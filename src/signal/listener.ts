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
import {
  CalendarEvent,
  CalendarError,
  CreateEventInput,
} from "../calendar/types.js";
import {
  listEvents,
  findEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../calendar/operations.js";
import {
  inferEventDate,
  formatEventTime,
  formatDayName,
  formatEventDate,
  createEventEndDateTime,
} from "../calendar/timezone.js";
import { DateTime } from "luxon";
import { sendSignalMessage } from "./sender.js";
import { ConversationStore } from "../state/conversation.js";
import { IdempotencyStore } from "../state/idempotency.js";
import { extractIntent } from "../llm/intent.js";
import { logger } from "../utils/logger.js";

/**
 * Dependencies for the message listener
 */
export interface MessageListenerDeps {
  signalClient: SignalClient;
  anthropicClient: Anthropic;
  conversationStore: ConversationStore;
  idempotencyStore: IdempotencyStore;
  calendarClient: CalendarClient;
}

/**
 * Handle calendar intent and perform actual operations
 *
 * All responses are in German with casual du-form tone.
 *
 * @param intent - Extracted intent from LLM
 * @param deps - Dependencies including calendar client
 * @returns Response message text in German
 */
async function handleIntent(
  intent: CalendarIntent,
  deps: MessageListenerDeps,
): Promise<string> {
  const tz = deps.calendarClient.timezone;

  try {
    switch (intent.intent) {
      case "greeting":
        return "Hey! Ich bin dein Familienkalender-Bot. Schreib mir einfach, was du wissen oder eintragen willst!";

      case "help":
        return `Das kann ich für dich tun:
- Termine anzeigen: "Was steht heute an?"
- Termin eintragen: "Trag Fußball Dienstag um 16 Uhr ein"
- Termin verschieben: "Verschieb den Zahnarzt auf Donnerstag"
- Termin löschen: "Streich das Fußball diese Woche"`;

      case "query_events": {
        // Use provided date or default to today
        const queryDate =
          intent.entities.date ||
          DateTime.now().setZone(tz).toFormat("yyyy-MM-dd");

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

        const eventInput: CreateEventInput = {
          summary: title,
          date,
          time,
          durationMinutes,
        };

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

        // Find events
        const searchQuery =
          intent.entities.event_search_query || intent.entities.title;
        const searchResult = await findEvents(
          deps.calendarClient,
          searchDate,
          searchQuery,
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

        // Find events
        const searchQuery =
          intent.entities.event_search_query || intent.entities.title;
        const searchResult = await findEvents(
          deps.calendarClient,
          searchDate,
          searchQuery,
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

        // Single event found - delete it
        const event = searchResult.event;
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

  // Register the message event handler
  // signal-sdk emits response.params which wraps envelope: { envelope: {...} }
  deps.signalClient.on("message", async (params: any) => {
    let phoneNumber: string | undefined;
    let messageId: string | undefined;

    try {
      // Log raw params to understand the structure
      logger.debug({ params: JSON.stringify(params) }, "Raw message event");

      // Extract envelope — signal-sdk wraps it in { envelope: {...} }
      const envelope: SignalEnvelope = params?.envelope || params;

      // Extract message data from envelope
      phoneNumber = envelope.source || envelope.sourceNumber;
      messageId = envelope.timestamp?.toString();
      const text = envelope.dataMessage?.message || "";

      logger.debug(
        {
          phoneNumber,
          messageId,
          hasText: !!text,
          isGroup: !!envelope.dataMessage?.groupInfo,
        },
        "Received Signal message",
      );

      // Skip if no text (media-only messages, typing indicators, sync messages)
      if (!text) {
        logger.debug({ messageId }, "Skipping message without text content");
        return;
      }

      // Skip group messages (Phase 1: direct messages only)
      if (envelope.dataMessage?.groupInfo) {
        logger.debug(
          {
            messageId,
            groupId: envelope.dataMessage.groupInfo.groupId,
          },
          "Skipping group message (not supported in Phase 1)",
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

      // Get conversation state
      const state = await deps.conversationStore.getState(phoneNumber);

      // Add user message to history
      await deps.conversationStore.addToHistory(phoneNumber, "user", text);

      // Extract intent via Claude LLM
      const intent = await extractIntent(
        deps.anthropicClient,
        text,
        state?.messageHistory || [],
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

      // Handle intent with calendar operations
      const response = await handleIntent(intent, deps);

      // Send response via Signal
      await sendSignalMessage(deps.signalClient, phoneNumber, response);

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
      if (phoneNumber) {
        try {
          await sendSignalMessage(
            deps.signalClient,
            phoneNumber,
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
