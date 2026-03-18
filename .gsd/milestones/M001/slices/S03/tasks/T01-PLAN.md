# T01: 03-multi-user-polish 01

**Slice:** S03 — **Milestone:** M001

## Description

Create the family member whitelist configuration module with Zod-validated JSON loading and in-memory phone number lookup.

Purpose: Foundation for multi-user access control — the bot needs to know which phone numbers belong to family members and what their names are.
Output: `src/config/family-members.ts` module and `family-members.example.json` template.

## Must-Haves

- [ ] "Family config file is validated at load time with Zod and libphonenumber-js"
- [ ] "Phone numbers are normalized to E.164 before storage in whitelist"
- [ ] "FamilyWhitelist provides O(1) lookup by phone number returning member name"
- [ ] "Invalid config (missing fields, bad phone format) causes clear error at startup"

## Files

- `src/config/family-members.ts`
- `family-members.example.json`
- `package.json`
