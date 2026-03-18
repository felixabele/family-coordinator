# S01: Foundation Signal Infrastructure

**Goal:** Update project configuration for Signal and create the Signal client foundation layer.
**Demo:** Update project configuration for Signal and create the Signal client foundation layer.

## Must-Haves


## Tasks

- [x] **T01: 01-foundation-signal-infrastructure 01** `est:5min`
  - Update project configuration for Signal and create the Signal client foundation layer.

Purpose: Replace WhatsApp dependencies and configuration with Signal equivalents. Create the typed Signal client wrapper that all other Signal modules will depend on. This is the foundation that Plans 02 and 03 build upon.

Output: Updated package.json, env validation, constants, error classes, Signal types, and Signal client wrapper.
- [x] **T02: 01-foundation-signal-infrastructure 02**
  - Create the Signal sender and message listener that form the core message processing pipeline.

Purpose: The sender provides outbound messaging capability. The listener is the heart of the bot -- it receives incoming Signal messages, checks idempotency, extracts intent via Claude LLM, generates responses, and sends them back via Signal. This replaces the WhatsApp webhook routes + BullMQ consumer with a simpler event-driven architecture.

Output: Working sender module and message listener with full processing pipeline.
- [x] **T03: 01-foundation-signal-infrastructure 03**
  - Rewrite the application entry point as a Signal daemon, remove all obsolete WhatsApp code, and create .env.example documentation.

Purpose: This is the final wiring plan that makes the bot actually run. It replaces the Fastify/BullMQ entry point with a Signal daemon that starts listening for messages on boot. It also cleans up all dead WhatsApp/webhook/queue code and provides a checkpoint for the user to verify the bot works end-to-end.

Output: Working application entry point, clean codebase with no dead WhatsApp code, .env.example for setup guidance.

## Files Likely Touched

- `package.json`
- `src/config/env.ts`
- `src/config/constants.ts`
- `src/utils/errors.ts`
- `src/signal/types.ts`
- `src/signal/client.ts`
- `src/signal/sender.ts`
- `src/signal/listener.ts`
- `src/index.ts`
- `src/state/idempotency.ts`
- `src/db/migrations/002_idempotency.sql`
- `.env.example`
