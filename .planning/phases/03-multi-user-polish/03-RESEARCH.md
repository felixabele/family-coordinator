# Phase 3: Multi-User & Polish - Research

**Researched:** 2026-02-15
**Domain:** Multi-user conversation management, access control, and UX polish
**Confidence:** HIGH

## Summary

Phase 3 extends the single-user bot to support multiple family members with phone number-based whitelisting, conversation timeout management, and reset commands. The existing PostgreSQL-backed conversation state infrastructure (from Phase 1) provides the foundation — conversations already have 30-minute idle timeout via SQL WHERE clause (`last_message_at > NOW() - INTERVAL '30 minutes'`), and phone numbers are already the primary conversation identifier.

The core technical work involves: (1) loading and validating a JSON whitelist config mapping phone numbers to friendly names, (2) adding access control checks in the message listener, (3) implementing help/cancel command detection to reset conversation state, (4) removing the group chat filter to enable group message handling, and (5) rejecting non-text messages with polite German responses. Multi-turn disambiguation is already working — the LLM receives conversation history and can remember it asked a clarifying question.

**Primary recommendation:** Use Zod to validate a `family-members.json` config file at startup, store the whitelist in-memory (family size is small, no need for DB), check phone numbers in the message listener before processing, detect "hilfe"/"help"/"abbrechen"/"cancel" commands before LLM extraction, and clear conversation state on these commands. For group chats, the signal-sdk already provides `groupInfo` in the message envelope — simply remove the existing filter. The current PostgreSQL conversation store already handles timeout via SQL query logic.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Conversation handling

- 30-minute idle timeout — after 30 min without a message, next message starts fresh context
- "hilfe" / "help" shows what the bot can do AND resets current conversation state
- "abbrechen" / "cancel" clears conversation context and confirms: "Alles klar, was kann ich für dich tun?"
- Multi-turn disambiguation supported — bot remembers it asked a question (e.g., "Welchen meinst du? 1) Zahnarzt 2) Fußball"), user can reply with just "1" or a short answer

#### User identification & access control

- Whitelist-only access — only pre-configured family phone numbers can interact
- Unknown numbers get ignored or a polite rejection (no calendar access)
- Whitelist configured via JSON config file mapping phone numbers to names: `{"members": [{"phone": "+491234", "name": "Papa"}]}`
- Bot uses the name from config to personalize responses

#### Non-text messages

- Polite rejection for images, voice notes, stickers: "Ich kann leider nur Textnachrichten verarbeiten."

#### Group chat support

- Bot responds in both direct (1:1) messages and group chats
- In group chats, bot responds to any message (no mention/tag required)

### Claude's Discretion

- Exact wording of the rejection message for unknown senders
- How to store/manage conversation state for multi-turn (in-memory vs PostgreSQL)
- Exact help text formatting and content
- Whether to include the user's name in every response or just greetings

</user_constraints>

## Standard Stack

### Core

| Library           | Version | Purpose                        | Why Standard                                                                  |
| ----------------- | ------- | ------------------------------ | ----------------------------------------------------------------------------- |
| libphonenumber-js | 1.11.14 | E.164 phone number validation  | Industry standard, TypeScript-native, 65KB smaller than google-libphonenumber |
| zod               | 4.3.6   | JSON config validation         | Already in project, runtime type safety for config files                      |
| PostgreSQL (pg)   | 8.18.0  | Conversation state persistence | Already in project, handles 30-min timeout via SQL WHERE clause               |

**Note:** The project already validates E.164 phone numbers via Zod regex in `src/config/env.ts` for `SIGNAL_PHONE_NUMBER`. This phase extends validation to the whitelist config file.

### Supporting

| Library     | Version     | Purpose          | When to Use                            |
| ----------- | ----------- | ---------------- | -------------------------------------- |
| fs/promises | (Node core) | Read JSON config | Load family-members.json at startup    |
| Pino logger | 10.3.1      | Audit trail      | Already in project, log access denials |

### Alternatives Considered

| Instead of          | Could Use             | Tradeoff                                                                              |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| libphonenumber-js   | google-libphonenumber | Official Google library, 550KB vs 145KB — overkill for simple whitelist validation    |
| libphonenumber-js   | phone (npm)           | Simpler API but mobile-only validation — families may have landlines                  |
| JSON config file    | Database table        | User decision: JSON file chosen for simplicity, easy manual editing                   |
| In-memory whitelist | PostgreSQL table      | PostgreSQL adds complexity for ~5 family members, no runtime changes expected         |
| PostgreSQL state    | In-memory Map         | User constraint: conversation state already in PostgreSQL with 30-min timeout via SQL |

**Installation:**

```bash
npm install libphonenumber-js@1.11.14
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── config/
│   ├── env.ts              # Existing: environment validation
│   ├── constants.ts        # Existing: SESSION_TTL_MS already defined
│   └── family-members.ts   # NEW: Load and validate whitelist config
├── signal/
│   ├── listener.ts         # MODIFY: Add access control, command detection
│   ├── types.ts            # EXISTING: Already has SignalEnvelope.source (phone)
│   └── sender.ts           # EXISTING: No changes needed
├── state/
│   ├── conversation.ts     # MODIFY: Add resetConversation() method
│   └── types.ts            # EXISTING: No schema changes needed
└── index.ts                # MODIFY: Load family config at startup
```

### Pattern 1: JSON Config with Zod Validation

**What:** Load and validate a JSON config file at application startup with runtime type checking
**When to use:** Small, rarely-changing configuration that humans need to edit (family member whitelist)

**Example:**

```typescript
// src/config/family-members.ts
import { z } from "zod";
import { readFile } from "fs/promises";
import { parsePhoneNumber } from "libphonenumber-js";

const FamilyMemberSchema = z.object({
  phone: z.string().refine((val) => {
    try {
      const parsed = parsePhoneNumber(val);
      return parsed.isValid() && parsed.format("E.164") === val;
    } catch {
      return false;
    }
  }, "Must be valid E.164 format (e.g., +491234567890)"),
  name: z.string().min(1).max(50),
});

const FamilyConfigSchema = z.object({
  members: z.array(FamilyMemberSchema).min(1),
});

export type FamilyMember = z.infer<typeof FamilyMemberSchema>;
export type FamilyConfig = z.infer<typeof FamilyConfigSchema>;

export async function loadFamilyConfig(
  path: string = "./family-members.json",
): Promise<FamilyConfig> {
  const raw = await readFile(path, "utf-8");
  const json = JSON.parse(raw);
  return FamilyConfigSchema.parse(json); // Throws ZodError if invalid
}
```

**Source:** Adapted from [How to Read JSON Files in Node.js (OneUpTime, Jan 2026)](https://oneuptime.com/blog/post/2026-01-22-nodejs-read-json-files/view)

### Pattern 2: In-Memory Whitelist with Fast Lookup

**What:** Store whitelist as a Map for O(1) phone number lookups
**When to use:** Small dataset (~5-10 family members) with frequent read access and no runtime updates

**Example:**

```typescript
// src/config/family-members.ts (continued)
export class FamilyWhitelist {
  private members: Map<string, string>; // phone -> name

  constructor(config: FamilyConfig) {
    this.members = new Map(config.members.map((m) => [m.phone, m.name]));
  }

  isAllowed(phoneNumber: string): boolean {
    return this.members.has(phoneNumber);
  }

  getName(phoneNumber: string): string | undefined {
    return this.members.get(phoneNumber);
  }

  getAllPhones(): string[] {
    return Array.from(this.members.keys());
  }
}
```

### Pattern 3: Command Detection Before LLM

**What:** Detect reset/help commands via string matching before calling expensive LLM
**When to use:** Simple literal commands where LLM adds no value and costs latency + tokens

**Example:**

```typescript
// src/signal/listener.ts (new function)
function detectCommand(text: string): "help" | "cancel" | null {
  const normalized = text.trim().toLowerCase();

  // Help commands: "hilfe", "help", "?"
  if (["hilfe", "help", "?"].includes(normalized)) {
    return "help";
  }

  // Cancel commands: "abbrechen", "cancel", "reset"
  if (["abbrechen", "cancel", "reset"].includes(normalized)) {
    return "cancel";
  }

  return null;
}
```

**Rationale:** These are utility commands, not calendar operations. Detecting them early saves 200-300ms LLM latency and ~$0.0001 per message. The user expects instant feedback for help/cancel.

### Pattern 4: PostgreSQL Session Timeout via SQL

**What:** Expire conversation sessions by filtering on `last_message_at` in the WHERE clause
**When to use:** Time-based session expiry without background cleanup jobs

**Example (ALREADY IMPLEMENTED):**

```typescript
// src/state/conversation.ts (existing code)
async getState(phoneNumber: string): Promise<ConversationState | null> {
  const result = await this.pool.query(
    `SELECT phone_number, current_intent, pending_entities, message_history, last_message_at
     FROM conversations
     WHERE phone_number = $1
       AND last_message_at > NOW() - INTERVAL '30 minutes'`,
    [phoneNumber],
  );

  if (result.rows.length === 0) {
    return null; // Session expired or never existed
  }

  return parseRow(result.rows[0]);
}
```

**Why this works:** Every read filters expired rows. Stale rows remain in DB but are invisible. A periodic cleanup job (OPTIONAL) can remove old rows, but it's not required for correctness.

**Source:** Common PostgreSQL pattern, documented in [Building Stateful Conversations with Postgres and LLMs (Levi Stringer, Medium)](https://medium.com/@levi_stringer/building-stateful-conversations-with-postgres-and-llms-e6bb2a5ff73e)

### Anti-Patterns to Avoid

- **Storing whitelist in database:** Adds complexity for a tiny dataset that never changes at runtime. JSON + in-memory is sufficient.
- **Using LLM to detect help/cancel:** Wastes 200-300ms and costs money for trivial string matching. Detect before LLM.
- **Background job for session cleanup:** PostgreSQL WHERE clause already filters expired sessions. A cleanup job is OPTIONAL optimization, not required.
- **OAuth for group chat members:** Signal already provides phone numbers. Whitelist-by-phone is simpler than OAuth.

## Don't Hand-Roll

| Problem                 | Don't Build                    | Use Instead        | Why                                                           |
| ----------------------- | ------------------------------ | ------------------ | ------------------------------------------------------------- |
| Phone number validation | Regex for E.164                | libphonenumber-js  | Handles country codes, invalid lengths, formatting edge cases |
| JSON config validation  | Manual typeof checks           | Zod schema         | Runtime type safety, clear error messages for invalid config  |
| Conversation timeout    | setInterval + in-memory expiry | PostgreSQL WHERE   | Already implemented, survives restarts, no memory leaks       |
| Multi-turn context      | Custom message queue           | PostgreSQL history | Already implemented with MAX_HISTORY_MESSAGES trimming        |

**Key insight:** The project already has robust conversation state infrastructure from Phase 1/2. Phase 3 is primarily about **access control** and **UX polish** (reset commands, group chat support), not rebuilding state management.

## Common Pitfalls

### Pitfall 1: Forgetting to Normalize Phone Numbers

**What goes wrong:** User whitelist has `+49 1234 567890` (spaces), Signal sends `+491234567890` (no spaces) → access denied despite being whitelisted.

**Why it happens:** Phone numbers have multiple valid representations. E.164 is the canonical format but humans add spaces/dashes for readability.

**How to avoid:** Always normalize to E.164 before comparison:

```typescript
import { parsePhoneNumber } from "libphonenumber-js";

function normalizePhone(input: string): string | null {
  try {
    const parsed = parsePhoneNumber(input);
    return parsed.isValid() ? parsed.format("E.164") : null;
  } catch {
    return null;
  }
}
```

**Warning signs:** Access control logs show "unknown sender" for numbers that ARE in the config file.

### Pitfall 2: Clearing Conversation State But Not Responding

**What goes wrong:** User sends "abbrechen", conversation clears, but bot never confirms → user confused, sends again.

**Why it happens:** Developer focuses on the state mutation and forgets the UX feedback loop.

**How to avoid:** ALWAYS send a confirmation response after clearing state:

```typescript
if (command === "cancel") {
  await conversationStore.clearState(phoneNumber);
  await sendSignalMessage(
    signalClient,
    phoneNumber,
    "Alles klar, was kann ich für dich tun?",
  );
  return; // Exit early, don't process as calendar intent
}
```

**Warning signs:** User sends "abbrechen" multiple times in a row.

### Pitfall 3: Resetting State After LLM Call

**What goes wrong:** Help/cancel commands go through LLM intent extraction → costs money, adds latency, may misclassify.

**Why it happens:** Developer adds command handling in the intent handler instead of before LLM.

**How to avoid:** Detect commands BEFORE calling `extractIntent()`:

```typescript
// CORRECT: Check commands first
const command = detectCommand(text);
if (command === "help") {
  await conversationStore.clearState(phoneNumber);
  await sendSignalMessage(signalClient, phoneNumber, HELP_TEXT);
  return; // Exit early
}

// Only call LLM if not a command
const intent = await extractIntent(
  anthropicClient,
  text,
  state?.messageHistory,
);
```

**Warning signs:** Anthropic API logs show requests for "hilfe" or "abbrechen".

### Pitfall 4: Including Sender Name in Every Message

**What goes wrong:** Every response starts with "Hey Papa, ..." → feels robotic and repetitive in long conversations.

**Why it happens:** Developer assumes personalization = always use the name.

**How to avoid:** Use name only in greetings or when context switches (new session after timeout):

```typescript
// Good: Name only on greeting or session start
if (intent.intent === "greeting" || !state) {
  const name = whitelist.getName(phoneNumber) || "there";
  return `Hey ${name}! Ich bin dein Familienkalender-Bot.`;
}

// For other intents: skip the name
return "Klar, hab ich eingetragen!"; // Not "Klar Papa, hab ich..."
```

**Warning signs:** User feedback mentions bot feels "unnatural" or "repetitive".

### Pitfall 5: Blocking Group Chats at Message Level

**What goes wrong:** Bot filters out ALL group messages → can't respond in family group chat.

**Why it happens:** Phase 1 code had a group chat filter for simplicity. Developer forgets to remove it.

**How to avoid:** Remove the group chat filter from `listener.ts`:

```typescript
// REMOVE THIS from Phase 1 code:
if (envelope.dataMessage?.groupInfo) {
  logger.debug({ messageId }, "Skipping group message");
  return;
}
```

**Warning signs:** Bot works in 1:1 DMs but not in the family Signal group.

## Code Examples

Verified patterns from official sources and current codebase:

### Loading JSON Config at Startup

```typescript
// src/index.ts
import { loadFamilyConfig, FamilyWhitelist } from "./config/family-members.js";

async function main() {
  // Load and validate config BEFORE starting listener
  const familyConfig = await loadFamilyConfig("./family-members.json");
  const whitelist = new FamilyWhitelist(familyConfig);

  logger.info(
    { memberCount: whitelist.getAllPhones().length },
    "Family whitelist loaded",
  );

  // Pass whitelist to listener
  setupMessageListener({
    signalClient,
    anthropicClient,
    conversationStore,
    idempotencyStore,
    calendarClient,
    familyWhitelist: whitelist, // NEW
  });
}
```

### Access Control in Message Listener

```typescript
// src/signal/listener.ts
export function setupMessageListener(deps: MessageListenerDeps): void {
  deps.signalClient.on("message", async (params: any) => {
    const envelope: SignalEnvelope = params?.envelope || params;
    const phoneNumber = envelope.source || envelope.sourceNumber;
    const text = envelope.dataMessage?.message || "";

    // 1. Check whitelist FIRST
    if (!deps.familyWhitelist.isAllowed(phoneNumber)) {
      logger.warn({ phoneNumber }, "Unknown sender rejected");
      // Optional: Send polite rejection (or ignore silently)
      await sendSignalMessage(
        deps.signalClient,
        phoneNumber,
        "Entschuldigung, ich kenne dich nicht.",
      );
      return; // Exit early
    }

    // 2. Check for non-text messages
    if (!text) {
      logger.debug({ messageId }, "Non-text message rejected");
      await sendSignalMessage(
        deps.signalClient,
        phoneNumber,
        "Ich kann leider nur Textnachrichten verarbeiten.",
      );
      return;
    }

    // 3. Detect reset commands BEFORE LLM
    const command = detectCommand(text);
    if (command) {
      await handleCommand(command, phoneNumber, deps);
      return; // Exit early
    }

    // 4. Continue with normal flow (idempotency, LLM, etc.)
    // ... existing code ...
  });
}
```

### Command Handler with State Reset

```typescript
// src/signal/listener.ts
async function handleCommand(
  command: "help" | "cancel",
  phoneNumber: string,
  deps: MessageListenerDeps,
): Promise<void> {
  // Always clear state for both commands
  await deps.conversationStore.clearState(phoneNumber);

  if (command === "help") {
    const helpText = `Das kann ich für dich tun:
- Termine anzeigen: "Was steht heute an?"
- Termin eintragen: "Trag Fußball Dienstag um 16 Uhr ein"
- Termin verschieben: "Verschieb den Zahnarzt auf Donnerstag"
- Termin löschen: "Streich das Fußball diese Woche"

Schreib "abbrechen" um neu zu starten.`;

    await sendSignalMessage(deps.signalClient, phoneNumber, helpText);
  } else {
    // command === "cancel"
    await sendSignalMessage(
      deps.signalClient,
      phoneNumber,
      "Alles klar, was kann ich für dich tun?",
    );
  }

  logger.info({ phoneNumber, command }, "Command executed, state reset");
}
```

### Phone Number Normalization

```typescript
// src/config/family-members.ts
import { parsePhoneNumber } from "libphonenumber-js";

export function normalizeToE164(phone: string): string | null {
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.isValid() ? parsed.format("E.164") : null;
  } catch {
    return null;
  }
}

// Example usage in whitelist loading:
const FamilyMemberSchema = z.object({
  phone: z.string().transform((val) => {
    const normalized = normalizeToE164(val);
    if (!normalized) {
      throw new Error(`Invalid phone number: ${val}`);
    }
    return normalized;
  }),
  name: z.string().min(1).max(50),
});
```

## State of the Art

| Old Approach               | Current Approach                       | When Changed | Impact                                         |
| -------------------------- | -------------------------------------- | ------------ | ---------------------------------------------- |
| In-memory session with TTL | PostgreSQL with WHERE clause filtering | 2024-2025    | Sessions survive restarts, no memory leaks     |
| LLM for all message types  | Command detection before LLM           | 2025-2026    | Faster reset commands, lower costs             |
| OAuth for multi-user       | Phone number whitelist                 | 2024-2026    | Simpler for family use case, no consent flows  |
| google-libphonenumber      | libphonenumber-js                      | 2023-2025    | 65KB smaller bundle, native TypeScript support |
| Manual JSON parsing        | Zod schema validation                  | 2023-2026    | Runtime type safety, better error messages     |

**Deprecated/outdated:**

- **Manual session cleanup jobs:** PostgreSQL WHERE clause makes background cleanup optional, not required
- **Separate phone number formatting libraries:** libphonenumber-js handles validation + formatting in one package

## Open Questions

1. **Should unknown senders receive a rejection message or be silently ignored?**
   - What we know: User constraint says "ignored or a polite rejection"
   - What's unclear: Which is better UX? Rejection confirms the message was received but sender not authorized. Silence prevents spam bots from confirming valid numbers.
   - Recommendation: Default to polite rejection ("Entschuldigung, ich kenne dich nicht.") but make it configurable via comment in family-members.json. Log all rejections for security audit.

2. **Should help text be dynamic based on conversation state?**
   - What we know: User wants help to show "what the bot can do"
   - What's unclear: Should help text acknowledge context? (e.g., "Du hast gerade nach Terminen gefragt...")
   - Recommendation: Keep help text static for consistency. Context acknowledgment adds complexity for minimal UX benefit.

3. **Should the bot acknowledge the sender in group chats vs 1:1?**
   - What we know: User constraint says "bot responds to any message" in groups, no mention/tag required
   - What's unclear: In a group, should the bot include sender name? ("Papa hat gefragt..." vs just answering)
   - Recommendation: No sender acknowledgment in groups — bot answers the question directly. If family wants attribution, they can check Signal's message metadata.

4. **Should numbered disambiguation responses (1, 2, 3) clear state or maintain context?**
   - What we know: LLM already handles multi-turn (receives history), user can reply "1"
   - What's unclear: Does the short answer "1" break context for future turns?
   - Recommendation: Trust the LLM to maintain context. The current `extractIntent()` already receives `conversationHistory`, so multi-turn works. No additional state management needed.

## Sources

### Primary (HIGH confidence)

- **libphonenumber-js v1.11.14:** [npm package](https://www.npmjs.com/package/libphonenumber-js), [GitHub repository](https://github.com/catamphetamine/libphonenumber-js) — TypeScript-native phone validation
- **Zod v4.3.6:** [Official docs](https://zod.dev/), [npm package](https://www.npmjs.com/package/zod) — Runtime schema validation
- **PostgreSQL conversation state pattern:** [Building Stateful Conversations with Postgres and LLMs](https://medium.com/@levi_stringer/building-stateful-conversations-with-postgres-and-llms-e6bb2a5ff73e) — Session management with SQL WHERE clause
- **Node.js JSON config loading:** [How to Read JSON Files in Node.js (OneUpTime, Jan 2026)](https://oneuptime.com/blog/post/2026-01-22-nodejs-read-json-files/view) — fs/promises + Zod pattern
- **Existing codebase:** `src/state/conversation.ts`, `src/signal/listener.ts`, `src/db/migrations/001_init.sql` — Conversation state already implemented

### Secondary (MEDIUM confidence)

- **Multi-turn LLM context management:** [Dynamic Context Tuning (Infralovers, Feb 2026)](https://www.infralovers.com/blog/2026-02-09-dynamic-context-tuning-chatbots/) — Embedding-based anaphora resolution (not needed for this phase, but relevant for understanding multi-turn challenges)
- **Google Research on disambiguation:** [Learning to clarify: Multi-turn conversations with Action-Based Contrastive Self-Training](https://research.google/blog/learning-to-clarify-multi-turn-conversations-with-action-based-contrastive-self-training/) — LLM disambiguation patterns (already implemented via clarification_needed in CalendarIntent)
- **Signal bot group chat handling:** [signalbot Python package docs](https://pypi.org/project/signalbot/) — Message handling patterns (conceptually similar, though different language)
- **Chatbot reset/cancel UX:** [Conversation Builder Best Practices - Resolve Stuck Conversations](https://developers.liveperson.com/conversation-builder-best-practices-resolve-stuck-conversations.html) — User should never feel trapped, always offer escape hatch

### Tertiary (LOW confidence)

- **State machine patterns for LLMs:** [Stately Expert (XState-based)](https://github.com/statelyai/agent) — Complex state machine framework (overkill for this use case, but documents the pattern)
- **Phone number validation alternatives:** [phone npm package](https://www.npmjs.com/package/phone) — Mobile-only validation (not chosen due to landline support requirement)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — libphonenumber-js is industry standard, Zod already in project, PostgreSQL conversation state already implemented
- Architecture: HIGH — Patterns are well-established (JSON config, whitelist Map, command detection), verified in current codebase
- Pitfalls: HIGH — Based on common mistakes in multi-user bot implementations and careful codebase review

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days — stable domain, standard patterns)

**Key findings:**

1. **Most infrastructure already exists:** Conversation state with 30-min timeout is already implemented via PostgreSQL WHERE clause filtering. Multi-turn context already works via message history.

2. **Phase 3 is primarily access control + UX polish:** Whitelist loading, command detection, group chat support, non-text rejection. Not rebuilding state management.

3. **Command detection before LLM is critical:** Help/cancel are utility commands that should execute instantly (< 50ms) without LLM latency (200-300ms) or cost.

4. **In-memory whitelist is sufficient:** ~5 family members, no runtime changes, O(1) lookup. No need for database complexity.

5. **Phone normalization is essential:** E.164 is the canonical format, but humans write phone numbers with spaces/dashes. Normalize before comparison to prevent false rejections.
