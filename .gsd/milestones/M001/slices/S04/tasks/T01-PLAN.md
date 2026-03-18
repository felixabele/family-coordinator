# T01: 04-advanced-features 01

**Slice:** S04 — **Milestone:** M001

## Description

Add recurring event support (daily/weekly/monthly) with RRULE formatting and enhance the LLM prompt for intelligent German date parsing and recurrence pattern detection.

Purpose: Enables users to create recurring events via natural language ("jeden Dienstag um 16 Uhr") and ensures the LLM accurately resolves German relative dates and vague time expressions.

Output: Recurring event creation with RRULE in Google Calendar, enhanced LLM prompt with German date parsing rules, confirmation messages showing next 3 occurrences.

## Must-Haves

- [ ] "LLM extracts recurrence entities (frequency, day_of_week, end_date) from German natural language"
- [ ] "RRULE strings are correctly formatted for daily, weekly, and monthly patterns"
- [ ] "Recurring events are created in Google Calendar with valid RRULE recurrence field"
- [ ] "Confirmation message shows next 3 occurrences after creating a recurring event"
- [ ] "LLM parses German relative dates (nächsten Dienstag, übermorgen, in 2 Wochen) accurately"
- [ ] "Vague time expressions resolve to sensible defaults (morgens=09:00, abends=19:00)"

## Files

- `src/llm/types.ts`
- `src/llm/prompts.ts`
- `src/llm/intent.ts`
- `src/calendar/types.ts`
- `src/calendar/recurring.ts`
- `src/calendar/operations.ts`
