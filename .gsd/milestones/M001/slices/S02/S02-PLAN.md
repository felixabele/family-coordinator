# S02: Calendar Crud

**Goal:** Build the complete Google Calendar integration module: authenticated API client, timezone utilities, and all CRUD operations (list, create, update, delete).
**Demo:** Build the complete Google Calendar integration module: authenticated API client, timezone utilities, and all CRUD operations (list, create, update, delete).

## Must-Haves


## Tasks

- [x] **T01: 02-calendar-crud 01** `est:4min`
  - Build the complete Google Calendar integration module: authenticated API client, timezone utilities, and all CRUD operations (list, create, update, delete).

Purpose: This is the calendar foundation that Phase 2's pipeline integration depends on. All calendar operations are self-contained in `src/calendar/` and can be tested independently before wiring into the Signal message pipeline.

Output: Complete `src/calendar/` module with client, types, timezone utilities, and CRUD operations ready for integration.
- [x] **T02: 02-calendar-crud 02** `est:3min`
  - Wire Google Calendar operations into the Signal message pipeline: update Claude prompts for German responses, replace Phase 1 stub responses with real calendar CRUD operations, and connect the CalendarClient in the application entry point.

Purpose: This plan transforms the bot from a stub-response demo into a working calendar assistant. After this plan, a family member can send a Signal message like "Was steht morgen an?" and receive real events from Google Calendar.

Output: Fully integrated Signal-to-Calendar pipeline responding in casual German.

## Files Likely Touched

- `package.json`
- `src/config/env.ts`
- `.env.example`
- `src/calendar/types.ts`
- `src/calendar/client.ts`
- `src/calendar/timezone.ts`
- `src/calendar/operations.ts`
- `src/llm/prompts.ts`
- `src/llm/types.ts`
- `src/llm/intent.ts`
- `src/signal/listener.ts`
- `src/index.ts`
