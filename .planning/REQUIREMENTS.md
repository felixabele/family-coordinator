# Requirements: Family Coordinator

**Defined:** 2026-02-13
**Core Value:** Any family member can manage the shared calendar instantly through a Signal message — no app switching, no friction.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calendar Operations

- [ ] **CAL-01**: User can ask about events on a specific date ("What's on today?", "What's happening Friday?")
- [ ] **CAL-02**: User can ask about a specific event ("When is Emma's dentist?")
- [ ] **CAL-03**: User can add an event via natural language ("Add soccer Tuesday at 4pm")
- [ ] **CAL-04**: User can edit an existing event ("Move the dentist to Thursday")
- [ ] **CAL-05**: User can delete an event with confirmation ("Cancel soccer this week")
- [ ] **CAL-06**: Bot confirms every calendar action with a summary of what changed

### Intelligence

- [ ] **INT-01**: Bot understands natural language calendar requests via Claude LLM
- [ ] **INT-02**: Bot resolves ambiguity when multiple events match ("Which one? 1) Dentist 2pm 2) Soccer 3pm")
- [ ] **INT-03**: Bot asks for clarification when confidence is low instead of guessing

### Infrastructure

- [ ] **INF-01**: Bot receives Signal messages via signal-cli
- [ ] **INF-02**: Bot sends responses back via Signal
- [ ] **INF-03**: Bot reads and writes to a shared Google Calendar
- [ ] **INF-04**: Multiple family members can interact with the bot
- [ ] **INF-05**: Bot is always-on (cloud-hosted, listens for messages 24/7)
- [ ] **INF-06**: Bot processes messages reliably without duplicates

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Bot sends proactive event reminders via Signal before events
- **ADV-02**: User can create recurring events ("Every Tuesday at 4pm - Piano lessons")
- **ADV-03**: Bot detects scheduling conflicts before confirming new events
- **ADV-04**: Bot supports smart relative date parsing ("next Tuesday", "in 2 weeks")
- **ADV-05**: Bot supports Signal message reactions for confirmations
- **ADV-06**: Bot tracks which family member added/modified each event

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple calendar support | One shared family calendar is v1 scope — validate single calendar first |
| Voice message input | Text-only natural language; voice adds transcription complexity |
| AI-suggested scheduling | Complex negotiation logic; users specify times directly |
| Event analytics/reporting | Not core to calendar coordination |
| Calendar sync across platforms | Google Calendar only; other platforms are separate products |
| Mobile app | Signal is the interface |
| User permissions/roles | All family members have equal CRUD access to shared calendar |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAL-01 | Phase 2 | Pending |
| CAL-02 | Phase 2 | Pending |
| CAL-03 | Phase 2 | Pending |
| CAL-04 | Phase 2 | Pending |
| CAL-05 | Phase 2 | Pending |
| CAL-06 | Phase 2 | Pending |
| INT-01 | Phase 1 | Pending |
| INT-02 | Phase 2 | Pending |
| INT-03 | Phase 2 | Pending |
| INF-01 | Phase 1 | Pending |
| INF-02 | Phase 1 | Pending |
| INF-03 | Phase 2 | Pending |
| INF-04 | Phase 3 | Pending |
| INF-05 | Phase 1 | Pending |
| INF-06 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation*
