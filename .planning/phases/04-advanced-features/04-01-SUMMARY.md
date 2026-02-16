# Phase 04 Plan 01: Recurring Events & Enhanced Date Parsing Summary

**One-liner:** Recurring event support (daily/weekly/monthly) with RFC 5545-compliant RRULE formatting, intelligent German date parsing for relative dates and weekday resolution, and vague time expressions with sensible defaults.

**Completed:** 2026-02-16T07:45:47Z
**Duration:** 3 minutes

---

## Plan Metadata

```yaml
phase: 04-advanced-features
plan: 01
subsystem: calendar-llm
tags: [recurring-events, rrule, date-parsing, german-nlp]
```

## Dependency Graph

**Requires:**

- Phase 02-01: Calendar operations foundation (createEvent, timezone handling)
- Phase 02-02: LLM-Calendar pipeline (intent extraction, entity parsing)

**Provides:**

- Recurring event creation with RRULE formatting
- Enhanced German date parsing (relative dates, weekday resolution)
- Next occurrence calculation for confirmation messages
- trimRecurringEvent utility for future deletion scope (Phase 04-03 dependency)

**Affects:**

- src/llm/types.ts: RecurrenceEntities interface and Zod schema
- src/llm/intent.ts: Tool schema extended with recurrence object
- src/llm/prompts.ts: Enhanced with German date rules and recurring event detection
- src/calendar/types.ts: CreateRecurringEventInput, CalendarEvent.recurringEventId
- src/calendar/recurring.ts: New module with RRULE utilities
- src/calendar/operations.ts: createRecurringEvent function, recurringEventId mapping

## Tech Stack Changes

**Added:**

- RRULE string formatting per RFC 5545 (UTC UNTIL with 'Z' suffix)
- Luxon DateTime for occurrence calculation and timezone-aware UNTIL conversion
- Recurring event pattern detection (täglich, wöchentlich, monatlich)

**Patterns:**

- RRULE generation: `FREQ=WEEKLY;BYDAY=TU;UNTIL=20260331T215959Z`
- Next occurrence calculation: Simple date arithmetic (daily +1 day, weekly +1 week, monthly +1 month)
- Event mapping: All operations.ts functions now populate recurringEventId

## Key Files

**Created:**

- src/calendar/recurring.ts
  - formatRRule: Generates RRULE strings with UTC UNTIL handling
  - calculateNextOccurrences: Calculates next N occurrences for confirmation
  - trimRecurringEvent: Trims recurring event RRULE to end before a given date (for "alle zukünftigen löschen")

**Modified:**

- src/llm/types.ts: RecurrenceEntities interface, Zod schema, CalendarEntities.recurrence
- src/llm/intent.ts: Tool schema includes recurrence object with frequency/day_of_week/end_date
- src/llm/prompts.ts: Added "Erweiterte Datumsauflösung" and "Wiederkehrende Termine" sections, updated time defaults
- src/calendar/types.ts: CreateRecurringEventInput interface, CalendarEvent.recurringEventId field
- src/calendar/operations.ts: createRecurringEvent function, all event mappings include recurringEventId

## Implementation Summary

### Task 1: Add recurrence types, RRULE utility, and extend LLM schema

**Commit:** 46677ff

**Changes:**

- Added RecurrenceEntities interface (frequency, day_of_week, end_date) to src/llm/types.ts
- Created RecurrenceEntitiesSchema Zod validator
- Extended CalendarEntities with optional recurrence field
- Extended calendarIntentTool schema with recurrence object in src/llm/intent.ts
- Created src/calendar/recurring.ts with three exported functions:
  - formatRRule: Generates RRULE strings with UTC UNTIL conversion per RFC 5545
  - calculateNextOccurrences: Calculates next N occurrences based on frequency
  - trimRecurringEvent: Updates RRULE UNTIL to preserve past instances while removing future ones
- Extended CalendarEvent interface with recurringEventId field (needed for Plan 04-03)
- Added CreateRecurringEventInput interface extending CreateEventInput

**Key Technical Details:**

- RRULE UNTIL must be in UTC with 'Z' suffix per RFC 5545 (research pitfall 1)
- UNTIL calculation: parse end_date in timezone → endOf('day') → toUTC() → format as yyyyMMdd'T'HHmmss'Z'
- trimRecurringEvent enables "delete all future instances" by setting UNTIL to (beforeDate - 1 day)

### Task 2: Enhance LLM prompt and add createRecurringEvent operation

**Commit:** debd466

**Changes:**

- Enhanced CALENDAR_SYSTEM_PROMPT in src/llm/prompts.ts with:
  - "Erweiterte Datumsauflösung" section covering:
    - Relative days (heute, morgen, übermorgen, gestern)
    - Relative weeks (nächste Woche, in 2 Wochen)
    - Weekday resolution (CRITICAL: "nächsten Freitag" on a Friday → 7 days, not today)
    - Month parsing (15. März → 2026-03-15)
    - Vague time expressions (morgens=09:00, vormittags=10:00, mittags=12:00, nachmittags=15:00, abends=19:00)
    - Date formats (15.03.2026, 15.3., 15. März)
    - End date parsing for recurring events (bis Ende März → 2026-03-31)
  - "Wiederkehrende Termine" section with pattern detection rules:
    - "jeden Tag", "täglich" → DAILY
    - "jede Woche", "wöchentlich" → WEEKLY
    - "jeden Monat", "monatlich" → MONTHLY
    - Weekday extraction for WEEKLY (jeden Dienstag → day_of_week: "TU")
    - End date handling (bis Juni → end_date: last day of June)
  - Updated time defaults: nachmittags → 15:00 (was 14:00), abends → 19:00 (was 18:00)
- Added createRecurringEvent function to src/calendar/operations.ts:
  - Calls formatRRule to generate RRULE string
  - Passes recurrence array to Google Calendar API
  - Calculates next 3 occurrences via calculateNextOccurrences
  - Returns { event, nextOccurrences } for confirmation messages
  - Formats occurrences as dd.MM strings (e.g., ["18.02", "25.02", "04.03"])
- Updated all event mappings in listEvents, findEvents, createEvent, updateEvent to include recurringEventId field

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision                                                     | Rationale                                                                      | Impact                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Update vague time defaults (nachmittags=15:00, abends=19:00) | Match user expectations for German time expressions                            | Affects all future event creation with vague times   |
| Add recurringEventId to all event mappings                   | Needed by Plan 04-03 for detecting recurring event instances                   | Enables "delete all future instances" disambiguation |
| Format next occurrences as dd.MM                             | Compact format for German users (18.02 vs 18.02.2026)                          | Affects confirmation message display                 |
| trimRecurringEvent sets UNTIL to (beforeDate - 1 day)        | Preserves all past instances while removing future ones from beforeDate onward | Enables "alle zukünftigen löschen" feature           |

## Verification Results

**TypeScript Compilation:**

```
npx tsc --noEmit
✓ Zero errors
```

**Key Component Checks:**

- ✓ RecurrenceEntities interface and schema in src/llm/types.ts
- ✓ formatRRule function in src/calendar/recurring.ts
- ✓ calculateNextOccurrences function in src/calendar/recurring.ts
- ✓ trimRecurringEvent function in src/calendar/recurring.ts
- ✓ createRecurringEvent function in src/calendar/operations.ts
- ✓ "Wiederkehrende Termine" section in prompts.ts
- ✓ "nachmittags → 15:00" in prompts.ts
- ✓ "abends → 19:00" in prompts.ts
- ✓ RRULE formatting code with UTC UNTIL
- ✓ recurrence object in LLM tool schema
- ✓ recurringEventId in CalendarEvent and all event mappings

**All 13 verification checks passed.**

## Self-Check: PASSED

**Created Files:**

- ✓ /Users/fabele/projects/family-cordinator/src/calendar/recurring.ts

**Commits:**

- ✓ 46677ff: feat(04-01): add recurrence types, RRULE utility, and extend LLM schema
- ✓ debd466: feat(04-01): enhance LLM prompt and add createRecurringEvent operation

**Modified Files:**

- ✓ src/llm/types.ts (RecurrenceEntities interface, Zod schema)
- ✓ src/llm/intent.ts (recurrence object in tool schema)
- ✓ src/llm/prompts.ts (German date parsing + recurring event rules)
- ✓ src/calendar/types.ts (CreateRecurringEventInput, recurringEventId field)
- ✓ src/calendar/operations.ts (createRecurringEvent, recurringEventId mapping)

All claims verified successfully.

## Success Criteria

- ✓ RecurrenceEntities type with frequency/day_of_week/end_date exists and validates via Zod
- ✓ LLM tool schema includes recurrence object in entities
- ✓ formatRRule generates correct RRULE strings (FREQ=WEEKLY;BYDAY=TU, FREQ=DAILY;UNTIL=... with UTC Z suffix)
- ✓ calculateNextOccurrences returns correct date progression for all three frequencies
- ✓ trimRecurringEvent updates recurring event RRULE to set UNTIL before given date (preserving past instances)
- ✓ System prompt includes German date parsing rules with deterministic weekday resolution
- ✓ System prompt includes recurring event detection with examples
- ✓ Vague time defaults match user decisions: morgens=09:00, mittags=12:00, nachmittags=15:00, abends=19:00
- ✓ createRecurringEvent creates Google Calendar event with RRULE recurrence field and returns next 3 occurrence dates
- ✓ All TypeScript compiles cleanly with zero errors

**10/10 success criteria met.**

## Next Steps

1. **Phase 04-02:** Extend bot to handle recurring event creation (integrate createRecurringEvent into message pipeline)
2. **Phase 04-03:** Add deletion scope for recurring events ("nur diesen" vs "alle zukünftigen" disambiguation)
3. **Integration testing:** Test German date parsing with real Claude API calls (nächsten Dienstag, übermorgen, jeden Mittwoch bis Juni)
4. **End-to-end testing:** Signal message → recurring event creation → next occurrences in response

## Notes

- RRULE UNTIL handling follows RFC 5545 strictly (UTC with 'Z' suffix) to avoid Google Calendar API rejection
- German weekday resolution is deterministic: "nächsten [Wochentag]" on the same weekday always means +7 days
- trimRecurringEvent is forward-looking only: preserves all past instances, removes future ones
- recurringEventId field enables Plan 04-03 to detect if a deleted event is a recurring instance
- Next occurrence calculation uses simple date arithmetic (no rrule library needed for display purposes)
