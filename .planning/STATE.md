# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Any family member can manage the shared calendar instantly through a Signal message — no app switching, no friction.
**Current focus:** Phase 3 - Multi-User & Polish

## Current Position

Phase: 2 of 4 (Calendar Integration & CRUD) — COMPLETE
Plan: 2 of 2 in current phase — complete
Status: Phase 2 complete, Phase 3 ready to plan
Last activity: 2026-02-14 — Phase 2 verified (7/7 must-haves, 9/9 requirements)

Progress: [███████░░░] 50% (Phase 1 complete, Phase 2 complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: 4 min
- Total execution time: 0.32 hours

**By Phase:**

| Phase | Plans | Total  | Avg/Plan |
| ----- | ----- | ------ | -------- |
| 1     | 3     | 12 min | 4 min    |
| 2     | 2     | 7 min  | 3.5 min  |

**Recent Trend:**

- Last 5 plans: 01-02 (2 min), 01-03 (5 min), 02-01 (4 min), 02-02 (3 min)
- Trend: Accelerating - Phase 2 completed in 3-4 minutes per plan

_Updated after each plan completion_

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Signal messaging selected for private, secure family communication — project restructure
- Claude as LLM for strong natural language understanding
- Single shared Google Calendar for simpler architecture
- Node 22 native TypeScript stripping for production (no tsc build step)
- ESM modules exclusively (type: module) for modern Node.js standard
- Zod for environment validation with fail-fast approach
- Pino for structured logging (JSON in production, pretty in dev)
- signal-sdk from npm (not GitHub — GitHub install missing dist/) for Signal messaging integration — 01-01
- E.164 phone number format validation with regex in Zod schema — 01-01
- Retry config: 3 max attempts, exponential backoff from 1s to 10s — 01-01
- Rate limiting: 5 concurrent, 200ms minimum interval between API calls — 01-01
- Removed WhatsApp/BullMQ/Redis/Fastify dependencies in favor of event-driven Signal client — 01-01
- Event-driven message processing via signal-sdk event emitter (not polling) — 01-02
- Mark messages as processed BEFORE processing to prevent race conditions — 01-02
- Phase 1 calendar operations return stubs to validate pipeline without Google Calendar — 01-02
- Migrate idempotency from Redis to PostgreSQL for consolidated state storage — 01-03
- Run idempotency cleanup on application startup (7-day retention) — 01-03
- Signal daemon uses event listener registration (no explicit startListening call) — 01-03
- signal-sdk spawns its own signal-cli process via connect() — no separate daemon needed — verification
- Use system signal-cli (brew) path instead of bundled binary — verification
- Set Anthropic baseURL explicitly to avoid ANTHROPIC_BASE_URL env var (Portkey proxy) — verification
- Docker PostgreSQL on port 5433 to avoid conflict with local PostgreSQL — verification
- IANA timezone identifiers (Europe/Berlin) for DST-safe Google Calendar handling — 02-01
- Default event duration: 1 hour when no end time specified — 02-01
- Date inference: assume today if time hasn't passed, tomorrow if passed — 02-01
- Event search disambiguation: return single/multiple/not found for LLM processing — 02-01
- Retry configuration: 3 max attempts on 429 and 5xx errors for Calendar API — 02-01
- German localization for all user responses with casual du-form tone — 02-02
- Bot asks for time when creating event without time specified — 02-02
- Compact event display format: 'HH:mm - Title | HH:mm - Title' — 02-02
- Disambiguation shows numbered list for multiple event matches — 02-02

### Pending Todos

(From .planning/todos/pending/ — ideas captured during sessions)

None yet.

### Blockers/Concerns

(Issues that affect future work)

**Phase 1: COMPLETE**

- ✅ Signal client foundation established with types and wrapper (01-01)
- ✅ Message processing pipeline complete with LLM integration (01-02)
- ✅ Entry point, idempotency migration, WhatsApp cleanup (01-03)
- ✅ End-to-end verified: receive Signal message → Claude intent extraction → send response

**Phase 2: COMPLETE**

- ✅ Calendar foundation with CRUD operations (02-01)
- ✅ Calendar pipeline integration (02-02)
- ✅ End-to-end verified: Signal message → Claude (German) → Google Calendar → Signal response

**Phase 2 Considerations:**

- ✅ Timezone handling uses explicit IANA timezones (Europe/Berlin) — implemented in 02-01
- Google Calendar quota attribution requires quotaUser parameter per family member — deferred to Phase 3
- Service account requires manual setup (Google Cloud project, calendar sharing) — user action needed

**Phase 3 Considerations:**

- Multi-user Signal identification pattern needs research (how to identify which family member sent message)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 2 complete and verified. Ready for Phase 3 planning.
Resume file: None

---

_State initialized: 2026-02-13_
_Last updated: 2026-02-14 — Phase 2 complete and verified, ready for Phase 3_
