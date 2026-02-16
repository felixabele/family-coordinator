# Phase 4: Advanced Features - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Bot supports recurring event creation, smart German date/time parsing, and scheduling conflict detection via Signal. Proactive reminders are part of the roadmap success criteria but were not selected for discussion — Claude has discretion on reminder implementation.

</domain>

<decisions>
## Implementation Decisions

### Recurring events

- Support simple patterns only: daily, weekly, monthly
- No custom intervals (every 2 weeks, every 3 months) — keep it simple
- When deleting/editing a recurring event, always ask: "Nur dieses oder alle zukünftigen?"
- Confirmation shows next 3 occurrences (e.g. "Fußball jeden Di um 16:00 erstellt. Nächste: 18.02, 25.02, 04.03")
- Repeat forever by default — no end date unless user specifies one ("jeden Dienstag bis Juni")

### Date parsing intelligence

- Claude LLM handles all date parsing — no separate date parsing library
- Full German support: "nächsten Dienstag", "übermorgen", "in 2 Wochen", "15. März", "Mittwochabend"
- Ambiguous relative dates resolved deterministically: "nächsten Freitag" on a Friday = 7 days from now (always the coming one)
- Vague time expressions use sensible defaults:
  - "morgens" = 09:00
  - "mittags" = 12:00
  - "nachmittags" = 15:00
  - "abends" = 19:00

### Conflict detection

- Detect overlapping time ranges only — not back-to-back events
- Check all events on the shared calendar (not per-person)
- All-day events (birthdays, holidays) do NOT trigger conflict warnings
- On conflict: warn and ask "Trotzdem erstellen?" — user confirms or cancels

### Claude's Discretion

- Proactive event reminder implementation (timing, format, opt-in behavior)
- How recurring event patterns are mapped to Google Calendar RRULE
- Exact LLM prompt structure for date extraction
- Conflict detection query window (how far to look ahead)

</decisions>

<specifics>
## Specific Ideas

- German casual tone maintained (du-form) — consistent with Phase 2/3 decisions
- Date parsing happens entirely in the LLM prompt — Claude extracts structured date/time from German natural language, no code-level parsing library needed
- Recurring event confirmation format: show pattern + next 3 dates for user confidence

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-advanced-features_
_Context gathered: 2026-02-16_
