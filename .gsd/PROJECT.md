# Family Coordinator

## What This Is

A Signal-based calendar agent for managing a shared family Google Calendar. Family members message the bot in natural language (German) to view upcoming events, add new events, edit or delete existing ones, create recurring events, and get warned about scheduling conflicts. All interaction happens in Signal — no app switching needed.

## Core Value

Any family member can manage the shared calendar instantly through a Signal message — no app switching, no friction.

## Requirements

### Validated

- ✓ Family members can ask about upcoming events via Signal — v1.0
- ✓ Family members can add events via natural language — v1.0
- ✓ Family members can edit existing events — v1.0
- ✓ Family members can delete events with confirmation — v1.0
- ✓ Bot understands natural language input using Claude LLM — v1.0
- ✓ Bot reads and writes to a shared Google Calendar — v1.0
- ✓ Multiple family members can interact with the bot — v1.0
- ✓ Recurring events (daily/weekly/monthly) via natural language — v1.0
- ✓ Scheduling conflict detection before event creation — v1.0
- ✓ Smart German date parsing (relative dates, vague time expressions) — v1.0

### Active

(None — define for next milestone)

### Out of Scope

- Proactive reminders/notifications — calendar only, no push alerts
- Other family coordination tools (grocery lists, chores, etc.) — calendar focused
- Mobile app — Signal is the interface
- Multiple calendars per person — one shared family calendar
- Voice message input — text-only natural language
- AI-suggested scheduling — users specify times directly

## Context

Shipped v1.0 with 3,366 LOC TypeScript across 27 source files.

**Tech stack:** Node.js 22 (native TS stripping), ESM modules, signal-sdk, Google Calendar API, Anthropic Claude, PostgreSQL (conversation state + idempotency), Luxon (timezone), Zod (validation), Pino (logging).

**Architecture:** Event-driven Signal listener → Claude LLM intent extraction → Google Calendar CRUD → German response via Signal. Conversation state enables multi-turn flows (conflict confirmation, delete scope selection).

**Production:** Runs as always-on daemon listening for Signal messages. Docker PostgreSQL for state. Service account for Google Calendar access.

## Constraints

- **Signal**: No official bot API — uses signal-sdk (wraps signal-cli) for programmatic access, requires a dedicated phone number registered with Signal
- **Calendar**: Google Calendar API — requires Google Cloud project with service account
- **LLM**: Claude API — per-token cost for each interaction
- **Hosting**: Cloud-hosted (always-on to listen for Signal messages)
- **Language**: All user-facing responses in German (casual du-form)

## Key Decisions

| Decision                                 | Rationale                                                       | Outcome |
| ---------------------------------------- | --------------------------------------------------------------- | ------- |
| Signal messenger                         | User preference, privacy-focused, family already uses it        | ✓ Good  |
| signal-sdk from npm                      | Most mature wrapper for signal-cli, spawns its own process      | ✓ Good  |
| Single shared Google Calendar            | Simpler architecture, family already uses one                   | ✓ Good  |
| Claude as LLM                            | User preference, strong natural language + German understanding | ✓ Good  |
| Node 22 native TS stripping              | No build step, fast development                                 | ✓ Good  |
| ESM modules exclusively                  | Modern Node.js standard                                         | ✓ Good  |
| Zod for validation                       | Runtime type safety with fail-fast                              | ✓ Good  |
| Pino for logging                         | Structured JSON in production, pretty in dev                    | ✓ Good  |
| PostgreSQL for state                     | Consolidated conversation + idempotency storage                 | ✓ Good  |
| E.164 phone normalization                | Consistent phone format via libphonenumber-js                   | ✓ Good  |
| German du-form responses                 | Matches family's casual communication style                     | ✓ Good  |
| Claude handles date parsing (no library) | Prompt-based, no external dependency, flexible                  | ✓ Good  |
| RRULE for recurring events               | RFC 5545 standard, native Google Calendar support               | ✓ Good  |
| Event-driven message processing          | signal-sdk event emitter, no polling overhead                   | ✓ Good  |
| Commands bypass LLM                      | help/cancel don't need AI, saves API calls                      | ✓ Good  |
| Conversation state for multi-turn        | Natural flows for conflict confirmation, delete scope           | ✓ Good  |

---

_Last updated: 2026-02-16 after v1.0 milestone_
