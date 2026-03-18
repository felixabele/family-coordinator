# T01: 02-calendar-crud 01

**Slice:** S02 — **Milestone:** M001

## Description

Build the complete Google Calendar integration module: authenticated API client, timezone utilities, and all CRUD operations (list, create, update, delete).

Purpose: This is the calendar foundation that Phase 2's pipeline integration depends on. All calendar operations are self-contained in `src/calendar/` and can be tested independently before wiring into the Signal message pipeline.

Output: Complete `src/calendar/` module with client, types, timezone utilities, and CRUD operations ready for integration.

## Must-Haves

- [ ] "Calendar client authenticates with Google Calendar API using service account credentials"
- [ ] "Calendar operations can list events for a specific date range"
- [ ] "Calendar operations can create events with timezone-aware start/end times"
- [ ] "Calendar operations can update existing events by ID"
- [ ] "Calendar operations can delete events by ID"
- [ ] "Timezone utilities correctly infer date when only time is provided"
- [ ] "Default event duration is 1 hour when no end time specified"

## Files

- `package.json`
- `src/config/env.ts`
- `.env.example`
- `src/calendar/types.ts`
- `src/calendar/client.ts`
- `src/calendar/timezone.ts`
- `src/calendar/operations.ts`
