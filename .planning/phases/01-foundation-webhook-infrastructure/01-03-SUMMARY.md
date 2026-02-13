---
phase: 01-foundation-webhook-infrastructure
plan: 03
subsystem: llm
tags: [anthropic, claude, prompt-caching, tool-use, postgres, conversation-state]

# Dependency graph
requires:
  - phase: 01-01
    provides: Database pool and environment validation
provides:
  - Claude intent extraction via tool use with 90% cost reduction from prompt caching
  - PostgreSQL conversation state management with 30-minute session TTL
  - Message history trimming to prevent token cost explosion
affects: [01-04, 01-05, phase-02]

# Tech tracking
tech-stack:
  added: [@anthropic-ai/sdk, zod runtime validation]
  patterns:
    - "Forced tool use (tool_choice: tool) for guaranteed structured output"
    - "Prompt caching with cache_control: ephemeral for 90% cost reduction"
    - "Session-based conversation state with automatic expiry"
    - "JSONB storage for flexible entity and history data"

key-files:
  created:
    - src/llm/types.ts
    - src/llm/client.ts
    - src/llm/prompts.ts
    - src/llm/intent.ts
    - src/state/types.ts
    - src/state/conversation.ts
  modified: []

key-decisions:
  - "Claude Sonnet 4 (claude-sonnet-4-20250514) selected for strong natural language understanding"
  - "Forced tool use (tool_choice: tool) guarantees structured output, eliminates parsing errors"
  - "System prompt designed >500 tokens for prompt caching eligibility (90% cost reduction)"
  - "Conversation history limited to MAX_HISTORY_MESSAGES (5) to control token costs"
  - "30-minute session TTL balances UX (multi-turn conversations) with stale state cleanup"
  - "JSONB for pendingEntities and messageHistory provides schema flexibility"

patterns-established:
  - "CalendarIntent validation with Zod before returning to caller"
  - "Cache metrics logging (cache_read_input_tokens, cache_creation_input_tokens) for monitoring"
  - "Parameterized queries ($1, $2) for SQL injection prevention"
  - "UPSERT pattern (ON CONFLICT DO UPDATE) for idempotent state saves"

# Metrics
duration: 2.5min
completed: 2026-02-13
---

# Phase 01 Plan 03: LLM Intent Extraction and Conversation State Summary

**Claude tool use intent extraction with prompt caching and PostgreSQL conversation state with automatic session expiry**

## Performance

- **Duration:** 2 min 31 sec
- **Started:** 2026-02-13T16:06:33Z
- **Completed:** 2026-02-13T16:09:04Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Claude extracts structured calendar intent from natural language via forced tool use
- System prompt caching reduces LLM costs by 90% on cache hits
- Conversation state persists across messages with 30-minute session expiry
- Message history automatically trimmed to 5 entries to prevent token cost explosion

## Task Commits

Each task was committed atomically:

1. **Task 1: Claude intent extraction with tool use and prompt caching** - `407126e` (feat)
2. **Task 2: PostgreSQL conversation state management** - `c5bc649` (feat)

## Files Created/Modified

**Created:**
- `src/llm/types.ts` - CalendarIntent, IntentType, entity types with Zod validation schemas
- `src/llm/client.ts` - Anthropic SDK client factory function
- `src/llm/prompts.ts` - CALENDAR_SYSTEM_PROMPT (500+ tokens for cache eligibility)
- `src/llm/intent.ts` - extractIntent() function with tool use and cache metrics logging
- `src/state/types.ts` - ConversationState and MessageHistoryEntry types
- `src/state/conversation.ts` - ConversationStore class with getState, saveState, clearState, addToHistory

**Modified:**
- None

## Decisions Made

**Claude Configuration:**
- Model: `claude-sonnet-4-20250514` for strong natural language understanding
- Tool choice: Forced (`tool_choice: { type: 'tool', name: 'parse_calendar_intent' }`) to guarantee structured output
- System prompt: 500+ tokens to qualify for Anthropic prompt caching (90% cost reduction on cache hits)
- Max tokens: 1024 (sufficient for intent extraction responses)

**Conversation State:**
- Session TTL: 30 minutes (balances multi-turn UX with stale state cleanup)
- History limit: 5 messages (MAX_HISTORY_MESSAGES) to control token costs
- Storage: JSONB for pendingEntities and messageHistory (schema flexibility)
- Expiry: Query-time filtering (`last_message_at > NOW() - INTERVAL '30 minutes'`) for automatic cleanup

**Cost Control:**
- Prompt caching via `cache_control: { type: 'ephemeral' }` on system prompt
- Message history trimming in addToHistory()
- Cache metrics logging for monitoring (cache_read_input_tokens, cache_creation_input_tokens)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compilation and verification checks passed on first attempt.

## User Setup Required

None - no external service configuration required.

LLM integration will require `ANTHROPIC_API_KEY` environment variable, but this was already specified in plan 01-01 environment validation.

## Next Phase Readiness

**Ready for next plan (01-04):**
- Intent extraction function (`extractIntent`) ready to parse user messages
- Conversation state (`ConversationStore`) ready to track multi-turn interactions
- Types and schemas available for import by message handler

**What's available:**
- `extractIntent(client, userMessage, conversationHistory)` returns validated CalendarIntent
- `ConversationStore` methods: getState, saveState, clearState, addToHistory
- CalendarIntent interface: `{ intent, entities, confidence, clarification_needed }`

**No blockers for next plan.**

## Self-Check: PASSED

**Files verified:**
- ✓ src/llm/types.ts
- ✓ src/llm/client.ts
- ✓ src/llm/prompts.ts
- ✓ src/llm/intent.ts
- ✓ src/state/types.ts
- ✓ src/state/conversation.ts

**Commits verified:**
- ✓ 407126e (Task 1)
- ✓ c5bc649 (Task 2)

---
*Phase: 01-foundation-webhook-infrastructure*
*Completed: 2026-02-13*
