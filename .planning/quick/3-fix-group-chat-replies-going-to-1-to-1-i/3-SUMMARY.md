---
phase: quick
plan: 3
subsystem: signal-messaging
tags: [bugfix, group-chat, routing]
dependency-graph:
  requires: []
  provides: [group-aware-reply-routing]
  affects: [signal-listener]
tech-stack:
  added: []
  patterns: [conditional-routing]
key-files:
  created: []
  modified: [src/signal/listener.ts]
decisions: []
metrics:
  duration: 3.5 min
  completed: 2026-02-17T05:47:49Z
---

# Quick Task 3: Fix Group Chat Replies Summary

Group chat messages now receive replies in the group instead of 1-to-1 DMs.

## One-liner

Implemented group-aware reply routing by extracting groupId from message envelope and routing responses to groupId || phoneNumber while preserving per-user state tracking.

## What Was Built

### Group-Aware Reply Routing

Modified `src/signal/listener.ts` to route replies based on message origin:

**New reply logic:**

```typescript
const groupId = envelope.dataMessage?.groupInfo?.groupId;
const replyTo = groupId || phoneNumber;
```

**Updated all sendSignalMessage calls (4 locations):**

1. Unknown sender rejection (line ~702)
2. Non-text message rejection (line ~714)
3. Main response (line ~785)
4. Error response in catch block (line ~810)

**Updated handleCommand function signature:**

- Added `replyTo` parameter for routing responses
- Kept `phoneNumber` for state management

**Preserved per-user tracking:**

- `phoneNumber` still used for:
  - Whitelist checks (`familyWhitelist.isAllowed`)
  - Name lookup (`familyWhitelist.getName`)
  - Conversation state (`conversationStore.*`)
  - Idempotency store (`idempotencyStore.*`)
  - Logging (for debugging who sent the message)

## Implementation Details

### Reply Target Computation

**Pattern:** `replyTo = groupId || phoneNumber`

- Group message: `replyTo = groupId` → bot replies in group
- 1-to-1 message: `replyTo = phoneNumber` → bot replies to sender

### Variable Scope

Declared `replyTo` at handler top level (`let replyTo: string | undefined;`) to ensure availability in catch block for error responses.

### State Management

All user-specific state tracking continues to use `phoneNumber` (not `replyTo`):

- Conversation history is per-user
- Whitelist is per-user
- Idempotency is per-message but logged per-user

This design ensures:

- Group members each have their own conversation context
- Bot knows WHO sent the message (phoneNumber)
- Bot knows WHERE to reply (replyTo)

## Verification

**TypeScript compilation:** Clean (`npx tsc --noEmit`)
**Prettier formatting:** Applied via pre-commit hook
**Code review:** All `sendSignalMessage` calls use `replyTo`, all state calls use `phoneNumber`

**Manual testing required:** Send message to bot in Signal group chat to verify reply arrives in group (not as DM).

## Deviations from Plan

None - plan executed exactly as written.

## Task Commits

| Task | Name                                              | Commit  | Files                  |
| ---- | ------------------------------------------------- | ------- | ---------------------- |
| 1    | Route replies to group or 1-to-1 based on message | 5340202 | src/signal/listener.ts |

## Self-Check: PASSED

**Created files:** None (modification only)

**Modified files:**

- src/signal/listener.ts: FOUND

**Commits:**

- 5340202: FOUND

All claims verified.
