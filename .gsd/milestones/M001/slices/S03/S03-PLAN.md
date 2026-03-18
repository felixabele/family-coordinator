# S03: Multi User Polish

**Goal:** Create the family member whitelist configuration module with Zod-validated JSON loading and in-memory phone number lookup.
**Demo:** Create the family member whitelist configuration module with Zod-validated JSON loading and in-memory phone number lookup.

## Must-Haves


## Tasks

- [x] **T01: 03-multi-user-polish 01**
  - Create the family member whitelist configuration module with Zod-validated JSON loading and in-memory phone number lookup.

Purpose: Foundation for multi-user access control — the bot needs to know which phone numbers belong to family members and what their names are.
Output: `src/config/family-members.ts` module and `family-members.example.json` template.
- [x] **T02: 03-multi-user-polish 02**
  - Wire family whitelist into the message processing pipeline with access control, command detection (help/cancel), non-text message rejection, group chat support, and personalized responses.

Purpose: Complete multi-user support — the bot now identifies family members, rejects unknowns, handles utility commands without LLM, and works in group chats.
Output: Modified `src/signal/listener.ts` and `src/index.ts`.

## Files Likely Touched

- `src/config/family-members.ts`
- `family-members.example.json`
- `package.json`
- `src/config/constants.ts`
- `src/signal/listener.ts`
- `src/index.ts`
