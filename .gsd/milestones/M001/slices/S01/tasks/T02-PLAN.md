# T02: 01-foundation-signal-infrastructure 02

**Slice:** S01 — **Milestone:** M001

## Description

Create the Signal sender and message listener that form the core message processing pipeline.

Purpose: The sender provides outbound messaging capability. The listener is the heart of the bot -- it receives incoming Signal messages, checks idempotency, extracts intent via Claude LLM, generates responses, and sends them back via Signal. This replaces the WhatsApp webhook routes + BullMQ consumer with a simpler event-driven architecture.

Output: Working sender module and message listener with full processing pipeline.

## Must-Haves

- [ ] "Bot can send text messages to a Signal phone number"
- [ ] "Bot receives incoming Signal messages as typed events"
- [ ] "Bot deduplicates messages using idempotency store before processing"
- [ ] "Bot processes messages through LLM intent extraction and responds"

## Files

- `src/signal/sender.ts`
- `src/signal/listener.ts`
