# Roadmap: Family Coordinator

## Overview

Build a Signal-based calendar agent for family coordination in four phases: establish Signal messaging infrastructure and conversation foundations, integrate Google Calendar with full CRUD operations, expand to multi-user coordination with improved UX, and add advanced features like reminders and recurring events. Each phase delivers a coherent, verifiable capability that builds toward the core value: any family member can manage the shared calendar instantly through Signal.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Signal Infrastructure** - Signal messaging, conversation state, and Claude integration
- [x] **Phase 2: Calendar Integration & CRUD** - Google Calendar connection with full create/read/update/delete operations
- [x] **Phase 3: Multi-User & Polish** - Multi-user coordination and UX improvements
- [x] **Phase 4: Advanced Features** - Event reminders, recurring events, and smart date parsing

## Phase Details

### Phase 1: Foundation & Signal Infrastructure

**Goal**: Bot can receive Signal messages, understand natural language via Claude, and respond conversationally
**Depends on**: Nothing (first phase)
**Requirements**: INF-01, INF-02, INF-05, INF-06, INT-01
**Success Criteria** (what must be TRUE):

1. Bot receives Signal messages via signal-cli and processes them reliably
2. Bot sends responses back via Signal without message duplication
3. Bot understands natural language calendar intent using Claude LLM
4. Bot maintains conversation state across multiple messages from the same user
5. Bot runs as an always-on service listening for incoming Signal messages
   **Plans**: 3 plans

Plans:

- [ ] 01-01-PLAN.md — Update dependencies and config for Signal, create Signal client wrapper
- [ ] 01-02-PLAN.md — Create Signal sender and message listener with processing pipeline
- [ ] 01-03-PLAN.md — Rewrite entry point, remove WhatsApp code, verify end-to-end

### Phase 2: Calendar Integration & CRUD

**Goal**: Family members can perform all calendar operations (view, add, edit, delete) through Signal
**Depends on**: Phase 1
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, INF-03, INT-02, INT-03
**Success Criteria** (what must be TRUE):

1. User can ask about events on specific dates and receive accurate results from Google Calendar
2. User can ask about specific events and bot finds them correctly
3. User can add new events via natural language and they appear in Google Calendar with correct timezone
4. User can edit existing events and changes are reflected in Google Calendar
5. User can delete events with confirmation, preventing accidental deletions
6. Bot confirms every calendar mutation with a summary of what changed
7. Bot asks for clarification when multiple events match or confidence is low instead of guessing
   **Plans**: 2 plans

Plans:

- [x] 02-01-PLAN.md — Google Calendar client, types, timezone utilities, and CRUD operations
- [x] 02-02-PLAN.md — Wire calendar into Signal pipeline with German responses

### Phase 3: Multi-User & Polish

**Goal**: Multiple family members can coordinate through the bot with improved UX
**Depends on**: Phase 2
**Requirements**: INF-04
**Success Criteria** (what must be TRUE):

1. Multiple family members can interact with the bot and access the shared calendar
2. Bot identifies which family member sent each message
3. User can reset stuck conversations with help/cancel commands
4. Conversation context times out gracefully after 30 minutes of inactivity
   **Plans**: 2 plans

Plans:

- [x] 03-01-PLAN.md — Family member whitelist config module with Zod validation and libphonenumber-js
- [x] 03-02-PLAN.md — Wire access control, command detection, group chat support into message pipeline

### Phase 4: Advanced Features

**Goal**: Bot supports recurring events, smart German date parsing, and scheduling conflict detection
**Depends on**: Phase 3
**Requirements**: ADV-02, ADV-03, ADV-04
**Success Criteria** (what must be TRUE):

1. User can create recurring events ("every Tuesday at 4pm") via natural language
2. Bot parses smart relative dates ("next Tuesday", "in 2 weeks") accurately
3. Bot detects scheduling conflicts and warns before confirming new events
   **Plans**: 2 plans

Plans:

- [x] 04-01-PLAN.md — Recurring event types, RRULE formatting, and enhanced German date parsing prompt
- [x] 04-03-PLAN.md — Conflict detection, recurring event UX flows, and pipeline integration

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase                                 | Plans Complete | Status   | Completed  |
| ------------------------------------- | -------------- | -------- | ---------- |
| 1. Foundation & Signal Infrastructure | 3/3            | Complete | 2026-02-14 |
| 2. Calendar Integration & CRUD        | 2/2            | Complete | 2026-02-14 |
| 3. Multi-User & Polish                | 2/2            | Complete | 2026-02-15 |
| 4. Advanced Features                  | 2/2            | Complete | 2026-02-16 |

---

_Roadmap created: 2026-02-13_
_Last updated: 2026-02-16 — Phase 4 complete (recurring events, conflict detection, German date parsing)_
