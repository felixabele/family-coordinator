---
phase: 01-foundation-signal-infrastructure
plan: 02
subsystem: signal-messaging
tags: [signal, messaging, llm-integration, event-driven]

dependency_graph:
  requires:
    - 01-01 (Signal client wrapper and types)
    - src/llm/intent.ts (LLM intent extraction)
    - src/state/conversation.ts (Conversation state management)
    - src/state/idempotency.ts (Message deduplication)
  provides:
    - sendSignalMessage (outbound messaging)
    - setupMessageListener (message processing pipeline)
  affects:
    - Future daemon/main.ts will use setupMessageListener to activate the bot

tech_stack:
  added: []
  patterns:
    - Event-driven message processing via signal-sdk events
    - Dependency injection pattern for listener setup
    - Pipeline architecture (receive -> dedupe -> state -> LLM -> respond)

key_files:
  created:
    - src/signal/sender.ts (55 lines)
    - src/signal/listener.ts (230 lines)
  modified: []

decisions:
  - Decision: Use signal-sdk event emitter pattern instead of polling
    Rationale: Event-driven architecture is simpler and more responsive than polling receive()
    Impact: Listener registers once on daemon startup, processes messages as they arrive

  - Decision: Mark messages as processed BEFORE processing (not after)
    Rationale: Prevents race conditions if Signal delivers duplicate while still processing
    Impact: Even if processing fails, message won't be reprocessed (fail-once semantics)

  - Decision: Phase 1 calendar operations return stub messages
    Rationale: Full pipeline validates LLM integration without requiring Google Calendar
    Impact: Users can test intent extraction, but calendar ops are placeholders until Phase 2

metrics:
  duration: 2 min
  tasks_completed: 2
  files_created: 2
  lines_added: 285
  commits: 2
  completed_at: 2026-02-13T17:39:51Z
---

# Phase 1 Plan 2: Signal Sender & Message Listener Summary

**One-liner:** Event-driven Signal message processing pipeline with LLM intent extraction, idempotency, and conversation state management.

## What Was Built

Created the core message processing pipeline for the Signal bot:

1. **Signal Sender** (`src/signal/sender.ts`)
   - Simple wrapper around signal-sdk's `sendMessage`
   - Error handling with `SignalSendError`
   - Logging for success/failure tracking
   - Relies on SignalClient's built-in retry configuration

2. **Signal Listener** (`src/signal/listener.ts`)
   - Event handler for `'message'` events from signal-sdk
   - Full processing pipeline:
     - **Receive**: Parses `SignalEnvelope` from signal-sdk events
     - **Filter**: Skips non-text messages and group messages (Phase 1: direct only)
     - **Deduplicate**: Checks `IdempotencyStore` before processing
     - **State**: Retrieves conversation state via `ConversationStore`
     - **LLM**: Extracts intent via `extractIntent` (Claude tool use)
     - **Respond**: Generates appropriate response based on intent type
     - **Send**: Replies via `sendSignalMessage`
     - **Track**: Adds user/assistant messages to conversation history
   - Error handling that prevents daemon crashes

## Processing Pipeline Flow

```
Signal Message Arrives
        ↓
Extract (phoneNumber, messageId, text) from envelope
        ↓
Filter: Skip if no text or group message
        ↓
Idempotency: Check isProcessed(messageId)
        ↓
Mark as processed (before processing - prevent races)
        ↓
Get conversation state (history, pending intent)
        ↓
Add user message to history
        ↓
Claude LLM: extractIntent(text, history)
        ↓
Generate response based on intent type
        ↓
Send response via Signal
        ↓
Add assistant response to history
```

## Intent Handling (Phase 1)

| Intent Type    | Response                                                        |
| -------------- | --------------------------------------------------------------- |
| `greeting`     | Welcome message introducing the bot                             |
| `help`         | List of supported commands                                      |
| `create_event` | Stub: "Calendar integration coming in Phase 2" + entity summary |
| `query_events` | Stub: "Calendar integration coming in Phase 2" + entity summary |
| `update_event` | Stub: "Calendar integration coming in Phase 2" + entity summary |
| `delete_event` | Stub: "Calendar integration coming in Phase 2" + entity summary |
| `unclear`      | Uses LLM's `clarification_needed` or generic unclear message    |

**Why stubs?** Phase 1 validates the full pipeline (Signal ↔ LLM ↔ State) without requiring Google Calendar integration. Users can test that the bot understands their requests. Phase 2 will replace stubs with actual calendar operations.

## Implementation Details

### Sender (`sendSignalMessage`)

- **Signature**: `(client: SignalClient, recipient: string, text: string) => Promise<void>`
- **Error handling**: Wraps in try/catch, throws `SignalSendError` on failure
- **Logging**: Debug on send attempt, info on success, error on failure
- **Retries**: Handled automatically by SignalClient configuration (no manual retry)

### Listener (`setupMessageListener`)

- **Setup**: Registers a single `'message'` event handler on SignalClient
- **Dependencies**: Injected via `MessageListenerDeps` interface
  - `signalClient`: SignalClient instance
  - `anthropicClient`: Anthropic SDK client
  - `conversationStore`: PostgreSQL-backed state
  - `idempotencyStore`: Redis-backed deduplication
- **Event payload**: Receives `SignalEnvelope` from signal-sdk
  - `envelope.source` / `envelope.sourceNumber`: sender phone number
  - `envelope.timestamp`: used as unique message ID
  - `envelope.dataMessage.message`: text content
  - `envelope.dataMessage.groupInfo`: indicates group message (skipped)

### Error Handling Strategy

1. **Per-message try/catch**: Each message handler wrapped independently
2. **Error response to user**: Attempts to send "Sorry, I had trouble..." message
3. **No re-throw**: Event handlers return normally to prevent daemon crash
4. **Logging**: All errors logged with context (phoneNumber, messageId)

This ensures one bad message doesn't crash the bot.

## Dependencies Wiring

All pipeline components integrated correctly:

- ✅ `IdempotencyStore.isProcessed()` / `markProcessed()` called
- ✅ `ConversationStore.getState()` / `addToHistory()` called
- ✅ `extractIntent()` called with message and history
- ✅ `sendSignalMessage()` called for responses

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- ✅ Signal sender can send text messages with error handling and logging
- ✅ Signal listener receives messages, deduplicates, extracts intent via Claude, and responds
- ✅ Full processing pipeline is wired: receive → deduplicate → state → LLM → respond
- ✅ Listener gracefully handles errors without crashing the daemon
- ✅ Phase 1 responds to all intent types with appropriate messages (calendar stubs for Phase 2)

## Self-Check

### Files Created

- ✅ `src/signal/sender.ts` exists
- ✅ `src/signal/listener.ts` exists

### Commits Exist

- ✅ `4e6ad51`: feat(01-02): implement Signal message sender
- ✅ `c1485bb`: feat(01-02): implement Signal message listener with processing pipeline

### Exports Verified

```bash
$ grep "export.*sendSignalMessage" src/signal/sender.ts
export async function sendSignalMessage(

$ grep "export.*setupMessageListener" src/signal/listener.ts
export function setupMessageListener(deps: MessageListenerDeps): void {
```

### Pipeline Wiring Verified

```bash
$ grep "isProcessed\|markProcessed" src/signal/listener.ts
      const isAlreadyProcessed = await deps.idempotencyStore.isProcessed(
      await deps.idempotencyStore.markProcessed(messageId);

$ grep "extractIntent" src/signal/listener.ts
import { extractIntent } from '../llm/intent.js';
      const intent = await extractIntent(

$ grep "conversationStore" src/signal/listener.ts
  conversationStore: ConversationStore;
      const state = await deps.conversationStore.getState(phoneNumber);
      await deps.conversationStore.addToHistory(phoneNumber, 'user', text);
      await deps.conversationStore.addToHistory(

$ grep "sendSignalMessage" src/signal/listener.ts
import { sendSignalMessage } from './sender.js';
      await sendSignalMessage(deps.signalClient, phoneNumber, response);
          await sendSignalMessage(
```

**Self-Check: PASSED**

## What's Next

**Phase 1 Plan 3** will create the daemon (`src/daemon.ts` or `src/main.ts`) that:

- Initializes all dependencies (SignalClient, Anthropic, DB pool, stores)
- Calls `setupMessageListener()` to activate the message handler
- Connects the SignalClient and starts listening for messages
- Provides graceful shutdown on SIGTERM/SIGINT

After Plan 3, Phase 1 will be complete and the bot will be runnable (though calendar operations will still be stubs until Phase 2).
