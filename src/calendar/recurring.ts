/**
 * Recurring event utilities for RRULE formatting and occurrence calculation
 */

import { DateTime } from "luxon";
import type { CalendarClient } from "./client.js";

export interface RRuleInput {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: string;
  endDate?: string; // YYYY-MM-DD format
  timezone: string;
}

/**
 * Formats an RRULE string for Google Calendar API
 *
 * @param input - Recurrence parameters
 * @returns RRULE string (e.g., "RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20260331T215959Z")
 *
 * CRITICAL: UNTIL must be in UTC with 'Z' suffix per RFC 5545
 */
export function formatRRule(input: RRuleInput): string {
  const parts: string[] = [`FREQ=${input.frequency}`];

  // Add day of week for weekly recurrence
  if (input.frequency === "WEEKLY" && input.dayOfWeek) {
    parts.push(`BYDAY=${input.dayOfWeek}`);
  }

  // Add UNTIL if end date provided
  if (input.endDate) {
    // Parse end date in timezone, get end of day, convert to UTC
    const endDateTime = DateTime.fromISO(input.endDate, {
      zone: input.timezone,
    })
      .endOf("day")
      .toUTC();

    // Format as yyyyMMdd'T'HHmmss'Z'
    const utcString = endDateTime.toFormat("yyyyMMdd'T'HHmmss'Z'");
    parts.push(`UNTIL=${utcString}`);
  }

  return `RRULE:${parts.join(";")}`;
}

/**
 * Calculates the next N occurrences of a recurring event
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param startTime - Start time in HH:mm format
 * @param frequency - Recurrence frequency
 * @param count - Number of occurrences to calculate
 * @param timezone - IANA timezone
 * @returns Array of DateTime objects for next N occurrences
 */
export function calculateNextOccurrences(
  startDate: string,
  startTime: string,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY",
  count: number,
  timezone: string,
): DateTime[] {
  const occurrences: DateTime[] = [];

  // Parse start date + time in timezone
  const [hours, minutes] = startTime.split(":").map(Number);
  let current = DateTime.fromISO(startDate, { zone: timezone }).set({
    hour: hours,
    minute: minutes,
  });

  for (let i = 0; i < count; i++) {
    occurrences.push(current);

    // Advance by frequency
    if (frequency === "DAILY") {
      current = current.plus({ days: 1 });
    } else if (frequency === "WEEKLY") {
      current = current.plus({ weeks: 1 });
    } else if (frequency === "MONTHLY") {
      current = current.plus({ months: 1 });
    }
  }

  return occurrences;
}

/**
 * Trims a recurring event to end before a given date
 *
 * Used for "alle zukünftigen löschen" - preserves past instances while removing future ones
 *
 * @param client - Calendar client
 * @param recurringEventId - ID of the recurring event
 * @param beforeDate - Date (YYYY-MM-DD) to trim before
 * @param timezone - IANA timezone
 */
export async function trimRecurringEvent(
  client: CalendarClient,
  recurringEventId: string,
  beforeDate: string,
  timezone: string,
): Promise<void> {
  // Fetch the existing recurring event
  const response = await client.calendar.events.get({
    calendarId: client.calendarId,
    eventId: recurringEventId,
  });

  if (!response.data.recurrence || response.data.recurrence.length === 0) {
    throw new Error("Event is not a recurring event");
  }

  // Parse the existing RRULE
  const existingRrule = response.data.recurrence[0];

  // Calculate UNTIL date: beforeDate - 1 day, end of day, in UTC
  const untilDate = DateTime.fromISO(beforeDate, { zone: timezone })
    .minus({ days: 1 })
    .endOf("day")
    .toUTC();

  const untilString = untilDate.toFormat("yyyyMMdd'T'HHmmss'Z'");

  // Replace/add UNTIL in the RRULE
  let updatedRrule: string;
  if (existingRrule.includes("UNTIL=")) {
    // Replace existing UNTIL
    updatedRrule = existingRrule.replace(/UNTIL=[^;]+/, `UNTIL=${untilString}`);
  } else {
    // Append UNTIL
    updatedRrule = `${existingRrule};UNTIL=${untilString}`;
  }

  // Update the event
  await client.calendar.events.patch({
    calendarId: client.calendarId,
    eventId: recurringEventId,
    requestBody: {
      recurrence: [updatedRrule],
    },
  });
}
