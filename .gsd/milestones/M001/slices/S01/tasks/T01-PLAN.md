# T01: 01-foundation-signal-infrastructure 01

**Slice:** S01 — **Milestone:** M001

## Description

Update project configuration for Signal and create the Signal client foundation layer.

Purpose: Replace WhatsApp dependencies and configuration with Signal equivalents. Create the typed Signal client wrapper that all other Signal modules will depend on. This is the foundation that Plans 02 and 03 build upon.

Output: Updated package.json, env validation, constants, error classes, Signal types, and Signal client wrapper.

## Must-Haves

- [ ] "Bot environment is configured for Signal messaging"
- [ ] "Environment validation requires SIGNAL_PHONE_NUMBER instead of WhatsApp variables"
- [ ] "Signal client wrapper initializes with phone number and retry/rate-limit config"

## Files

- `package.json`
- `src/config/env.ts`
- `src/config/constants.ts`
- `src/utils/errors.ts`
- `src/signal/types.ts`
- `src/signal/client.ts`
