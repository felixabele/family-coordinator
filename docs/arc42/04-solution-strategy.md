# 4. Solution Strategy

## 4.1 Technology Decisions

| Decision        | Choice                      | Rationale                                                                  |
| --------------- | --------------------------- | -------------------------------------------------------------------------- |
| Language        | TypeScript (Node.js 22)     | Native TS stripping removes build step; strong typing for reliability      |
| Messaging       | Signal via signal-sdk       | Family already uses Signal; privacy-focused; signal-sdk wraps signal-cli   |
| LLM             | Anthropic Claude (Sonnet 4) | Strong German language understanding; tool use for structured output       |
| Calendar        | Google Calendar API v3      | Family already uses shared Google Calendar; service account for bot access |
| Database        | PostgreSQL                  | Reliable, supports JSONB for conversation state; simple schema             |
| Timezone        | Luxon                       | Robust IANA timezone handling; German locale support                       |
| Validation      | Zod                         | Runtime type safety at boundaries (env, LLM output, config files)          |
| Logging         | Pino                        | Structured JSON logging; pretty-print in dev, raw JSON in production       |
| Process manager | PM2                         | Auto-restart, memory limits, log management for daemon process             |
| Phone parsing   | libphonenumber-js           | E.164 normalization for consistent phone number matching                   |

## 4.2 Top-Level Decomposition

The system is decomposed **by domain/feature**, not by technical layer:

- `src/signal/` -- Signal messaging (receive + send)
- `src/llm/` -- LLM intent extraction (Claude tool use)
- `src/calendar/` -- Google Calendar operations (CRUD, conflicts, recurring, timezone)
- `src/state/` -- Conversation and idempotency state (PostgreSQL-backed)
- `src/config/` -- Environment validation, constants, family whitelist
- `src/db/` -- Database connection pool and migrations
- `src/utils/` -- Cross-cutting utilities (logger, error classes)

The entry point `src/index.ts` wires all modules together via dependency injection.

## 4.3 Key Design Patterns

| Pattern                        | Where Applied                                                         | Purpose                                                          |
| ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Event-driven architecture      | `src/signal/listener.ts`                                              | Signal messages processed via event emitter; no polling          |
| Dependency injection           | `src/index.ts`, `MessageListenerDeps` interface                       | All dependencies wired at startup; modules are loosely coupled   |
| Tool use for structured output | `src/llm/intent.ts`                                                   | Forces Claude to return validated JSON via tool_choice           |
| Idempotency guard              | `src/state/idempotency.ts`                                            | Prevents duplicate message processing from Signal retries        |
| Conversation state machine     | `src/signal/listener.ts`, `src/state/conversation.ts`                 | Multi-turn flows (conflict confirmation, delete scope selection) |
| Factory functions              | `src/signal/client.ts`, `src/calendar/client.ts`, `src/llm/client.ts` | Encapsulate client creation with configuration                   |
| Domain error classes           | `src/calendar/types.ts`, `src/utils/errors.ts`                        | Typed errors enable intent-specific error handling in listener   |
| Whitelist access control       | `src/config/family-members.ts`                                        | O(1) phone/UUID lookup; rejects unknown senders                  |
