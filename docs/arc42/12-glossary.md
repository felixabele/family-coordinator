# 12. Glossary

| Term               | Definition                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| E.164              | International phone number format with country code prefix (e.g., +491701234567). Used for consistent phone matching                       |
| signal-cli         | Command-line tool for Signal messaging. The signal-sdk npm package wraps it as a subprocess                                                |
| signal-sdk         | npm package that provides a Node.js interface to signal-cli via JSON-RPC subprocess communication                                          |
| Intent             | The classified purpose of a user message: `create_event`, `query_events`, `update_event`, `delete_event`, `greeting`, `help`, or `unclear` |
| Entity             | A structured data field extracted from a natural language message (e.g., title, date, time, recurrence pattern)                            |
| Tool use           | Anthropic Claude feature that forces the LLM to return structured JSON matching a defined schema, instead of free text                     |
| Prompt caching     | Anthropic feature that caches system prompts >500 tokens, reducing cost by ~90% for repeated calls with the same prompt                    |
| RRULE              | RFC 5545 recurrence rule format used by Google Calendar (e.g., `RRULE:FREQ=WEEKLY;BYDAY=TU`)                                               |
| Idempotency        | Ensuring a message is processed exactly once, even if Signal delivers it multiple times                                                    |
| Conversation state | Per-user state tracking active intent and pending entities across multiple messages (e.g., conflict confirmation flow)                     |
| Family whitelist   | JSON file containing authorized family member phone numbers and names; loaded at startup for access control                                |
| PM2                | Node.js process manager used in production for auto-restart, memory limits, and log management                                             |
| du-form            | German informal second-person address ("du" vs. formal "Sie"); used for casual family communication tone                                   |
| Conflict detection | Pre-creation check that identifies existing calendar events overlapping with a new event's time slot                                       |
| Service account    | Google Cloud credential type that allows server-to-server API access without user interaction                                              |
| Luxon              | JavaScript date/time library used for timezone-aware operations and German locale formatting                                               |

---

_Generated: 2026-02-17_
_Template: arc42 (https://arc42.org)_
