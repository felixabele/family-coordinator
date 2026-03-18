# T02: 03-multi-user-polish 02

**Slice:** S03 — **Milestone:** M001

## Description

Wire family whitelist into the message processing pipeline with access control, command detection (help/cancel), non-text message rejection, group chat support, and personalized responses.

Purpose: Complete multi-user support — the bot now identifies family members, rejects unknowns, handles utility commands without LLM, and works in group chats.
Output: Modified `src/signal/listener.ts` and `src/index.ts`.

## Must-Haves

- [ ] "Only whitelisted phone numbers can interact with the bot"
- [ ] "Unknown senders receive a polite rejection message"
- [ ] "Non-text messages (images, voice notes, stickers) get rejected with German message"
- [ ] "Help command shows capabilities and resets conversation state"
- [ ] "Cancel command clears conversation and confirms in German"
- [ ] "Commands are detected before LLM call (no wasted API calls)"
- [ ] "Bot responds in both 1:1 and group chats"
- [ ] "Bot personalizes responses with family member name on greeting/new session"

## Files

- `src/config/constants.ts`
- `src/signal/listener.ts`
- `src/index.ts`
