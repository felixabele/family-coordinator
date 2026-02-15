# Phase 3: Multi-User & Polish - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Multiple family members can interact with the bot through Signal, with the bot identifying who sent each message via phone number. Includes conversation timeout, reset commands, and edge case handling (unknown senders, non-text messages, group chats). Proactive reminders and recurring events are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Conversation handling

- 30-minute idle timeout — after 30 min without a message, next message starts fresh context
- "hilfe" / "help" shows what the bot can do AND resets current conversation state
- "abbrechen" / "cancel" clears conversation context and confirms: "Alles klar, was kann ich für dich tun?"
- Multi-turn disambiguation supported — bot remembers it asked a question (e.g., "Welchen meinst du? 1) Zahnarzt 2) Fußball"), user can reply with just "1" or a short answer

### User identification & access control

- Whitelist-only access — only pre-configured family phone numbers can interact
- Unknown numbers get ignored or a polite rejection (no calendar access)
- Whitelist configured via JSON config file mapping phone numbers to names: `{"members": [{"phone": "+491234", "name": "Papa"}]}`
- Bot uses the name from config to personalize responses

### Non-text messages

- Polite rejection for images, voice notes, stickers: "Ich kann leider nur Textnachrichten verarbeiten."

### Group chat support

- Bot responds in both direct (1:1) messages and group chats
- In group chats, bot responds to any message (no mention/tag required)

### Claude's Discretion

- Exact wording of the rejection message for unknown senders
- How to store/manage conversation state for multi-turn (in-memory vs PostgreSQL)
- Exact help text formatting and content
- Whether to include the user's name in every response or just greetings

</decisions>

<specifics>
## Specific Ideas

- The JSON config file approach allows mapping phone numbers to friendly names, which makes the bot feel personal ("Hey Papa, morgen steht an: ...")
- Multi-turn disambiguation is important for a natural conversation flow — nobody wants to retype "Lösch den Termin am Dienstag" after being asked "which one?"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 03-multi-user-polish_
_Context gathered: 2026-02-14_
