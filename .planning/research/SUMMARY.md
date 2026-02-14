# Project Research Summary

**Project:** WhatsApp Calendar Agent (Family Coordinator)
**Domain:** Conversational AI Calendar Bot
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

This is a WhatsApp-based conversational calendar agent for family coordination, built on three critical integrations: WhatsApp Business Cloud API, Google Calendar API, and Claude (Anthropic LLM). The recommended architecture is a Node.js-based webhook server with async job processing, using Claude for natural language understanding and Google Calendar as the shared family calendar backend. The tech stack centers on Node.js 22 LTS with Fastify for webhook handling, PostgreSQL for persistent state, Redis for session management, and specialized SDKs for each integration point.

The core challenge is managing the complexity at integration boundaries: WhatsApp's 5-second webhook timeout requires immediate acknowledgment with async processing; the 24-hour messaging window restricts when free-form messages can be sent (requiring pre-approved templates for notifications); timezone handling across calendar operations demands explicit timezone specification to avoid chaos; and LLM context management must balance conversational quality with token costs. Success depends on getting these foundational patterns right before building features.

The primary risk is underestimating the operational complexity of three external APIs with different failure modes. WhatsApp webhooks can silently fail after returning 200 OK, Google Calendar has quota limits that exhaust per-service-account (not per-user), and Claude token costs can explode without prompt caching and context pruning. Mitigation requires defensive architecture from day one: idempotent webhook processing, exponential backoff for all external API calls, per-user quota attribution for Google Calendar, and aggressive LLM context management with prompt caching.

## Key Findings

### Recommended Stack

The stack prioritizes production stability and webhook performance over cutting-edge tooling. Node.js 22 LTS provides native TypeScript support and proven scalability for always-on webhook servers. Fastify is chosen over Express (2.3x faster) and Hono (edge-focused) for its async-first design and built-in schema validation. The database strategy uses PostgreSQL for persistent data with optional Redis for active session state, avoiding the file-based state anti-pattern that can't scale or survive restarts.

**Core technologies:**

- **Node.js 22 LTS + TypeScript 5.5+**: Runtime with native TS support, ideal for always-on webhook servers (not serverless due to WhatsApp timeout constraints)
- **Fastify 5.x**: HTTP framework optimized for webhook handling with async logging, 2.3x faster than Express
- **@great-detail/whatsapp**: Community-maintained WhatsApp SDK (official Meta SDK is 3 years outdated at v0.0.5-Alpha)
- **@anthropic-ai/sdk 0.74.0+**: Official Claude SDK with structured output support for reliable NLU parsing
- **@googleapis/calendar 14.2.0+**: Official Google Calendar v3 API client with OAuth 2.0 support
- **PostgreSQL 16.x**: Persistent storage for conversation history and credentials; relational model handles calendar data better than DynamoDB/MongoDB
- **Redis 7.x (optional)**: Session state cache for sub-millisecond active conversation lookups; can start without and add when scaling
- **Railway or Render**: Managed hosting with webhook support (Fly.io doesn't support webhooks), managed PostgreSQL, automatic SSL
- **Supporting**: Zod 4.x for runtime validation, Pino 9.x for async logging, Vitest 2.x for testing, date-fns 4.x for timezone-aware date handling

**Critical version notes:**

- Official Meta WhatsApp SDK abandoned at v0.0.5-Alpha (2022); use community fork @great-detail/whatsapp
- Anthropic SDK v0.74.0 (Feb 2026) includes Message Batching API and latest Claude models
- ESLint v9+ flat config is now default (deprecated .eslintrc format)
- Avoid: Serverless platforms (cold starts hurt webhook latency), Moment.js (deprecated), ts-node (slow), CommonJS (use ESM)

### Expected Features

Research reveals two tiers: table stakes (expected in any calendar bot) and differentiators (competitive advantages for family use cases). The MVP should focus on complete CRUD operations with conflict detection, deferring recurring events and reminders to v1.x after validating core flows.

**Must have (table stakes):**

- **View events** — Natural language queries ("What's on Friday?") with detailed responses showing title, date, time, location
- **Add events** — Create from natural language ("Lunch with mom tomorrow 1pm") with NLP parsing of entities
- **Edit events** — Modify existing events with ambiguity resolution when multiple matches
- **Delete events** — Remove cancelled events with confirmation to prevent accidents
- **Event confirmations** — Clear feedback after every mutation to prevent misunderstandings
- **24/7 availability** — Instant responses (always-on server, not serverless)
- **Natural language input** — Conversational interface, not structured commands

**Should have (competitive differentiators):**

- **Conflict detection** — Proactively warn of double-booking before confirming new events (major pain point for families)
- **Ambiguity resolution** — Present options when editing/deleting matches multiple events
- **Shared calendar visibility** — All family members see same events (one source of truth via Google Calendar)
- **Smart date parsing** — Understand "next Tuesday", "this Friday", relative dates beyond absolute dates
- **Multi-user context awareness** — Track who added what event for accountability
- **Quick replies/buttons** — WhatsApp interactive messages for [Confirm] [Cancel] instead of text-only

**Defer (v2+):**

- **Event reminders** — High value but requires background jobs and pre-approved WhatsApp templates; add after core CRUD validated
- **Recurring events** — Complex NLP for recurrence patterns ("every Monday at 4pm"); Google Calendar supports it but defer to v1.1
- **Time zone intelligence** — Handle "tomorrow" across timezones; edge case for most families unless traveling
- **Multiple calendar support** — Different product; validate single shared calendar first
- **AI-suggested scheduling** — "Find time for everyone" requires complex availability parsing; too ambitious for v1

**Explicitly avoid (anti-features):**

- Multiple calendar sync (Google + Outlook + Apple) — massive scope, pick Google only
- User permissions/roles — families expect equal access, not admin/member hierarchy
- Rich media in events — images/files add complexity; text-based details only
- Voice message input — transcription + NLP adds accuracy issues; text only
- Event analytics/reporting — nice to have but not core to coordination

### Architecture Approach

The standard pattern is immediate webhook acknowledgment with async processing via job queue. WhatsApp sends webhook → server validates signature and returns 200 within 5 seconds → job enqueued to Redis → worker processes asynchronously (parsing with Claude, calendar operations, response formatting). This decoupling is non-negotiable; synchronous processing will timeout and cause WhatsApp to retry, creating duplicates.

**Major components:**

1. **Webhook Receiver (Fastify HTTP server)** — Accept WhatsApp webhooks, validate X-Hub-Signature-256, return 200 immediately, enqueue to Redis
2. **Job Queue (Redis + BullMQ)** — Decouple receipt from processing, enable retries, handle traffic bursts
3. **Message Processor (Worker pool)** — Dequeue jobs, check idempotency (processed:message_id in Redis), extract message content, route to orchestrator
4. **Intent Router/Orchestrator** — Coordinate flow: send message to Claude → parse intent → call Calendar Service → format response → send via WhatsApp
5. **NLU Agent (Claude SDK)** — Parse natural language into structured output (intent, entities like date/time/title) using tool use for schema validation
6. **Calendar Service** — CRUD operations on Google Calendar with exponential backoff, quotaUser parameter for per-user quota attribution
7. **Session State Store (Redis)** — Track conversation state across messages with 30-minute TTL for multi-turn interactions
8. **Response Formatter** — Convert calendar data into conversational WhatsApp messages with event links

**Critical patterns:**

- **Immediate Acknowledgment**: Return HTTP 200 within 100ms, process asynchronously to meet WhatsApp 5-second timeout
- **Idempotent Processing**: Check `processed:message_id` in Redis before processing to prevent duplicate events from WhatsApp retries
- **Stateful Conversations**: Store structured state (intent, pending entities) in Redis, not full LLM conversation history
- **Exponential Backoff**: Retry Google Calendar API calls on 429/503 with increasing delays (1s, 2s, 4s...)
- **Structured LLM Output**: Use Claude tool use to extract JSON with intent/entities, not free text parsing

**Data flow:**
WhatsApp webhook → Validate signature → Return 200 → Enqueue Redis → Worker dequeues → Check idempotency → Load session state → Claude NLU (parse intent) → Calendar Service (CRUD with retry) → Format response → Send WhatsApp message → Save session state → Mark processed

**Project structure:**

```
src/
  webhook/          # HTTP server, signature validation
  queue/            # Redis producer/consumer, worker pool
  orchestrator/     # Intent routing, state management, workflows
  agents/nlu/       # Claude SDK, prompts, structured output parser
  services/         # calendar/ (Google API), whatsapp/ (sender)
  storage/          # session (Redis), credentials (encrypted), history (DB)
  utils/            # logger, errors, config
```

### Critical Pitfalls

Research identified 10 critical pitfalls; top 5 with highest impact:

1. **Ignoring 24-Hour Messaging Window** — WhatsApp only allows free-form messages within 24 hours of last user message; outside that window requires pre-approved templates. Building reminders/notifications without templates causes silent failures and potential account suspension. Prevention: Design notifications with templates from day one, track last user message timestamp, submit templates early for approval lead time. Address in Phase 1 (Foundation).

2. **Poor Webhook Verification** — Skipping X-Hub-Signature-256 validation, using wrong verify tokens, or invalid SSL certificates causes webhook failures and security breaches. Prevention: Implement HMAC signature validation immediately, test with valid/invalid signatures, deploy with proper SSL/TLS (not self-signed). Address in Phase 1 (Foundation).

3. **Timezone Chaos in Calendar Operations** — Not specifying explicit timezone in Google Calendar API creates events at wrong times, especially across DST boundaries or multi-timezone families. "3pm tomorrow" becomes 3pm server time, not user time. Prevention: Always pass explicit IANA timezone ("America/New_York"), store user timezone preference, confirm parsed details before creation. Address in Phase 2 (Core Features).

4. **LLM Context Window Mismanagement** — Sending full conversation history on every Claude request causes exploding costs (scales linearly with conversation length), token limit failures beyond 32K, and 23% performance drop above 85% capacity utilization. Prevention: Implement prompt caching for system prompts (90% cost reduction), summarize history periodically, store only last 5-10 turns plus summary, set realistic max_tokens (500-1000, not 4096). Address in Phase 1 (Foundation).

5. **Naive Conversation State Management** — Using file-based state (useMultiFileAuthState from tutorials) or in-memory state causes loss on restart, can't scale beyond single instance, users stuck in loops. Prevention: Use Redis/PostgreSQL for state from day one, implement conversation timeouts (30min), design exit commands ("cancel", "start over"). Address in Phase 1 (Foundation).

**Additional critical pitfalls to address early:**

- **Google Calendar Rate Limits**: Use quotaUser parameter to attribute quota to end-user, not service account; otherwise single quota exhausts for all family members (Phase 2)
- **Template Rejection Hell**: WhatsApp templates take 48 hours to review and are frequently rejected for promotional language, wrong variable format ({{name}} vs {{1}}), or category mismatch. Submit conservative utility templates early in development (Phase 1)
- **Natural Language Ambiguity**: Implement confidence scoring for parsed dates/times; below 0.8 threshold triggers clarification ("Did you mean this Tuesday Feb 18 or next Tuesday Feb 25?"). Always confirm before mutations (Phase 2)

## Implications for Roadmap

Based on dependencies and pitfall prevention, recommended 4-phase structure:

### Phase 1: Foundation & Webhook Infrastructure

**Rationale:** Can't receive or respond to messages without working webhook infrastructure. The 24-hour messaging window and conversation state architecture are foundational decisions expensive to change later. LLM cost management must be designed upfront, not retrofitted.

**Delivers:**

- WhatsApp webhook receiver with signature validation and HTTPS
- Redis job queue with async message processing
- Idempotent processing pattern (prevent duplicate events)
- Database-backed conversation state (not file-based)
- Claude SDK integration with structured output parsing
- LLM prompt caching and context management
- Basic message sending via WhatsApp Cloud API
- First message templates submitted for approval

**Addresses features:**

- 24/7 availability (webhook server infrastructure)
- Natural language input (Claude NLU foundation)

**Avoids pitfalls:**

- Pitfall 2: Poor webhook verification (signature validation from start)
- Pitfall 3: Naive state management (Redis/PostgreSQL, not files)
- Pitfall 5: LLM context bloat (prompt caching, context pruning)
- Pitfall 7: Template approval delays (submit early for lead time)
- Pitfall 10: Webhook silent failures (end-to-end testing)

**Stack used:** Node.js 22, Fastify, Redis, PostgreSQL, @great-detail/whatsapp, @anthropic-ai/sdk, Zod, Pino

**Research flag:** Standard webhook patterns, well-documented. No additional research needed.

---

### Phase 2: Calendar Integration & CRUD

**Rationale:** Core value proposition is calendar operations. Must implement timezone handling correctly before building features that depend on it. Conflict detection is the key differentiator for families and should be included early to validate value.

**Delivers:**

- Google Calendar OAuth flow and token storage (encrypted)
- Calendar service with exponential backoff and quotaUser attribution
- View events (query calendar with natural language)
- Add events (create with explicit timezone)
- Edit events (update with ambiguity resolution)
- Delete events (remove with confirmation)
- Event confirmations (structured responses with event links)
- Conflict detection (check existing events before creating)
- Timezone preference storage per user
- Confidence scoring for date/time parsing

**Addresses features:**

- View events (table stakes)
- Add events (table stakes)
- Edit events (table stakes)
- Delete events (table stakes)
- Event confirmations (table stakes)
- Conflict detection (differentiator)
- Ambiguity resolution (differentiator)

**Avoids pitfalls:**

- Pitfall 4: Timezone chaos (explicit IANA timezone in all API calls)
- Pitfall 6: Calendar rate limits (quotaUser parameter, exponential backoff)
- Pitfall 8: NLP ambiguity (confidence scoring, clarification prompts)
- Pitfall 9: Multi-user permissions (per-user OAuth, not service account)

**Stack used:** @googleapis/calendar, date-fns, Zod for validation

**Research flag:** Standard Google Calendar patterns. No additional research needed.

---

### Phase 3: Multi-User & Polish

**Rationale:** Once core CRUD works for single user, expand to multi-user coordination with proper permissions and UX improvements. Quick replies improve UX significantly with low implementation cost.

**Delivers:**

- Multi-user authentication and user identification
- Per-user Google Calendar permissions (ACL enforcement)
- Audit log (who added/modified what event)
- Context awareness ("Sarah added Soccer practice")
- WhatsApp interactive messages (quick reply buttons)
- Improved confirmation flows with [Confirm] [Cancel] buttons
- Help command and conversation reset ("cancel", "start over")
- Graceful timeout handling (30min inactivity → reset)

**Addresses features:**

- Multi-user context awareness (differentiator)
- Quick replies/buttons (differentiator)
- Shared calendar visibility (differentiator)

**Avoids pitfalls:**

- Pitfall 9: Multi-user permission failures (proper ACL, per-user OAuth)
- UX pitfall: Users stuck in abandoned conversations (timeout/reset)
- UX pitfall: No conversation escape hatch (help/cancel commands)

**Stack used:** Existing stack, WhatsApp interactive message API

**Research flag:** Multi-user WhatsApp patterns. Consider `/gsd:research-phase` for WhatsApp Business API best practices around multi-user identification and interactive messages.

---

### Phase 4: Advanced Features (v1.x)

**Rationale:** After core flows validated and multi-user working, add high-value features that require additional infrastructure (background jobs for reminders) or complex NLP (recurring events).

**Delivers:**

- Event reminders via pre-approved WhatsApp templates
- Background job scheduler for proactive notifications
- Recurring event support ("every Monday at 4pm")
- Smart date parsing ("next Tuesday", "in 2 weeks")
- Event search/filtering ("show all events next week")
- Time zone intelligence for traveling families

**Addresses features:**

- Event reminders (v1.x priority)
- Recurring events (v1.x priority)
- Smart date parsing (UX improvement)
- Event search/filtering (nice to have)
- Time zone intelligence (edge case)

**Avoids pitfalls:**

- Pitfall 1: 24-hour window (proper template usage for reminders)
- Pitfall 8: Recurrence pattern ambiguity (confirmation for complex patterns)

**Stack used:** Background job scheduler (BullMQ or similar), advanced Claude prompting for recurrence parsing

**Research flag:** Recurring event NLP parsing and WhatsApp template best practices. Consider `/gsd:research-phase` for "WhatsApp proactive messaging patterns" and "Natural language recurrence pattern parsing".

---

### Phase Ordering Rationale

- **Foundation first**: Webhook infrastructure and conversation state are architectural foundations that can't be easily changed. Getting messaging window, state management, and LLM cost patterns wrong requires rewrites.
- **Calendar CRUD second**: Core value delivery. Timezone handling must be correct from start to build user trust.
- **Multi-user third**: Depends on working CRUD. Expanding from single to multi-user is natural progression.
- **Advanced features last**: Reminders and recurring events require working foundation + CRUD. Background jobs add complexity best deferred until core flows validated.

**Dependency chain:**

- Phase 2 depends on Phase 1 (needs webhook infrastructure to receive calendar requests)
- Phase 3 depends on Phase 2 (needs working CRUD to coordinate across users)
- Phase 4 depends on Phases 1-3 (reminders need templates from Phase 1, CRUD from Phase 2, multi-user from Phase 3)

**Pitfall mitigation:**

- 7 of 10 critical pitfalls addressed in Phase 1 (foundation)
- 3 of 10 addressed in Phase 2 (calendar operations)
- Remaining pitfalls are UX/feature-specific, handled in Phases 3-4

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3**: Multi-user WhatsApp identification and interactive message API patterns — niche domain, worth targeted research
- **Phase 4**: Natural language recurrence pattern parsing — complex NLP, existing libraries may not handle all cases

**Phases with standard patterns (skip research-phase):**

- **Phase 1**: Webhook patterns, Redis job queues, LLM integration — well-documented, established patterns
- **Phase 2**: Google Calendar CRUD, OAuth flows — official documentation comprehensive, no gaps

**When to trigger `/gsd:research-phase`:**

- Before Phase 3 implementation: "WhatsApp Business API multi-user authentication patterns"
- Before Phase 4 reminders: "WhatsApp message template best practices for calendar notifications"
- Before Phase 4 recurring events: "Natural language recurrence pattern parsing libraries and approaches"

## Confidence Assessment

| Area         | Confidence      | Notes                                                                                                                                                                                                                             |
| ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | **HIGH**        | Node.js 22 LTS, Fastify, official SDKs verified from npm and docs. Community WhatsApp SDK (@great-detail/whatsapp) is MEDIUM confidence (fork of abandoned official SDK) but actively maintained.                                 |
| Features     | **MEDIUM**      | Table stakes identified from multiple competitor analyses and WhatsApp calendar bot reviews. Differentiators inferred from family coordination pain points. MVP scope reasonable but needs user validation.                       |
| Architecture | **HIGH**        | Webhook async processing pattern well-documented across multiple sources. LLM agent architecture verified from Anthropic docs. Google Calendar integration standard.                                                              |
| Pitfalls     | **MEDIUM-HIGH** | Critical pitfalls sourced from official docs (24-hour window, template guidelines), community issues (GitHub), and best practice articles. Some pitfalls from inference (timezone chaos) but confirmed by troubleshooting guides. |

**Overall confidence:** **HIGH**

Research quality is strong for technical stack and architecture (official sources, recent 2026 articles). Feature prioritization has medium confidence (relies on competitor analysis and domain inference). Pitfall research is solid but some prevention strategies are general best practices rather than WhatsApp-specific verified patterns.

### Gaps to Address

**During planning:**

- **WhatsApp template approval timeline**: Research shows 48-hour review but actual timelines vary. Plan for 1-week buffer when submitting first templates.
- **Multi-user authentication flow**: How to identify which family member sent message when all use same WhatsApp number? Need to research user onboarding pattern (send name on first use? Phone number per user?).
- **Google Calendar quota increases**: Default 10,000 requests/day may be sufficient for small family but unclear at what usage level quota increase needed. Monitor during beta.
- **Recurring event NLP edge cases**: Libraries for parsing "every other Tuesday" or "first Monday of month" not thoroughly researched. May need custom logic or conservative patterns only.

**During implementation:**

- **Claude prompt optimization**: System prompts for calendar intent parsing need iteration to achieve >0.8 confidence reliably. Budget time for prompt engineering.
- **Timezone testing across DST**: Must test event creation around DST transitions (March/November) to verify correctness.
- **WhatsApp webhook reliability**: Some integration platforms (n8n, Chatwoot) have reported silent failures. Test thoroughly in production-like environment.

**Post-launch validation:**

- **Feature prioritization**: Assumed conflict detection and ambiguity resolution are high-value differentiators based on research, but need real family usage to validate.
- **Template effectiveness**: Reminder templates may have lower engagement than expected if families ignore WhatsApp notifications. Need metrics.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**

- [WhatsApp Business Platform Documentation](https://business.whatsapp.com/blog/how-to-use-webhooks-from-whatsapp-business-api) — Webhook implementation, 24-hour window policy
- [Google Calendar API Documentation](https://developers.google.com/workspace/calendar/api) — OAuth, CRUD operations, quota management, timezone handling
- [Anthropic Claude SDK Documentation](https://github.com/anthropics/anthropic-sdk-typescript) — Structured output, tool use, prompt caching
- [WhatsApp Business API Compliance 2026](https://gmcsco.com/your-simple-guide-to-whatsapp-api-compliance-2026/) — Jan 2026 AI policy update requiring "concrete business tasks"

**Stack Research (npm + GitHub verified):**

- [@great-detail/whatsapp](https://www.npmjs.com/package/@great-detail/whatsapp) — Community fork, actively maintained vs official SDK v0.0.5-Alpha (3 years old)
- [@anthropic-ai/sdk v0.74.0](https://www.npmjs.com/package/@anthropic-ai/sdk) — Published Feb 2026, latest models
- [@googleapis/calendar v14.2.0](https://www.npmjs.com/package/@googleapis/calendar) — Official client, Dec 2025 release
- [Fastify vs Express vs Hono comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) — Performance benchmarks, use case fit

### Secondary (MEDIUM confidence)

**Feature Research:**

- [Famulor AI Calendar Bot](https://www.famulor.io/blog/rethinking-scheduling-how-famulors-ai-assistant-automates-your-calendar-across-all-channels) — Competitor analysis, multi-channel appointment booking
- [8x8 WhatsApp Calendar Tutorial](https://developer.8x8.com/connect/docs/tutorial-building-a-whatsapp-google-calendar-chat-bot/) — Integration patterns
- [Best Shared Calendar Apps 2026](https://koalendar.com/blog/best-shared-calendar-app) — Family coordination features

**Architecture Patterns:**

- [Building Scalable Webhook Architecture for WhatsApp](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions) — Async processing, queue patterns
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — LLM agent design patterns
- [Webhook Best Practices 2026](https://inventivehq.com/blog/webhook-best-practices-guide) — Idempotency, retries, signatures

**Pitfall Research:**

- [WhatsApp Template Rejection Reasons](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/) — 27 common rejection causes
- [Google Calendar Rate Limit Issues](https://community.latenode.com/t/rate-limit-exceeded-issue-with-google-calendar-api-integration/39496) — quotaUser parameter importance
- [LLM Context Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) — Prompt caching, summarization
- [Timezone Troubleshooting Guide](https://community.calendly.com/how-do-i-40/time-zone-troubleshooting-guide-242) — Common timezone issues

### Tertiary (LOW confidence, needs validation)

**Community Issues:**

- [GitHub: Chatwoot webhook display issue #13324](https://github.com/chatwoot/chatwoot/issues/13324) — Webhook forwarding silent failures
- [GitHub: Evolution API webhook not working #807](https://github.com/EvolutionAPI/evolution-api/issues/807) — Integration platform incompatibilities

**Inferred Best Practices:**

- Multi-user permission patterns — inferred from Google Calendar ACL documentation, not WhatsApp-specific
- Conversation timeout values (30 min) — industry standard for chatbots, not calendar-bot-specific research

---

_Research completed: 2026-02-13_
_Ready for roadmap: YES_
