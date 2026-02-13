# Phase 1: Foundation & Signal Infrastructure - Research

**Researched:** 2026-02-13
**Domain:** Signal messenger bot infrastructure with signal-cli
**Confidence:** MEDIUM-HIGH

## Summary

Signal has no official API for programmatic messaging. The most mature community solution is **signal-cli** (v0.13.24, Feb 2025), a Java-based CLI tool that provides JSON-RPC and D-BUS interfaces for the Signal protocol. For Node.js/TypeScript bots, the recommended approach is **signal-sdk** - a comprehensive TypeScript wrapper that bundles signal-cli binaries and provides event-driven bot framework capabilities.

The architecture pattern for always-on Signal bots differs fundamentally from WhatsApp webhook-based systems: instead of receiving webhook POSTs with a 5-second timeout, Signal bots run a persistent daemon that receives messages as JSON-RPC notifications over local sockets or TCP. This eliminates the need for BullMQ job queues for webhook timeout handling, simplifying the architecture significantly.

The existing codebase has excellent reusable components (config, utils, db, llm, state), but webhook and queue layers need replacement with Signal-specific message listening. The key technical challenge is initial device registration (requires manual CAPTCHA from https://signalcaptchas.org), but once registered, the daemon is reliable for production use.

**Primary recommendation:** Use signal-sdk npm package as the TypeScript wrapper around signal-cli. Run signal-cli daemon in JSON-RPC mode via Unix socket for reliable message receiving. Register the bot as a primary device (not linked) to avoid dependency on a mobile device. Reuse existing PostgreSQL state management and idempotency patterns. Replace BullMQ with simple in-memory processing since there's no webhook timeout constraint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| signal-cli | 0.13.24 | Signal protocol client (Java) | Most mature community Signal CLI tool, actively maintained, 3.4k+ stars |
| signal-sdk | Latest (npm) | TypeScript wrapper for signal-cli | Bundles signal-cli binaries, provides bot framework, event-driven API, TypeScript native |
| Java Runtime | JRE 25+ | Required by signal-cli | signal-cli dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrencode | Latest | Generate QR codes for device linking | Only needed if linking as secondary device (not recommended for bots) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| signal-sdk | signal-cli-rest-api (Docker) | REST wrapper adds HTTP overhead, requires Docker, more moving parts |
| signal-sdk | signald (daemon alternative) | Less mature, smaller community, different protocol implementation |
| signal-sdk | Direct signal-cli spawn | No TypeScript types, manual JSON-RPC handling, reinventing the wheel |
| Primary device registration | Link as secondary device | Dependency on mobile device being online, more complex setup |

**Installation:**
```bash
# Install Java Runtime (required by signal-cli)
# Ubuntu/Debian: sudo apt update && sudo apt install default-jre
# macOS: brew install openjdk

# Install TypeScript SDK (bundles signal-cli)
npm install signal-sdk
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── signal/              # Signal-specific layer
│   ├── client.ts        # SignalCli wrapper instance
│   ├── listener.ts      # Message event handler
│   ├── sender.ts        # Outbound message sender
│   └── types.ts         # Signal message types
├── config/              # KEEP: Existing env validation (update vars)
├── utils/               # KEEP: Existing logger, errors
├── db/                  # KEEP: Existing pool, migrations
├── llm/                 # KEEP: Existing Claude intent extraction
├── state/               # KEEP: Existing conversation + idempotency stores
└── index.ts             # REPLACE: Launch daemon listener instead of Fastify
```

### Pattern 1: Signal Daemon Message Listener (Event-Driven)
**What:** Run signal-cli in daemon mode, connect via signal-sdk, handle incoming messages as events
**When to use:** Always-on bot that receives messages 24/7
**Example:**
```typescript
// Source: https://github.com/benoitpetit/signal-sdk
import { SignalCli } from 'signal-sdk';

const signal = new SignalCli(process.env.SIGNAL_NUMBER, undefined, {
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  rateLimiter: {
    maxConcurrent: 5,
    minInterval: 200,
  },
});

// Event-driven message receiving
signal.on('message', async (message) => {
  const { source, dataMessage } = message.envelope;
  const messageId = message.envelope.timestamp.toString();
  const phoneNumber = source;
  const text = dataMessage?.message || '';

  // Check idempotency
  if (await idempotencyStore.isProcessed(messageId)) {
    logger.debug({ messageId }, 'Duplicate message, skipping');
    return;
  }

  // Process message directly (no queue needed)
  await processMessage(phoneNumber, text);

  // Mark as processed
  await idempotencyStore.markProcessed(messageId);
});

await signal.startListening();
```

### Pattern 2: Idempotent Message Processing (Reuse Existing)
**What:** Track processed message IDs in Redis to prevent duplicate processing
**When to use:** Always - Signal can deliver duplicates, and daemon restarts replay messages
**Example:**
```typescript
// Source: Existing codebase src/state/idempotency.ts (REUSABLE)
// Change only the message ID source from WhatsApp wamid to Signal timestamp
const messageId = message.envelope.timestamp.toString();

if (await idempotencyStore.isProcessed(messageId)) {
  logger.debug({ messageId }, 'Already processed');
  return;
}

await processMessage(...);
await idempotencyStore.markProcessed(messageId);
```

### Pattern 3: Conversation State Management (Reuse Existing)
**What:** PostgreSQL-backed conversation state with 30-minute session expiry
**When to use:** Multi-turn conversations requiring context
**Example:**
```typescript
// Source: Existing codebase src/state/conversation.ts (FULLY REUSABLE)
// Phone number format: Signal uses E.164 format (same as WhatsApp)
const state = await conversationStore.getState(phoneNumber);

if (!state) {
  // New conversation
  await conversationStore.addToHistory(phoneNumber, 'user', text);
  const intent = await extractIntent(anthropicClient, text, []);
  // ...
} else {
  // Continuing conversation
  await conversationStore.addToHistory(phoneNumber, 'user', text);
  const intent = await extractIntent(
    anthropicClient,
    text,
    state.messageHistory
  );
  // ...
}
```

### Pattern 4: Sending Messages
**What:** Use signal-sdk's sendMessage method with recipient or groupId
**When to use:** Responding to users
**Example:**
```typescript
// Source: https://github.com/AsamK/signal-cli/blob/master/man/signal-cli-jsonrpc.5.adoc
// Via signal-sdk wrapper
await signal.sendMessage(recipientPhoneNumber, responseText);

// With error handling and retry (built into signal-sdk)
try {
  await signal.sendMessage(recipient, message);
  logger.info({ recipient }, 'Message sent successfully');
} catch (error) {
  // signal-sdk automatically retries with exponential backoff
  logger.error({ error, recipient }, 'Failed to send message');
  throw error;
}
```

### Anti-Patterns to Avoid
- **Don't use BullMQ for message processing:** Signal has no webhook timeout constraint (unlike WhatsApp's 5s). Process messages directly in the event handler with async/await. Keeps architecture simpler.
- **Don't link as secondary device for bots:** Requires primary mobile device to be online. Bots should register as primary device with their own number.
- **Don't skip idempotency checks:** Even though we process in-memory, signal-cli can deliver duplicates on restart or network issues. Always check `isProcessed()`.
- **Don't ignore message timestamps:** Use `message.envelope.timestamp` as unique message ID, not just for ordering. Critical for idempotency.
- **Don't run multiple signal-cli daemons per number:** Signal protocol allows only one active daemon per account. Multiple instances cause encryption state corruption.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signal protocol implementation | Custom Signal encryption/decryption | signal-cli (via signal-sdk) | Signal protocol is complex: sealed sender, server-side fanout, rotating keys, device linking. signal-cli is battle-tested community implementation. |
| JSON-RPC client for signal-cli | Manual socket connection + JSON parsing | signal-sdk TypeScript wrapper | Handles connection lifecycle, retry logic, type safety, event subscriptions. Well-maintained with 100+ stars. |
| Message deduplication | Custom duplicate detection logic | Existing `IdempotencyStore` class | Already implemented with Redis + TTL. Just change message ID from `wamid` to `envelope.timestamp.toString()`. |
| Conversation state persistence | In-memory state with manual save logic | Existing `ConversationStore` class | PostgreSQL-backed with 30-min expiry, history trimming, atomic operations. Fully reusable. |
| LLM intent extraction | Custom Claude API prompts | Existing `llm/intent.ts` module | Already has prompt engineering for calendar intents, streaming, error handling. Zero changes needed. |
| Device registration automation | Headless browser CAPTCHA solving | Manual registration once | Signal actively prevents automation. One-time manual CAPTCHA is acceptable for bot setup. Don't waste time on brittle automation. |

**Key insight:** Signal's daemon-based architecture is simpler than WhatsApp's webhook model. You're removing complexity (no job queue, no webhook signature validation, no 5s timeout race), not adding it. Focus energy on the one-time registration hurdle, then leverage existing battle-tested components.

## Common Pitfalls

### Pitfall 1: CAPTCHA Registration Frustration
**What goes wrong:** Registration fails with "CAPTCHA required" error. Users visit https://signalcaptchas.org/registration/generate.html, complete CAPTCHA, but then get "Invalid CAPTCHA" or rate-limited with HTTP 429.

**Why it happens:**
- CAPTCHA tokens expire quickly (minutes, not hours)
- Signal rate-limits registration attempts from same IP
- Must complete CAPTCHA from same external IP as signal-cli registration
- Copy-paste timing matters - token invalidates if you wait too long

**How to avoid:**
1. Prepare signal-cli command BEFORE visiting CAPTCHA site
2. Open CAPTCHA site on same machine/network running signal-cli
3. Complete CAPTCHA immediately
4. Right-click "Open Signal" link, copy URL (don't navigate)
5. Paste token into signal-cli command within 60 seconds
6. If you hit 429 rate limit, wait 30+ minutes before retrying

**Warning signs:**
- "StatusCode: 429 (RegistrationRetryException)" = too many attempts, must wait
- "StatusCode: 502 (ExternalServiceFailureException)" = Signal server issue, try again later
- "Invalid CAPTCHA" after long delay = token expired, get fresh one

**Sources:**
- https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha
- https://github.com/AsamK/signal-cli/issues/1373
- https://github.com/AsamK/signal-cli/issues/1631

### Pitfall 2: Daemon Connects But No Messages Arrive
**What goes wrong:** signal-cli daemon starts successfully, client connects to socket, but incoming messages are never received as notifications.

**Why it happens:**
- **Timing issue:** Clients only receive messages that arrive AFTER they connect to the daemon socket. Messages received while no client was connected are lost.
- **Account not fully registered:** If registration completed but `updateAccount` was never run, encryption state may be stale.
- **Signal protocol requires regular polling:** If account hasn't received messages in a while, encryption ratchet gets out of sync.

**How to avoid:**
1. Run `updateAccount` command after registration to sync encryption state
2. Connect client to daemon socket BEFORE expecting test messages
3. Send test message only AFTER seeing "listening for messages" confirmation
4. Keep daemon running continuously - don't start/stop frequently
5. If messages still don't arrive, run `receive` command manually to force sync

**Warning signs:**
- Daemon logs show "started" but no "received message" entries when you send test
- Manual `receive` command works but daemon mode doesn't
- Old messages arrive when daemon starts, but new ones don't

**Sources:**
- https://github.com/AsamK/signal-cli/discussions/799
- https://github.com/AsamK/signal-cli/blob/master/man/signal-cli-jsonrpc.5.adoc

### Pitfall 3: Multiple Signal-CLI Instances Corruption
**What goes wrong:** Running multiple signal-cli daemon instances with the same account causes messages to become unreadable, encryption errors, or "failed to decrypt" errors in official Signal app.

**Why it happens:** Signal protocol maintains per-device encryption state (ratchets, session keys). Multiple daemons reading/writing the same account data directory create race conditions that corrupt this state. Signal's encryption depends on strictly sequential message processing per device.

**How to avoid:**
1. NEVER run multiple signal-cli daemons for the same phone number
2. Use single daemon instance with multi-client support (TCP socket mode)
3. If you need high availability, use process manager (systemd, PM2) to ensure only one instance
4. Don't mix signal-cli daemon with manual CLI commands while daemon is running
5. Proper shutdown: close daemon cleanly before starting a new instance

**Warning signs:**
- "Failed to decrypt message" errors in logs
- Official Signal app on phone shows decryption errors for messages sent to bot
- State directory lock file errors
- Messages arrive out of order or duplicated

**Sources:**
- https://github.com/AsamK/signal-cli/issues/38
- https://github.com/AsamK/signal-cli/discussions/752

### Pitfall 4: Forgetting Signal-CLI Version Expiry
**What goes wrong:** Bot works fine for months, then suddenly stops receiving/sending messages with protocol errors or "incompatible version" failures.

**Why it happens:** Signal Foundation aggressively deprecates old clients for security. Official Signal apps expire after 90 days. Signal servers can make breaking protocol changes after 3 months, so signal-cli releases older than ~90 days may break unexpectedly.

**How to avoid:**
1. Monitor signal-cli releases: https://github.com/AsamK/signal-cli/releases
2. Set calendar reminder to update signal-cli every 60 days
3. Use Dependabot or Renovate to track signal-sdk npm updates
4. Test signal-cli updates in staging before production deploy
5. Keep Java runtime updated (JRE 25+ required as of Feb 2026)

**Warning signs:**
- Messages stop arriving after bot has been running for 2+ months without updates
- Protocol errors mentioning version numbers in logs
- Signal-cli logs show "unsupported message type" errors

**Sources:**
- https://github.com/AsamK/signal-cli/discussions/700
- https://github.com/AsamK/signal-cli/blob/master/CHANGELOG.md

### Pitfall 5: Phone Number Format Mismatches
**What goes wrong:** Message sends fail with "invalid recipient" errors, or messages get sent but to wrong recipient.

**Why it happens:** Signal requires E.164 international format with country code (+1234567890), no spaces, no dashes. Inconsistency between registration number format and sending number format causes failures. Different Signal APIs (register vs send) may have different format requirements.

**How to avoid:**
1. ALWAYS use E.164 format: start with +, country code, number (e.g., "+12025551234")
2. Validate format on input with regex: `^\\+[1-9]\\d{1,14}$`
3. Strip formatting characters (spaces, dashes, parentheses) before sending to Signal
4. Use same format for registration, sending, and storing in database
5. Test with your own number first to verify format is accepted

**Warning signs:**
- "Invalid recipient" errors despite number looking correct
- Messages send successfully but recipient never receives them
- Registration works but sending fails with format errors

**Sources:**
- https://github.com/AsamK/signal-cli/blob/master/man/signal-cli.1.adoc
- Signal E.164 format requirement in official docs

## Code Examples

Verified patterns from official sources:

### Example 1: Daemon Startup and Connection
```typescript
// Source: https://github.com/benoitpetit/signal-sdk + signal-cli-jsonrpc.5.adoc
import { SignalCli, Logger } from 'signal-sdk';

// Initialize signal-sdk (automatically manages signal-cli daemon)
const signal = new SignalCli(
  process.env.SIGNAL_PHONE_NUMBER, // E.164 format: "+12025551234"
  undefined, // Config file path (optional, defaults to ~/.local/share/signal-cli)
  {
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
    rateLimiter: {
      maxConcurrent: 5,
      minInterval: 200, // milliseconds between requests
    },
    logger: new Logger('info'),
  }
);

// Start listening for messages (starts daemon if not running)
await signal.startListening();
logger.info('Signal daemon listening for messages');
```

### Example 2: Receiving and Processing Messages with Idempotency
```typescript
// Source: signal-cli JSON-RPC docs + existing idempotency pattern
signal.on('message', async (message) => {
  try {
    // Extract message details
    const { envelope } = message;
    const phoneNumber = envelope.source; // Sender's phone number
    const timestamp = envelope.timestamp; // Unix epoch milliseconds
    const text = envelope.dataMessage?.message || '';
    const messageId = timestamp.toString(); // Use timestamp as unique ID

    logger.debug({ phoneNumber, messageId, text }, 'Received message');

    // Idempotency check (reuse existing IdempotencyStore)
    if (await idempotencyStore.isProcessed(messageId)) {
      logger.debug({ messageId }, 'Duplicate message detected, skipping');
      return;
    }

    // Process message (reuse existing conversation + LLM logic)
    await processIncomingMessage(phoneNumber, text);

    // Mark as processed to prevent duplicates
    await idempotencyStore.markProcessed(messageId);

    logger.info({ phoneNumber, messageId }, 'Message processed successfully');
  } catch (error) {
    logger.error({ error, message }, 'Failed to process message');
    // Don't mark as processed - will retry on duplicate delivery
  }
});
```

### Example 3: Processing Message with Conversation State
```typescript
// Source: Existing codebase pattern - fully reusable
async function processIncomingMessage(
  phoneNumber: string,
  text: string
): Promise<void> {
  // Get conversation state (reuse existing ConversationStore)
  const state = await conversationStore.getState(phoneNumber);

  // Add user message to history
  await conversationStore.addToHistory(phoneNumber, 'user', text);

  // Extract intent using Claude (reuse existing LLM module)
  const messageHistory = state?.messageHistory || [];
  const intent = await extractIntent(anthropicClient, text, messageHistory);

  logger.info({ phoneNumber, intent: intent.type }, 'Intent extracted');

  // Generate response based on intent
  let response: string;

  if (intent.type === 'create_event') {
    // Handle calendar event creation logic
    response = await handleCreateEvent(intent, phoneNumber);
  } else if (intent.type === 'list_events') {
    // Handle list events logic
    response = await handleListEvents(intent, phoneNumber);
  } else {
    response = 'I can help you manage your family calendar. Try asking me to create an event or list upcoming events!';
  }

  // Send response via Signal
  await signal.sendMessage(phoneNumber, response);

  // Add assistant response to history
  await conversationStore.addToHistory(phoneNumber, 'assistant', response);
}
```

### Example 4: Sending Messages with Error Handling
```typescript
// Source: https://github.com/benoitpetit/signal-sdk
async function sendSignalMessage(
  recipient: string,
  text: string
): Promise<void> {
  try {
    // signal-sdk automatically retries with exponential backoff
    await signal.sendMessage(recipient, text);

    logger.info({ recipient }, 'Message sent successfully');
  } catch (error) {
    // After all retries exhausted
    logger.error(
      { error, recipient, text },
      'Failed to send message after retries'
    );

    // Could implement fallback: save to pending_messages table for manual retry
    throw error;
  }
}

// With attachments (for future calendar file exports)
async function sendWithAttachment(
  recipient: string,
  text: string,
  filePath: string
): Promise<void> {
  await signal.sendMessage(recipient, text, {
    attachments: [filePath],
  });
}
```

### Example 5: Graceful Shutdown
```typescript
// Source: Existing index.ts pattern + signal-sdk cleanup
async function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, cleaning up...');

  try {
    // Stop signal daemon
    await signalClient.stopListening();
    logger.info('Signal daemon stopped');

    // Close Redis connections
    await queueConnection.quit();
    logger.info('Redis connections closed');

    // Close PostgreSQL pool
    await closePool();
    logger.info('PostgreSQL pool closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Example 6: Registration (One-Time Manual Setup)
```bash
# Source: https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha

# Step 1: Request registration (triggers SMS/voice code)
signal-cli -a +12025551234 register

# If CAPTCHA required, visit https://signalcaptchas.org/registration/generate.html
# Complete CAPTCHA, right-click "Open Signal", copy URL

# Step 2: Register with CAPTCHA token
signal-cli -a +12025551234 register --captcha "signalcaptcha://signal-hcaptcha.5xx..."

# Step 3: Enter verification code from SMS
signal-cli -a +12025551234 verify CODE_FROM_SMS

# Step 4: Update account to sync encryption state
signal-cli -a +12025551234 updateAccount
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| signal-cli REST API Docker wrapper | signal-sdk with bundled binaries | 2024-2025 | No Docker needed, simplified deployment, native TypeScript types |
| DBus interface for daemon | JSON-RPC over Unix socket/TCP | signal-cli v0.11+ (2022) | Language-agnostic, easier to consume from Node.js/TypeScript |
| Linking as secondary device | Registering as primary device | Best practice evolution | Bots don't depend on mobile device being online |
| Manual JSON-RPC protocol handling | signal-sdk event-driven wrapper | signal-sdk v0.1+ (2024) | Type safety, retry logic, event subscriptions built-in |

**Deprecated/outdated:**
- **libsignal-protocol-javascript**: Official JS library is no longer maintained. Replaced by libsignal-client TypeScript API (but that's low-level crypto, not for bots)
- **signal-cli versions older than 3 months**: Signal servers deprecate old clients. Always update within 90 days.
- **DBus-only integration**: JSON-RPC is now preferred for cross-platform compatibility and language-agnostic access

## Open Questions

1. **Does signal-sdk handle signal-cli daemon lifecycle automatically?**
   - What we know: Documentation says "signal-cli binaries are included" and examples show `startListening()` method
   - What's unclear: Does signal-sdk spawn/manage the daemon process, or do we need systemd/PM2 to keep it alive?
   - Recommendation: Test `startListening()` behavior. If it spawns daemon child process, verify it survives parent crashes. If not, wrap in PM2/systemd for production.

2. **What is the actual npm package name for signal-sdk?**
   - What we know: GitHub repo is benoitpetit/signal-sdk, documentation shows `npm install signal-sdk`
   - What's unclear: npm registry search didn't return results (npm access issue during research)
   - Recommendation: Verify package exists with `npm info signal-sdk` before implementation. If not published, may need to install from GitHub: `npm install github:benoitpetit/signal-sdk`

3. **How does idempotency interact with daemon restarts?**
   - What we know: Clients only see messages received AFTER connection. Redis TTL is 7 days for idempotency.
   - What's unclear: When daemon restarts, does signal-cli re-deliver recent messages? If yes, does our Redis idempotency catch them?
   - Recommendation: Test daemon restart behavior. Send message, restart daemon, verify no duplicate processing. May need to lower idempotency TTL or handle "old" messages by timestamp.

4. **Can we reuse existing Redis connection from BullMQ, or do we remove Redis entirely?**
   - What we know: BullMQ is being removed (no webhook timeout). IdempotencyStore needs Redis.
   - What's unclear: Is Redis still worth running just for idempotency? Or should we switch to PostgreSQL-based idempotency?
   - Recommendation: Keep Redis for Phase 1 (simpler, existing code). Consider PostgreSQL migration in later phase if Redis operational overhead is high.

## Sources

### Primary (HIGH confidence)
- **signal-cli GitHub Repository**: https://github.com/AsamK/signal-cli - Official source, v0.13.24 release notes, installation docs
- **signal-cli JSON-RPC Man Page**: https://github.com/AsamK/signal-cli/blob/master/man/signal-cli-jsonrpc.5.adoc - Official API specification, request/response formats
- **signal-sdk GitHub Repository**: https://github.com/benoitpetit/signal-sdk - TypeScript SDK documentation, code examples, feature list

### Secondary (MEDIUM confidence)
- **signal-cli Releases Page**: https://github.com/AsamK/signal-cli/releases - Version 0.13.24 confirmed Feb 5, 2025
- **signal-cli Registration Wiki**: https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha - CAPTCHA process verified
- **signal-cli Linking Wiki**: https://github.com/AsamK/signal-cli/wiki/Linking-other-devices-(Provisioning) - Device linking process
- **signal-cli Best Practices Issue**: https://github.com/AsamK/signal-cli/issues/402 - Production deployment recommendations (attempted fetch, blocked by 403)

### Tertiary (LOW confidence - flagged for validation)
- **signal-sdk npm package existence**: Documentation shows `npm install signal-sdk` but npm registry access failed during research. MUST verify package is published before implementation phase.
- **signal-sdk daemon lifecycle management**: Examples show `startListening()` but implementation details not visible in documentation. Test behavior during planning.

### Community Resources (Context, not authoritative)
- **signal-cli alternatives overview**: https://github.com/exquo/signal-soft/wiki/Software-list
- **signald alternative**: https://signald.org/ (alternative daemon, not recommended - less mature)
- **signal-cli-rest-api Docker wrapper**: https://github.com/bbernhard/signal-cli-rest-api (alternative approach, adds complexity)

## Metadata

**Confidence breakdown:**
- Standard stack: **MEDIUM-HIGH** - signal-cli is well-documented official source. signal-sdk is newer (2024-2025) with good documentation but needs npm verification.
- Architecture: **HIGH** - JSON-RPC daemon pattern is well-established. Existing codebase patterns (idempotency, conversation state) are proven and reusable.
- Pitfalls: **MEDIUM** - Gathered from GitHub issues and wiki, common patterns emerge (CAPTCHA, daemon lifecycle, version expiry). Real-world confirmed but not all edge cases documented.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - signal-cli is stable, but Signal protocol evolves quarterly)

**Critical validation needed before implementation:**
1. Verify `signal-sdk` npm package exists and is installable
2. Test signal-sdk daemon lifecycle management (does it spawn daemon or require external process manager?)
3. Confirm phone number format requirements with actual registration test
4. Test idempotency behavior across daemon restarts
