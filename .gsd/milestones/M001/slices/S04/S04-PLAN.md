# S04: Advanced Features

**Goal:** Add recurring event support (daily/weekly/monthly) with RRULE formatting and enhance the LLM prompt for intelligent German date parsing and recurrence pattern detection.
**Demo:** Add recurring event support (daily/weekly/monthly) with RRULE formatting and enhance the LLM prompt for intelligent German date parsing and recurrence pattern detection.

## Must-Haves


## Tasks

- [x] **T01: 04-advanced-features 01**
  - Add recurring event support (daily/weekly/monthly) with RRULE formatting and enhance the LLM prompt for intelligent German date parsing and recurrence pattern detection.

Purpose: Enables users to create recurring events via natural language ("jeden Dienstag um 16 Uhr") and ensures the LLM accurately resolves German relative dates and vague time expressions.

Output: Recurring event creation with RRULE in Google Calendar, enhanced LLM prompt with German date parsing rules, confirmation messages showing next 3 occurrences.
- [x] **T02: 04-advanced-features 03**
  - Wire conflict detection and recurring event handling into the message processing pipeline.

Purpose: Completes Phase 4 by integrating advanced features into the live application — users experience conflict warnings, recurring event creation with confirmation, and recurring event deletion with scope selection.

Output: Fully integrated advanced features — conflict detection before event creation, recurring event CRUD with proper UX flows.

## Files Likely Touched

- `src/llm/types.ts`
- `src/llm/prompts.ts`
- `src/llm/intent.ts`
- `src/calendar/types.ts`
- `src/calendar/recurring.ts`
- `src/calendar/operations.ts`
- `src/signal/listener.ts`
- `src/calendar/conflicts.ts`
- `src/config/constants.ts`
