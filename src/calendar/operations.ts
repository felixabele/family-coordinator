/**
 * Calendar CRUD operations for Google Calendar
 */

import { CalendarClient } from "./client.js";
import {
  CalendarEvent,
  CalendarError,
  CreateEventInput,
  UpdateEventInput,
  EventSearchResult,
  CreateRecurringEventInput,
  CreateAllDayEventInput,
} from "./types.js";
import {
  createEventDateTime,
  createEventEndDateTime,
  formatEventTime,
} from "./timezone.js";
import { formatRRule, calculateNextOccurrences } from "./recurring.js";
import { logger } from "../utils/logger.js";
import { DateTime } from "luxon";

/**
 * List all events for a specific date.
 */
export async function listEvents(
  client: CalendarClient,
  date: string,
): Promise<CalendarEvent[]> {
  const dayStart = DateTime.fromFormat(date, "yyyy-MM-dd", {
    zone: client.timezone,
  }).startOf("day");
  const dayEnd = dayStart.endOf("day");

  try {
    logger.info(
      { calendarId: client.calendarId, date },
      "Listing calendar events",
    );

    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin: dayStart.toISO()!,
      timeMax: dayEnd.toISO()!,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = response.data.items || [];

    const events: CalendarEvent[] = items.map((item) => {
      const isAllDay = !!item.start?.date;
      return {
        id: item.id!,
        summary: item.summary || "(No title)",
        startTime: item.start?.dateTime || item.start?.date || "",
        endTime: item.end?.dateTime || item.end?.date || "",
        isAllDay,
        description: item.description || undefined,
        recurringEventId: item.recurringEventId || undefined,
      };
    });

    logger.info(
      { calendarId: client.calendarId, date, count: events.length },
      "Events listed successfully",
    );

    return events;
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
      { error, calendarId: client.calendarId, date },
      "Failed to list events",
    );
    throw new CalendarError("API_ERROR", "Failed to list calendar events");
  }
}

/**
 * Find events by date and optional title hint.
 * Returns single event, multiple candidates, or not found.
 */
export async function findEvents(
  client: CalendarClient,
  date: string,
  titleHint?: string,
): Promise<EventSearchResult> {
  const dayStart = DateTime.fromFormat(date, "yyyy-MM-dd", {
    zone: client.timezone,
  }).startOf("day");
  const dayEnd = dayStart.endOf("day");

  try {
    logger.info(
      { calendarId: client.calendarId, date, titleHint },
      "Finding calendar events",
    );

    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin: dayStart.toISO()!,
      timeMax: dayEnd.toISO()!,
      singleEvents: true,
      orderBy: "startTime",
      q: titleHint,
    });

    const items = response.data.items || [];

    const events: CalendarEvent[] = items.map((item) => {
      const isAllDay = !!item.start?.date;
      return {
        id: item.id!,
        summary: item.summary || "(No title)",
        startTime: item.start?.dateTime || item.start?.date || "",
        endTime: item.end?.dateTime || item.end?.date || "",
        isAllDay,
        description: item.description || undefined,
        recurringEventId: item.recurringEventId || undefined,
      };
    });

    if (events.length === 0) {
      logger.info(
        { calendarId: client.calendarId, date, titleHint },
        "No events found",
      );
      return { notFound: true };
    }

    if (events.length === 1) {
      logger.info(
        {
          calendarId: client.calendarId,
          date,
          titleHint,
          eventId: events[0].id,
        },
        "Single event found",
      );
      return { event: events[0] };
    }

    logger.info(
      { calendarId: client.calendarId, date, titleHint, count: events.length },
      "Multiple events found",
    );
    return { candidates: events };
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
      { error, calendarId: client.calendarId, date, titleHint },
      "Failed to find events",
    );
    throw new CalendarError("API_ERROR", "Failed to find calendar events");
  }
}

/**
 * Create a new all-day calendar event.
 */
export async function createAllDayEvent(
  client: CalendarClient,
  input: CreateAllDayEventInput,
): Promise<CalendarEvent> {
  try {
    logger.info(
      {
        calendarId: client.calendarId,
        summary: input.summary,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      "Creating all-day calendar event",
    );

    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { date: input.startDate },
        end: { date: input.endDate },
      },
    });

    const item = response.data;
    const isAllDay = !!item.start?.date;

    const event: CalendarEvent = {
      id: item.id!,
      summary: item.summary || "(No title)",
      startTime: item.start?.dateTime || item.start?.date || "",
      endTime: item.end?.dateTime || item.end?.date || "",
      isAllDay,
      description: item.description || undefined,
      recurringEventId: item.recurringEventId || undefined,
    };

    logger.info(
      {
        calendarId: client.calendarId,
        eventId: event.id,
        summary: input.summary,
      },
      "All-day event created successfully",
    );

    return event;
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
      { error, calendarId: client.calendarId, input },
      "Failed to create all-day event",
    );
    throw new CalendarError(
      "API_ERROR",
      "Failed to create all-day calendar event",
    );
  }
}

/**
 * Create a new calendar event.
 */
export async function createEvent(
  client: CalendarClient,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  const durationMinutes = input.durationMinutes ?? 60;

  const start = createEventDateTime(input.date, input.time, client.timezone);
  const end = createEventEndDateTime(
    input.date,
    input.time,
    durationMinutes,
    client.timezone,
  );

  try {
    logger.info(
      {
        calendarId: client.calendarId,
        summary: input.summary,
        date: input.date,
        time: input.time,
      },
      "Creating calendar event",
    );

    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start,
        end,
      },
    });

    const item = response.data;
    const isAllDay = !!item.start?.date;

    const event: CalendarEvent = {
      id: item.id!,
      summary: item.summary || "(No title)",
      startTime: item.start?.dateTime || item.start?.date || "",
      endTime: item.end?.dateTime || item.end?.date || "",
      isAllDay,
      description: item.description || undefined,
      recurringEventId: item.recurringEventId || undefined,
    };

    logger.info(
      {
        calendarId: client.calendarId,
        eventId: event.id,
        summary: input.summary,
      },
      "Event created successfully",
    );

    return event;
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
      { error, calendarId: client.calendarId, input },
      "Failed to create event",
    );
    throw new CalendarError("API_ERROR", "Failed to create calendar event");
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent(
  client: CalendarClient,
  eventId: string,
  input: UpdateEventInput,
): Promise<CalendarEvent> {
  try {
    // If we're updating time or date, we need to recalculate start/end
    let updates: Record<string, unknown> = {};

    if (input.summary !== undefined) {
      updates.summary = input.summary;
    }

    // If both date and time are provided, we can set start/end directly
    if (input.date && input.time) {
      const durationMinutes = input.durationMinutes ?? 60;
      const start = createEventDateTime(
        input.date,
        input.time,
        client.timezone,
      );
      const end = createEventEndDateTime(
        input.date,
        input.time,
        durationMinutes,
        client.timezone,
      );
      updates.start = start;
      updates.end = end;
    } else if (input.time && !input.date) {
      // If only time is provided, we need to fetch existing event to get the date
      const existingEvent = await client.calendar.events.get({
        calendarId: client.calendarId,
        eventId,
      });

      const existingStartTime = existingEvent.data.start?.dateTime;
      if (existingStartTime) {
        const existingDate = DateTime.fromISO(existingStartTime)
          .setZone(client.timezone)
          .toFormat("yyyy-MM-dd");

        const durationMinutes = input.durationMinutes ?? 60;
        const start = createEventDateTime(
          existingDate,
          input.time,
          client.timezone,
        );
        const end = createEventEndDateTime(
          existingDate,
          input.time,
          durationMinutes,
          client.timezone,
        );
        updates.start = start;
        updates.end = end;
      }
    } else if (input.date && !input.time) {
      // If only date is provided, fetch existing event to get the time
      const existingEvent = await client.calendar.events.get({
        calendarId: client.calendarId,
        eventId,
      });

      const existingStartTime = existingEvent.data.start?.dateTime;
      if (existingStartTime) {
        const existingTime = formatEventTime(
          existingStartTime,
          client.timezone,
        );

        const durationMinutes = input.durationMinutes ?? 60;
        const start = createEventDateTime(
          input.date,
          existingTime,
          client.timezone,
        );
        const end = createEventEndDateTime(
          input.date,
          existingTime,
          durationMinutes,
          client.timezone,
        );
        updates.start = start;
        updates.end = end;
      }
    }

    logger.info(
      { calendarId: client.calendarId, eventId, updates },
      "Updating calendar event",
    );

    const response = await client.calendar.events.patch({
      calendarId: client.calendarId,
      eventId,
      requestBody: updates,
    });

    const item = response.data;
    const isAllDay = !!item.start?.date;

    const event: CalendarEvent = {
      id: item.id!,
      summary: item.summary || "(No title)",
      startTime: item.start?.dateTime || item.start?.date || "",
      endTime: item.end?.dateTime || item.end?.date || "",
      isAllDay,
      description: item.description || undefined,
      recurringEventId: item.recurringEventId || undefined,
    };

    logger.info(
      { calendarId: client.calendarId, eventId },
      "Event updated successfully",
    );

    return event;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: number }).code;
      if (code === 403) {
        throw new CalendarError(
          "PERMISSION_DENIED",
          "Calendar access denied. Check service account permissions.",
        );
      }
      if (code === 404 || code === 410) {
        throw new CalendarError("NOT_FOUND", "Calendar event not found.");
      }
      if (code === 429) {
        throw new CalendarError(
          "RATE_LIMITED",
          "Calendar API rate limit exceeded.",
        );
      }
    }

    logger.error(
      { error, calendarId: client.calendarId, eventId, input },
      "Failed to update event",
    );
    throw new CalendarError("API_ERROR", "Failed to update calendar event");
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  client: CalendarClient,
  eventId: string,
): Promise<void> {
  try {
    logger.info(
      { calendarId: client.calendarId, eventId },
      "Deleting calendar event",
    );

    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId,
    });

    logger.info(
      { calendarId: client.calendarId, eventId },
      "Event deleted successfully",
    );
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: number }).code;
      if (code === 404 || code === 410) {
        throw new CalendarError("NOT_FOUND", "Calendar event not found.");
      }
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
      { error, calendarId: client.calendarId, eventId },
      "Failed to delete event",
    );
    throw new CalendarError("API_ERROR", "Failed to delete calendar event");
  }
}

/**
 * Create a recurring calendar event.
 */
export async function createRecurringEvent(
  client: CalendarClient,
  input: CreateRecurringEventInput,
): Promise<{ event: CalendarEvent; nextOccurrences: string[] }> {
  const durationMinutes = input.durationMinutes ?? 60;

  // For weekly recurrence with a specific day, adjust start date to the next
  // occurrence of that weekday so the first instance lands on the right day
  let effectiveDate = input.date;
  if (input.recurrence.frequency === "WEEKLY" && input.recurrence.dayOfWeek) {
    const dayMap: Record<string, number> = {
      MO: 1,
      TU: 2,
      WE: 3,
      TH: 4,
      FR: 5,
      SA: 6,
      SU: 7,
    };
    const targetDay = dayMap[input.recurrence.dayOfWeek];
    if (targetDay) {
      const currentDate = DateTime.fromISO(input.date, {
        zone: client.timezone,
      });
      const currentDay = currentDate.weekday; // 1=Mon, 7=Sun
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // next week if today or past
      if (daysUntil === 7 && currentDay === targetDay) daysUntil = 0; // same day is OK if explicitly that day
      // Actually, if it's the same day, use today
      if (currentDay === targetDay) {
        daysUntil = 0;
      }
      effectiveDate = currentDate
        .plus({ days: daysUntil })
        .toFormat("yyyy-MM-dd");
    }
  }

  const start = createEventDateTime(effectiveDate, input.time, client.timezone);
  const end = createEventEndDateTime(
    effectiveDate,
    input.time,
    durationMinutes,
    client.timezone,
  );

  // Format RRULE string
  const rruleString = formatRRule({
    frequency: input.recurrence.frequency,
    dayOfWeek: input.recurrence.dayOfWeek,
    endDate: input.recurrence.endDate,
    timezone: client.timezone,
  });

  try {
    logger.info(
      {
        calendarId: client.calendarId,
        summary: input.summary,
        date: input.date,
        time: input.time,
        recurrence: input.recurrence,
      },
      "Creating recurring calendar event",
    );

    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start,
        end,
        recurrence: [rruleString],
      },
    });

    const item = response.data;
    const isAllDay = !!item.start?.date;

    const event: CalendarEvent = {
      id: item.id!,
      summary: item.summary || "(No title)",
      startTime: item.start?.dateTime || item.start?.date || "",
      endTime: item.end?.dateTime || item.end?.date || "",
      isAllDay,
      description: item.description || undefined,
      recurringEventId: item.recurringEventId || undefined,
    };

    // Calculate next 3 occurrences for confirmation message
    const occurrences = calculateNextOccurrences(
      effectiveDate,
      input.time,
      input.recurrence.frequency,
      3,
      client.timezone,
    );

    const nextOccurrences = occurrences.map((dt) => dt.toFormat("dd.MM"));

    logger.info(
      {
        calendarId: client.calendarId,
        eventId: event.id,
        summary: input.summary,
        nextOccurrences,
      },
      "Recurring event created successfully",
    );

    return { event, nextOccurrences };
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
      { error, calendarId: client.calendarId, input },
      "Failed to create recurring event",
    );
    throw new CalendarError(
      "API_ERROR",
      "Failed to create recurring calendar event",
    );
  }
}
