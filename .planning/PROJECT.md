# Family Coordinator

## What This Is

A Signal-based calendar agent for managing a shared family Google Calendar. Family members message the bot in natural language to ask about upcoming events, add new events, edit existing ones, or delete them. It replaces the constant app-switching between Signal and calendar apps.

## Core Value

Any family member can manage the shared calendar instantly through a Signal message — no app switching, no friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Family members can ask about upcoming events via Signal ("What's on today?", "When is Emma's dentist?")
- [ ] Family members can add events via natural language ("Add soccer practice Tuesday at 4pm")
- [ ] Family members can edit existing events ("Move the dentist to Thursday")
- [ ] Family members can delete events ("Cancel soccer this week")
- [ ] Bot understands natural language input using Claude LLM
- [ ] Bot reads and writes to a shared Google Calendar
- [ ] Multiple family members can interact with the bot (not just one person)

### Out of Scope

- Proactive reminders/notifications — calendar only, no push alerts
- Other family coordination tools (grocery lists, chores, etc.) — calendar focused
- Mobile app — Signal is the interface
- Multiple calendars per person — one shared family calendar

## Context

- Family of multiple members who currently coordinate schedules through Signal conversations and separate calendar apps
- The pain point is context-switching: someone asks "when is X?" in Signal, and you have to open the calendar app, find the answer, and switch back to reply
- The bot lives where the conversations already happen — Signal
- signal-cli or signal-cli-rest-api will be used for programmatic Signal access (no official Signal Bot API exists)
- Google Calendar API for calendar access
- Claude (Anthropic) as the LLM for natural language understanding

## Constraints

- **Signal**: No official bot API — uses signal-cli (community tool) for programmatic access, requires a dedicated phone number registered with Signal
- **Calendar**: Google Calendar API — requires Google Cloud project and OAuth/service account
- **LLM**: Claude API — per-token cost for each interaction
- **Hosting**: Cloud-hosted (always-on to listen for Signal messages)
- **Language**: Natural language processing must handle casual family-style messages

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Signal messenger | User preference, privacy-focused, family already uses it | — Pending |
| signal-cli for Signal access | Most mature community tool for programmatic Signal access | — Pending |
| Single shared Google Calendar | Simpler architecture, family already uses one | — Pending |
| Claude as LLM | User preference, strong natural language understanding | — Pending |
| Cloud hosting | Must be always-on to listen for Signal messages | — Pending |
| Calendar only (no reminders, no extras) | Keep v1 focused and shippable | — Pending |

---
*Last updated: 2026-02-13 after initialization*
