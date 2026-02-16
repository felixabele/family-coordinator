# Phase 4: Advanced Features - Research

**Researched:** 2026-02-16
**Domain:** Recurring events, proactive reminders, date parsing intelligence, conflict detection
**Confidence:** HIGH

## Summary

Phase 4 adds advanced calendar features: recurring events (daily/weekly/monthly), proactive event reminders, intelligent German date parsing, and scheduling conflict detection. The existing infrastructure provides a strong foundation — Claude LLM already handles natural language understanding with tool-based structured output, the Google Calendar API supports RFC 5545 RRULE format for recurrence, and the PostgreSQL database can store reminder metadata. Luxon (already installed) handles date/time manipulation with robust timezone support.

The core technical work involves: (1) extending the Claude intent schema to detect recurring patterns and extract RRULE components, (2) creating recurring events via Google Calendar API with properly formatted recurrence strings, (3) implementing a background job scheduler (BullMQ + Redis or pg_cron) to check for upcoming events and send proactive Signal reminders, (4) enhancing date parsing prompts to handle German relative dates ("nächsten Dienstag", "übermorgen"), and (5) querying the calendar for overlapping events before confirming creation/updates.

**Primary recommendation:** Use Claude's existing tool-use pattern to parse recurring patterns from natural language (no RRULE library needed client-side), format RRULE strings manually for simple patterns (daily/weekly/monthly), use BullMQ with Redis for reliable reminder scheduling (more robust than node-cron for production), enhance the LLM prompt with explicit German date parsing examples, and implement conflict detection as a pre-creation calendar query checking for overlapping time ranges. For editing/deleting recurring events, always ask "Nur dieses oder alle zukünftigen?" and use Google Calendar's two-step process (trim original + create new) for "all following" modifications.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Recurring events

- Support simple patterns only: daily, weekly, monthly
- No custom intervals (every 2 weeks, every 3 months) — keep it simple
- When deleting/editing a recurring event, always ask: "Nur dieses oder alle zukünftigen?"
- Confirmation shows next 3 occurrences (e.g. "Fußball jeden Di um 16:00 erstellt. Nächste: 18.02, 25.02, 04.03")
- Repeat forever by default — no end date unless user specifies one ("jeden Dienstag bis Juni")

#### Date parsing intelligence

- Claude LLM handles all date parsing — no separate date parsing library
- Full German support: "nächsten Dienstag", "übermorgen", "in 2 Wochen", "15. März", "Mittwochabend"
- Ambiguous relative dates resolved deterministically: "nächsten Freitag" on a Friday = 7 days from now (always the coming one)
- Vague time expressions use sensible defaults:
  - "morgens" = 09:00
  - "mittags" = 12:00
  - "nachmittags" = 15:00
  - "abends" = 19:00

#### Conflict detection

- Detect overlapping time ranges only — not back-to-back events
- Check all events on the shared calendar (not per-person)
- All-day events (birthdays, holidays) do NOT trigger conflict warnings
- On conflict: warn and ask "Trotzdem erstellen?" — user confirms or cancels

### Claude's Discretion

- Proactive event reminder implementation (timing, format, opt-in behavior)
- How recurring event patterns are mapped to Google Calendar RRULE
- Exact LLM prompt structure for date extraction
- Conflict detection query window (how far to look ahead)

</user_constraints>

## Standard Stack

### Core

| Library               | Version | Purpose                    | Why Standard                                                                                                      |
| --------------------- | ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| BullMQ                | 5.x     | Background job scheduling  | Industry standard for Node.js job queues, supports delayed/repeating jobs, Redis-backed persistence, robust retry |
| Redis                 | 7.x     | Job queue backend          | Required by BullMQ, provides reliable message persistence, already used in similar production stacks              |
| Luxon                 | 3.7.2   | Date/time manipulation     | Already installed, immutable API, excellent timezone support, needed for RRULE date calculations                  |
| @anthropic-ai/sdk     | 0.74.0  | LLM date parsing           | Already in project, handles German NLP via prompt engineering, structured output with tool use                    |
| googleapis (Calendar) | 171.4.0 | Recurring events via RRULE | Already in project, Google Calendar API natively supports RFC 5545 RRULE in `recurrence` field                    |
| PostgreSQL (pg)       | 8.18.0  | Reminder metadata storage  | Already in project, could store reminder preferences, sent reminder tracking                                      |

**Note:** User decision mandates Claude LLM for all date parsing (no date-fns parsing helpers, no chrono-node). The existing Luxon installation is purely for date arithmetic (calculating next 3 occurrences, computing RRULE UNTIL dates).

### Supporting

| Library     | Version | Purpose                   | When to Use                                        |
| ----------- | ------- | ------------------------- | -------------------------------------------------- |
| ioredis     | 5.x     | Redis client for BullMQ   | Required dependency for BullMQ                     |
| Pino logger | 10.3.1  | Job execution audit trail | Already in project, log reminder sends, job errors |
| signal-sdk  | 0.1.4   | Send proactive reminders  | Already in project, send reminder messages         |

### Alternatives Considered

| Instead of                | Could Use        | Tradeoff                                                                                                             |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| BullMQ                    | node-cron        | Simpler API but no persistence — missed reminders on restart, no retry logic, not production-ready                   |
| BullMQ                    | pg_cron          | Native PostgreSQL scheduling but requires pg extension setup, less flexible than BullMQ for dynamic job management   |
| BullMQ                    | Bree             | Worker thread-based scheduler, good alternative but smaller community, BullMQ more battle-tested                     |
| Redis                     | PostgreSQL queue | Could use PostgreSQL as job queue but Redis is industry standard for BullMQ, better performance for high-frequency   |
| Luxon                     | date-fns         | Similar capabilities but Luxon already installed, immutability built-in, superior timezone handling                  |
| Manual RRULE formatting   | rrule (npm)      | 467 dependents, mature library for RRULE generation — but user needs are simple (daily/weekly/monthly), manual safer |
| Claude prompt engineering | chrono-node      | User decision: Claude handles ALL date parsing, no external NLP libraries allowed                                    |

**Installation:**

```bash
npm install bullmq@5 ioredis@5
```

**Redis setup (Docker):**

```bash
# Already has docker-compose.yml for PostgreSQL, extend for Redis
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── calendar/
│   ├── operations.ts      # MODIFY: Add conflict detection query
│   ├── recurring.ts       # NEW: RRULE formatting, next occurrence calculation
│   └── conflicts.ts       # NEW: Overlap detection logic
├── reminders/
│   ├── scheduler.ts       # NEW: BullMQ queue setup, job definitions
│   ├── jobs.ts            # NEW: Job handlers (check upcoming events, send reminders)
│   └── types.ts           # NEW: Reminder job data types
├── llm/
│   ├── prompts.ts         # MODIFY: Enhanced German date parsing, recurring pattern extraction
│   ├── intent.ts          # MODIFY: Extended tool schema for recurrence entities
│   └── types.ts           # MODIFY: Add recurrence fields to CalendarIntent
├── db/
│   └── migrations/
│       └── 003_reminders.sql  # NEW: Reminder preferences, sent reminder tracking
└── config/
    └── redis.ts           # NEW: Redis connection config
```

### Pattern 1: LLM-Based Recurrence Pattern Extraction

**What:** Extend the existing Claude tool schema to detect recurring patterns in natural language and extract RRULE components (frequency, day of week, end date).

**When to use:** For all recurring event creation requests ("jeden Dienstag", "täglich um 9 Uhr").

**Trade-offs:**

- **Pros:** No client-side RRULE library needed, leverages existing LLM infrastructure, handles German naturally
- **Cons:** Requires careful prompt engineering, must validate LLM output strictly

**Example:**

```typescript
// llm/types.ts - Extended intent schema
export interface RecurrenceEntities {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  day_of_week?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU"; // For weekly
  end_date?: string; // YYYY-MM-DD format, null = forever
}

export interface CalendarIntent {
  intent: "create_event" | "query_events" | "update_event" | "delete_event" | ...;
  entities: {
    title?: string;
    date?: string;
    time?: string;
    recurrence?: RecurrenceEntities; // NEW
    // ... existing fields
  };
  confidence: number;
  clarification_needed?: string;
}
```

```typescript
// llm/intent.ts - Tool schema extension
const calendarIntentTool: Anthropic.Tool = {
  name: "parse_calendar_intent",
  input_schema: {
    type: "object",
    properties: {
      // ... existing properties
      entities: {
        type: "object",
        properties: {
          // ... existing entity properties
          recurrence: {
            type: "object",
            properties: {
              frequency: {
                type: "string",
                enum: ["DAILY", "WEEKLY", "MONTHLY"],
                description: "How often the event repeats",
              },
              day_of_week: {
                type: "string",
                enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
                description:
                  "Day of week for weekly recurrence (e.g., TU for Tuesday)",
              },
              end_date: {
                type: "string",
                description: "End date in YYYY-MM-DD format, null for forever",
              },
            },
            description: "Recurring pattern information",
          },
        },
      },
    },
  },
};
```

**Prompt enhancement (llm/prompts.ts):**

```typescript
// Add to CALENDAR_SYSTEM_PROMPT
`
## Recurring Events

When user says "jeden Tag", "täglich", "every day": set recurrence.frequency = "DAILY"
When user says "jede Woche", "wöchentlich", "every week": set recurrence.frequency = "WEEKLY"
When user says "jeden Monat", "monatlich": set recurrence.frequency = "MONTHLY"

For weekly events, extract day of week:
- "jeden Dienstag" → frequency: "WEEKLY", day_of_week: "TU"
- "jeden Montag" → frequency: "WEEKLY", day_of_week: "MO"

For end dates:
- "jeden Dienstag bis Juni" → parse "Juni" to last day of June in current year
- "täglich bis 15. März" → parse to "2026-03-15"
- No end date specified → end_date: null (repeat forever)

Examples:
- "Trag Fußball jeden Dienstag um 16 Uhr ein" → recurrence: {frequency: "WEEKLY", day_of_week: "TU", end_date: null}
- "Täglich um 9 Uhr Meeting bis Ende März" → recurrence: {frequency: "DAILY", end_date: "2026-03-31"}
`;
```

### Pattern 2: Manual RRULE Formatting for Simple Patterns

**What:** Format Google Calendar RRULE strings manually for the three supported patterns (daily/weekly/monthly) without using the rrule npm library.

**When to use:** When creating recurring events after Claude extracts recurrence entities.

**Trade-offs:**

- **Pros:** No additional dependencies, full control over output, avoids library complexity for simple cases
- **Cons:** Must manually construct RFC 5545 strings, potential for formatting errors

**Example:**

```typescript
// calendar/recurring.ts
import { DateTime } from "luxon";

export interface RRuleInput {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
  endDate?: string; // YYYY-MM-DD
  timezone: string;
}

/**
 * Format an RRULE string for Google Calendar API
 * Supports simple patterns only: DAILY, WEEKLY, MONTHLY
 *
 * @example
 * formatRRule({frequency: "WEEKLY", dayOfWeek: "TU", timezone: "Europe/Berlin"})
 * // Returns: "RRULE:FREQ=WEEKLY;BYDAY=TU"
 *
 * @example
 * formatRRule({frequency: "DAILY", endDate: "2026-06-30", timezone: "Europe/Berlin"})
 * // Returns: "RRULE:FREQ=DAILY;UNTIL=20260630T220000Z"
 */
export function formatRRule(input: RRuleInput): string {
  const parts: string[] = [`FREQ=${input.frequency}`];

  // Add BYDAY for weekly recurrence
  if (input.frequency === "WEEKLY" && input.dayOfWeek) {
    parts.push(`BYDAY=${input.dayOfWeek}`);
  }

  // Add UNTIL if end date specified
  // Google Calendar RRULE UNTIL must be in UTC (Z suffix)
  if (input.endDate) {
    const endDateTime = DateTime.fromFormat(input.endDate, "yyyy-MM-dd", {
      zone: input.timezone,
    }).endOf("day"); // End of day in local timezone

    const utcString = endDateTime.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
    parts.push(`UNTIL=${utcString}`);
  }

  return `RRULE:${parts.join(";")}`;
}

/**
 * Calculate the next N occurrences of a recurring event
 * Used for confirmation messages: "Nächste: 18.02, 25.02, 04.03"
 */
export function calculateNextOccurrences(
  startDate: string, // YYYY-MM-DD
  startTime: string, // HH:MM
  frequency: "DAILY" | "WEEKLY" | "MONTHLY",
  count: number,
  timezone: string,
): DateTime[] {
  const start = DateTime.fromFormat(
    `${startDate} ${startTime}`,
    "yyyy-MM-dd HH:mm",
    {
      zone: timezone,
    },
  );

  const occurrences: DateTime[] = [];
  let current = start;

  for (let i = 0; i < count; i++) {
    occurrences.push(current);

    // Calculate next occurrence
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
```

**Usage in calendar operations:**

```typescript
// calendar/operations.ts - Modified createEvent
export async function createRecurringEvent(
  client: CalendarClient,
  input: CreateEventInput & { recurrence?: RecurrenceEntities },
): Promise<CalendarEvent> {
  const start = createEventDateTime(input.date, input.time, client.timezone);
  const end = createEventEndDateTime(
    input.date,
    input.time,
    input.durationMinutes ?? 60,
    client.timezone,
  );

  // Format RRULE if recurring
  let recurrence: string[] | undefined;
  if (input.recurrence) {
    const rrule = formatRRule({
      frequency: input.recurrence.frequency,
      dayOfWeek: input.recurrence.day_of_week,
      endDate: input.recurrence.end_date,
      timezone: client.timezone,
    });
    recurrence = [rrule];
  }

  const response = await client.calendar.events.insert({
    calendarId: client.calendarId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start,
      end,
      recurrence, // NEW: Array of RRULE strings
    },
  });

  // ... return event
}
```

### Pattern 3: BullMQ Background Job Scheduler for Reminders

**What:** Use BullMQ with Redis to run a periodic job that checks for upcoming events and sends Signal reminders.

**When to use:** For all proactive reminder functionality.

**Trade-offs:**

- **Pros:** Persistent job queue survives restarts, robust retry logic, horizontal scaling support, battle-tested
- **Cons:** Requires Redis infrastructure, more complex than node-cron

**Example:**

```typescript
// reminders/scheduler.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../utils/logger.js";
import { checkUpcomingEvents, sendEventReminder } from "./jobs.js";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null, // BullMQ requirement
});

// Queue for reminder jobs
export const reminderQueue = new Queue("event-reminders", { connection });

/**
 * Schedule a repeating job to check for upcoming events
 * Runs every 5 minutes, queries calendar for events in next 24 hours
 */
export async function startReminderScheduler() {
  // Add a repeating job (every 5 minutes)
  await reminderQueue.add(
    "check-upcoming-events",
    {},
    {
      repeat: {
        pattern: "*/5 * * * *", // Cron: every 5 minutes
      },
    },
  );

  logger.info("Reminder scheduler started (checks every 5 minutes)");
}

/**
 * Worker to process reminder jobs
 */
export const reminderWorker = new Worker(
  "event-reminders",
  async (job) => {
    if (job.name === "check-upcoming-events") {
      await checkUpcomingEvents();
    } else if (job.name === "send-reminder") {
      await sendEventReminder(job.data);
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time (family use case, low volume)
  },
);

reminderWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "Reminder job completed");
});

reminderWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, jobName: job?.name, error: err },
    "Reminder job failed",
  );
});
```

```typescript
// reminders/jobs.ts
import { DateTime } from "luxon";
import { listEvents } from "../calendar/operations.js";
import { sendMessage } from "../signal/sender.js";
import { reminderQueue } from "./scheduler.js";
import { pool } from "../db/pool.js";
import { logger } from "../utils/logger.js";

/**
 * Check for events in the next 24 hours and schedule reminder jobs
 * Runs every 5 minutes via BullMQ repeating job
 */
export async function checkUpcomingEvents() {
  const now = DateTime.now().setZone("Europe/Berlin");
  const tomorrow = now.plus({ days: 1 });

  // Query calendar for today and tomorrow
  const todayEvents = await listEvents(
    calendarClient,
    now.toFormat("yyyy-MM-dd"),
  );
  const tomorrowEvents = await listEvents(
    calendarClient,
    tomorrow.toFormat("yyyy-MM-dd"),
  );

  const allEvents = [...todayEvents, ...tomorrowEvents];

  for (const event of allEvents) {
    const eventStart = DateTime.fromISO(event.startTime, {
      zone: "Europe/Berlin",
    });
    const hoursUntilEvent = eventStart.diff(now, "hours").hours;

    // Send reminder 1 hour before (configurable)
    if (hoursUntilEvent > 0.9 && hoursUntilEvent < 1.1) {
      // Check if we already sent a reminder for this event
      const alreadySent = await hasReminderBeenSent(
        event.id,
        eventStart.toISO(),
      );

      if (!alreadySent) {
        // Schedule immediate send job
        await reminderQueue.add("send-reminder", {
          eventId: event.id,
          eventSummary: event.summary,
          eventStart: event.startTime,
        });
      }
    }
  }
}

/**
 * Send a reminder message via Signal
 */
export async function sendEventReminder(data: {
  eventId: string;
  eventSummary: string;
  eventStart: string;
}) {
  const eventTime = DateTime.fromISO(data.eventStart, {
    zone: "Europe/Berlin",
  });
  const formattedTime = eventTime.toFormat("HH:mm");

  const reminderText = `Erinnerung: ${data.eventSummary} um ${formattedTime} Uhr`;

  // Send to family group (or all individual members)
  await sendMessage(process.env.SIGNAL_FAMILY_GROUP_ID!, reminderText);

  // Mark as sent
  await markReminderSent(data.eventId, data.eventStart);

  logger.info(
    { eventId: data.eventId, summary: data.eventSummary },
    "Reminder sent",
  );
}

async function hasReminderBeenSent(
  eventId: string,
  eventStart: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM sent_reminders WHERE event_id = $1 AND event_start = $2",
    [eventId, eventStart],
  );
  return result.rowCount! > 0;
}

async function markReminderSent(
  eventId: string,
  eventStart: string,
): Promise<void> {
  await pool.query(
    "INSERT INTO sent_reminders (event_id, event_start, sent_at) VALUES ($1, $2, NOW())",
    [eventId, eventStart],
  );
}
```

**Database migration:**

```sql
-- db/migrations/003_reminders.sql
CREATE TABLE IF NOT EXISTS sent_reminders (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_start TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, event_start) -- Prevent duplicate reminders
);

CREATE INDEX idx_sent_reminders_event ON sent_reminders(event_id, event_start);
```

### Pattern 4: Conflict Detection via Pre-Creation Query

**What:** Before creating or updating an event, query Google Calendar for overlapping events on the same day and warn the user.

**When to use:** For all create_event and update_event operations (unless user confirms after warning).

**Trade-offs:**

- **Pros:** Simple implementation, uses existing calendar API, no extra infrastructure
- **Cons:** Adds latency to event creation, requires extra API call

**Example:**

```typescript
// calendar/conflicts.ts
import { DateTime } from "luxon";
import { CalendarClient } from "./client.js";
import { CalendarEvent } from "./types.js";

export interface TimeRange {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

/**
 * Find overlapping events in the calendar
 * Ignores all-day events (user decision)
 *
 * @returns Array of conflicting events (empty if no conflicts)
 */
export async function findConflicts(
  client: CalendarClient,
  newEvent: TimeRange,
): Promise<CalendarEvent[]> {
  const newStart = DateTime.fromISO(newEvent.start);
  const newEnd = DateTime.fromISO(newEvent.end);

  // Query events on the same day
  const dayStart = newStart.startOf("day");
  const dayEnd = newStart.endOf("day");

  const response = await client.calendar.events.list({
    calendarId: client.calendarId,
    timeMin: dayStart.toISO()!,
    timeMax: dayEnd.toISO()!,
    singleEvents: true, // Expand recurring events into instances
    orderBy: "startTime",
  });

  const existingEvents = response.data.items || [];
  const conflicts: CalendarEvent[] = [];

  for (const event of existingEvents) {
    // Skip all-day events (user decision)
    if (event.start?.date) {
      continue;
    }

    const eventStart = DateTime.fromISO(event.start?.dateTime!);
    const eventEnd = DateTime.fromISO(event.end?.dateTime!);

    // Check for overlap (not just back-to-back)
    // Overlap: new starts before existing ends AND new ends after existing starts
    const overlaps = newStart < eventEnd && newEnd > eventStart;

    if (overlaps) {
      conflicts.push({
        id: event.id!,
        summary: event.summary || "(No title)",
        startTime: event.start?.dateTime || "",
        endTime: event.end?.dateTime || "",
        isAllDay: false,
      });
    }
  }

  return conflicts;
}
```

**Usage in message handler:**

```typescript
// Signal message handler (index.ts or orchestrator)
if (
  intent.intent === "create_event" &&
  intent.entities.date &&
  intent.entities.time
) {
  // Check for conflicts
  const newEventStart = createEventDateTime(
    intent.entities.date,
    intent.entities.time,
    timezone,
  );
  const newEventEnd = createEventEndDateTime(
    intent.entities.date,
    intent.entities.time,
    60,
    timezone,
  );

  const conflicts = await findConflicts(calendarClient, {
    start: newEventStart.dateTime!,
    end: newEventEnd.dateTime!,
  });

  if (conflicts.length > 0) {
    // Format conflict warning in German
    const conflictList = conflicts
      .map((e) => {
        const time = DateTime.fromISO(e.startTime).toFormat("HH:mm");
        return `${e.summary} um ${time} Uhr`;
      })
      .join(", ");

    const warning = `Achtung: Überschneidung mit ${conflictList}. Trotzdem erstellen?`;

    // Save in conversation state: awaiting conflict confirmation
    await saveConversationState({
      phoneNumber,
      awaitingConfirmation: "conflict",
      pendingEvent: intent.entities,
    });

    await sendMessage(phoneNumber, warning);
    return;
  }

  // No conflicts, proceed with creation
  const event = await createEvent(calendarClient, {
    summary: intent.entities.title!,
    date: intent.entities.date,
    time: intent.entities.time,
  });

  await sendMessage(phoneNumber, `Termin erstellt: ${event.summary}`);
}
```

### Pattern 5: Enhanced German Date Parsing via Prompt Engineering

**What:** Extend the Claude system prompt with explicit German date/time parsing rules and examples.

**When to use:** User constraint mandates LLM-based date parsing for all German natural language input.

**Trade-offs:**

- **Pros:** No external parsing library needed, handles German idioms naturally, consistent with existing architecture
- **Cons:** Requires extensive prompt testing, potential edge cases with ambiguous inputs

**Example:**

```typescript
// llm/prompts.ts - Enhanced section
export const GERMAN_DATE_PARSING_RULES = `
## Advanced German Date Parsing

You MUST parse the following German date/time expressions:

### Relative Days
- "heute" → current date
- "morgen" → current date + 1 day
- "übermorgen" → current date + 2 days
- "gestern" → current date - 1 day (for queries)
- "vorgestern" → current date - 2 days (for queries)

### Relative Weeks
- "nächste Woche" → 7 days from today
- "nächsten [Weekday]" → next occurrence of that weekday (if today is Friday and user says "nächsten Freitag", add 7 days, NOT 0)
- "in 2 Wochen" → current date + 14 days
- "in einer Woche" → current date + 7 days

### Weekday Resolution (CRITICAL)
When today is the same weekday as requested:
- "nächsten Freitag" on a Friday → 7 days from now (the COMING Friday, not today)
- NEVER return the same day for "nächsten [Weekday]"

Examples with current date 2026-02-16 (Monday):
- "nächsten Dienstag" → 2026-02-17 (tomorrow, first Tuesday after today)
- "nächsten Montag" → 2026-02-23 (7 days from now, NOT today)
- "Dienstag" → 2026-02-17 (default: next occurrence)

### Months
- "15. März" → 2026-03-15 (current year if not specified)
- "März" → 2026-03-01 (first day of month if day not specified)
- "nächsten Monat" → first day of next month
- "in 2 Monaten" → current date + 2 months

### Time of Day
- "morgens" → 09:00
- "vormittags" → 10:00
- "mittags" → 12:00
- "nachmittags" → 15:00
- "abends" → 19:00
- "Mittwochabend" → next Wednesday at 19:00

### Absolute Dates
- "15.03.2026" → 2026-03-15
- "15.3." → 2026-03-15 (current year)
- "15.03." → 2026-03-15 (current year)

### Date Ranges (for end dates)
- "bis Ende März" → 2026-03-31
- "bis Juni" → 2026-06-30 (last day of June)
- "bis 15. März" → 2026-03-15

### Ambiguity Resolution
When user says "Freitag" without qualifier:
- If today is Monday-Thursday: next Friday
- If today is Friday: NEXT Friday (7 days from now)
- If today is Saturday/Sunday: upcoming Friday (within current week)

When user says "Wochenende":
- Default: next Saturday
`;

// Append to existing CALENDAR_SYSTEM_PROMPT
export const CALENDAR_SYSTEM_PROMPT = `
[... existing prompt ...]

${GERMAN_DATE_PARSING_RULES}

## Important: Date Context
You receive the current date/time at the start of each user message in ISO format.
Use this to calculate all relative dates ACCURATELY.
Example: [Current date/time: 2026-02-16T14:30:00.000Z]

Always return dates in YYYY-MM-DD format.
Always return times in HH:MM 24-hour format.
`;
```

## Don't Hand-Roll

| Problem                          | Don't Build                  | Use Instead                 | Why                                                                                                |
| -------------------------------- | ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| Job queue/scheduling             | Custom setTimeout scheduler  | BullMQ                      | Persistence across restarts, retry logic, job prioritization, battle-tested production reliability |
| RRULE parsing                    | Custom recurrence calculator | Manual RRULE strings        | For simple patterns (daily/weekly/monthly), manual formatting is safer than library complexity     |
| Date parsing NLP                 | regex/manual parser          | Claude LLM (user decision)  | German natural language is complex, LLM handles idioms/ambiguity better than regex                 |
| Conflict detection algorithm     | Custom overlap logic         | DateTime comparison (Luxon) | Luxon immutable API prevents timezone bugs, < > operators handle overlap elegantly                 |
| Recurring event instance editing | Manual Google Calendar calls | Google's two-step process   | Trim original RRULE + create new event — documented best practice, prevents exception clutter      |

**Key insight:** Recurring events and job scheduling have subtle edge cases (DST transitions, timezone handling, missed jobs, recurring event exceptions). Use proven libraries (BullMQ, Luxon) and follow Google Calendar API best practices rather than reinventing. For simple RRULE patterns, manual formatting is acceptable because user scope is limited (no complex BYMONTHDAY or BYYEARDAY rules).

## Common Pitfalls

### Pitfall 1: RRULE UNTIL Timezone Mismatches

**What goes wrong:** Google Calendar RRULE UNTIL must be in UTC with 'Z' suffix, but event start/end times are in local timezone. If you format UNTIL in local timezone or forget the 'Z', recurring events may end prematurely or extend too long.

**Why it happens:** RFC 5545 requires UNTIL to be in UTC if start time has a timezone. Mixing timezone-aware start times with timezone-naive UNTIL causes parsing errors or incorrect recurrence.

**How to avoid:**

```typescript
// WRONG: Local timezone UNTIL
const wrong = `RRULE:FREQ=WEEKLY;UNTIL=20260630T230000`; // No Z, ambiguous timezone

// CORRECT: Convert local end date to UTC with Z suffix
const endDateTime = DateTime.fromFormat("2026-06-30", "yyyy-MM-dd", {
  zone: "Europe/Berlin",
}).endOf("day");

const utcUntil = endDateTime.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
const correct = `RRULE:FREQ=WEEKLY;UNTIL=${utcUntil}`; // 20260630T220000Z
```

**Warning signs:** Recurring events stop 1-2 hours before expected end date, or continue past end date. Check timezone conversion in UNTIL formatting.

### Pitfall 2: Missing Reminders After Application Restart

**What goes wrong:** Using node-cron or setTimeout for reminder scheduling means all scheduled jobs are lost when the application restarts. Reminders scheduled for events during downtime are never sent.

**Why it happens:** In-memory schedulers don't persist state. If the bot crashes or deploys, setTimeout timers are cleared and cron schedules aren't recreated until the next trigger time.

**How to avoid:** Use BullMQ with Redis backend. Jobs are persisted in Redis and survive application restarts.

```typescript
// WRONG: In-memory node-cron
import cron from "node-cron";
cron.schedule("*/5 * * * *", checkUpcomingEvents); // Lost on restart

// CORRECT: BullMQ with Redis persistence
await reminderQueue.add(
  "check-upcoming-events",
  {},
  {
    repeat: { pattern: "*/5 * * * *" },
  },
); // Survives restart
```

**Warning signs:** Reminders work fine during continuous uptime but are missed after deployments or crashes. Check for persistent job queue.

### Pitfall 3: Conflict Detection Misses Recurring Event Instances

**What goes wrong:** Querying `events.list()` without `singleEvents: true` returns recurring event definitions, not individual instances. Conflict detection checks against the first occurrence only, missing future conflicts.

**Why it happens:** Google Calendar API default behavior returns recurring events as a single object with RRULE. Individual instances aren't expanded unless explicitly requested.

**How to avoid:**

```typescript
// WRONG: Misses recurring event instances
const response = await calendar.events.list({
  calendarId: "primary",
  timeMin: dayStart.toISO(),
  timeMax: dayEnd.toISO(),
  // Missing singleEvents: true
});
// Returns: 1 recurring event object (not 10 instances)

// CORRECT: Expand recurring events into instances
const response = await calendar.events.list({
  calendarId: "primary",
  timeMin: dayStart.toISO(),
  timeMax: dayEnd.toISO(),
  singleEvents: true, // Expands recurring events
  orderBy: "startTime",
});
// Returns: All individual instances
```

**Warning signs:** Conflict detection works for single events but misses conflicts with "every Tuesday" recurring events. Verify singleEvents parameter.

### Pitfall 4: "Nächsten Freitag" on Friday Returns Today

**What goes wrong:** When parsing "nächsten Freitag" on a Friday, the LLM might return today's date instead of 7 days from now, violating user expectations.

**Why it happens:** Ambiguous semantics of "nächsten" (next). Some interpret "next Friday" on Friday as "today" (the upcoming Friday within the week), others as "next week's Friday" (7 days away).

**How to avoid:** Explicitly specify in the prompt:

```typescript
// Prompt rule (added above)
`When today is the same weekday as requested:
- "nächsten Freitag" on a Friday → 7 days from now (the COMING Friday, not today)
- NEVER return the same day for "nächsten [Weekday]"`;
```

Include test cases in prompt examples:

```typescript
`Example: Current date is Friday 2026-02-20
User: "Trag Termin nächsten Freitag ein"
Correct: date = "2026-02-27" (7 days from now)
WRONG: date = "2026-02-20" (today)`;
```

**Warning signs:** Users complain that "nächsten Freitag" creates events for today instead of next week. Add deterministic weekday resolution logic to prompt.

### Pitfall 5: Duplicate Reminders for Recurring Event Instances

**What goes wrong:** Sending reminders for recurring events without tracking individual instance start times results in duplicate reminders. The first occurrence gets 10 reminders instead of 1.

**Why it happens:** Recurring events have a single `event.id` but multiple `startTime` values (one per instance). Tracking by `event_id` alone doesn't distinguish instances.

**How to avoid:**

```typescript
// WRONG: Track by event_id only
await pool.query("INSERT INTO sent_reminders (event_id) VALUES ($1)", [
  eventId,
]);
// Problem: Second instance with same event_id is treated as duplicate

// CORRECT: Track by (event_id, event_start) composite key
await pool.query(
  "INSERT INTO sent_reminders (event_id, event_start) VALUES ($1, $2)",
  [eventId, eventStartISO],
);
// UNIQUE constraint on (event_id, event_start) prevents duplicate instance reminders
```

Database schema:

```sql
CREATE TABLE sent_reminders (
  event_id TEXT NOT NULL,
  event_start TIMESTAMPTZ NOT NULL,
  UNIQUE(event_id, event_start) -- Composite key
);
```

**Warning signs:** First occurrence of recurring event gets multiple reminders, subsequent occurrences get none. Check sent_reminders table schema.

### Pitfall 6: Editing "All Future Instances" Creates Exception Spam

**What goes wrong:** Modifying all future instances of a recurring event by looping through each instance and calling `events.patch()` creates hundreds of exceptions, cluttering the calendar and degrading API performance.

**Why it happens:** Google Calendar treats each instance modification as an exception to the original recurrence rule. The underlying recurring event becomes bloated with exception data.

**How to avoid:** Use Google's documented two-step process:

```typescript
// WRONG: Loop through instances and patch each
const instances = await calendar.events.instances({
  eventId: recurringEventId,
});
for (const instance of instances.data.items) {
  if (instance.start.dateTime > targetDate) {
    await calendar.events.patch({ eventId: instance.id, requestBody: updates });
    // Creates 100+ exceptions!
  }
}

// CORRECT: Trim original + create new recurring event
// Step 1: Update original recurring event to end before target instance
await calendar.events.patch({
  eventId: recurringEventId,
  requestBody: {
    recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=20260301T000000Z`], // End before target
  },
});

// Step 2: Create new recurring event with modified data starting from target date
await calendar.events.insert({
  calendarId: "primary",
  requestBody: {
    summary: "Updated Title", // Modified data
    start: { dateTime: "2026-03-08T16:00:00", timeZone: "Europe/Berlin" },
    end: { dateTime: "2026-03-08T17:00:00", timeZone: "Europe/Berlin" },
    recurrence: ["RRULE:FREQ=WEEKLY"], // Continue with new data
  },
});
```

**Warning signs:** Calendar API slows down after editing recurring events, Google Calendar UI shows "many exceptions" warning. Always use trim-and-create pattern for "all future" edits.

## Code Examples

Verified patterns from official sources:

### Creating a Recurring Event

```typescript
// Source: Google Calendar API Recurring Events Guide
// https://developers.google.com/workspace/calendar/api/guides/recurringevents

import { google } from "googleapis";

const calendar = google.calendar({ version: "v3", auth });

const recurringEvent = {
  summary: "Fußball Training",
  start: {
    dateTime: "2026-02-18T16:00:00",
    timeZone: "Europe/Berlin",
  },
  end: {
    dateTime: "2026-02-18T17:00:00",
    timeZone: "Europe/Berlin",
  },
  recurrence: [
    "RRULE:FREQ=WEEKLY;BYDAY=TU", // Every Tuesday, repeat forever
  ],
};

const response = await calendar.events.insert({
  calendarId: "primary",
  requestBody: recurringEvent,
});

console.log("Recurring event created:", response.data.id);
```

### Listing Recurring Event Instances

```typescript
// Source: Google Calendar API Events.instances reference
// https://developers.google.com/workspace/calendar/api/v3/reference/events/instances

const instances = await calendar.events.instances({
  calendarId: "primary",
  eventId: recurringEventId,
  timeMin: "2026-02-01T00:00:00Z",
  timeMax: "2026-03-01T00:00:00Z",
});

console.log("Instances:", instances.data.items.length);
```

### BullMQ Repeating Job (Cron)

```typescript
// Source: BullMQ documentation - Repeatable Jobs
// https://docs.bullmq.io

import { Queue } from "bullmq";

const queue = new Queue("reminders", {
  connection: { host: "localhost", port: 6379 },
});

// Add a job that repeats every 5 minutes
await queue.add(
  "check-events",
  { task: "scan calendar" },
  {
    repeat: {
      pattern: "*/5 * * * *", // Cron syntax
    },
  },
);
```

### BullMQ Delayed Job (One-Time Reminder)

```typescript
// Source: BullMQ documentation - Delayed Jobs
// https://docs.bullmq.io

// Send reminder at specific timestamp
const reminderTime = DateTime.fromISO("2026-02-18T15:00:00", {
  zone: "Europe/Berlin",
}).toMillis();

const delay = reminderTime - Date.now();

await queue.add(
  "send-reminder",
  { eventId: "abc123", message: "Erinnerung: Zahnarzt um 16 Uhr" },
  { delay }, // Delay in milliseconds
);
```

### Luxon Date Arithmetic for Recurrence

```typescript
// Source: Luxon documentation - Math
// https://moment.github.io/luxon/docs/

import { DateTime } from "luxon";

const start = DateTime.fromFormat("2026-02-18 16:00", "yyyy-MM-dd HH:mm", {
  zone: "Europe/Berlin",
});

// Calculate next 3 weekly occurrences
const occurrences = [];
for (let i = 0; i < 3; i++) {
  const occurrence = start.plus({ weeks: i });
  occurrences.push(occurrence.toFormat("dd.MM")); // "18.02", "25.02", "04.03"
}

console.log(`Nächste: ${occurrences.join(", ")}`);
```

### Checking for Event Overlap

```typescript
// Source: Common pattern, DateTime comparison
// Luxon docs: https://moment.github.io/luxon/docs/

function isOverlapping(
  newStart: DateTime,
  newEnd: DateTime,
  existingStart: DateTime,
  existingEnd: DateTime,
): boolean {
  // Overlap: new starts before existing ends AND new ends after existing starts
  return newStart < existingEnd && newEnd > existingStart;
}

// Usage
const newEvent = {
  start: DateTime.fromISO("2026-02-18T15:00:00"),
  end: DateTime.fromISO("2026-02-18T16:00:00"),
};

const existing = {
  start: DateTime.fromISO("2026-02-18T15:30:00"),
  end: DateTime.fromISO("2026-02-18T16:30:00"),
};

if (isOverlapping(newEvent.start, newEvent.end, existing.start, existing.end)) {
  console.log("Conflict detected!");
}
```

## State of the Art

| Old Approach             | Current Approach        | When Changed  | Impact                                                                                 |
| ------------------------ | ----------------------- | ------------- | -------------------------------------------------------------------------------------- |
| node-cron                | BullMQ                  | 2024-2025     | Production systems shifted to persistent queues for reliability and horizontal scaling |
| Moment.js                | Luxon / date-fns        | 2020-2021     | Moment deprecated, Luxon offers immutability and better timezone support               |
| Manual date parsing      | LLM-based extraction    | 2024-2026     | Claude and GPT-4 handle natural language date parsing better than regex/chrono-node    |
| rrule library for simple | Manual RRULE formatting | N/A (context) | For daily/weekly/monthly, manual strings simpler than library dependency               |
| In-memory job scheduling | Redis-backed job queues | 2022-2023     | Microservices architecture requires persistent, distributed job scheduling             |

**Deprecated/outdated:**

- **Moment.js**: Officially in maintenance mode since 2020, replaced by Luxon or date-fns. Luxon is preferred for timezone-heavy applications.
- **node-cron for production**: Fine for development/personal projects, but production systems use BullMQ/Asynq/pg_cron for persistence and reliability.
- **google-libphonenumber**: The 550KB official library is overkill for phone validation; libphonenumber-js (145KB) is the modern choice for JavaScript projects.
- **chrono-node for date parsing**: With LLM-based extraction (Claude, GPT-4), regex-based parsers like chrono-node are less relevant for conversational interfaces.

## Open Questions

1. **Reminder timing preferences**
   - What we know: Industry best practice is 1 hour before events, 24 hours for all-day events
   - What's unclear: Should this be configurable per family member? Should users opt-in to reminders?
   - Recommendation: Start with fixed 1-hour reminders for all events, add per-user preferences in later phase if requested. Track in `family-members.json` config: `{"phone": "+49123", "name": "Papa", "reminders_enabled": true}`

2. **Conflict query window**
   - What we know: Should check same-day events for overlaps
   - What's unclear: Should we also warn about events earlier/later the same day (not overlapping but "busy day" warning)?
   - Recommendation: Start with strict overlap detection only (user decision). Expand to "busy day" warnings in future if users request it.

3. **Recurring event confirmation format**
   - What we know: User wants "next 3 occurrences" shown, e.g., "Nächste: 18.02, 25.02, 04.03"
   - What's unclear: Should confirmation include end date if specified? "Jeden Di bis Juni (26 Termine)"?
   - Recommendation: Show next 3 dates + end date if present: "Fußball jeden Di um 16:00. Nächste: 18.02, 25.02, 04.03. Endet: 30.06."

4. **Group chat reminders**
   - What we know: Bot supports group chats (Phase 3), family likely uses a shared group
   - What's unclear: Send reminders to group or individual DMs? Or both?
   - Recommendation: Send to group if configured (`SIGNAL_FAMILY_GROUP_ID` env var), otherwise send to all whitelisted phone numbers individually.

5. **Recurring event deletion scope**
   - What we know: Ask "Nur dieses oder alle zukünftigen?" before deleting
   - What's unclear: Should we offer "Alle" (past + future) or only "Dieses" + "Zukünftige"?
   - Recommendation: Offer two options only: "Nur dieses" (single instance) and "Alle zukünftigen" (this + future). Deleting past instances is rarely needed.

## Sources

### Primary (HIGH confidence)

- [Google Calendar API - Recurring Events Guide](https://developers.google.com/workspace/calendar/api/guides/recurringevents) - Official documentation for RRULE implementation
- [Google Calendar API - Events Reference](https://developers.google.com/workspace/calendar/api/v3/reference/events) - API specifications for recurrence field
- [BullMQ Official Documentation](https://docs.bullmq.io) - Repeating jobs, delayed jobs, worker configuration
- [iCalendar RFC 5545 - Recurrence Rule](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html) - RRULE specification standard
- [Luxon Documentation - DateTime Math](https://moment.github.io/luxon/docs/) - Date arithmetic for occurrence calculation
- [node-cron npm package](https://www.npmjs.com/package/node-cron) - Checked version 3.0.3, last updated 2 years ago
- [rrule npm package](https://www.npmjs.com/package/rrule) - Version 2.8.1, 467 dependents

### Secondary (MEDIUM confidence)

- [Job Scheduling in Node.js with BullMQ (2026)](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/) - Current best practices for BullMQ
- [How to Build a Job Queue in Node.js with BullMQ and Redis (2026)](https://oneuptime.com/blog/post/2026-01-06-nodejs-job-queue-bullmq-redis/view) - Production patterns
- [PostgreSQL pg_cron Extension (AWS RDS)](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL_pg_cron.html) - Alternative to BullMQ
- [date-fns vs Luxon comparison (2026)](https://www.slant.co/versus/20523/29531/~date-fns_vs_luxon) - Library trade-offs
- [Event Reminder Email Timing Best Practices (Mailchimp)](https://mailchimp.com/resources/event-reminder-email/) - Industry standards for reminder timing
- [The Deceptively Complex World of Calendar Events and RRULEs (Nylas)](https://www.nylas.com/blog/calendar-events-rrules/) - RRULE edge cases and pitfalls

### Tertiary (LOW confidence)

- [Managing Recurring Events in Node.js with rrule](https://blog.cybermindworks.com/post/managing-recurring-events-in-node-js-with-rrule) - Community tutorial, not official docs
- [Proactive notifications - Microsoft Bot Framework](https://microsoft.github.io/botframework-solutions/solution-accelerators/samples/proactive-notifications/) - Teams bot patterns, not Signal-specific

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - BullMQ, Luxon, Google Calendar API are all officially documented with current 2026 guides
- Architecture: HIGH - Patterns verified against official Google Calendar API docs, BullMQ documentation, and production use cases
- Pitfalls: MEDIUM-HIGH - Timezone RRULE issues and conflict detection documented in Google Calendar API; BullMQ restart persistence verified in official docs; recurring event exception spam documented in Google best practices blog

**Research date:** 2026-02-16
**Valid until:** ~30 days (stable domain, BullMQ/Luxon/Google Calendar API rarely breaking changes)
