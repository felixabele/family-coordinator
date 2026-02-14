# Architecture Research

**Domain:** WhatsApp Bot with Calendar Integration
**Researched:** 2026-02-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    External Services Layer                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐              ┌──────────────────┐             │
│  │  WhatsApp Cloud  │              │  Google Calendar │             │
│  │      API         │              │       API        │             │
│  │   (Meta/FB)      │              │                  │             │
│  └────────┬─────────┘              └────────▲─────────┘             │
│           │ HTTP POST                       │ REST API              │
│           │ (webhooks)                      │                       │
├───────────┼─────────────────────────────────┼───────────────────────┤
│           │    Application Layer            │                       │
├───────────┼─────────────────────────────────┼───────────────────────┤
│           ▼                                 │                       │
│  ┌─────────────────┐              ┌─────────────────┐               │
│  │  Webhook        │─────────────▶│  Job Queue      │               │
│  │  Receiver       │   enqueue    │  (Redis)        │               │
│  │  (HTTP Server)  │              │                 │               │
│  └─────────────────┘              └────────┬────────┘               │
│                                            │ dequeue                │
│                                            ▼                        │
│                           ┌──────────────────────────┐              │
│                           │   Message Processor      │              │
│                           │   (Worker Pool)          │              │
│                           └──────────┬───────────────┘              │
│                                      │                              │
│                                      ▼                              │
│  ┌──────────────────────────────────────────────────┐               │
│  │          Intent Router / Orchestrator            │               │
│  │   (Coordinates LLM + Calendar + Response)        │               │
│  └───┬──────────────────────────┬──────────┬────────┘               │
│      │                          │          │                        │
│      ▼                          ▼          ▼                        │
│  ┌────────┐            ┌─────────────┐  ┌─────────────┐             │
│  │  NLU   │            │  Calendar   │  │  Response   │             │
│  │ Agent  │            │  Service    │  │  Formatter  │             │
│  │(Claude)│            │             │  │             │             │
│  └────────┘            └──────┬──────┘  └──────┬──────┘             │
│                               │                │                    │
│                               │                │                    │
├───────────────────────────────┼────────────────┼────────────────────┤
│           Data Layer          │                │                    │
├───────────────────────────────┼────────────────┼────────────────────┤
│  ┌──────────────┐  ┌──────────▼────────┐  ┌───▼──────────┐         │
│  │   Session    │  │     Calendar      │  │   Message    │         │
│  │   State      │  │   Credentials     │  │   History    │         │
│  │   Store      │  │     Store         │  │   Store      │         │
│  │  (Redis)     │  │   (Encrypted)     │  │  (Database)  │         │
│  └──────────────┘  └───────────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component                      | Responsibility                                                                                                  | Typical Implementation                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Webhook Receiver**           | Accept incoming WhatsApp webhooks, validate signature, return 200 immediately                                   | Express.js/Fastify HTTP server with webhook signature validation |
| **Job Queue**                  | Decouple webhook receipt from processing, handle bursts, enable retry                                           | Redis with BullMQ (Node.js) or Asynq (Go)                        |
| **Message Processor**          | Pull jobs from queue, extract message content, route to orchestrator                                            | Worker pool (3-5 workers for family use case)                    |
| **Intent Router/Orchestrator** | Coordinate flow: send to NLU → interpret intent → call Calendar Service → format response                       | State machine or orchestration layer                             |
| **NLU Agent (Claude)**         | Parse natural language, extract calendar intent (create/update/query), extract entities (date, time, attendees) | Anthropic Claude SDK with structured output                      |
| **Calendar Service**           | CRUD operations on Google Calendar, handle auth, implement retry logic                                          | Google Calendar API client with exponential backoff              |
| **Response Formatter**         | Format calendar data into conversational WhatsApp messages                                                      | Template engine with message type handlers                       |
| **Session State Store**        | Track conversation state across messages for multi-turn interactions                                            | Redis with TTL (30 min typical)                                  |
| **Calendar Credentials Store** | Securely store OAuth tokens for Google Calendar                                                                 | Encrypted database or secrets manager                            |
| **Message History Store**      | Log all messages for debugging, compliance, conversation context                                                | PostgreSQL/MongoDB with message_id as idempotency key            |

## Recommended Project Structure

```
src/
├── webhook/              # Webhook handling
│   ├── receiver.ts       # HTTP server for WhatsApp webhooks
│   ├── validator.ts      # Signature validation
│   └── types.ts          # WhatsApp payload types
├── queue/                # Job queue
│   ├── producer.ts       # Enqueue jobs
│   ├── consumer.ts       # Worker pool
│   └── config.ts         # Queue configuration
├── orchestrator/         # Core business logic
│   ├── router.ts         # Intent routing
│   ├── state.ts          # Conversation state management
│   └── workflow.ts       # Multi-step conversation flows
├── agents/               # AI agents
│   ├── nlu/
│   │   ├── claude.ts     # Claude SDK integration
│   │   ├── prompts.ts    # System prompts for calendar tasks
│   │   └── parser.ts     # Parse structured output
├── services/             # External service integrations
│   ├── calendar/
│   │   ├── client.ts     # Google Calendar API client
│   │   ├── auth.ts       # OAuth flow
│   │   ├── retry.ts      # Exponential backoff
│   │   └── operations.ts # CRUD operations
│   ├── whatsapp/
│   │   ├── sender.ts     # Send messages via Cloud API
│   │   └── formatter.ts  # Message formatting
├── storage/              # Data persistence
│   ├── session.ts        # Session state (Redis)
│   ├── credentials.ts    # Encrypted credential storage
│   └── history.ts        # Message history (DB)
├── utils/                # Shared utilities
│   ├── logger.ts
│   ├── errors.ts
│   └── config.ts
└── index.ts              # Application entry point
```

### Structure Rationale

- **webhook/**: Thin layer focused solely on receiving and validating WhatsApp webhooks. No business logic.
- **queue/**: Decouples receipt from processing. Critical for meeting WhatsApp's 5-second response requirement.
- **orchestrator/**: Heart of the system. Routes messages, manages conversation state, coordinates agents and services.
- **agents/**: AI-specific logic isolated from business logic. Makes it easy to swap Claude for another LLM if needed.
- **services/**: External API integrations with error handling, retries, rate limiting.
- **storage/**: Data layer abstraction. Easy to swap Redis for another cache or DB implementation.

## Architectural Patterns

### Pattern 1: Immediate Acknowledgment with Async Processing

**What:** Webhook receiver immediately returns HTTP 200, enqueues message to Redis, then background workers process.

**When to use:** Always, for WhatsApp webhooks. Meta has a 5-second timeout; processing can take much longer.

**Trade-offs:**

- **Pros:** Meets WhatsApp timeout requirements, handles traffic spikes, enables retries
- **Cons:** Adds complexity (queue infrastructure), eventual consistency (user sees "processing" briefly)

**Example:**

```typescript
// webhook/receiver.ts
app.post("/webhook", async (req, res) => {
  // 1. Validate webhook signature
  if (!validateSignature(req.headers, req.body)) {
    return res.status(401).send("Invalid signature");
  }

  // 2. Return 200 IMMEDIATELY (don't await processing)
  res.status(200).send("OK");

  // 3. Enqueue asynchronously (don't block response)
  const payload = req.body;
  await queue.add("process-message", {
    messageId: payload.entry[0].changes[0].value.messages[0].id,
    payload: payload,
  });
});
```

### Pattern 2: Idempotent Processing with Message ID

**What:** Store processed webhook IDs in Redis with TTL. Before processing, check if ID exists. If yes, skip.

**When to use:** Always, for webhook handlers. WhatsApp retries on timeout/failure, causing duplicate processing.

**Trade-offs:**

- **Pros:** Prevents duplicate calendar events, safe retries, exactly-once semantics
- **Cons:** Extra Redis lookup on every message

**Example:**

```typescript
// queue/consumer.ts
async function processMessage(job) {
  const { messageId, payload } = job.data;

  // Check if already processed
  const processed = await redis.get(`processed:${messageId}`);
  if (processed) {
    console.log(`Message ${messageId} already processed, skipping`);
    return;
  }

  try {
    // Process message
    await handleMessage(payload);

    // Mark as processed (TTL 7 days)
    await redis.setex(`processed:${messageId}`, 7 * 24 * 60 * 60, "1");
  } catch (error) {
    // If error, don't mark as processed (will retry)
    throw error;
  }
}
```

### Pattern 3: Stateful Conversation with Session Store

**What:** Store conversation state (context, pending actions, user preferences) in Redis keyed by WhatsApp phone number.

**When to use:** Multi-turn conversations (e.g., "Schedule a meeting" → "When?" → "Tomorrow at 3pm" → "With whom?").

**Trade-offs:**

- **Pros:** Enables natural multi-turn dialogues, remembers user context
- **Cons:** Must handle session expiry, cleanup, memory limits

**Example:**

```typescript
// orchestrator/state.ts
interface ConversationState {
  phoneNumber: string;
  currentIntent: "create_event" | "query_events" | "update_event" | null;
  pendingData: {
    title?: string;
    date?: string;
    time?: string;
    attendees?: string[];
  };
  lastMessageAt: number;
}

async function getState(phoneNumber: string): Promise<ConversationState> {
  const state = await redis.get(`session:${phoneNumber}`);
  return state
    ? JSON.parse(state)
    : {
        phoneNumber,
        currentIntent: null,
        pendingData: {},
        lastMessageAt: Date.now(),
      };
}

async function saveState(state: ConversationState): Promise<void> {
  // TTL 30 minutes
  await redis.setex(
    `session:${state.phoneNumber}`,
    30 * 60,
    JSON.stringify(state),
  );
}
```

### Pattern 4: Exponential Backoff for External APIs

**What:** When Google Calendar API returns 429 (rate limit) or 503 (unavailable), retry with exponentially increasing delays.

**When to use:** All external API calls (Google Calendar, potentially Claude if rate limited).

**Trade-offs:**

- **Pros:** Handles transient failures gracefully, respects API rate limits
- **Cons:** Increases latency on failures

**Example:**

```typescript
// services/calendar/retry.ts
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = error.code === 429 || error.code === 503;
      const isLastAttempt = i === maxRetries - 1;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.pow(2, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Usage
await withRetry(() =>
  calendar.events.insert({
    calendarId: "primary",
    resource: event,
  }),
);
```

### Pattern 5: Structured Output from LLM

**What:** Use Claude's structured output to extract calendar entities (date, time, title, attendees) as JSON, not free text.

**When to use:** All NLU tasks where you need to parse user intent into actionable data.

**Trade-offs:**

- **Pros:** Reliable parsing, type-safe, easy to validate
- **Cons:** Requires good prompt engineering, schema design

**Example:**

```typescript
// agents/nlu/claude.ts
const schema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "create_event",
        "query_events",
        "update_event",
        "delete_event",
        "none",
      ],
    },
    entities: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", format: "date" },
        time: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["intent", "confidence"],
};

const response = await claude.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: `Parse this calendar request: "${userMessage}"`,
    },
  ],
  // Tool use for structured output
  tools: [
    {
      name: "parse_calendar_intent",
      description: "Parse user message into calendar intent and entities",
      input_schema: schema,
    },
  ],
});
```

## Data Flow

### Request Flow

```
[WhatsApp User Sends Message]
    ↓ HTTP POST
[Webhook Receiver] → Validate signature → Return 200
    ↓ enqueue
[Redis Job Queue]
    ↓ dequeue (worker)
[Message Processor] → Extract message content
    ↓
[Check Idempotency] → Redis lookup (processed:message_id)
    ↓ if not processed
[Load Session State] ← Redis (session:phone_number)
    ↓
[Intent Router] → Send to Claude NLU
    ↓
[Claude Agent] → Returns structured JSON (intent, entities)
    ↓
[Calendar Service] → Google Calendar API (create/query/update)
    ↓ with retry/backoff
[Google Calendar] → Returns event data
    ↓
[Response Formatter] → Format as WhatsApp message
    ↓
[WhatsApp Sender] → Send via Cloud API
    ↓
[Save Session State] → Redis (updated state)
    ↓
[Mark as Processed] → Redis (processed:message_id)
    ↓
[Log Message] → Database (history)
```

### State Management

```
[Incoming Message]
    ↓
[Retrieve Session State] ← Redis.get(session:phone_number)
    ↓
[Update State with Intent/Entities]
    ↓
[Save Session State] → Redis.setex(session:phone_number, TTL=30min)
    ↓
[State Available for Next Message]
```

### Key Data Flows

1. **Webhook to Queue:** WhatsApp → Webhook Receiver → Redis Queue (< 100ms to meet 5s timeout)
2. **Queue to Processing:** Redis Queue → Worker → Orchestrator → NLU/Calendar → Response (2-5s typical)
3. **Multi-turn Conversation:** Message 1 → Save state → Message 2 → Load state → Continue context
4. **Error Handling:** API failure → Retry with backoff → If all retries fail → Send error message to user

## Scaling Considerations

| Scale                             | Architecture Adjustments                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Family (1-10 users)**           | Single server, Redis on same machine, 1-2 workers, no optimization needed. PostgreSQL for message history. Est. 10-100 messages/day.                                              |
| **Small Group (10-100 users)**    | Separate Redis instance, 3-5 workers, consider managed Redis (Upstash/Redis Cloud). Add monitoring (Sentry, Datadog). Est. 100-1000 messages/day.                                 |
| **Organization (100-1000 users)** | Managed Redis cluster, horizontal scaling (5-10 workers), load balancer for webhook receivers, separate DB for history. Add rate limiting per user. Est. 1000-10000 messages/day. |
| **Enterprise (1000+ users)**      | Kubernetes deployment, auto-scaling workers based on queue depth, multi-region Redis, CDN for webhook endpoint, partition session state by region. Est. 10000+ messages/day.      |

### Scaling Priorities

1. **First bottleneck:** Worker processing capacity. Solution: Add more workers (horizontal scaling). Monitor queue depth.
2. **Second bottleneck:** Redis memory for session state. Solution: Shorten TTL, use Redis eviction policies, or partition by user hash.
3. **Third bottleneck:** Google Calendar API rate limits (10,000 requests/day default). Solution: Request quota increase, batch operations, cache calendar data.

**For family use case (1-10 users):** Simple single-server deployment is fine. No need for Kubernetes, load balancers, or multi-region. Focus on reliability and good error messages.

## Anti-Patterns

### Anti-Pattern 1: Processing in Webhook Handler

**What people do:** Receive webhook → Parse message → Call Claude → Call Google Calendar → Send response → Return 200
**Why it's wrong:** WhatsApp has a 5-second timeout. If Claude or Google Calendar is slow (2-3s each), you'll timeout. WhatsApp will retry, causing duplicate processing.
**Do this instead:** Receive webhook → Return 200 immediately → Queue job → Process asynchronously. Use pattern #1 (Immediate Acknowledgment).

### Anti-Pattern 2: No Idempotency

**What people do:** Process every incoming webhook without checking if it's a duplicate.
**Why it's wrong:** WhatsApp retries on timeout/failure. You'll create duplicate calendar events, send duplicate messages.
**Do this instead:** Use pattern #2 (Idempotent Processing). Check `processed:message_id` before processing.

### Anti-Pattern 3: Storing Full Conversation in LLM Context

**What people do:** Send entire conversation history to Claude on every message to maintain context.
**Why it's wrong:** Expensive (tokens), slow (latency), and unnecessary. Most calendar requests are single-turn.
**Do this instead:** Store structured state (intent, entities) in Redis. Only send 2-3 prior messages for context if needed. Use session state pattern #3.

### Anti-Pattern 4: No Retry Logic for External APIs

**What people do:** Call Google Calendar API once. If it fails (rate limit, timeout), return error to user.
**Why it's wrong:** Transient failures are common. Users get frustrated by intermittent errors.
**Do this instead:** Use pattern #4 (Exponential Backoff). Retry 3-5 times with increasing delays.

### Anti-Pattern 5: Synchronous Sequential Processing

**What people do:** For a message like "Schedule a meeting tomorrow at 3pm and send invite to John", process sequentially: parse → create event → send invite → respond (10+ seconds).
**Why it's wrong:** Slow user experience. User waits for each step.
**Do this instead:** For independent operations, parallelize where possible. For this case, parse is fast; create event + send invite can be a single Calendar API call.

### Anti-Pattern 6: Unencrypted Calendar Credentials

**What people do:** Store Google OAuth tokens in plaintext database.
**Why it's wrong:** Security risk. If DB is compromised, attacker has full calendar access.
**Do this instead:** Encrypt tokens at rest using database encryption or secrets manager (AWS Secrets Manager, GCP Secret Manager). Rotate tokens regularly.

## Integration Points

### External Services

| Service                 | Integration Pattern                  | Notes                                                                                                       |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **WhatsApp Cloud API**  | Webhooks (receive) + REST API (send) | Must return 200 within 5s. Validate signature. Use message templates for notifications.                     |
| **Google Calendar API** | REST API with OAuth 2.0              | Requires consent flow for user. Store refresh tokens securely. Watch for rate limits (10k req/day default). |
| **Claude (Anthropic)**  | REST API or SDK                      | Use structured output (tool use). Cache system prompts. Monitor token usage.                                |

### Internal Boundaries

| Boundary                            | Communication                        | Notes                                                                        |
| ----------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| **Webhook ↔ Queue**                 | Redis producer-consumer              | Webhook enqueues, workers dequeue. Decoupled for resilience.                 |
| **Orchestrator ↔ NLU Agent**        | Direct function call or API          | If using Claude SDK, direct call. If separate service, REST API.             |
| **Orchestrator ↔ Calendar Service** | Direct function call                 | Keep in same service for family use case. Can split later if needed.         |
| **Orchestrator ↔ Session Store**    | Redis client                         | Fast key-value lookup. Use consistent key format: `session:{phone_number}`.  |
| **Calendar Service ↔ Google API**   | REST API via official client library | Use `@googleapis/calendar` (Node.js) or `google-api-python-client` (Python). |

## Build Order Recommendations

Based on dependencies between components, suggested build order:

### Phase 1: Core Webhook Infrastructure

1. **Webhook Receiver** (receive and validate)
2. **Job Queue** (Redis setup, enqueue)
3. **Message Processor** (basic worker that logs messages)

**Why first:** Foundation. Can't receive messages without this.

### Phase 2: Calendar Integration

1. **Google Calendar Authentication** (OAuth flow, token storage)
2. **Calendar Service** (CRUD operations with retry logic)
3. **Manual testing** (call Calendar Service directly, verify events created)

**Why second:** Core functionality. Verifies Google Calendar access works before adding LLM complexity.

### Phase 3: NLU Agent

1. **Claude SDK Integration** (basic prompting)
2. **Structured Output Parser** (intent + entities extraction)
3. **Manual testing** (send text, verify structured output)

**Why third:** Parses user intent. Requires working webhook + queue to test end-to-end.

### Phase 4: Orchestration

1. **Intent Router** (connect NLU → Calendar Service)
2. **Response Formatter** (format calendar data for WhatsApp)
3. **WhatsApp Sender** (send formatted responses)

**Why fourth:** Connects all pieces. Completes basic end-to-end flow.

### Phase 5: State Management

1. **Session State Store** (Redis schema)
2. **Multi-turn Conversation Handling** (save/load state)
3. **Idempotency** (processed message tracking)

**Why fifth:** Refinement. Basic flow works without state; this adds multi-turn support.

### Phase 6: Reliability

1. **Error Handling** (catch and log errors gracefully)
2. **Monitoring** (logging, metrics)
3. **Testing** (integration tests for key flows)

**Why last:** Polish. System works end-to-end; now make it robust.

## Sources

### WhatsApp Business API Architecture

- [Building a Scalable Webhook Architecture for Custom WhatsApp Solutions](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions)
- [How to Set Up WhatsApp Business API: Complete Guide (2026)](https://www.socialintents.com/blog/how-to-set-up-whatsapp-business-api/)
- [Implementing Webhooks From The WhatsApp Business Platform](https://business.whatsapp.com/blog/how-to-use-webhooks-from-whatsapp-business-api)
- [WhatsApp Webhook Payloads Explained](https://www.linkedin.com/pulse/mastering-whatsapp-webhook-payloads-handling-text-media-zain-zulfiqar-oegcf)
- [Webhooks | Client Documentation - 360dialog](https://docs.360dialog.com/docs/waba-messaging/webhook)

### Calendar Integration

- [Tutorial: Building a WhatsApp + Google Calendar Chat Bot](https://developer.8x8.com/connect/docs/tutorial-building-a-whatsapp-google-calendar-chat-bot/)
- [Manage Google Calendar via WhatsApp with GPT-4 virtual assistant - n8n](https://n8n.io/workflows/5368-manage-google-calendar-via-whatsapp-with-gpt-4-virtual-assistant/)
- [How to Build a Chatbot: Components & Architecture 2026](https://research.aimultiple.com/chatbot-architecture/)

### LLM Agent Architecture

- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [The Complete Guide to Building Agents with the Claude Agent SDK](https://nader.substack.com/p/the-complete-guide-to-building-agents)
- [Building Effective Agents - Anthropic Research](https://www.anthropic.com/research/building-effective-agents)

### Webhook Async Processing & Job Queues

- [Webhook Scaling & Performance: High-Volume Processing Architecture Guide](https://inventivehq.com/blog/webhook-scaling-performance-guide)
- [Efficient Webhook Processing with Redis as a Queue in Go](https://webhookwizard.com/blog/webhook-processing-with-redis-go-queue)
- [Using Redis as a Webhook Queue](https://webhookwizard.com/blog/redis-as-a-webhook-queue)
- [How to Build a Job Queue in Go with Asynq and Redis](https://oneuptime.com/blog/post/2026-01-07-go-asynq-job-queue-redis/view)
- [Webhook Best Practices: Production-Ready Implementation Guide](https://inventivehq.com/blog/webhook-best-practices-guide)

### Conversation State Management

- [AI Chatbot Session Management: Best Practices](https://optiblack.com/insights/ai-chatbot-session-management-best-practices)
- [Handling Concurrent Sessions and Chronological Messaging In ChatBot](https://medium.com/@jayantnehra18/handling-concurrent-sessions-and-chronological-messaging-in-chatbot-9266479e3bca)
- [Enhancing Chatbot State Management with LangGraph](https://www.mattlayman.com/blog/2025/enhancing-chatbot-state-management/)

### Google Calendar API

- [Handle API errors - Google Calendar](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Manage quotas - Google Calendar](https://developers.google.com/calendar/api/guides/quota)
- [Google Calendar API Integration: Best Practices, Security](https://projectmanagers.net/google-calendar-api-integration-best-practices-security-and-a-faster-path-with-unipile/)

### Conversational AI Patterns

- [SmythOS - Conversational Agent Architecture](https://smythos.com/developers/agent-development/conversational-agent-architecture/)
- [Ultimate Guide to AI Agent Routing (2026)](https://botpress.com/blog/ai-agent-routing)
- [How to Build a Conversational AI Multi-Agent Bot in 2026?](https://www.solulab.com/build-a-conversational-ai-multi-agent-bot/)

---

_Architecture research for: WhatsApp Calendar Agent for Family Coordination_
_Researched: 2026-02-13_
_Confidence: HIGH - Based on official documentation (WhatsApp Business Platform, Google Calendar API), recent 2026 articles on webhook patterns, and established LLM agent architectures_
