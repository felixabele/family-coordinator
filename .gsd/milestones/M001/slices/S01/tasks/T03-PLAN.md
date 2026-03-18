# T03: 01-foundation-signal-infrastructure 03

**Slice:** S01 — **Milestone:** M001

## Description

Rewrite the application entry point as a Signal daemon, remove all obsolete WhatsApp code, and create .env.example documentation.

Purpose: This is the final wiring plan that makes the bot actually run. It replaces the Fastify/BullMQ entry point with a Signal daemon that starts listening for messages on boot. It also cleans up all dead WhatsApp/webhook/queue code and provides a checkpoint for the user to verify the bot works end-to-end.

Output: Working application entry point, clean codebase with no dead WhatsApp code, .env.example for setup guidance.

## Must-Haves

- [ ] "Bot starts as a daemon process that listens for Signal messages"
- [ ] "Bot gracefully shuts down on SIGTERM/SIGINT (closes Signal client, DB pool)"
- [ ] "Bot logs startup with configuration details"
- [ ] "Old WhatsApp/BullMQ/Fastify code is removed from the project"
- [ ] ".env.example documents all required environment variables"

## Files

- `src/index.ts`
- `src/state/idempotency.ts`
- `src/db/migrations/002_idempotency.sql`
- `.env.example`
