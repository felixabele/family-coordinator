# Roadmap: Family Coordinator

## Overview

Build a WhatsApp-based calendar agent for family coordination in four phases: establish webhook infrastructure and conversation foundations, integrate Google Calendar with full CRUD operations, expand to multi-user coordination with improved UX, and add advanced features like reminders and recurring events. Each phase delivers a coherent, verifiable capability that builds toward the core value: any family member can manage the shared calendar instantly through WhatsApp.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Webhook Infrastructure** - WhatsApp webhooks, conversation state, and Claude integration
- [ ] **Phase 2: Calendar Integration & CRUD** - Google Calendar connection with full create/read/update/delete operations
- [ ] **Phase 3: Multi-User & Polish** - Multi-user coordination, interactive messages, and UX improvements
- [ ] **Phase 4: Advanced Features** - Event reminders, recurring events, and smart date parsing

## Phase Details

### Phase 1: Foundation & Webhook Infrastructure
**Goal**: Bot can receive WhatsApp messages, understand natural language via Claude, and respond conversationally
**Depends on**: Nothing (first phase)
**Requirements**: INF-01, INF-02, INF-05, INF-06, INT-01
**Success Criteria** (what must be TRUE):
  1. Bot receives WhatsApp messages via verified webhook with proper signature validation
  2. Bot processes messages asynchronously and returns 200 within WhatsApp's 5-second timeout
  3. Bot sends responses back via WhatsApp without message duplication
  4. Bot understands natural language calendar intent using Claude LLM
  5. Bot maintains conversation state across multiple messages from the same user
**Plans**: TBD

Plans:
- [ ] (Plans will be created during planning phase)

### Phase 2: Calendar Integration & CRUD
**Goal**: Family members can perform all calendar operations (view, add, edit, delete) through WhatsApp
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
**Plans**: TBD

Plans:
- [ ] (Plans will be created during planning phase)

### Phase 3: Multi-User & Polish
**Goal**: Multiple family members can coordinate through the bot with improved UX and interactive confirmations
**Depends on**: Phase 2
**Requirements**: INF-04
**Success Criteria** (what must be TRUE):
  1. Multiple family members can interact with the bot and access the shared calendar
  2. Bot identifies which family member sent each message
  3. Bot uses WhatsApp interactive messages (quick reply buttons) for confirmations
  4. User can reset stuck conversations with help/cancel commands
  5. Conversation context times out gracefully after 30 minutes of inactivity
**Plans**: TBD

Plans:
- [ ] (Plans will be created during planning phase)

### Phase 4: Advanced Features
**Goal**: Bot proactively reminds users of upcoming events and supports recurring event creation
**Depends on**: Phase 3
**Requirements**: (All v2 requirements from REQUIREMENTS.md - deferred scope)
**Success Criteria** (what must be TRUE):
  1. Bot sends proactive event reminders via approved WhatsApp templates before events
  2. User can create recurring events ("every Tuesday at 4pm") via natural language
  3. Bot parses smart relative dates ("next Tuesday", "in 2 weeks") accurately
  4. Bot detects scheduling conflicts and warns before confirming new events
**Plans**: TBD

Plans:
- [ ] (Plans will be created during planning phase)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Webhook Infrastructure | 0/TBD | Not started | - |
| 2. Calendar Integration & CRUD | 0/TBD | Not started | - |
| 3. Multi-User & Polish | 0/TBD | Not started | - |
| 4. Advanced Features | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-13*
*Last updated: 2026-02-13*
