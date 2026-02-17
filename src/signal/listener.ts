/**
 * Signal Message Listener
 *
 * Event handler for incoming Signal messages with full processing pipeline:
 * receive -> deduplicate -> state -> LLM intent extraction -> calendar operations -> response -> send
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { SignalClient } from "./client.js";
import type { SignalEnvelope } from "./types.js";
import type { CalendarIntent } from "../llm/types.js";
import type { CalendarClient } from "../calendar/client.js";
import type { FamilyWhitelist } from "../config/family-members.js";
import {
  CalendarEvent,
  CalendarError,
  CreateEventInput,
  CreateRecurringEventInput,
  CreateAllDayEventInput,
} from "../calendar/types.js";
import {
  listEvents,
  findEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  createRecurringEvent,
  createAllDayEvent,
} from "../calendar/operations.js";
import {
  inferEventDate,
  formatEventTime,
  formatDayName,
  formatEventDate,
  createEventDateTime,
  createEventEndDateTime,
} from "../calendar/timezone.js";
import { DateTime } from "luxon";
import { sendSignalMessage } from "./sender.js";
import { ConversationStore } from "../state/conversation.js";
import { IdempotencyStore } from "../state/idempotency.js";
import { extractIntent } from "../llm/intent.js";
import { logger } from "../utils/logger.js";
import { HELP_TEXT } from "../config/constants.js";
import { findConflicts } from "../calendar/conflicts.js";
import {
  calculateNextOccurrences,
  trimRecurringEvent,
} from "../calendar/recurring.js";

/**
 * Dependencies for the message listener
 */
export interface MessageListenerDeps {
  signalClient: SignalClient;
  anthropicClient: Anthropic;
  conversationStore: ConversationStore;
  idempotencyStore: IdempotencyStore;
  calendarClient: CalendarClient;
  familyWhitelist: FamilyWhitelist;
}

/**
 * Detect if message is a command (help/cancel)
 *
 * @param text - Message text to check
 * @returns Command type or null if not a command
 */
function detectCommand(text: string): "help" | "cancel" | null {
  const normalized = text.trim().toLowerCase();
  if (["hilfe", "help", "?"].includes(normalized)) return "help";
  if (["abbrechen", "cancel", "reset"].includes(normalized)) return "cancel";
  return null;
}

/**
 * Handle command execution (help/cancel)
 *
 * Commands always reset conversation state and don't invoke LLM.
 *
 * @param command - Command type
 * @param phoneNumber - Sender phone number
 * @param replyTo - Where to send the response (groupId or phoneNumber)
 * @param deps - Dependencies
 */
async function handleCommand(
  command: "help" | "cancel",
  phoneNumber: string,
  replyTo: string,
  deps: MessageListenerDeps,
): Promise<void> {
  // Always reset conversation state on any command
  await deps.conversationStore.clearState(phoneNumber);

  const response =
    command === "help" ? HELP_TEXT : "Alles klar, was kann ich für dich tun?";

  await sendSignalMessage(deps.signalClient, replyTo, response);
  logger.info({ phoneNumber, command }, "Command executed, state reset");
}

/**
 * Handle calendar intent and perform actual operations
 *
 * All responses are in German with casual du-form tone.
 *
 * @param intent - Extracted intent from LLM
 * @param deps - Dependencies including calendar client
 * @param memberName - Family member name for personalization (optional)
 * @returns Response message text in German
 */
async function handleIntent(
  intent: CalendarIntent,
  deps: MessageListenerDeps,
  memberName?: string,
  phoneNumber?: string,
): Promise<string> {
  const tz = deps.calendarClient.timezone;

  // Check for pending conflict confirmation
  if (phoneNumber) {
    const state = await deps.conversationStore.getState(phoneNumber);

    if (state?.currentIntent === "awaiting_conflict_confirmation") {
      const userResponse = intent.entities.title?.toLowerCase() || "";
      const isAffirmative =
        userResponse.includes("ja") ||
        userResponse.includes("ok") ||
        userResponse.includes("trotzdem") ||
        userResponse.includes("yes") ||
        userResponse.includes("klar") ||
        userResponse.includes("mach");

      if (isAffirmative) {
        // Retrieve pending event and create it
        const pendingEvent =
          state.pendingEntities as unknown as CreateEventInput & {
            recurrence?: any;
          };

        let confirmationMessage: string;

        // Check if it's a recurring event
        if (pendingEvent.recurrence) {
          const recurringInput: CreateRecurringEventInput = {
            summary: pendingEvent.summary,
            date: pendingEvent.date,
            time: pendingEvent.time,
            durationMinutes: pendingEvent.durationMinutes || 60,
            recurrence: {
              frequency: pendingEvent.recurrence.frequency,
              dayOfWeek: pendingEvent.recurrence.day_of_week,
              endDate: pendingEvent.recurrence.end_date,
            },
          };

          const { event, nextOccurrences } = await createRecurringEvent(
            deps.calendarClient,
            recurringInput,
          );

          // Build frequency pattern in German
          let pattern: string;
          if (pendingEvent.recurrence.frequency === "DAILY") {
            pattern = "täglich";
          } else if (pendingEvent.recurrence.frequency === "WEEKLY") {
            const dayMap: Record<string, string> = {
              MO: "Montag",
              TU: "Dienstag",
              WE: "Mittwoch",
              TH: "Donnerstag",
              FR: "Freitag",
              SA: "Samstag",
              SU: "Sonntag",
            };
            const day = pendingEvent.recurrence.day_of_week;
            pattern = day ? `jeden ${dayMap[day]}` : "wöchentlich";
          } else {
            pattern = "monatlich";
          }

          const time = formatEventTime(event.startTime, tz);
          confirmationMessage = `${event.summary} ${pattern} um ${time} erstellt. Nächste: ${nextOccurrences.join(", ")}`;

          if (pendingEvent.recurrence.end_date) {
            const endDate = DateTime.fromISO(pendingEvent.recurrence.end_date, {
              zone: tz,
            });
            confirmationMessage += ` Endet: ${endDate.toFormat("dd.MM.yyyy")}`;
          }
        } else {
          // Regular event
          const createdEvent = await createEvent(
            deps.calendarClient,
            pendingEvent,
          );
          const formattedDay = formatDayName(pendingEvent.date, tz);
          const formattedTime = formatEventTime(createdEvent.startTime, tz);
          const formattedEndTime = formatEventTime(createdEvent.endTime, tz);
          confirmationMessage = `Klar, hab ich eingetragen! ${pendingEvent.summary}, ${formattedDay} ${formattedTime}-${formattedEndTime}`;
        }

        await deps.conversationStore.clearState(phoneNumber);
        return confirmationMessage;
      } else {
        // User declined
        await deps.conversationStore.clearState(phoneNumber);
        return "Alles klar, Termin wurde nicht erstellt.";
      }
    }

    // Check for pending delete scope confirmation
    if (state?.currentIntent === "awaiting_delete_scope") {
      const userResponse = intent.entities.title?.toLowerCase() || "";
      const isThisOnly =
        userResponse.includes("1") ||
        userResponse.includes("dieses") ||
        userResponse.includes("nur");
      const isAllFuture =
        userResponse.includes("2") ||
        userResponse.includes("alle") ||
        userResponse.includes("zukünftige");

      if (isThisOnly) {
        // Delete single instance
        const eventId = state.pendingEntities.eventId as string;
        await deleteEvent(deps.calendarClient, eventId);
        await deps.conversationStore.clearState(phoneNumber);
        return "Erledigt! Nur dieser Termin wurde gelöscht.";
      } else if (isAllFuture) {
        // Delete all future instances
        const recurringEventId = state.pendingEntities
          .recurringEventId as string;
        const instanceStartDate = state.pendingEntities
          .instanceStartDate as string;
        await trimRecurringEvent(
          deps.calendarClient,
          recurringEventId,
          instanceStartDate,
          tz,
        );
        const instanceDate = DateTime.fromISO(instanceStartDate, { zone: tz });
        await deps.conversationStore.clearState(phoneNumber);
        return `Alle zukünftigen Termine ab ${instanceDate.toFormat("dd.MM.")} gelöscht.`;
      } else {
        return "Bitte wähl 1 für nur diesen Termin oder 2 für alle zukünftigen.";
      }
    }
  }

  try {
    switch (intent.intent) {
      case "greeting": {
        const nameGreeting = memberName ? `Hey ${memberName}!` : "Hey!";
        return `${nameGreeting} Ich bin dein Familienkalender-Bot. Schreib mir einfach, was du wissen oder eintragen willst!`;
      }

      case "help":
        return HELP_TEXT;

      case "query_events": {
        // Use provided date or default to today
        const queryDate =
          intent.entities.date ||
          DateTime.now().setZone(tz).toFormat("yyyy-MM-dd");

        // Multi-day query (e.g., "Wochenende" → Saturday + Sunday)
        if (intent.entities.date_end) {
          const days: string[] = [];
          let current = DateTime.fromISO(queryDate, { zone: tz });
          const end = DateTime.fromISO(intent.entities.date_end, { zone: tz });

          while (current <= end) {
            days.push(current.toFormat("yyyy-MM-dd"));
            current = current.plus({ days: 1 });
          }

          const parts: string[] = [];
          for (const day of days) {
            const events = await listEvents(deps.calendarClient, day);
            const dayName = formatDayName(day, tz);
            if (events.length === 0) {
              parts.push(`${dayName}: frei`);
            } else {
              const formatted = events
                .map((event) => {
                  if (event.isAllDay) return event.summary;
                  const time = formatEventTime(event.startTime, tz);
                  return `${time} - ${event.summary}`;
                })
                .join(" | ");
              parts.push(`${dayName}: ${formatted}`);
            }
          }
          return parts.join("\n");
        }

        const events = await listEvents(deps.calendarClient, queryDate);

        if (events.length === 0) {
          return `${formatDayName(queryDate, tz)} ist frei!`;
        }

        // Format events in compact one-line-per-event format
        const formattedEvents = events
          .map((event) => {
            if (event.isAllDay) {
              return event.summary;
            }
            const time = formatEventTime(event.startTime, tz);
            return `${time} - ${event.summary}`;
          })
          .join(" | ");

        return formattedEvents;
      }

      case "create_event": {
        // Check for clarification needed or low confidence
        if (intent.confidence < 0.7 || intent.clarification_needed) {
          return (
            intent.clarification_needed ||
            "Das hab ich nicht ganz verstanden. Schreib mir einfach, was du mit dem Kalender machen möchtest!"
          );
        }

        // Handle all-day / multi-day events
        if (
          intent.entities.all_day &&
          intent.entities.date &&
          intent.entities.date_end
        ) {
          const title = intent.entities.title || "Termin";
          const startDate = intent.entities.date;
          const endDateRaw = intent.entities.date_end;

          // Google Calendar exclusive end date: add 1 day to the user's end date
          const endDateExclusive = DateTime.fromISO(endDateRaw, { zone: tz })
            .plus({ days: 1 })
            .toFormat("yyyy-MM-dd");

          const allDayInput: CreateAllDayEventInput = {
            summary: title,
            startDate,
            endDate: endDateExclusive,
          };

          const createdEvent = await createAllDayEvent(
            deps.calendarClient,
            allDayInput,
          );

          // Format confirmation with date range
          const startFormatted = DateTime.fromISO(startDate, { zone: tz })
            .setLocale("de")
            .toFormat("d. MMM");
          const endFormatted = DateTime.fromISO(endDateRaw, { zone: tz })
            .setLocale("de")
            .toFormat("d. MMM");

          return `Klar, hab ich eingetragen! ${title}, ${startFormatted} bis ${endFormatted} (ganztägig)`;
        }

        // Check for missing time
        if (!intent.entities.time) {
          return "Zu welcher Uhrzeit soll ich das eintragen?";
        }

        const title = intent.entities.title || "Termin";
        const time = intent.entities.time;

        // Infer date if not provided
        const date = intent.entities.date || inferEventDate(time, tz);

        // Calculate duration
        let durationMinutes = 60; // default
        if (intent.entities.end_time) {
          // Calculate duration from time range
          const [startHour, startMin] = time.split(":").map(Number);
          const [endHour, endMin] = intent.entities.end_time
            .split(":")
            .map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          durationMinutes = endMinutes - startMinutes;
        } else if (intent.entities.duration_minutes) {
          durationMinutes = intent.entities.duration_minutes;
        }

        // Calculate start/end times for conflict detection
        const startDt = createEventDateTime(date, time, tz);
        const endDt = createEventEndDateTime(date, time, durationMinutes, tz);

        // Check for conflicts
        const conflicts = await findConflicts(deps.calendarClient, {
          start: startDt.dateTime,
          end: endDt.dateTime,
        });

        if (conflicts.length > 0 && phoneNumber) {
          // Format conflict list in German
          const conflictList = conflicts
            .map((conflict) => {
              const conflictTime = formatEventTime(conflict.startTime, tz);
              return `${conflict.summary} um ${conflictTime} Uhr`;
            })
            .join(", ");

          // Save pending event in conversation state
          await deps.conversationStore.saveState({
            phoneNumber,
            currentIntent: "awaiting_conflict_confirmation",
            pendingEntities: {
              summary: title,
              date,
              time,
              durationMinutes,
              recurrence: intent.entities.recurrence,
            },
            messageHistory: [],
            lastMessageAt: new Date(),
          });

          return `Achtung: Überschneidung mit ${conflictList}. Trotzdem erstellen?`;
        }

        // No conflicts - proceed with creation
        const eventInput: CreateEventInput = {
          summary: title,
          date,
          time,
          durationMinutes,
        };

        // Check if it's a recurring event
        if (intent.entities.recurrence) {
          const recurringInput: CreateRecurringEventInput = {
            ...eventInput,
            recurrence: {
              frequency: intent.entities.recurrence.frequency,
              dayOfWeek: intent.entities.recurrence.day_of_week,
              endDate: intent.entities.recurrence.end_date,
            },
          };

          const { event, nextOccurrences } = await createRecurringEvent(
            deps.calendarClient,
            recurringInput,
          );

          // Build frequency pattern in German
          let pattern: string;
          if (intent.entities.recurrence.frequency === "DAILY") {
            pattern = "täglich";
          } else if (intent.entities.recurrence.frequency === "WEEKLY") {
            const dayMap: Record<string, string> = {
              MO: "Montag",
              TU: "Dienstag",
              WE: "Mittwoch",
              TH: "Donnerstag",
              FR: "Freitag",
              SA: "Samstag",
              SU: "Sonntag",
            };
            const day = intent.entities.recurrence.day_of_week;
            pattern = day ? `jeden ${dayMap[day]}` : "wöchentlich";
          } else {
            pattern = "monatlich";
          }

          const formattedTime = formatEventTime(event.startTime, tz);
          let confirmationMessage = `${title} ${pattern} um ${formattedTime} erstellt. Nächste: ${nextOccurrences.join(", ")}`;

          if (intent.entities.recurrence.end_date) {
            const endDate = DateTime.fromISO(
              intent.entities.recurrence.end_date,
              { zone: tz },
            );
            confirmationMessage += ` Endet: ${endDate.toFormat("dd.MM.yyyy")}`;
          }

          return confirmationMessage;
        }

        // Regular event creation
        const createdEvent = await createEvent(deps.calendarClient, eventInput);

        // Format confirmation
        const formattedDay = formatDayName(date, tz);
        const formattedTime = formatEventTime(createdEvent.startTime, tz);
        const formattedEndTime = formatEventTime(createdEvent.endTime, tz);

        return `Klar, hab ich eingetragen! ${title}, ${formattedDay} ${formattedTime}-${formattedEndTime}`;
      }

      case "update_event": {
        // Check for clarification needed or low confidence
        if (intent.confidence < 0.7 || intent.clarification_needed) {
          return (
            intent.clarification_needed ||
            "Das hab ich nicht ganz verstanden. Welchen Termin möchtest du ändern?"
          );
        }

        // Determine search date
        const searchDate =
          intent.entities.date ||
          DateTime.now().setZone(tz).toFormat("yyyy-MM-dd");

        // Determine search date end (30 days if no date specified)
        const searchDateEnd = intent.entities.date
          ? undefined
          : DateTime.now()
              .setZone(tz)
              .plus({ days: 30 })
              .toFormat("yyyy-MM-dd");

        // Find events
        const searchQuery =
          intent.entities.event_search_query || intent.entities.title;
        const searchResult = await findEvents(
          deps.calendarClient,
          searchDate,
          searchQuery,
          searchDateEnd,
        );

        if ("notFound" in searchResult) {
          return "Ich finde keinen passenden Termin.";
        }

        if ("candidates" in searchResult) {
          // Multiple matches - ask user to choose
          const options = searchResult.candidates
            .map((event, index) => {
              const time = event.isAllDay
                ? "ganztägig"
                : formatEventTime(event.startTime, tz);
              return `${index + 1}) ${event.summary} ${time}`;
            })
            .join("\n");
          return `Welchen meinst du?\n${options}`;
        }

        // Single event found - apply update
        const event = searchResult.event;
        const updateInput: any = {};

        if (intent.entities.title) {
          updateInput.summary = intent.entities.title;
        }
        if (intent.entities.date) {
          updateInput.date = intent.entities.date;
        }
        if (intent.entities.time) {
          updateInput.time = intent.entities.time;
        }
        if (intent.entities.duration_minutes) {
          updateInput.durationMinutes = intent.entities.duration_minutes;
        }

        const updatedEvent = await updateEvent(
          deps.calendarClient,
          event.id,
          updateInput,
        );

        // Format confirmation
        const newDay = formatDayName(
          DateTime.fromISO(updatedEvent.startTime)
            .setZone(tz)
            .toFormat("yyyy-MM-dd"),
          tz,
        );
        const newTime = formatEventTime(updatedEvent.startTime, tz);

        return `Geändert: ${updatedEvent.summary} jetzt ${newDay} ${newTime}`;
      }

      case "delete_event": {
        // Check for clarification needed or low confidence
        if (intent.confidence < 0.7 || intent.clarification_needed) {
          return (
            intent.clarification_needed ||
            "Das hab ich nicht ganz verstanden. Welchen Termin möchtest du löschen?"
          );
        }

        // Determine search date
        const searchDate =
          intent.entities.date ||
          DateTime.now().setZone(tz).toFormat("yyyy-MM-dd");

        // Determine search date end (30 days if no date specified)
        const searchDateEnd = intent.entities.date
          ? undefined
          : DateTime.now()
              .setZone(tz)
              .plus({ days: 30 })
              .toFormat("yyyy-MM-dd");

        // Find events
        const searchQuery =
          intent.entities.event_search_query || intent.entities.title;
        const searchResult = await findEvents(
          deps.calendarClient,
          searchDate,
          searchQuery,
          searchDateEnd,
        );

        if ("notFound" in searchResult) {
          return "Ich finde keinen passenden Termin.";
        }

        if ("candidates" in searchResult) {
          // Multiple matches - ask user to choose
          const options = searchResult.candidates
            .map((event, index) => {
              const time = event.isAllDay
                ? "ganztägig"
                : formatEventTime(event.startTime, tz);
              return `${index + 1}) ${event.summary} ${time}`;
            })
            .join("\n");
          return `Welchen meinst du?\n${options}`;
        }

        // Single event found
        const event = searchResult.event;

        // Check if it's a recurring event instance
        if (event.recurringEventId && phoneNumber) {
          // Ask user for deletion scope
          await deps.conversationStore.saveState({
            phoneNumber,
            currentIntent: "awaiting_delete_scope",
            pendingEntities: {
              eventId: event.id,
              recurringEventId: event.recurringEventId,
              instanceStartDate: event.startTime,
            },
            messageHistory: [],
            lastMessageAt: new Date(),
          });

          return `Das ist ein wiederkehrender Termin. Nur dieses Mal oder alle zukünftigen löschen?\n1) Nur dieses Mal\n2) Alle zukünftigen`;
        }

        // Regular event - delete it
        await deleteEvent(deps.calendarClient, event.id);

        // Format confirmation
        const formattedDay = formatDayName(
          DateTime.fromISO(event.startTime).setZone(tz).toFormat("yyyy-MM-dd"),
          tz,
        );

        return `Erledigt! ${event.summary} am ${formattedDay} wurde gelöscht.`;
      }

      case "unclear":
        return (
          intent.clarification_needed ||
          "Das hab ich nicht ganz verstanden. Schreib mir einfach, was du mit dem Kalender machen möchtest!"
        );

      default:
        return "Das hab ich nicht ganz verstanden. Schreib mir einfach, was du mit dem Kalender machen möchtest!";
    }
  } catch (error) {
    // Handle calendar-specific errors
    if (error instanceof CalendarError) {
      switch (error.code) {
        case "PERMISSION_DENIED":
          return "Zugriff auf den Kalender verweigert. Bitte prüf die Freigabe-Einstellungen.";
        case "RATE_LIMITED":
          return "Zu viele Anfragen, probier's gleich nochmal.";
        case "NOT_FOUND":
          return "Den Termin gibt's nicht mehr.";
        case "API_ERROR":
          return "Fehler beim Kalender-Zugriff. Probier's nochmal.";
      }
    }

    // Re-throw unknown errors to be caught by outer handler
    throw error;
  }
}

/**
 * Setup the Signal message listener
 *
 * Registers an event handler that:
 * 1. Receives incoming Signal messages
 * 2. Filters out non-text and group messages
 * 3. Checks idempotency to prevent duplicate processing
 * 4. Extracts intent via Claude LLM
 * 5. Performs calendar operations
 * 6. Sends response via Signal
 * 7. Manages conversation state
 *
 * Error handling ensures individual message failures don't crash the daemon.
 *
 * @param deps - Dependencies (SignalClient, Anthropic, CalendarClient, stores)
 */
export function setupMessageListener(deps: MessageListenerDeps): void {
  logger.info("Setting up Signal message listener");

  // Track recent rejection messages to prevent spam loops
  const recentRejections = new Map<string, number>();

  // Register the message event handler
  // signal-sdk emits response.params which wraps envelope: { envelope: {...} }
  deps.signalClient.on("message", async (params: any) => {
    let phoneNumber: string | undefined;
    let messageId: string | undefined;
    let replyTo: string | undefined;

    try {
      // Log raw params to understand the structure
      logger.debug({ params: JSON.stringify(params) }, "Raw message event");

      // Extract envelope — signal-sdk wraps it in { envelope: {...} }
      const envelope: SignalEnvelope = params?.envelope || params;

      // Ignore sync messages (our own sent messages echoed back)
      if (envelope.syncMessage || !envelope.dataMessage) {
        logger.debug("Ignoring sync/non-data message");
        return;
      }

      // Extract message data from envelope
      phoneNumber = envelope.source || envelope.sourceNumber;
      messageId = envelope.timestamp?.toString();
      const text = envelope.dataMessage?.message || "";
      const groupId = envelope.dataMessage?.groupInfo?.groupId;

      // Compute reply target - send to group if from group, otherwise to sender
      replyTo = groupId || phoneNumber;

      logger.debug(
        {
          phoneNumber,
          messageId,
          hasText: !!text,
          isGroup: !!envelope.dataMessage?.groupInfo,
        },
        "Received Signal message",
      );

      // Access control - reject unknown senders (send rejection at most once per 5 minutes)
      if (!deps.familyWhitelist.isAllowed(phoneNumber)) {
        logger.warn({ phoneNumber }, "Message from unknown sender rejected");
        const lastRejection = recentRejections.get(phoneNumber) || 0;
        const now = Date.now();
        if (now - lastRejection > 5 * 60 * 1000) {
          recentRejections.set(phoneNumber, now);
          await sendSignalMessage(
            deps.signalClient,
            replyTo,
            "Entschuldigung, ich bin ein privater Familienbot und kann nur mit registrierten Familienmitgliedern kommunizieren.",
          );
        }
        return;
      }

      // Non-text message rejection
      if (!text) {
        logger.debug({ messageId, phoneNumber }, "Non-text message rejected");
        await sendSignalMessage(
          deps.signalClient,
          replyTo,
          "Ich kann leider nur Textnachrichten verarbeiten.",
        );
        return;
      }

      // Idempotency check
      const isAlreadyProcessed =
        await deps.idempotencyStore.isProcessed(messageId);

      if (isAlreadyProcessed) {
        logger.debug(
          { messageId, phoneNumber },
          "Duplicate message detected, skipping",
        );
        return;
      }

      // Mark as processed BEFORE processing to prevent race conditions
      await deps.idempotencyStore.markProcessed(messageId);

      logger.info(
        { phoneNumber, messageId, text },
        "Processing new Signal message",
      );

      // Command detection - handle help/cancel before LLM
      const command = detectCommand(text);
      if (command) {
        await handleCommand(command, phoneNumber, replyTo, deps);
        return;
      }

      // Get conversation state
      const state = await deps.conversationStore.getState(phoneNumber);

      // Add user message to history
      await deps.conversationStore.addToHistory(phoneNumber, "user", text);

      // Extract intent via Claude LLM (pass timezone for correct weekday resolution)
      const intent = await extractIntent(
        deps.anthropicClient,
        text,
        state?.messageHistory || [],
        deps.calendarClient.timezone,
      );

      logger.info(
        {
          phoneNumber,
          intent: intent.intent,
          confidence: intent.confidence,
          hasEntities: Object.keys(intent.entities).length > 0,
        },
        "Intent extracted successfully",
      );

      // Get member name for personalization
      const memberName = deps.familyWhitelist.getName(phoneNumber);

      // Handle intent with calendar operations
      const response = await handleIntent(
        intent,
        deps,
        memberName,
        phoneNumber,
      );

      // Send response via Signal
      await sendSignalMessage(deps.signalClient, replyTo, response);

      // Add assistant response to history
      await deps.conversationStore.addToHistory(
        phoneNumber,
        "assistant",
        response,
      );

      logger.info(
        { phoneNumber, messageId, intent: intent.intent },
        "Message processed successfully",
      );
    } catch (error) {
      logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          phoneNumber,
          messageId,
        },
        "Error processing Signal message",
      );

      // Attempt to send error response to user
      if (replyTo) {
        try {
          await sendSignalMessage(
            deps.signalClient,
            replyTo,
            "Entschuldigung, da ist was schiefgelaufen. Probier's nochmal.",
          );
        } catch (sendError) {
          logger.error(
            {
              err:
                sendError instanceof Error
                  ? sendError
                  : new Error(String(sendError)),
              phoneNumber,
            },
            "Failed to send error response to user",
          );
        }
      }

      // Do NOT re-throw - event handlers should not crash the daemon
    }
  });

  logger.info("Signal message listener setup complete");
}
