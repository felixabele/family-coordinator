---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/signal/listener.ts
autonomous: true
must_haves:
  truths:
    - "Non-calendar text messages in group chats produce no bot reply"
    - "Non-calendar text messages in 1-to-1 chats still get a helpful reply"
    - "Calendar-related messages in group chats still get processed and replied to normally"
  artifacts:
    - path: "src/signal/listener.ts"
      provides: "Group chat silent ignore for non-calendar text"
      contains: "groupId.*intent"
  key_links:
    - from: "setupMessageListener handler"
      to: "handleIntent return value"
      via: "conditional send based on groupId + intent type"
      pattern: "groupId.*intent\\.(intent|unclear|greeting)"
---

<objective>
Suppress bot replies to non-calendar text messages in group chats.

Purpose: In group chats, casual conversation (e.g., "lol", "Guten Appetit", "Danke!") triggers
the LLM which classifies the intent as "unclear" or "greeting", then the bot responds with an
apology or greeting. This is noisy and disruptive. In group chats, these non-actionable replies
should be silently suppressed. In 1-to-1 chats, the current behavior (replying helpfully) remains.

Output: Modified `src/signal/listener.ts` that checks for group context after intent extraction
and silently skips responses for non-calendar intents.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/quick/6-calendar-agent-should-silently-ignore-no/6-SUMMARY.md
@src/signal/listener.ts
@src/llm/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Suppress non-calendar replies in group chats</name>
  <files>src/signal/listener.ts</files>
  <action>
In `setupMessageListener`, after the intent is extracted (line ~813) and before `handleIntent` is
called (line ~829), add a group chat filter that silently ignores non-calendar intents.

The logic should be:

1. After `extractIntent()` returns the intent (around line 813), check if BOTH conditions are true:
   - `groupId` is truthy (message is from a group chat)
   - `intent.intent` is NOT a calendar action (i.e., intent is "unclear", "greeting", or "help")

2. If both conditions are true:
   - Log at debug level: "Non-calendar message in group chat ignored" with phoneNumber, intent, and groupId
   - `return` early (skip handleIntent, skip sendSignalMessage, skip conversation history update)

3. Calendar action intents ("create_event", "query_events", "update_event", "delete_event") in
   group chats MUST still be processed normally.

4. Also suppress responses for low-confidence intents in group chats: if `groupId` is truthy AND
   `intent.confidence < 0.7` AND intent is "create_event" or similar but has `clarification_needed`,
   skip the reply. Rationale: in a group chat, asking "Zu welcher Uhrzeit?" for a message that
   wasn't even directed at the bot is worse than staying silent.
   HOWEVER, only do this for confidence below 0.5 to avoid suppressing legitimate but slightly
   ambiguous calendar requests. Use 0.5 as the threshold, not 0.7.

The check should go AFTER the logger.info for "Intent extracted successfully" (line ~823) and
BEFORE the memberName lookup (line ~826).

Implementation pattern:

```typescript
// In group chats, silently ignore non-calendar intents
const isGroupChat = !!groupId;
const isCalendarAction = [
  "create_event",
  "query_events",
  "update_event",
  "delete_event",
].includes(intent.intent);

if (isGroupChat && !isCalendarAction) {
  logger.debug(
    { phoneNumber, intent: intent.intent, groupId },
    "Non-calendar message in group chat ignored",
  );
  return;
}

// In group chats, also ignore very low confidence calendar intents (likely not directed at bot)
if (isGroupChat && isCalendarAction && intent.confidence < 0.5) {
  logger.debug(
    {
      phoneNumber,
      intent: intent.intent,
      confidence: intent.confidence,
      groupId,
    },
    "Low-confidence calendar intent in group chat ignored",
  );
  return;
}
```

Do NOT modify any other behavior. 1-to-1 chat handling remains exactly the same.
Do NOT change the handleIntent function or the intent extraction.
Do NOT change the non-text message handling (already silenced in quick-6).
</action>
<verify>

1. `npx tsc --noEmit` passes with no errors
2. Grep for the new debug log message to confirm it exists
3. Verify that `sendSignalMessage` is NOT called for group + non-calendar path
4. Verify that calendar intents (create_event, query_events, etc.) still reach handleIntent when groupId is set
   </verify>
   <done>

- Non-calendar text in group chats (unclear, greeting, help intents) produces no bot reply
- Very low confidence calendar intents (< 0.5) in group chats produce no bot reply
- Calendar intents with confidence >= 0.5 in group chats still get processed normally
- All 1-to-1 chat behavior unchanged (unclear/greeting/help still get replies)
- TypeScript compiles without errors
  </done>
  </task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit` must pass
2. Code review: the early return must be AFTER intent extraction and BEFORE handleIntent call
3. The groupId variable must be in scope at the point of the check (it is -- defined at line 737)
4. No regression: calendar intents in group chats still handled
5. No regression: all 1-to-1 chat behavior unchanged
</verification>

<success_criteria>

- Bot stays silent when someone sends "lol", "Danke", "Guten Appetit" etc. in a group chat
- Bot still responds to "Trag Zahnarzt morgen um 10 ein" in a group chat
- Bot still responds to "Hallo" in a 1-to-1 chat with the greeting message
- Bot still responds to unclear messages in 1-to-1 with helpful guidance
  </success_criteria>

<output>
After completion, create `.planning/quick/7-silently-ignore-non-calendar-text-messag/7-SUMMARY.md`
</output>
