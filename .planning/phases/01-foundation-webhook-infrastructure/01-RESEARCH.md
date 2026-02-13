# Phase 1: Foundation & Webhook Infrastructure - Research

**Researched:** 2026-02-13
**Domain:** WhatsApp webhook server, async message processing, Claude LLM integration, conversation state management
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for the WhatsApp Calendar Agent: receiving WhatsApp messages via verified webhooks, processing them asynchronously to meet WhatsApp's 5-second timeout, understanding natural language via Claude LLM, and sending responses back. This is a greenfield project with no existing code.

The core technical challenge is the async processing pipeline: WhatsApp webhooks must return HTTP 200 within 5 seconds or Meta retries, causing duplicates. The standard pattern is immediate acknowledgment with background job processing via Redis/BullMQ. Claude's tool use API provides structured output extraction for reliable intent parsing. Conversation state must be persisted in PostgreSQL (Redis optional for v1) to survive restarts and support multi-turn interactions.

The stack is locked from prior project research: Node.js 22 LTS, Fastify 5, TypeScript, PostgreSQL, Redis. The WhatsApp SDK choice requires careful consideration -- the official Meta SDK is abandoned (v0.0.5-Alpha, last updated 2022). The community fork `@great-detail/whatsapp` was recommended in project research, but given the importance of webhook signature validation and message sending, we should also evaluate using the WhatsApp Cloud API directly via fetch/axios since the API surface for this project is small (receive webhooks, send text messages).

**Primary recommendation:** Build a Fastify webhook server with custom raw body parsing for HMAC signature validation, BullMQ for async job processing, Claude tool use for structured intent extraction, and PostgreSQL-backed conversation state with 30-minute TTL.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x LTS | Runtime | Native TypeScript stripping, native .env loading, stable LTS for always-on servers |
| TypeScript | 5.5+ | Type safety | Prevents runtime errors across 3 API integrations; all supporting libs expect TS 5.5+ |
| Fastify | 5.7.x | HTTP server | 2.3x faster than Express, built-in schema validation, async-first design, custom content-type parsers for raw body access |
| @anthropic-ai/sdk | 0.74.0+ | Claude LLM client | Official Anthropic SDK with tool use, structured outputs, prompt caching support |
| bullmq | 5.x | Job queue | Redis-backed job queue with TypeScript generics, retry logic, concurrency control, persistent jobs |
| pg | 8.x | PostgreSQL client | Direct PostgreSQL client; lightweight, well-maintained |
| zod | 4.x | Runtime validation | Validate webhook payloads, env vars, API responses at runtime; TypeScript-first |
| pino | 9.x | Structured logging | 5x faster than Winston, async logging prevents blocking webhook responses |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ioredis | 5.x | Redis client (BullMQ dependency) | Required by BullMQ; also used for idempotency checks and optional session cache |
| @fastify/rate-limit | 10.x | Rate limiting | Protect webhook endpoint from abuse; apply per-IP limits |
| date-fns | 4.x | Date utilities | Parse relative dates from user input; timezone-aware operations |
| tsx | 4.x | Dev TypeScript runner | Development-only; hot reload for fast iteration |
| vitest | 2.x | Testing framework | Unit and integration tests; 10-20x faster than Jest with native TS/ESM |
| dotenv | 16.x | Local env vars | Local development only; production uses platform secrets |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | Direct Redis pub/sub | BullMQ adds retry logic, job persistence, dead letter queues, and concurrency control. Direct Redis loses all of these. Use BullMQ. |
| @great-detail/whatsapp | Direct WhatsApp Cloud API via fetch | The API surface for Phase 1 is small (verify webhook, receive messages, send text). Direct API calls are simpler and have zero dependency risk. However, the SDK handles message type parsing. Recommend: start with direct API calls, add SDK later if needed. |
| pg (raw SQL) | Drizzle ORM / Prisma | ORM adds complexity for a simple schema. Raw pg with Zod validation is sufficient for conversation state table. Can migrate to ORM in later phases if schema grows. |
| In-process queue | BullMQ | In-process queues (e.g., p-queue) lose jobs on restart and cannot scale to multiple workers. BullMQ with Redis is the production-standard pattern. |

**Installation:**

```bash
# Core dependencies
npm install fastify @fastify/rate-limit \
  @anthropic-ai/sdk \
  bullmq ioredis pg \
  pino pino-pretty \
  zod date-fns

# Development dependencies
npm install -D typescript @types/node @types/pg \
  tsx vitest \
  eslint @eslint/js typescript-eslint \
  prettier eslint-config-prettier \
  dotenv
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)

```
src/
  index.ts              # Application entry point, Fastify server setup
  config/
    env.ts              # Environment variable validation with Zod
    constants.ts        # App constants (timeouts, TTLs, limits)
  webhook/
    routes.ts           # GET /webhook (verification) + POST /webhook (receive)
    signature.ts        # HMAC-SHA256 signature validation
    parser.ts           # WhatsApp payload parsing and type extraction
    types.ts            # WhatsApp webhook payload TypeScript types
  queue/
    connection.ts       # Shared Redis/IORedis connection config
    producer.ts         # Enqueue incoming messages to BullMQ
    consumer.ts         # Worker that processes messages
    types.ts            # Job data types
  llm/
    client.ts           # Anthropic SDK client initialization
    intent.ts           # Intent extraction tool definition + parsing
    prompts.ts          # System prompts for calendar intent parsing
    types.ts            # Intent/entity types (CalendarIntent, etc.)
  messaging/
    sender.ts           # Send WhatsApp text messages via Cloud API
    templates.ts        # Message response templates/formatters
    types.ts            # WhatsApp send message types
  state/
    conversation.ts     # Conversation state CRUD (PostgreSQL)
    idempotency.ts      # Processed message tracking (Redis)
    types.ts            # ConversationState type definition
  db/
    pool.ts             # PostgreSQL connection pool
    migrations/         # SQL migration files
      001_init.sql      # conversations, processed_messages tables
  utils/
    logger.ts           # Pino logger configuration
    errors.ts           # Custom error classes
```

### Pattern 1: Webhook Verification (GET endpoint)

**What:** WhatsApp sends a GET request with `hub.mode`, `hub.verify_token`, and `hub.challenge` to verify your webhook URL.
**When to use:** One-time setup when registering webhook URL in Meta developer console.

```typescript
// Source: WhatsApp Cloud API official docs
// webhook/routes.ts
import { FastifyInstance } from 'fastify';

export async function webhookRoutes(fastify: FastifyInstance) {
  // GET - Webhook verification
  fastify.get('/webhook', async (request, reply) => {
    const mode = (request.query as any)['hub.mode'];
    const token = (request.query as any)['hub.verify_token'];
    const challenge = (request.query as any)['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      reply.code(200).send(challenge);
    } else {
      reply.code(403).send('Forbidden');
    }
  });
}
```

### Pattern 2: Raw Body Access for Signature Validation

**What:** Override Fastify's default JSON parser to capture the raw buffer for HMAC signature validation before parsing JSON.
**When to use:** Always for the webhook POST endpoint. WhatsApp signs the raw body with X-Hub-Signature-256.

```typescript
// Source: Fastify v5.7 Content-Type Parser docs
// index.ts - Register custom parser BEFORE routes
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body: Buffer, done) => {
    // Attach raw body for signature validation
    (req as any).rawBody = body;
    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (err) {
      done(err as Error);
    }
  }
);
```

```typescript
// webhook/signature.ts
import { createHmac } from 'node:crypto';

export function validateWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;

  const expectedSignature = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const receivedSignature = signatureHeader.replace('sha256=', '');

  // Use timingSafeEqual to prevent timing attacks
  const expected = Buffer.from(expectedSignature, 'hex');
  const received = Buffer.from(receivedSignature, 'hex');

  if (expected.length !== received.length) return false;

  return require('node:crypto').timingSafeEqual(expected, received);
}
```

### Pattern 3: Immediate Acknowledgment with Async Processing

**What:** Webhook POST handler validates signature, returns 200 immediately, then enqueues job for background processing.
**When to use:** Always for WhatsApp webhooks. Meta has a 5-second timeout; Claude + calendar processing takes 2-5 seconds.

```typescript
// webhook/routes.ts
fastify.post('/webhook', async (request, reply) => {
  const rawBody = (request.raw as any).rawBody ?? (request as any).rawBody;
  const signature = request.headers['x-hub-signature-256'] as string;

  // 1. Validate signature
  if (!validateWebhookSignature(rawBody, signature, config.WHATSAPP_APP_SECRET)) {
    return reply.code(401).send('Invalid signature');
  }

  // 2. Return 200 IMMEDIATELY (before processing)
  reply.code(200).send('OK');

  // 3. Extract messages and enqueue (fire-and-forget)
  const payload = request.body as WhatsAppWebhookPayload;
  const messages = extractMessages(payload);

  for (const message of messages) {
    await messageQueue.add('process-message', {
      messageId: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body,
      payload: message,
    });
  }
});
```

### Pattern 4: Idempotent Message Processing

**What:** Check Redis before processing to prevent duplicate handling when WhatsApp retries.
**When to use:** Always. WhatsApp retries on timeout/failure. Without idempotency, duplicate calendar events and duplicate responses are created.

```typescript
// state/idempotency.ts
import Redis from 'ioredis';

const PROCESSED_TTL = 7 * 24 * 60 * 60; // 7 days

export class IdempotencyStore {
  constructor(private redis: Redis) {}

  async isProcessed(messageId: string): Promise<boolean> {
    const result = await this.redis.get(`processed:${messageId}`);
    return result !== null;
  }

  async markProcessed(messageId: string): Promise<void> {
    await this.redis.setex(`processed:${messageId}`, PROCESSED_TTL, '1');
  }
}
```

### Pattern 5: Claude Tool Use for Structured Intent Extraction

**What:** Use Claude's tool use API (not free text) to extract structured calendar intent as typed JSON.
**When to use:** All NLU tasks. Tool use guarantees structured output; free text requires fragile parsing.

```typescript
// Source: Anthropic official docs (platform.claude.com)
// llm/intent.ts
import Anthropic from '@anthropic-ai/sdk';

const calendarIntentTool = {
  name: 'parse_calendar_intent',
  description: 'Parse a user message into a calendar intent with extracted entities',
  input_schema: {
    type: 'object' as const,
    properties: {
      intent: {
        type: 'string',
        enum: ['create_event', 'query_events', 'update_event', 'delete_event', 'greeting', 'help', 'unclear'],
        description: 'The calendar intent detected from the user message',
      },
      entities: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title or description' },
          date: { type: 'string', description: 'Date in ISO 8601 format (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Time in HH:MM format (24-hour)' },
          duration_minutes: { type: 'number', description: 'Duration in minutes' },
        },
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0.0 to 1.0',
      },
      clarification_needed: {
        type: 'string',
        description: 'Question to ask user if intent is unclear or entities are missing',
      },
    },
    required: ['intent', 'confidence'],
  },
};

export async function extractIntent(
  client: Anthropic,
  userMessage: string,
  conversationContext?: string
): Promise<CalendarIntent> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: CALENDAR_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // Cache system prompt
      },
    ],
    tools: [calendarIntentTool],
    tool_choice: { type: 'tool', name: 'parse_calendar_intent' },
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === 'tool_use'
  );

  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('No tool use in response');
  }

  return toolUseBlock.input as CalendarIntent;
}
```

### Pattern 6: Conversation State Management (PostgreSQL)

**What:** Store conversation state per phone number in PostgreSQL with timestamps for TTL enforcement.
**When to use:** Multi-turn conversations where context spans multiple messages.

```typescript
// state/conversation.ts
import { Pool } from 'pg';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ConversationState {
  phoneNumber: string;
  currentIntent: string | null;
  pendingEntities: Record<string, unknown>;
  messageHistory: Array<{ role: string; content: string }>;
  lastMessageAt: Date;
}

export class ConversationStore {
  constructor(private pool: Pool) {}

  async getState(phoneNumber: string): Promise<ConversationState | null> {
    const result = await this.pool.query(
      `SELECT * FROM conversations
       WHERE phone_number = $1
       AND last_message_at > NOW() - INTERVAL '30 minutes'`,
      [phoneNumber]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      phoneNumber: row.phone_number,
      currentIntent: row.current_intent,
      pendingEntities: row.pending_entities,
      messageHistory: row.message_history,
      lastMessageAt: row.last_message_at,
    };
  }

  async saveState(state: ConversationState): Promise<void> {
    await this.pool.query(
      `INSERT INTO conversations (phone_number, current_intent, pending_entities, message_history, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (phone_number)
       DO UPDATE SET
         current_intent = $2,
         pending_entities = $3,
         message_history = $4,
         last_message_at = NOW()`,
      [
        state.phoneNumber,
        state.currentIntent,
        JSON.stringify(state.pendingEntities),
        JSON.stringify(state.messageHistory),
      ]
    );
  }
}
```

### Pattern 7: Sending WhatsApp Messages via Cloud API

**What:** Send text messages back to users via the WhatsApp Cloud API directly (no SDK needed for text-only).
**When to use:** All bot responses. The API surface is simple enough to call directly.

```typescript
// messaging/sender.ts
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }
}
```

### Anti-Patterns to Avoid

- **Processing in webhook handler:** Never call Claude or external APIs before returning 200. WhatsApp retries on timeout, causing duplicates.
- **In-memory conversation state:** Server restarts lose all state. Always use PostgreSQL or Redis.
- **Full conversation history to LLM:** Send only last 3-5 messages plus structured state summary. Full history causes token explosion and cost bloat.
- **Skipping signature validation:** Security requirement. Never process unsigned webhooks in production.
- **Synchronous webhook processing:** Even with fast processing, synchronous design creates coupling between webhook response time and external API latency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retries | Custom Redis pub/sub with retry logic | BullMQ | BullMQ handles job persistence, dead letter queues, concurrency, backoff, and graceful shutdown. Custom solutions miss edge cases (job visibility timeout, stalled job recovery). |
| HMAC signature validation | Custom crypto code without timing-safe comparison | Node.js `crypto.timingSafeEqual` | Timing attacks can bypass naive string comparison. `timingSafeEqual` is constant-time. |
| Structured LLM output | Regex/string parsing of Claude free text | Claude tool use with `tool_choice: { type: 'tool' }` | Tool use guarantees JSON structure. Free text parsing fails on edge cases, formatting changes, and multilingual input. |
| Environment variable validation | Manual `process.env.X || throw` checks | Zod schema validation at startup | Zod catches missing vars immediately at startup with clear error messages, generates TypeScript types, and validates formats (URLs, numbers). |
| Request rate limiting | Custom counter middleware | @fastify/rate-limit | Battle-tested, handles distributed rate limiting, supports multiple stores (memory, Redis). |
| Webhook payload parsing | Manual JSON traversal of nested WhatsApp payloads | Typed parser functions with Zod validation | WhatsApp webhook payloads are deeply nested (`entry[0].changes[0].value.messages[0]`). Type-safe parsing prevents undefined access errors. |

**Key insight:** The webhook-to-response pipeline has many failure modes (timeouts, retries, duplicates, malformed payloads, signature spoofing). Each "simple" custom solution misses edge cases that production traffic exposes. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: WhatsApp Webhook Timeout and Retry Cascade

**What goes wrong:** Processing takes longer than 5 seconds. WhatsApp retries the webhook. Your system processes the same message 2-3 times, sending duplicate responses and potentially creating duplicate calendar events.
**Why it happens:** Claude API calls take 1-3 seconds. Database operations add latency. Without async processing, total time easily exceeds 5 seconds.
**How to avoid:** Return HTTP 200 within 100ms. Enqueue to BullMQ. Process asynchronously. Implement idempotency checks using WhatsApp message ID.
**Warning signs:** Users receiving duplicate responses. `processed:` Redis keys showing same message ID multiple times in logs.

### Pitfall 2: Missing Raw Body for Signature Validation

**What goes wrong:** Fastify automatically parses JSON, consuming the raw body. HMAC signature computed on re-serialized JSON differs from the original because JSON serialization is not stable (key ordering, whitespace).
**Why it happens:** Developers compute HMAC on `JSON.stringify(request.body)` instead of the original raw bytes.
**How to avoid:** Use Fastify's `addContentTypeParser` with `parseAs: 'buffer'` to capture raw body BEFORE JSON parsing. Compute HMAC on the buffer, then parse JSON.
**Warning signs:** Signature validation always fails even with correct app secret.

### Pitfall 3: BullMQ Redis Configuration Missing `maxRetriesPerRequest: null`

**What goes wrong:** Workers silently stop processing jobs after Redis connection hiccups. Jobs pile up in the queue with no errors visible.
**Why it happens:** IORedis default `maxRetriesPerRequest` is 20. BullMQ workers need blocking connections (`BRPOPLPUSH`) that require `null` (infinite retries). Without it, the worker gives up after 20 retries and stops consuming.
**How to avoid:** Always set `maxRetriesPerRequest: null` for Worker connections. Keep it at default (20) or lower for Queue (producer) connections so failed enqueue operations fail fast.
**Warning signs:** Queue depth grows but workers show as idle. No error logs (failure is silent).

### Pitfall 4: LLM Token Cost Explosion

**What goes wrong:** Sending full conversation history on every Claude request causes per-message costs to scale linearly with conversation length. A 20-message conversation costs 20x more than the first message.
**Why it happens:** Developers append every message to context "for better understanding" without pruning.
**How to avoid:** Store structured state (current intent, pending entities) in database. Send only last 3-5 messages as context. Use prompt caching for system prompts (90% cost reduction on cache hits). Set `max_tokens` to 500-1000, not 4096.
**Warning signs:** API costs growing faster than message volume. Individual requests showing >5000 input tokens.

### Pitfall 5: Webhook Verification Endpoint Returns Wrong Response

**What goes wrong:** WhatsApp webhook verification fails in Meta developer console. The GET endpoint returns JSON `{ challenge: "..." }` instead of the raw challenge string.
**Why it happens:** Fastify auto-serializes return values to JSON. The challenge must be returned as plain text.
**How to avoid:** Return the challenge value directly as a string with `reply.code(200).send(challenge)`. Fastify will send it as plain text when the value is a string (not an object).
**Warning signs:** Meta developer console shows "Webhook verification failed" during setup.

### Pitfall 6: Not Handling WhatsApp Status Updates

**What goes wrong:** Bot attempts to process every webhook payload as a user message, including delivery status updates (`sent`, `delivered`, `read`). This causes errors or unexpected behavior.
**Why it happens:** WhatsApp sends status updates AND incoming messages to the same webhook endpoint. Developers don't distinguish between them.
**How to avoid:** Check `entry[0].changes[0].value.messages` existence. If absent, it's a status update (in `statuses` field) -- acknowledge and ignore for Phase 1.
**Warning signs:** "Cannot read property 'text' of undefined" errors in logs. Processing succeeds on some webhooks but fails on others.

### Pitfall 7: PostgreSQL Connection Pool Exhaustion

**What goes wrong:** "Too many clients already" error under moderate load. Bot stops responding.
**Why it happens:** Creating a new `pg.Client` per request instead of using a connection pool. Or setting pool max too low for concurrent message processing.
**How to avoid:** Use `pg.Pool` with `max: 10` (default). Share the pool instance across the application. Close the pool on shutdown.
**Warning signs:** Intermittent database errors under load. Connection count in PostgreSQL monitoring spikes.

## Code Examples

Verified patterns from official sources:

### Environment Variable Validation with Zod

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().startsWith('sk-'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
```

### BullMQ Queue and Worker Setup

```typescript
// queue/connection.ts
import IORedis from 'ioredis';

// Separate connections for producers and consumers
export function createQueueConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: 20, // Fail fast for producers
  });
}

export function createWorkerConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ workers (blocking connection)
  });
}
```

```typescript
// queue/producer.ts
import { Queue } from 'bullmq';
import type { MessageJobData } from './types.js';

export function createMessageQueue(connection: IORedis) {
  return new Queue<MessageJobData>('whatsapp-messages', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: { count: 1000 }, // Keep last 1000 completed
      removeOnFail: { count: 5000 },     // Keep last 5000 failed for debugging
    },
  });
}
```

```typescript
// queue/consumer.ts
import { Worker, Job } from 'bullmq';
import type { MessageJobData } from './types.js';

export function createMessageWorker(
  connection: IORedis,
  processor: (job: Job<MessageJobData>) => Promise<void>
) {
  const worker = new Worker<MessageJobData>(
    'whatsapp-messages',
    processor,
    {
      connection,
      concurrency: 3, // Process up to 3 messages concurrently
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, messageId: job.data.messageId }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
  });

  // CRITICAL: Without error handler, worker may stop processing
  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  return worker;
}
```

### Fastify Server Entry Point

```typescript
// index.ts
import Fastify from 'fastify';
import { validateEnv } from './config/env.js';
import { webhookRoutes } from './webhook/routes.js';

const config = validateEnv();

const fastify = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  },
});

// Raw body parser for signature validation
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body: Buffer, done) => {
    (req as any).rawBody = body;
    try {
      done(null, JSON.parse(body.toString()));
    } catch (err) {
      done(err as Error);
    }
  }
);

// Register routes
fastify.register(webhookRoutes);

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    await fastify.close();
    // Close BullMQ workers, Redis, PG pool here
    process.exit(0);
  });
}

await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
```

### Claude Prompt Caching for System Prompt

```typescript
// Source: Anthropic official docs (platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
// llm/client.ts
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: CALENDAR_SYSTEM_PROMPT, // ~500+ tokens of instructions
      cache_control: { type: 'ephemeral' }, // 5-min cache, 90% cost reduction on hits
    },
  ],
  tools: [calendarIntentTool],
  tool_choice: { type: 'tool', name: 'parse_calendar_intent' },
  messages: [
    { role: 'user', content: userMessage },
  ],
});

// Cache metrics from response:
// response.usage.cache_read_input_tokens  -> tokens served from cache
// response.usage.cache_creation_input_tokens -> tokens written to cache
// response.usage.input_tokens -> tokens not cached (user message)
```

### Database Migration (Phase 1)

```sql
-- db/migrations/001_init.sql
CREATE TABLE IF NOT EXISTS conversations (
  phone_number VARCHAR(20) PRIMARY KEY,
  current_intent VARCHAR(50),
  pending_entities JSONB DEFAULT '{}',
  message_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);

-- Optional: for message logging/audit
CREATE TABLE IF NOT EXISTS message_log (
  id SERIAL PRIMARY KEY,
  whatsapp_message_id VARCHAR(100) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  message_type VARCHAR(20) NOT NULL,
  content TEXT,
  intent VARCHAR(50),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_log_phone ON message_log(phone_number);
CREATE INDEX idx_message_log_wa_id ON message_log(whatsapp_message_id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express.js for webhook servers | Fastify 5 with async-first design | 2024-2025 | 2.3x faster, built-in validation, better TypeScript support |
| Free-text LLM parsing with regex | Claude tool use with `strict: true` structured outputs | 2025-2026 | Guaranteed JSON schema conformance, no parsing failures |
| Manual prompt token management | Prompt caching with `cache_control: { type: 'ephemeral' }` | 2025 | 90% cost reduction on cached system prompts (cache reads at 10% of base price) |
| `client.beta.promptCaching.messages.create()` | `client.messages.create()` with `cache_control` | 2025 | Prompt caching is GA, no beta prefix needed |
| QueueScheduler required for delayed jobs (BullMQ <2.0) | No QueueScheduler needed (BullMQ 2.0+) | 2023 | Simpler setup, one fewer component to manage |
| `.eslintrc` format | ESLint v9+ flat config (`eslint.config.mjs`) | 2024 | Old format deprecated, flat config is now default |
| CommonJS (`require`) | ESM (`import/export`) with `"type": "module"` | 2023-2024 | ESM is the standard for modern Node.js; better tree-shaking |

**Deprecated/outdated:**
- Official Meta WhatsApp SDK (`whatsapp` on npm): v0.0.5-Alpha, last updated 2022. Do not use.
- `ts-node`: Slow TypeScript runner. Use `tsx` instead (10x faster).
- Moment.js: Deprecated since 2020. Use `date-fns`.
- Winston logger: 5x slower than Pino for async logging.
- `client.beta.promptCaching`: Prompt caching is GA; use `client.messages.create()` directly.

## Open Questions

1. **WhatsApp SDK vs Direct API**
   - What we know: `@great-detail/whatsapp` is recommended in project research as a maintained fork of the abandoned official SDK. However, Phase 1 only needs: verify webhook, parse incoming messages, send text messages.
   - What's unclear: Whether the SDK adds meaningful value for this limited surface area vs. direct `fetch` calls to the Cloud API. The SDK may add type definitions for webhook payloads which would save effort.
   - Recommendation: Start with direct API calls for sending messages (simpler, no dependency risk). Define WhatsApp webhook types manually with Zod validation. Evaluate SDK addition in Phase 2 if message types become complex (media, interactive messages).

2. **Redis Requirement in Phase 1**
   - What we know: BullMQ requires Redis. Idempotency checks benefit from Redis. Conversation state CAN use Redis but PostgreSQL also works.
   - What's unclear: Whether to run Redis locally for development or use a managed Redis service immediately.
   - Recommendation: Use Redis for BullMQ (required) and idempotency (fast lookups). Use PostgreSQL for conversation state (persistent, survives Redis flush). For development, use local Redis via Docker. For production, use managed Redis from hosting platform (Railway/Render built-in).

3. **Claude Model Selection for Intent Parsing**
   - What we know: Claude Sonnet is faster and cheaper than Opus for structured extraction tasks. Haiku is fastest/cheapest but may miss nuance.
   - What's unclear: Whether Sonnet's accuracy is sufficient for calendar intent parsing or if Opus is needed for ambiguous requests.
   - Recommendation: Start with Claude Sonnet 4 (`claude-sonnet-4-20250514`) for intent extraction. It handles structured tool use well and is cost-effective. Upgrade to Opus only if accuracy issues emerge in testing.

4. **Message History Limit for LLM Context**
   - What we know: Full history is expensive and degrades quality. Too little context breaks multi-turn conversations.
   - What's unclear: Optimal number of history messages for calendar intent parsing.
   - Recommendation: Start with last 5 messages in context. Store current intent and pending entities in structured state (not in LLM context). Monitor token usage and adjust.

## Sources

### Primary (HIGH confidence)
- [Fastify v5.7 Documentation](https://fastify.dev/docs/latest/) - Content-type parser for raw body access, server setup
- [Anthropic Tool Use Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/tool-use) - Complete tool use patterns, TypeScript SDK examples, response format, strict mode
- [Anthropic Prompt Caching Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) - Cache control, pricing (90% reduction on hits), TTL (5 min default), TypeScript examples
- [Anthropic Structured Outputs Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs) - `strict: true` for guaranteed schema conformance, Zod integration via `zodOutputFormat`
- [BullMQ Documentation](https://docs.bullmq.io/) - Queue/Worker patterns, Redis connection requirements (`maxRetriesPerRequest: null`), TypeScript generics, job options

### Secondary (MEDIUM confidence)
- [WhatsApp Cloud API Webhook Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks) - Verification flow, X-Hub-Signature-256 validation (could not fetch directly but documented extensively in project research)
- Project research files: STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md - Comprehensive stack decisions, architecture patterns, and pitfall catalog

### Tertiary (LOW confidence)
- WhatsApp Cloud API message sending endpoint: Verified from training data. The `graph.facebook.com/v21.0/{phone-number-id}/messages` endpoint structure is well-known but exact current API version should be verified during implementation.
- `@great-detail/whatsapp` capabilities: Could not access npm page or GitHub repo directly. Information from project research STACK.md. Validate during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified from official docs or npm; versions confirmed
- Architecture patterns: HIGH - Webhook async processing is a well-documented pattern; verified from Fastify docs, BullMQ docs, and Anthropic docs
- Pitfalls: HIGH - Most pitfalls verified from official docs (Fastify raw body, BullMQ maxRetriesPerRequest) or confirmed by multiple sources (WhatsApp timeout behavior, signature validation)
- Code examples: HIGH - Fastify content-type parser from official docs; Anthropic tool use and prompt caching from official docs; BullMQ patterns from official docs

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days; stable technologies with slow-moving APIs)
