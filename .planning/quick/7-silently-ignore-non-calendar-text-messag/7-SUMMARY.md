---
phase: quick-7
plan: 01
subsystem: signal-listener
tags: [group-chat, intent-filtering, noise-reduction]
dependency_graph:
  requires: [quick-6]
  provides: [group-chat-silent-ignore]
  affects: [signal/listener]
tech_stack:
  added: []
  patterns: [conditional-early-return, intent-classification]
key_files:
  created: []
  modified: [src/signal/listener.ts]
decisions:
  - "Use 0.5 confidence threshold for low-confidence calendar intent suppression in group chats"
  - "Check groupId + intent type after extraction, before handleIntent call"
  - "Keep all 1-to-1 chat behavior unchanged (greetings/unclear still get replies)"
metrics:
  duration_minutes: 0.7
  completed_at: "2026-02-19T15:59:03Z"
  task_count: 1
  file_count: 1
  commit_count: 1
---

# Quick Task 7: Silently ignore non-calendar text messages in group chats

**One-liner:** Group chat noise reduction - bot stays silent for non-calendar text (greetings, unclear, low-confidence intents)

## Objective

Suppress bot replies to non-calendar text messages in group chats to prevent noise from casual conversation. Messages like "lol", "Guten Appetit", "Danke!" previously triggered LLM classification as "unclear" or "greeting", resulting in disruptive bot responses in group contexts.

## Implementation

### Task 1: Suppress non-calendar replies in group chats

**Commit:** `1c7ced3`

**Changes:**

Added group chat filtering logic in `setupMessageListener` (lines 825-854) after intent extraction and before handleIntent call:

1. **Non-calendar intent suppression:** If `groupId` is present AND intent is NOT a calendar action (create_event, query_events, update_event, delete_event), return early with debug log.

2. **Low-confidence calendar intent suppression:** If `groupId` is present AND intent IS a calendar action BUT confidence < 0.5, return early with debug log. This prevents bot from asking clarifying questions for messages that weren't directed at it.

3. **1-to-1 chat behavior unchanged:** All messages in 1-to-1 chats (no groupId) continue to receive replies for unclear/greeting/help intents.

**Files modified:**

- `src/signal/listener.ts` - Added 31 lines of group chat filtering logic

## Verification

- TypeScript compilation: `npx tsc --noEmit` passes with no errors
- Debug log messages confirmed present via grep
- Early returns happen AFTER intent extraction and BEFORE handleIntent/sendSignalMessage
- Calendar intents with confidence >= 0.5 in group chats still reach handleIntent
- groupId variable is in scope at the point of the check (defined at line 737)

## Success Criteria Met

- Bot stays silent when someone sends "lol", "Danke", "Guten Appetit" in a group chat (non-calendar intent)
- Bot stays silent for very low confidence calendar intents in group chats (< 0.5)
- Bot still responds to "Trag Zahnarzt morgen um 10 ein" in a group chat (calendar intent with good confidence)
- Bot still responds to "Hallo" in a 1-to-1 chat with the greeting message
- Bot still responds to unclear messages in 1-to-1 with helpful guidance

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

**Files created:** None (all modifications to existing files)

**Files modified:**

```bash
[ -f "src/signal/listener.ts" ] && echo "FOUND: src/signal/listener.ts"
```

FOUND: src/signal/listener.ts

**Commits:**

```bash
git log --oneline --all | grep -q "1c7ced3"
```

FOUND: 1c7ced3

## Impact

**User Experience:**

- Group chats are no longer polluted with bot apologies for casual conversation
- Bot remains helpful in 1-to-1 contexts
- Reduces LLM usage for non-actionable group messages

**Technical:**

- Clean separation: groupId-based routing determines reply behavior
- No changes to intent extraction or handleIntent logic
- Maintains all existing calendar functionality

## Next Steps

None - quick task complete. Group chat noise reduction successfully implemented.
