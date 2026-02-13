---
phase: 01-foundation-signal-infrastructure
plan: 03
subsystem: daemon-entry-point
status: checkpoint-reached
checkpoint_type: human-verify
tags:
  - signal-daemon
  - entry-point
  - idempotency
  - cleanup
dependency_graph:
  requires:
    - 01-01 (Signal client and types)
    - 01-02 (Signal sender and listener)
  provides:
    - signal-daemon-entry-point
    - postgresql-idempotency
    - env-documentation
  affects:
    - application-startup
    - message-processing-pipeline
tech_stack:
  added:
    - postgresql-idempotency-store
  patterns:
    - daemon-process
    - graceful-shutdown
    - startup-cleanup
key_files:
  created:
    - src/db/migrations/002_idempotency.sql
    - .env.example
  modified:
    - src/index.ts
    - src/state/idempotency.ts
    - src/signal/listener.ts
  deleted:
    - src/webhook/ (directory)
    - src/queue/ (directory)
    - src/messaging/ (directory)
decisions:
  - decision: "Migrate idempotency from Redis to PostgreSQL"
    rationale: "Consolidates state storage, removes Redis dependency, simplifies infrastructure"
    alternatives: ["Keep Redis for idempotency", "Use in-memory store with TTL"]
  - decision: "Signal daemon uses event-driven listener (no explicit startListening call)"
    rationale: "signal-sdk uses EventEmitter pattern; listener registration is sufficient"
    alternatives: ["Polling approach", "Explicit start/stop methods"]
  - decision: "Run idempotency cleanup on startup"
    rationale: "Prevents table bloat, ensures old records are pruned without separate cron"
    alternatives: ["Separate cleanup cron", "PostgreSQL TTL extension", "No cleanup"]
metrics:
  tasks_completed: 2
  tasks_total: 3
  duration_minutes: 3
  commits: 2
---

# Phase 1 Plan 3: Signal Daemon Entry Point Summary

**One-liner:** Complete Signal daemon entry point with PostgreSQL-backed idempotency, graceful shutdown, and cleaned codebase (WhatsApp code removed).

## Overview

This plan rewrote the application entry point from a Fastify/BullMQ/WhatsApp webhook server into a Signal daemon that listens for messages on boot. It migrated idempotency tracking from Redis to PostgreSQL, removed all obsolete WhatsApp/webhook/queue code, and created comprehensive .env.example documentation.

**Status:** Checkpoint reached at Task 3 (human-verify) - awaiting user verification of end-to-end bot functionality.

## Tasks Completed

### Task 1: Migrate idempotency to PostgreSQL and delete obsolete WhatsApp code
**Commit:** 0608c82

**What was done:**
- Created migration `002_idempotency.sql` with `processed_messages` table
- Migrated `IdempotencyStore` from Redis (`ioredis`) to PostgreSQL (`pg.Pool`)
- Added `cleanup()` method to remove records older than 7 days
- Deleted obsolete directories:
  - `src/webhook/` (WhatsApp webhook handlers, signature validation)
  - `src/queue/` (BullMQ connection, producer, consumer)
  - `src/messaging/` (WhatsApp sender, message templates)

**Files modified:**
- Created: `src/db/migrations/002_idempotency.sql`
- Modified: `src/state/idempotency.ts` (Redis → PostgreSQL)
- Deleted: 13 files across 3 directories

**Verification:**
- ✅ Migration file exists
- ✅ Obsolete directories deleted (webhook, queue, messaging)
- ✅ IdempotencyStore uses `Pool` from `pg`
- ✅ No `ioredis` references remaining

---

### Task 2: Rewrite entry point as Signal daemon and create .env.example
**Commit:** 9b9200a

**What was done:**
- Rewrote `src/index.ts` as Signal daemon entry point:
  - Validates environment (validateEnv)
  - Creates Signal client, Anthropic client, state stores
  - Runs idempotency cleanup on startup
  - Sets up message listener
  - Registers SIGTERM/SIGINT graceful shutdown handlers
- Created `.env.example` with Signal-focused configuration
- Removed all references to Fastify, BullMQ, Redis, webhook routes
- Fixed type compatibility bug in `listener.ts` (CalendarIntent type import)

**Files modified:**
- Modified: `src/index.ts` (167 lines → 103 lines, complete rewrite)
- Modified: `src/signal/listener.ts` (added CalendarIntent import for type safety)
- Created: `.env.example` (6 environment variables documented)

**Verification:**
- ✅ TypeScript compilation passes (`npx tsc --noEmit`)
- ✅ .env.example exists and documents all required variables
- ✅ No dead imports (fastify, bullmq, ioredis, webhook, queue, messaging)
- ✅ createAnthropicClient properly imported and used

---

### Task 3: Verify Signal bot starts and processes messages
**Status:** CHECKPOINT REACHED - Awaiting human verification

**What needs verification:**
User must verify the complete Signal bot works end-to-end:
1. Bot starts with `npm run dev` (after migrations run)
2. Bot receives Signal messages from another account
3. Bot processes messages and responds with intent acknowledgments
4. Duplicate messages sent quickly result in only one response (idempotency working)
5. Ctrl+C triggers graceful shutdown

See checkpoint details below for full verification steps.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CalendarIntent type compatibility in listener.ts**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `generateResponse()` function had generic type `{ intent: string; entities: Record<string, unknown> }` but was being passed `CalendarIntent` which uses `CalendarEntities` interface (not index-signatured)
- **Fix:** Imported `CalendarIntent` type and updated function signature to accept `CalendarIntent` directly
- **Files modified:** `src/signal/listener.ts`
- **Commit:** 9b9200a (included in Task 2 commit)

---

## Architecture Notes

### Idempotency Migration
The shift from Redis to PostgreSQL for idempotency storage consolidates state management and removes an external dependency. The `cleanup()` method runs on application startup, providing automatic maintenance without requiring a separate cron job.

### Signal Daemon Pattern
Unlike the previous Fastify server, the Signal daemon doesn't have an explicit "start server" step. The signal-sdk library uses an EventEmitter pattern where registering the message event handler (via `setupMessageListener`) is sufficient to begin receiving messages.

### Graceful Shutdown
The daemon handles SIGTERM and SIGINT signals by:
1. Attempting to stop/close the Signal client (if methods exist)
2. Closing the PostgreSQL connection pool
3. Logging completion and exiting cleanly

This ensures no in-flight database operations are lost during shutdown.

---

## Next Steps

**After checkpoint verification passes:**
1. User will test the bot end-to-end and confirm functionality
2. If issues found, they will be addressed in a gap closure plan
3. If approved, Phase 1 is complete and Phase 2 (Google Calendar integration) begins

---

## Self-Check: PENDING

Checkpoint reached before final verification. Self-check will be completed after human verification and plan completion.
