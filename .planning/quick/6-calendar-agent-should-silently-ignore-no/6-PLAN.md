---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/signal/listener.ts
autonomous: true
must_haves:
  truths:
    - "Non-text messages (images, stickers, reactions, etc.) are silently ignored without any reply"
    - "Text messages continue to be processed normally through the full pipeline"
    - "Log entry is still written for non-text messages at debug level for observability"
  artifacts:
    - path: "src/signal/listener.ts"
      provides: "Silent ignore for non-text messages"
      contains: "Non-text message ignored"
  key_links:
    - from: "src/signal/listener.ts"
      to: "sendSignalMessage"
      via: "removed call for non-text case"
      pattern: "!text"
---

<objective>
Silence the bot's reply to non-text messages in group chats.

Purpose: Currently, every non-text message (images, stickers, reactions, voice notes, etc.) triggers the bot to reply with "Ich kann leider nur Textnachrichten verarbeiten." In group chats this is disruptive and spammy. The bot should silently ignore these messages and only log them at debug level.

Output: Updated `src/signal/listener.ts` with silent ignore behavior for non-text messages.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@src/signal/listener.ts
@src/signal/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Silently ignore non-text messages instead of replying</name>
  <files>src/signal/listener.ts</files>
  <action>
In `setupMessageListener`, find the non-text message handling block (lines 769-776):

```typescript
// Non-text message rejection
if (!text) {
  logger.debug({ messageId, phoneNumber }, "Non-text message rejected");
  await sendSignalMessage(
    deps.signalClient,
    replyTo,
    "Ich kann leider nur Textnachrichten verarbeiten.",
  );
  return;
}
```

Replace it with a silent ignore — remove the `sendSignalMessage` call entirely, keep the debug log (update log message to say "ignored" instead of "rejected"), and return early:

```typescript
// Non-text message — silently ignore (no reply, especially important in group chats)
if (!text) {
  logger.debug({ messageId, phoneNumber }, "Non-text message ignored");
  return;
}
```

Also update the JSDoc for `setupMessageListener` (line 695) — change "Filters out non-text and group messages" to "Silently ignores non-text messages (images, stickers, reactions, etc.)" since the function does not actually filter out group messages (it processes them).
</action>
<verify>
Run `npx tsc --noEmit` to confirm TypeScript compiles without errors.
Visually inspect `src/signal/listener.ts` to confirm:

1. The `sendSignalMessage` call is removed from the `!text` branch
2. The `logger.debug` call remains with updated message
3. The early `return` remains
   </verify>
   <done>
   Non-text messages are silently ignored with only a debug log entry. No reply is sent to the user or group chat. TypeScript compiles cleanly.
   </done>
   </task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- The string "Ich kann leider nur Textnachrichten verarbeiten" no longer appears in `src/signal/listener.ts`
- The `!text` branch contains only a `logger.debug` call and `return` (no `sendSignalMessage`)
- All other message handling (text messages, commands, intents) remains unchanged
</verification>

<success_criteria>

- Non-text messages produce no bot reply (silent ignore)
- Debug log still records non-text messages for observability
- All text message processing continues to work identically
- TypeScript compiles without errors
  </success_criteria>

<output>
After completion, create `.planning/quick/6-calendar-agent-should-silently-ignore-no/6-SUMMARY.md`
</output>
