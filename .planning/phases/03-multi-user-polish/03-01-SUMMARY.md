---
phase: 03-multi-user-polish
plan: 01
subsystem: config
tags: [whitelist, validation, phone-normalization]
dependency_graph:
  requires: []
  provides: [family-whitelist-config, phone-validation]
  affects: [multi-user-auth]
tech_stack:
  added: [libphonenumber-js@1.11.14]
  patterns: [zod-transforms, e164-normalization, map-based-lookup]
key_files:
  created:
    - src/config/family-members.ts
    - family-members.example.json
  modified:
    - package.json
    - package-lock.json
decisions:
  - Phone numbers normalized to E.164 via Zod transform for consistent storage
  - FamilyWhitelist uses Map for O(1) lookup performance
  - File not found errors provide clear path guidance
  - Empty members array rejected at validation time
metrics:
  duration_minutes: 1
  tasks_completed: 1
  files_created: 2
  files_modified: 2
  commits: 1
  completed_at: "2026-02-15T11:24:14Z"
---

# Phase 3 Plan 01: Family Member Whitelist Config Summary

**One-liner:** Phone number whitelist with Zod validation and E.164 normalization using libphonenumber-js for multi-user access control.

## What Was Built

Created a configuration module for managing family member phone number whitelisting with validation and fast lookup.

### Core Components

**1. Family Member Schema (`src/config/family-members.ts`)**

- `FamilyMemberSchema`: Zod schema with phone validation and E.164 transformation
- `FamilyConfigSchema`: Requires at least one family member
- Phone number normalization handles spaces, dashes, and various formats
- Clear error messages for invalid phone numbers and missing fields

**2. Config Loading (`loadFamilyConfig`)**

- Async JSON file loading with validation
- File not found errors provide helpful guidance
- Zod validation errors propagate with detailed messages
- Default path: `./family-members.json`

**3. Whitelist Lookup (`FamilyWhitelist` class)**

- Map-based O(1) phone number lookup
- `isAllowed(phoneNumber)`: Check if phone allowed
- `getName(phoneNumber)`: Get family member name
- `getMemberCount()`: Total family members
- All lookups expect E.164 format

**4. Example Configuration (`family-members.example.json`)**

- Demonstrates expected JSON structure
- German phone number examples
- Template for user setup

## Implementation Details

### Phone Number Normalization

Phone numbers are validated and normalized using `libphonenumber-js`:

```typescript
phone: z.string().transform((val, ctx) => {
  const parsed = parsePhoneNumber(val);
  if (!parsed.isValid()) {
    ctx.addIssue({ ... });
    return z.NEVER;
  }
  return parsed.format("E.164");
})
```

Handles various input formats:

- `+49 123 456 7890` → `+491234567890`
- `+49-123-456-7890` → `+491234567890`
- Invalid numbers throw clear Zod errors

### Validation Rules

- At least one family member required
- Phone must be valid per libphonenumber-js
- Name must be 1-50 characters
- File must exist and be valid JSON

### Error Handling

- Missing file: Clear message with expected path
- Invalid JSON: JSON parse error
- Invalid schema: Zod validation error with details
- Invalid phone: libphonenumber-js error via Zod

## Testing Performed

Verified all requirements:

1. Basic loading and lookup: 2 members, correct lookups
2. Phone normalization: `+49 123 456 7890` → `+491234567890`
3. Unknown number: Returns false/undefined
4. Empty members array: Throws validation error
5. Missing file: Throws helpful error
6. libphonenumber-js in package.json: Confirmed

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Ready for Phase 3 Plan 02:**

- Message listener can load whitelist on startup
- Check sender phone number against whitelist
- Reject unauthorized messages early
- Use family member name for personalized responses

**Export API:**

```typescript
import { loadFamilyConfig, FamilyWhitelist } from "./config/family-members.js";

const config = await loadFamilyConfig("./family-members.json");
const whitelist = new FamilyWhitelist(config);

if (whitelist.isAllowed(senderPhone)) {
  const name = whitelist.getName(senderPhone);
  // Process message for authorized user
}
```

## Task Completion

| Task | Name                                               | Status   | Commit  | Files                                                                   |
| ---- | -------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------- |
| 1    | Install libphonenumber-js and create config module | Complete | b1a1237 | src/config/family-members.ts, family-members.example.json, package.json |

## Self-Check: PASSED

### Created Files

```bash
FOUND: src/config/family-members.ts
FOUND: family-members.example.json
```

### Modified Files

```bash
FOUND: package.json (libphonenumber-js@1.11.14)
FOUND: package-lock.json
```

### Commits

```bash
FOUND: b1a1237 (feat(03-01): add family member whitelist config module)
```

All artifacts verified successfully.
