---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/signal/listener.ts
autonomous: true
must_haves:
  truths:
    - "When a message arrives from a group chat, the bot replies in the group chat"
    - "When a message arrives from a 1-to-1 chat, the bot still replies in the 1-to-1 chat"
    - "Whitelist checks and conversation state still use the sender's phone number, not the group ID"
  artifacts:
    - path: "src/signal/listener.ts"
      provides: "Group-aware reply routing"
      contains: "groupId"
  key_links:
    - from: "src/signal/listener.ts"
      to: "sendSignalMessage"
      via: "replyTo variable (groupId || phoneNumber)"
      pattern: "replyTo"
---

<objective>
Fix group chat replies going to 1-to-1 instead of group.

Purpose: When a message is sent to the bot in a Signal group chat, the bot currently replies to the sender in a 1-to-1 DM. It should reply in the group instead.

Output: Updated `src/signal/listener.ts` with group-aware reply routing.
</objective>

<context>
@src/signal/listener.ts
@src/signal/sender.ts
@src/signal/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Route replies to group or 1-to-1 based on message origin</name>
  <files>src/signal/listener.ts</files>
  <action>
In `setupMessageListener`, after extracting `phoneNumber` (line 674), extract the group ID:

```typescript
const groupId = envelope.dataMessage?.groupInfo?.groupId;
```

Compute the reply target (where to send the response):

```typescript
const replyTo = groupId || phoneNumber;
```

Then replace ALL `sendSignalMessage` calls in `setupMessageListener` that currently use `phoneNumber` as the recipient with `replyTo` instead. There are 4 calls:

1. **Unknown sender rejection** (~line 695): Change `phoneNumber` to `replyTo`
2. **Non-text message rejection** (~line 708): Change `phoneNumber` to `replyTo`
3. **Main response** (~line 778): Change `phoneNumber` to `replyTo`
4. **Error response in catch block** (~line 805): Change `phoneNumber` to `replyTo`

Update the `handleCommand` function signature to accept a `replyTo` parameter for where to send the response, separate from `phoneNumber` which is still used for conversation state:

```typescript
async function handleCommand(
  command: "help" | "cancel",
  phoneNumber: string,
  replyTo: string,
  deps: MessageListenerDeps,
): Promise<void> {
  await deps.conversationStore.clearState(phoneNumber); // keep phoneNumber for state
  const response =
    command === "help" ? HELP_TEXT : "Alles klar, was kann ich für dich tun?";
  await sendSignalMessage(deps.signalClient, replyTo, response); // use replyTo for sending
  logger.info({ phoneNumber, command }, "Command executed, state reset");
}
```

Update the `handleCommand` call site (~line 738) to pass `replyTo`:

```typescript
await handleCommand(command, phoneNumber, replyTo, deps);
```

IMPORTANT: Keep using `phoneNumber` (NOT `replyTo`) for:

- `deps.familyWhitelist.isAllowed(phoneNumber)` (whitelist is per-user)
- `deps.familyWhitelist.getName(phoneNumber)` (name lookup is per-user)
- `deps.conversationStore.*` calls (conversation state is per-user)
- `deps.idempotencyStore.*` calls
- All logger calls (for debugging, we want to know WHO sent it)
- The `phoneNumber` parameter passed to `handleIntent` (used for conversation state internally)

Note: `replyTo` must be declared at the top of the handler alongside `phoneNumber` and `messageId` so it is available in the catch block. Declare it as `let replyTo: string | undefined;` next to `phoneNumber`, then assign it after extracting groupId.
</action>
<verify>
Run `npx tsc --noEmit` to confirm no type errors.

Manual verification approach: Send a message to the bot in a Signal group chat and confirm the reply arrives in the group, not as a DM.
</verify>
<done>
All `sendSignalMessage` calls in `setupMessageListener` and `handleCommand` use `replyTo` (groupId when from group, phoneNumber when from 1-to-1). All whitelist, conversation state, and idempotency logic still uses `phoneNumber`. TypeScript compiles cleanly.
</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `npm run format` passes (prettier via pre-commit hook)
- Code review: every `sendSignalMessage` call in listener.ts uses `replyTo`, every state/whitelist call uses `phoneNumber`
</verification>

<success_criteria>

- Group chat messages get replies in the group
- 1-to-1 chat messages still get replies in the DM (no regression)
- Conversation state remains per-user (phone number based)
- Clean TypeScript compilation
  </success_criteria>

<output>
After completion, create `.planning/quick/3-fix-group-chat-replies-going-to-1-to-1-i/3-SUMMARY.md`
</output>
