# M001: v1.0 MVP

**Vision:** Build a Signal-based calendar agent for family coordination — any family member can manage the shared calendar instantly through a Signal message, no app switching, no friction.

## Success Criteria

- Signal bot receives and responds to messages with calendar operations
- Full CRUD operations on shared Google Calendar via natural language
- Multi-user access control with family member whitelist
- Recurring events with RRULE and conflict detection
- All responses in casual German du-form


## Slices

- [x] **S01: Foundation Signal Infrastructure** `risk:medium` `depends:[]`
  > After this: Update project configuration for Signal and create the Signal client foundation layer.
- [x] **S02: Calendar Crud** `risk:medium` `depends:[S01]`
  > After this: Build the complete Google Calendar integration module: authenticated API client, timezone utilities, and all CRUD operations (list, create, update, delete).
- [x] **S03: Multi User Polish** `risk:medium` `depends:[S02]`
  > After this: Create the family member whitelist configuration module with Zod-validated JSON loading and in-memory phone number lookup.
- [x] **S04: Advanced Features** `risk:medium` `depends:[S03]`
  > After this: Add recurring event support (daily/weekly/monthly) with RRULE formatting and enhance the LLM prompt for intelligent German date parsing and recurrence pattern detection.
