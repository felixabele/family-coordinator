# 9. Architecture Decisions

### ADR-1: Signal as Messaging Interface

**Status:** Accepted
**Context:** The family needed a way to manage their shared calendar without switching to a dedicated app. The family already uses Signal for daily communication.
**Decision:** Use Signal as the sole user interface via signal-sdk, which wraps signal-cli for programmatic message handling.
**Consequences:** No official bot API means depending on the third-party signal-sdk package. Requires a dedicated phone number registered with Signal. Cannot send rich UI elements (buttons, carousels) -- text-only interaction.

### ADR-2: Claude LLM for Intent Extraction with Tool Use

**Status:** Accepted
**Context:** Users send natural language messages in German. The system needs to extract structured calendar operations (intent + entities like date, time, title) from free-form text.
**Decision:** Use Anthropic Claude (Sonnet 4) with the tool use feature (`tool_choice: "tool"`) to force structured JSON output. The system prompt (~270 lines, German) defines intent types, date resolution rules, and examples. Prompt caching (`cache_control: "ephemeral"`) reduces repeated costs by ~90%.
**Consequences:** Per-token API cost on every interaction. Latency depends on Claude API response time. Strong German understanding without custom NLP pipelines. Structured output via tool use eliminates fragile JSON parsing.

### ADR-3: No Build Step -- Node.js Native TypeScript Stripping

**Status:** Accepted
**Context:** TypeScript provides type safety but traditionally requires a build step (tsc compilation) before running.
**Decision:** Use Node.js 22's `--experimental-strip-types` flag to run TypeScript directly. Use `tsx` for development (watch mode) and production (via PM2).
**Consequences:** No build artifacts to manage. Faster development cycle. Requires Node.js 22+. The `tsc` command is used only for type checking (`npm run build`), not for compilation.

### ADR-4: PostgreSQL for Conversation State and Idempotency

**Status:** Accepted
**Context:** The system needs to track conversation state (multi-turn flows like conflict confirmation) and prevent duplicate message processing.
**Decision:** Use PostgreSQL with two primary tables: `conversations` (state per phone number with 30-minute TTL) and `processed_messages` (idempotency with 7-day retention). JSONB columns for flexible entity storage.
**Consequences:** Requires a running PostgreSQL instance. State survives process restarts. Simple schema with 3 tables total. No ORM -- raw SQL queries via pg driver for simplicity.

### ADR-5: Claude Handles Date Parsing (No Library)

**Status:** Accepted
**Context:** German date expressions are complex ("uebermorgen", "naechsten Mittwoch", "dieses Wochenende"). Dedicated NLP date parsing libraries for German are limited.
**Decision:** Let Claude parse dates directly in the system prompt with explicit resolution rules. The prompt provides the current date/time/weekday context with each message.
**Consequences:** No external date parsing dependency. The LLM handles vague expressions well. Date resolution quality depends on prompt engineering. System prompt includes ~100 lines of date resolution rules and examples.

### ADR-6: Event-Driven Message Processing

**Status:** Accepted
**Context:** The bot needs to continuously listen for incoming Signal messages without polling.
**Decision:** Use signal-sdk's event emitter pattern (`client.on("message", handler)`). Each message is processed independently in the event handler.
**Consequences:** No polling overhead. Individual message failures are caught and don't crash the daemon. Concurrent message processing limited by `SIGNAL_MAX_CONCURRENT` (5).

### ADR-7: Whitelist-Based Access Control

**Status:** Accepted
**Context:** The bot should only respond to family members, not arbitrary Signal users.
**Decision:** Maintain a `family-members.json` file with phone numbers (E.164) and names. The `FamilyWhitelist` class provides O(1) lookup. Unknown senders receive a rejection message (rate-limited to 1 per 5 minutes).
**Consequences:** Adding/removing family members requires editing a JSON file and restarting the bot. No self-registration or invitation flow. Simple and secure for a small family.

### ADR-8: Commands Bypass LLM

**Status:** Accepted
**Context:** Commands like "help" and "cancel" have deterministic responses that don't require AI interpretation.
**Decision:** Detect command keywords ("hilfe", "help", "?", "abbrechen", "cancel", "reset") before calling Claude. Commands always reset conversation state.
**Consequences:** Saves API cost and latency for simple operations. Fixed keyword detection (not fuzzy matching). Both German and English keywords supported.

### ADR-9: PM2 for Process Management

**Status:** Accepted
**Context:** The bot runs as an always-on daemon that needs automatic restart on crashes and memory management.
**Decision:** Use PM2 with `ecosystem.config.cjs` for process management in production. Configured with auto-restart, max 500MB memory, 30-second minimum uptime, and 10 max restarts.
**Consequences:** PM2 must be installed globally on the VPS. Log management handled by PM2. Process list persisted across server reboots via `pm2 save` + `pm2 startup`.
