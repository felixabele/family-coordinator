# Phase 2: Calendar Integration & CRUD - Research

**Researched:** 2026-02-14
**Domain:** Google Calendar API v3 integration with Node.js service accounts
**Confidence:** HIGH

## Summary

Google Calendar API integration with Node.js is a well-established pattern with robust official support. The standard stack uses the `googleapis` npm package (v171.4.0) for API access via service account authentication using JSON key files. Authentication follows the GoogleAuth pattern with JWT tokens, eliminating the need for OAuth flows in server-to-server scenarios.

The API enforces per-minute quotas with rate limiting (403/429 status codes), requiring exponential backoff retry strategies. Timezone handling is critical — the API uses IANA timezone identifiers (e.g., "Europe/Berlin"), and recurring events require a single timezone. Date manipulation libraries like Luxon (v3.7.2) or date-fns (v4.1.0, already in project) provide timezone-aware date operations. Event matching for updates/deletes requires disambiguation strategies when multiple events match user queries.

**Primary recommendation:** Use googleapis v171.4.0 with service account authentication, implement retry logic with exponential backoff for rate limits, leverage Luxon for timezone-aware date operations (project already has date-fns v4.1.0 which can work but Luxon has better timezone support), and build explicit disambiguation UX when multiple events match ambiguous queries.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Google Calendar auth

- Service account authentication (bot has its own Google identity)
- JSON key file for credentials, path configured via `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` env var
- Single `GOOGLE_CALENDAR_ID` env var pointing to the existing shared family calendar
- Calendar is already shared with the service account email with "Make changes to events" permission

#### Timezone handling

- Single family-wide timezone: `Europe/Berlin`
- Configure via env var but default to Europe/Berlin
- When no date given ("Add dinner at 7pm"): assume today if time hasn't passed, otherwise tomorrow
- When no time given ("Add dentist on Thursday"): bot asks for a time before creating

#### Confirmation & safety

- Deletes execute immediately — bot confirms what was deleted after the fact
- Mutations (create, edit, delete) always show a summary of what changed: "Hinzugefügt: Fußball, Di 16:00-17:00"
- When multiple events match an ambiguous request: bot lists matching events with numbers and asks which one
- Default event duration: 1 hour when no end time specified

#### Response formatting

- Compact one-line-per-event format for listings: "15:00 - Zahnarzt | 17:00 - Fußball"
- Always respond in German
- Casual/familiar tone — du-form, like texting a family member ("Klar, hab ich eingetragen!")
- Empty state: simple message ("Samstag ist frei!") — no proactive suggestions

### Claude's Discretion

- Exact confirmation message wording (within casual German tone)
- How to format edit confirmations (show before/after or just the result)
- Error message design for API failures
- How many upcoming events to show by default for open-ended queries

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library             | Version   | Purpose                        | Why Standard                                                                 |
| ------------------- | --------- | ------------------------------ | ---------------------------------------------------------------------------- |
| googleapis          | 171.4.0   | Official Google API client     | Google's officially supported Node.js client, handles auth and API access    |
| luxon               | 3.7.2     | Timezone-aware date operations | Superior timezone support via Intl API, immutable API, IANA timezone support |
| google-auth-library | (bundled) | Service account JWT auth       | Bundled with googleapis, handles GoogleAuth and JWT token generation         |

**Note:** Project already uses date-fns v4.1.0. While date-fns works for basic date operations, Luxon is recommended for this phase due to superior timezone handling through the Intl API. date-fns requires the separate date-fns-tz package for timezone support.

### Supporting

| Library | Version | Purpose                   | When to Use                            |
| ------- | ------- | ------------------------- | -------------------------------------- |
| rrule   | 2.8.1   | RFC 5545 recurrence rules | Phase 4: Creating recurring events     |
| zod     | 4.3.6   | Runtime validation        | Already in project, validate API input |

**Note:** rrule is deferred to Phase 4 (Advanced Features) per roadmap.

### Alternatives Considered

| Instead of      | Could Use              | Tradeoff                                                                                       |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| googleapis      | @googleapis/calendar   | Specialized package, smaller bundle but googleapis offers unified auth and multi-API access    |
| luxon           | date-fns + date-fns-tz | Project already has date-fns, works but requires extra package and less elegant timezone API   |
| Service account | OAuth2 user flow       | User decision: service account chosen for server-to-server access without user consent prompts |

**Installation:**

```bash
npm install googleapis@171.4.0 luxon@3.7.2
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── calendar/          # New: Google Calendar integration
│   ├── client.ts      # Calendar API client with auth
│   ├── operations.ts  # CRUD operations (list, create, update, delete)
│   ├── types.ts       # Calendar domain types
│   └── timezone.ts    # Timezone conversion utilities
├── config/            # Existing: Environment config
│   └── env.ts         # Add Google Calendar env vars
├── llm/               # Existing: Claude integration
│   ├── intent.ts      # Update: Enhanced entity extraction
│   └── prompts.ts     # Update: German response templates
└── signal/            # Existing: Signal messaging
    └── listener.ts    # Update: Wire calendar operations
```

### Pattern 1: Service Account Authentication

**What:** Create GoogleAuth client with service account credentials from JSON key file
**When to use:** Server-to-server API access without user OAuth flow
**Example:**

```typescript
// Source: https://github.com/googleapis/google-api-nodejs-client
import { google } from "googleapis";

export function createCalendarClient(keyFilePath: string, calendarId: string) {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  return { calendar, calendarId };
}
```

**Critical:** Service account email must have "Make changes to events" permission on the target calendar (user decision: already configured).

### Pattern 2: Timezone-Aware Event Creation

**What:** Convert user input to RFC 3339 datetime with IANA timezone
**When to use:** Creating or updating events with specific times
**Example:**

```typescript
// Using Luxon for timezone handling
import { DateTime } from "luxon";

export function createEventDateTime(
  date: string, // YYYY-MM-DD from Claude
  time: string, // HH:mm from Claude
  timezone: string, // "Europe/Berlin"
) {
  const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
    zone: timezone,
  });

  return {
    dateTime: dt.toISO(), // RFC 3339 format
    timeZone: timezone, // IANA identifier
  };
}
```

**Critical:** Always specify both `dateTime` and `timeZone` fields. Google Calendar API requires explicit timezone to handle DST correctly.

### Pattern 3: Event Search with Disambiguation

**What:** Query events by date range and text, handle multiple matches
**When to use:** Update/delete operations where user doesn't specify exact event
**Example:**

```typescript
// List events for disambiguation
async function findEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  date: string,
  titleHint?: string,
): Promise<calendar_v3.Schema$Event[]> {
  const dayStart = DateTime.fromFormat(date, "yyyy-MM-dd", {
    zone: "Europe/Berlin",
  }).startOf("day");

  const dayEnd = dayStart.endOf("day");

  const response = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISO(),
    timeMax: dayEnd.toISO(),
    singleEvents: true,
    orderBy: "startTime",
    q: titleHint, // Free text search
  });

  return response.data.items || [];
}
```

**Disambiguation flow:**

1. Find all matching events
2. If 0 matches: "Ich finde keinen Termin..."
3. If 1 match: Proceed with operation
4. If 2+ matches: Return numbered list, ask user to choose

### Pattern 4: Exponential Backoff for Rate Limits

**What:** Retry API calls with exponentially increasing delays when rate limited
**When to use:** All Calendar API operations to handle 403/429 quota errors
**Example:**

```typescript
// googleapis uses gaxios which has built-in retry
// Configure at client level:
const calendar = google.calendar({
  version: "v3",
  auth,
  retryConfig: {
    retry: 3, // Max retry attempts
    retryDelay: 1000, // Initial delay: 1s
    statusCodesToRetry: [
      [429, 429],
      [500, 599],
    ],
    httpMethodsToRetry: ["GET", "POST", "PATCH", "DELETE"],
    onRetryAttempt: (err) => {
      logger.warn({ error: err }, "Retrying Google Calendar API call");
    },
  },
});
```

**Alternative:** Implement custom retry wrapper if more control needed, but googleapis client has gaxios retry built-in.

### Pattern 5: Handling Time-Only Input ("7pm today")

**What:** Default to today if time hasn't passed, tomorrow if it has
**When to use:** User provides time but no date
**Example:**

```typescript
import { DateTime } from "luxon";

export function inferEventDate(
  time: string, // "19:00" from Claude
  timezone: string, // "Europe/Berlin"
): string {
  const now = DateTime.now().setZone(timezone);
  const [hour, minute] = time.split(":").map(Number);

  let candidate = now.set({ hour, minute, second: 0, millisecond: 0 });

  // If time has passed today, use tomorrow
  if (candidate < now) {
    candidate = candidate.plus({ days: 1 });
  }

  return candidate.toFormat("yyyy-MM-dd");
}
```

**User decision:** This pattern implements the "assume today if time hasn't passed, otherwise tomorrow" requirement.

### Anti-Patterns to Avoid

- **Using UTC offsets instead of IANA timezones:** Offsets break during DST transitions. Always use "Europe/Berlin", never "GMT+1" or "UTC+01:00".
- **Omitting timeZone field:** API defaults to calendar timezone, which may differ from user expectation. Always explicit.
- **Not handling pagination for event lists:** Maximum 2500 events per request. Check `nextPageToken` in response for longer time ranges.
- **Treating end date as inclusive for all-day events:** All-day events use exclusive end dates (single-day event: start=2026-02-14, end=2026-02-15).
- **Assuming event IDs are stable across instances:** Recurring events have per-instance IDs. Use `singleEvents: true` when querying to expand recurrences.

## Don't Hand-Roll

| Problem                  | Don't Build                    | Use Instead         | Why                                                                                         |
| ------------------------ | ------------------------------ | ------------------- | ------------------------------------------------------------------------------------------- |
| Timezone conversions     | Manual UTC offset calculations | Luxon DateTime      | DST transitions, leap seconds, historical timezone changes — edge cases are nightmarish     |
| Date parsing             | Regex parsing "next Tuesday"   | Phase 4 scope       | Relative date parsing deferred per roadmap, Claude extracts dates in Phase 2                |
| Retry logic              | Manual exponential backoff     | gaxios retryConfig  | Built into googleapis client via gaxios, handles jitter and thundering herd                 |
| OAuth flows              | Custom JWT signing             | google-auth-library | Service account auth complexity (JWT signing, token refresh) handled by GoogleAuth          |
| Recurrence rules         | Custom recurring event logic   | rrule (Phase 4)     | RFC 5545 RRULE is deceptively complex (DST, UNTIL, BYDAY edge cases), use rrule npm package |
| Event conflict detection | Manual time overlap checking   | Phase 4 scope       | Deferred to Advanced Features phase per roadmap                                             |

**Key insight:** Calendar operations have decades of edge cases (timezones, DST, leap years, recurrence). Use proven libraries. The googleapis package has 8+ years of production hardening and Google's official support.

## Common Pitfalls

### Pitfall 1: DST Transitions Break Fixed Offsets

**What goes wrong:** Events created with UTC offsets (e.g., "2026-03-29T15:00:00+01:00") don't adjust when Europe/Berlin transitions to CEST (+02:00), causing events to shift by one hour.
**Why it happens:** Fixed offsets don't capture timezone rules, only current offset.
**How to avoid:** Always use IANA timezone identifiers ("Europe/Berlin") in the `timeZone` field, not in the datetime string itself.
**Warning signs:** Events appearing at wrong times after DST changes in March/October.

**Example:**

```typescript
// ❌ WRONG: Fixed offset breaks during DST
const event = {
  start: { dateTime: "2026-10-25T15:00:00+02:00" },
  end: { dateTime: "2026-10-25T16:00:00+02:00" },
};

// ✅ CORRECT: Timezone identifier handles DST
const event = {
  start: {
    dateTime: "2026-10-25T15:00:00",
    timeZone: "Europe/Berlin",
  },
  end: {
    dateTime: "2026-10-25T16:00:00",
    timeZone: "Europe/Berlin",
  },
};
```

### Pitfall 2: Rate Limiting from Burst Traffic

**What goes wrong:** Rapid succession of API calls (e.g., creating multiple events in a loop) triggers 429 "quotaExceeded" errors, blocking further requests.
**Why it happens:** Google Calendar API enforces per-minute quotas using a sliding window. Burst traffic during one minute causes rate limiting in the next window.
**How to avoid:** Implement retry logic with exponential backoff and jitter. Avoid synchronous loops over events — batch operations or add delays.
**Warning signs:** 429 status codes, "usageLimits" error reason in response.

**Mitigation:**

```typescript
// googleapis gaxios retry config handles this automatically
// Custom wrapper if needed:
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === 429 && attempt < maxAttempts - 1) {
        const delay = Math.pow(2, attempt) * 1000 * (0.5 + Math.random());
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Pitfall 3: All-Day Event Date Confusion

**What goes wrong:** Creating a single-day all-day event with `start.date = "2026-02-14"` and `end.date = "2026-02-14"` results in a zero-duration event that doesn't display.
**Why it happens:** All-day events use **exclusive** end dates. A single-day event needs `end.date` to be the next day.
**How to avoid:** For all-day events, always set `end.date = start.date + 1 day`. Use `start.date` / `end.date` fields, not `dateTime`.
**Warning signs:** All-day events not appearing in calendar, or showing as past events immediately.

**Example:**

```typescript
// ❌ WRONG: Zero-duration all-day event
const event = {
  summary: "Birthday",
  start: { date: "2026-02-14" },
  end: { date: "2026-02-14" },
};

// ✅ CORRECT: Exclusive end date
const event = {
  summary: "Birthday",
  start: { date: "2026-02-14" },
  end: { date: "2026-02-15" }, // Next day
};
```

### Pitfall 4: Missing Pagination for Long Date Ranges

**What goes wrong:** Querying events for a year returns only the first 2500 events, silently omitting the rest.
**Why it happens:** `events.list` has a maximum pageSize of 2500. Longer ranges require pagination via `nextPageToken`.
**How to avoid:** Check for `nextPageToken` in response, make additional calls with `pageToken` parameter until no token is returned.
**Warning signs:** "Missing" events in long-term queries, inconsistent counts.

**Example:**

```typescript
async function getAllEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<calendar_v3.Schema$Event[]> {
  let allEvents: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      pageToken,
      maxResults: 250, // Lower than 2500 for reasonable responses
    });

    allEvents = allEvents.concat(response.data.items || []);
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return allEvents;
}
```

**Note:** Phase 2 scope is limited to single-day or short-range queries, so pagination is less critical. Document for future phases.

### Pitfall 5: Service Account Permission Scope

**What goes wrong:** API calls fail with 403 "Forbidden" despite valid credentials because the service account email doesn't have access to the target calendar.
**Why it happens:** Service accounts are separate Google identities. They need explicit calendar sharing permissions.
**How to avoid:** Verify the calendar is shared with the service account email (`client_email` from JSON key) with "Make changes to events" permission.
**Warning signs:** 403 errors, "Forbidden" or "Calendar not found" messages.

**Verification:**

1. Open target calendar in Google Calendar web UI
2. Settings → Share with specific people
3. Add service account email (e.g., `family-bot@project-id.iam.gserviceaccount.com`)
4. Set permission to "Make changes to events"

**User decision:** Context indicates calendar is already shared with service account. Document verification step in PLAN.

### Pitfall 6: Ambiguous Event Matching Without Disambiguation

**What goes wrong:** User says "Delete dentist" but there are three dentist appointments. Bot deletes the first match, user intended the third.
**Why it happens:** Natural language is inherently ambiguous. Text search on `events.list` may return multiple matches.
**How to avoid:** When multiple events match, return a numbered list and ask user to choose. Only proceed with single unambiguous match.
**Warning signs:** User complaints about wrong events being modified/deleted.

**User decision:** Context specifies this exact pattern: "When multiple events match an ambiguous request: bot lists matching events with numbers and asks which one."

**Implementation:**

```typescript
// After finding events:
if (events.length === 0) {
  return "Ich finde keinen Termin...";
} else if (events.length === 1) {
  // Proceed with operation
  await deleteEvent(events[0].id);
} else {
  // Disambiguation required
  const list = events
    .map((e, i) => `${i + 1}) ${e.summary} - ${formatTime(e.start)}`)
    .join("\n");
  return `Welchen meinst du?\n${list}`;
}
```

## Code Examples

Verified patterns from official sources:

### List Events for a Specific Day

```typescript
// Source: https://developers.google.com/calendar/api/v3/reference/events/list
import { google, calendar_v3 } from "googleapis";
import { DateTime } from "luxon";

async function listEventsForDay(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  date: string, // YYYY-MM-DD
  timezone: string,
): Promise<calendar_v3.Schema$Event[]> {
  const dayStart = DateTime.fromFormat(date, "yyyy-MM-dd", {
    zone: timezone,
  }).startOf("day");

  const dayEnd = dayStart.endOf("day");

  const response = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISO(),
    timeMax: dayEnd.toISO(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}
```

### Create Timed Event

```typescript
// Source: https://developers.google.com/calendar/api/guides/create-events
import { calendar_v3 } from "googleapis";

async function createEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  title: string,
  startDateTime: string, // RFC 3339
  endDateTime: string, // RFC 3339
  timezone: string,
): Promise<calendar_v3.Schema$Event> {
  const event: calendar_v3.Schema$Event = {
    summary: title,
    start: {
      dateTime: startDateTime,
      timeZone: timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: timezone,
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return response.data;
}
```

### Update Event

```typescript
// Source: https://developers.google.com/calendar/api/v3/reference/events/patch
import { calendar_v3 } from "googleapis";

async function updateEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string,
  updates: Partial<calendar_v3.Schema$Event>,
): Promise<calendar_v3.Schema$Event> {
  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updates,
  });

  return response.data;
}
```

### Delete Event

```typescript
// Source: https://developers.google.com/calendar/api/v3/reference/events/delete
import { calendar_v3 } from "googleapis";

async function deleteEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}
```

### Format Event for Display

```typescript
// User decision: "Compact one-line-per-event format"
import { calendar_v3 } from "googleapis";
import { DateTime } from "luxon";

function formatEventCompact(
  event: calendar_v3.Schema$Event,
  timezone: string,
): string {
  const start = event.start?.dateTime
    ? DateTime.fromISO(event.start.dateTime).setZone(timezone)
    : null;

  const end = event.end?.dateTime
    ? DateTime.fromISO(event.end.dateTime).setZone(timezone)
    : null;

  if (start && end) {
    return `${start.toFormat("HH:mm")} - ${event.summary}`;
  } else {
    // All-day event
    return event.summary || "Unbekannter Termin";
  }
}

// Example: "15:00 - Zahnarzt | 17:00 - Fußball"
function formatEventList(
  events: calendar_v3.Schema$Event[],
  timezone: string,
): string {
  return events.map((e) => formatEventCompact(e, timezone)).join(" | ");
}
```

## State of the Art

| Old Approach                       | Current Approach                 | When Changed | Impact                                                    |
| ---------------------------------- | -------------------------------- | ------------ | --------------------------------------------------------- |
| Moment.js for dates                | Luxon or date-fns                | 2020         | Moment deprecated, Luxon has better timezone/immutability |
| google-auth-library separate       | Bundled in googleapis            | Always       | Unified install, consistent auth patterns                 |
| Manual OAuth refresh token storage | GoogleAuth auto-refresh          | 2018+        | Service account JWT handles token lifecycle               |
| Per-second quotas                  | Per-minute sliding window quotas | May 2021     | Burst traffic now triggers rate limiting in next window   |
| node-google-calendar wrapper       | Direct googleapis usage          | Current      | Third-party wrappers lag official package updates         |

**Deprecated/outdated:**

- **Moment.js**: Deprecated in 2020, replaced by Luxon, date-fns, or Day.js. Project uses date-fns v4.1.0, consider Luxon for superior timezone support.
- **google-calendar npm package**: Outdated third-party wrapper, use official `googleapis` package.
- **node-google-calendar**: Last updated 4+ years ago, use `googleapis` directly.
- **OAuth 2.0 user flow for server bots**: Service accounts are standard for server-to-server API access without user interaction.

## Open Questions

1. **How many events to show by default for open-ended queries ("What's this week?")**
   - What we know: User decision marks this as "Claude's Discretion"
   - What's unclear: Optimal UX balance between completeness and Signal message length
   - Recommendation: Start with 5-7 events per query, paginate with "show more" if user requests. Signal messages should stay scannable on mobile.

2. **Error message strategy for transient vs permanent failures**
   - What we know: User decision marks error message design as "Claude's Discretion"
   - What's unclear: German wording for 429 rate limits vs 403 permission errors vs network failures
   - Recommendation:
     - 429 rate limits: "Zu viele Anfragen, probier's in ein paar Sekunden nochmal" (user should retry)
     - 403 permission: "Zugriff verweigert — prüf die Kalender-Freigabe" (configuration issue)
     - Network errors: "Verbindungsfehler, probier's später nochmal" (transient)
     - Unknown errors: "Fehler beim Kalender-Zugriff" + log error ID for debugging

3. **Edit confirmation format: before/after or just result?**
   - What we know: User decision marks this as "Claude's Discretion"
   - What's unclear: Balance between verbosity and clarity
   - Recommendation: Just result for simple changes ("Geändert: Zahnarzt jetzt Do 15:00"). Before/after for time moves ("Verschoben: Fußball Di 16:00 → Mi 17:00"). Keep casual tone.

4. **CommonJS vs ESM compatibility for googleapis**
   - What we know: Project uses ESM (`"type": "module"`), googleapis v171.4.0 is primarily CommonJS
   - What's unclear: Whether named imports work correctly in pure ESM project
   - Recommendation: Use `import { google } from 'googleapis'` (works in Node.js ESM despite CommonJS source). Verify during implementation in first plan.

## Sources

### Primary (HIGH confidence)

- [googleapis npm package](https://www.npmjs.com/package/googleapis) — v171.4.0 installation, API patterns
- [Google Calendar API Official Documentation](https://developers.google.com/workspace/calendar/api/guides/overview) — API reference, best practices
- [Google Calendar API Error Handling Guide](https://developers.google.com/workspace/calendar/api/guides/errors) — Error codes, retry strategies
- [Google Calendar API Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota) — Rate limits, per-minute quotas
- [Luxon Documentation](https://github.com/moment/luxon) — Timezone handling, Intl API
- [rrule npm package](https://www.npmjs.com/package/rrule) — RFC 5545 recurrence rules (Phase 4)

### Secondary (MEDIUM confidence)

- [Creating Google Service Account and using in Node.js](https://sathishsuresh.medium.com/creating-google-service-account-and-using-in-node-js-a080fb7f5bde) — Service account setup patterns
- [Managing Recurring Events in Node.js with rrule](https://blog.cybermindworks.com/post/managing-recurring-events-in-node-js-with-rrule) — rrule integration (Phase 4 scope)
- [Dealing with Timezones and Dates in Node.js (Luxon/Date-fns)](https://www.leadwithskills.com/blogs/dealing-with-timezones-dates-nodejs-luxon-datefns) — Luxon vs date-fns comparison
- [Node.js Advanced Patterns: Implementing Robust Retry Logic](https://v-checha.medium.com/advanced-node-js-patterns-implementing-robust-retry-logic-656cf70f8ee9) — Exponential backoff patterns

### Tertiary (LOW confidence)

- Community forum discussions on DST and timezone issues — Anecdotal evidence of common pitfalls, not authoritative

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — googleapis is official Google package, Luxon is well-established Moment.js successor, versions confirmed via npm
- Architecture: HIGH — Service account auth pattern from official docs, timezone patterns from Google Calendar API guide
- Pitfalls: HIGH — DST, rate limiting, all-day events documented in official error handling and event type guides; pagination limits in API reference

**Research date:** 2026-02-14
**Valid until:** ~2026-03-14 (30 days) — Google Calendar API v3 is stable, minimal breaking changes expected. Check googleapis package updates monthly.
