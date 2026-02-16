/**
 * Conflict detection for calendar events
 */

import { DateTime } from "luxon";
import type { CalendarClient } from "./client.js";
import { CalendarEvent, CalendarError } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Finds conflicting events for a new event
 *
 * @param client - Calendar client
 * @param newEvent - New event with start and end times (ISO datetime strings)
 * @returns Array of conflicting events (empty if no conflicts)
 *
 * Note: All-day events are excluded from conflict detection per user decision
 */
export async function findConflicts(
  client: CalendarClient,
  newEvent: { start: string; end: string },
): Promise<CalendarEvent[]> {
  try {
    // Parse new event times
    const newStart = DateTime.fromISO(newEvent.start, {
      zone: client.timezone,
    });
    const newEnd = DateTime.fromISO(newEvent.end, { zone: client.timezone });

    // Calculate day boundaries for query
    const dayStart = newStart.startOf("day");
    const dayEnd = newStart.endOf("day");

    logger.info(
      {
        calendarId: client.calendarId,
        newEventStart: newEvent.start,
        newEventEnd: newEvent.end,
      },
      "Finding conflicting events",
    );

    // Query Google Calendar for events on the same day
    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin: dayStart.toISO()!,
      timeMax: dayEnd.toISO()!,
      singleEvents: true, // CRITICAL: expand recurring events into instances
      orderBy: "startTime",
    });

    const items = response.data.items || [];

    // Filter for conflicting events
    const conflicts: CalendarEvent[] = [];

    for (const item of items) {
      // Skip all-day events (per user decision)
      if (item.start?.date) {
        continue;
      }

      // Check for timed events
      if (item.start?.dateTime && item.end?.dateTime) {
        const eventStart = DateTime.fromISO(item.start.dateTime, {
          zone: client.timezone,
        });
        const eventEnd = DateTime.fromISO(item.end.dateTime, {
          zone: client.timezone,
        });

        // Check for overlap: newStart < eventEnd && newEnd > eventStart
        if (newStart < eventEnd && newEnd > eventStart) {
          conflicts.push({
            id: item.id!,
            summary: item.summary || "(No title)",
            startTime: item.start.dateTime,
            endTime: item.end.dateTime,
            isAllDay: false,
            description: item.description || undefined,
            recurringEventId: item.recurringEventId || undefined,
          });
        }
      }
    }

    logger.info(
      {
        calendarId: client.calendarId,
        conflictCount: conflicts.length,
      },
      "Conflict detection complete",
    );

    return conflicts;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: number }).code;
      if (code === 403) {
        throw new CalendarError(
          "PERMISSION_DENIED",
          "Calendar access denied. Check service account permissions.",
        );
      }
      if (code === 429) {
        throw new CalendarError(
          "RATE_LIMITED",
          "Calendar API rate limit exceeded.",
        );
      }
    }

    logger.error(
      { error, calendarId: client.calendarId, newEvent },
      "Failed to find conflicts",
    );
    throw new CalendarError("API_ERROR", "Failed to find conflicting events");
  }
}
