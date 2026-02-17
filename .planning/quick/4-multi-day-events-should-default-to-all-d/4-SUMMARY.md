---
phase: quick-4
plan: 1
subsystem: calendar
tags: [all-day-events, multi-day, user-experience]
dependency_graph:
  requires: []
  provides: [multi-day-all-day-event-creation]
  affects: [llm-intent, calendar-operations, signal-listener]
tech_stack:
  added: []
  patterns: [google-calendar-all-day-format, exclusive-end-dates]
key_files:
  created:
    - path: none
  modified:
    - path: src/llm/types.ts
      why: Added all_day field to CalendarEntities
    - path: src/llm/intent.ts
      why: Updated tool schema for all_day and date_end
    - path: src/calendar/types.ts
      why: Added CreateAllDayEventInput type
    - path: src/calendar/operations.ts
      why: Added createAllDayEvent function
    - path: src/llm/prompts.ts
      why: Added multi-day all-day event rules
    - path: src/signal/listener.ts
      why: Added all-day event handling logic
decisions:
  - what: Use Google Calendar's exclusive end date convention
    why: All-day events in Google Calendar require end date to be day AFTER last day
    alternatives: []
  - what: Handle all-day events before time check in listener
    why: Multi-day events should not trigger time clarification prompt
    alternatives: []
metrics:
  duration_minutes: 2.9
  completed_at: 2026-02-17T10:31:00Z
---

# Quick Task 4: Multi-day Events Default to All-Day

**One-liner:** Multi-day date range events (e.g., "Urlaub vom 5. bis 10. März") now automatically create all-day Google Calendar events without prompting for time.

## What Changed

Multi-day events spanning multiple days (like vacation, conferences, trips) are now handled as all-day events automatically. The bot recognizes date ranges and creates proper all-day Google Calendar events without asking for a time.

### Before

User: "Trag Urlaub vom 5. bis 10. März ein"
Bot: "Zu welcher Uhrzeit soll ich das eintragen?"

### After

User: "Trag Urlaub vom 5. bis 10. März ein"
Bot: "Klar, hab ich eingetragen! Urlaub, 5. Mär bis 10. Mär (ganztägig)"

## Implementation Details

### Schema Changes

Added `all_day` field to intent schema:

- `CalendarEntities` interface and Zod schema
- LLM tool definition with description
- Updated `date_end` description to include create_event usage

### New Calendar Operation

Created `createAllDayEvent` function in `operations.ts`:

- Uses Google Calendar's `{ date }` format (not `dateTime`)
- Handles exclusive end date convention (end = last day + 1)
- Follows same error handling as `createEvent`

### LLM Prompt Updates

Added comprehensive multi-day event rules:

- When to set `all_day: true`
- Date range extraction (start + end)
- Confidence handling (0.9+, not <0.7)
- Examples for clarity
- Preserved single-day time prompt behavior

### Listener Logic

Added all-day event handling before time check:

- Detects `all_day && date && date_end`
- Calculates exclusive end date (user's end + 1 day)
- Creates event via `createAllDayEvent`
- Formats German confirmation with date range
- Preserves existing single-day clarification flow

## Deviations from Plan

None - plan executed exactly as written.

## Key Files

**Created:**

- None (all changes to existing files)

**Modified:**

- `src/llm/types.ts` - Added `all_day` field
- `src/llm/intent.ts` - Updated tool schema
- `src/calendar/types.ts` - Added `CreateAllDayEventInput`
- `src/calendar/operations.ts` - Added `createAllDayEvent` function
- `src/llm/prompts.ts` - Multi-day event rules + example
- `src/signal/listener.ts` - All-day event handling

## Commits

- `60abd3f`: feat(quick-4): add all-day event support to schema and operations
- `ad2309f`: feat(quick-4): handle multi-day all-day events in LLM and listener

## Testing Notes

**Manual verification required:**

1. "Trag Urlaub vom 5. bis 10. März ein" → creates all-day event without asking time
2. "Trag Zahnarzt morgen ein" → still asks "Zu welcher Uhrzeit soll ich das eintragen?"
3. Google Calendar shows event spanning correct date range as all-day
4. Confirmation shows readable date range with "(ganztägig)" label

## Self-Check: PASSED

**Files created:**

- None (all modifications to existing files)

**Files modified:**

- FOUND: src/llm/types.ts
- FOUND: src/llm/intent.ts
- FOUND: src/calendar/types.ts
- FOUND: src/calendar/operations.ts
- FOUND: src/llm/prompts.ts
- FOUND: src/signal/listener.ts

**Commits:**

- FOUND: 60abd3f
- FOUND: ad2309f

All claimed files and commits verified successfully.
