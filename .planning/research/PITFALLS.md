# Domain Pitfalls: WhatsApp Calendar Agent

**Domain:** WhatsApp bot with calendar integration for family coordination
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Ignoring the 24-Hour Messaging Window

**What goes wrong:**
Your bot attempts to send messages outside the 24-hour customer service window without using pre-approved message templates, resulting in failed message delivery and potential API violations. The 24-hour window starts when a user sends you a message and resets with each user message.

**Why it happens:**
Developers treat WhatsApp like email or SMS where you can send anytime. They build reminder/notification features without understanding that free-form messages are only allowed within 24 hours of the last user message. Outside this window, only pre-approved message templates work.

**Consequences:**

- Messages silently fail to send
- User confusion ("why didn't I get my reminder?")
- Potential account suspension for repeated violations
- Complete rewrite of notification architecture to use templates

**Prevention:**

- Track the last user message timestamp for each conversation
- Design reminder/notification features to use approved message templates from day one
- Build a template approval workflow into your development process
- Implement fallback mechanisms when the 24-hour window expires
- Never promise real-time notifications without template pre-approval

**Detection:**

- Messages showing as "sent" in logs but never received by users
- WhatsApp API returning errors about messaging window violations
- Users reporting missed notifications/reminders

**Phase to address:**
Phase 1 (Foundation) - Architecture must account for messaging windows before building any features

---

### Pitfall 2: Poor Webhook Verification and Security

**What goes wrong:**
Webhook endpoints fail verification, don't validate signatures, or accept unauthenticated requests. This leads to failed WhatsApp integration, potential security breaches, or message processing failures.

**Why it happens:**
Developers skip webhook signature validation (X-Hub-Signature-256 header) to "get it working faster," use incorrect verify tokens, or misconfigure SSL/TLS certificates. WhatsApp requires HTTPS with valid certificates - self-signed certificates are rejected.

**Consequences:**

- Webhook verification failures prevent WhatsApp from sending events to your server
- Unvalidated webhooks expose your system to spoofed requests
- Messages appear in WhatsApp Cloud API logs but never reach your application
- SSL/TLS issues cause complete communication breakdown

**Prevention:**

- Implement HMAC signature validation for all webhook payloads from day one
- Use exact verify token matching between WhatsApp settings and application config
- Deploy with valid SSL/TLS certificates (Let's Encrypt for dev/staging, proper CA for production)
- Log webhook verification attempts to debug mismatches
- Test webhook endpoint accessibility from external networks before registering with Meta

**Detection:**

- Webhook registration fails in Meta developer console
- Logs show webhook payloads received but signature validation fails
- n8n/Chatwoot/integration platforms return HTTP 200 but don't process messages
- SSL handshake errors in server logs

**Phase to address:**
Phase 1 (Foundation) - Must be correct before any message processing can work

---

### Pitfall 3: Naive Conversation State Management

**What goes wrong:**
Using file-based state storage (like `useMultiFileAuthState`), storing state in memory, or failing to implement proper session management causes state loss during restarts, inability to scale, and complete conversation context loss.

**Why it happens:**
Developers copy tutorial code that uses file-based auth "for testing" and ship it to production. They don't plan for server restarts, multiple instances, or long-running conversations. No fallback when users abandon conversations mid-flow and return hours later.

**Consequences:**

- Users get stuck in conversation loops ("bot keeps asking the same question")
- All conversation history lost during deployment or crash
- Can't scale beyond single server instance
- Users who leave and return are greeted with "I don't understand" instead of context

**Prevention:**

- Use database-backed state storage (Redis, PostgreSQL) from day one - never ship file-based auth
- Implement conversation timeouts that gracefully reset to initial state
- Design conversation flows with explicit exit commands ("cancel", "start over")
- Store conversation state per user with timestamps
- Implement session recovery that detects abandoned conversations and offers to restart

**Detection:**

- User complaints about being stuck in loops
- All users lose conversation context after deployment
- Same user ID shows multiple concurrent "sessions" in logs
- Memory usage grows unbounded over time

**Phase to address:**
Phase 1 (Foundation) - Core architecture decision that's expensive to change later

---

### Pitfall 4: Timezone Chaos in Calendar Operations

**What goes wrong:**
Calendar events created at wrong times, events shifting by hours when viewed in Google Calendar, or complete timezone mismatches between what user requested and what was created. Family members in different timezones see different event times.

**Why it happens:**
Mixing timezone-naive and timezone-aware datetimes, assuming server timezone equals user timezone, not specifying explicit timezone in Google Calendar API calls, or trusting natural language parsing to infer timezone correctly. Google Calendar API accepts "floating time" which gets interpreted differently by different clients.

**Consequences:**

- "Create event for 3pm tomorrow" creates event at 3pm server time, not user time
- Shared family calendar shows events at wrong times for family members in different locations
- All-day events span two days due to UTC conversion issues
- Daylight saving time transitions cause 1-hour shifts
- Complete loss of user trust ("this bot is unreliable")

**Prevention:**

- Always use explicit timezone identifiers (IANA timezone database: "America/New_York", not "EST")
- Store user timezone preference per family member on first interaction
- Pass explicit timezone parameter to Google Calendar API for every event
- Use timezone-aware datetime libraries (Python: `zoneinfo`, JS: `luxon` or `date-fns-tz`)
- Confirm event details with user including timezone before creation
- Test across DST boundaries and multiple timezones

**Detection:**

- User reports: "event is at wrong time"
- Events created successfully but time differs from request by fixed offset (8 hours = timezone issue)
- All-day events showing as 11pm-11pm instead of 12am-12am
- Inconsistent behavior around DST changes (March/November)

**Phase to address:**
Phase 2 (Core Features) - Must be correct when calendar operations are implemented

---

### Pitfall 5: LLM Context Window Mismanagement

**What goes wrong:**
Sending entire conversation history with every LLM request, hitting token limits on long conversations, costs exploding as conversations grow, or LLM performance degrading because context is bloated with irrelevant information.

**Why it happens:**
Developers send full conversation history "to give the AI context" without pruning, summarizing, or using prompt caching. They don't monitor token usage or implement conversation length limits. Unaware that Claude API charges per token for input and output.

**Consequences:**

- API costs scale linearly (or worse) with conversation length
- Requests fail when context exceeds model limits (200K tokens for Claude Sonnet)
- LLM response quality degrades due to "lost in the middle" effect beyond 32K tokens
- 23% performance drop when context utilization exceeds 85% capacity
- Multi-turn conversations become prohibitively expensive

**Prevention:**

- Implement prompt caching for static content (system prompts, instructions) - saves up to 90%
- Summarize conversation history periodically (every 10 messages) while preserving key entities
- Store only last N turns plus summary in LLM context (N=5-10 for most use cases)
- Monitor token usage per request and set alerts for high usage
- Use conversation state tracking to determine what context is actually needed
- Set reasonable max_tokens limits (500-1000 for calendar operations, not 4096)
- Consider conversation threading: new task = new conversation context

**Detection:**

- API bills growing faster than user growth
- Individual requests costing $0.10+ (check token counts in API response)
- Request latency increasing over conversation length
- Token count warnings in API responses
- LLM giving worse responses in longer conversations

**Phase to address:**
Phase 1 (Foundation) - Cost optimization is hard to retrofit; build correctly from start

---

### Pitfall 6: Google Calendar API Rate Limit Violations

**What goes wrong:**
Hitting "Calendar usage limits exceeded" or "Rate limit exceeded" errors despite being well under documented quotas. Service accounts exhaust quotas while operating on multiple users' calendars, causing cascading failures.

**Consequences:**

- Calendar operations fail intermittently for all users
- Burst of activity (family planning weekend events) triggers rate limiting
- Service account quota exhausted even though individual users are under limit
- 403/429 errors require exponential backoff, adding latency

**Prevention:**

- Use quotaUser parameter in every API request to attribute quota to end user, not service account
- Implement exponential backoff with jitter for all calendar API calls
- Batch calendar operations when possible (single API call for multiple events)
- Cache calendar data locally with appropriate TTL to reduce API calls
- Monitor quota usage via Google Cloud Console
- Request quota increases proactively if family size will exceed defaults
- Use sliding window rate limiting client-side to stay under quotas

**Detection:**

- 403 usageLimits or 429 usageLimits errors in logs
- Errors cluster around specific times (mornings when families plan days)
- All operations fail simultaneously (service account quota exhausted)
- Error rates spike after quiet periods (quota calculated per-minute, sliding window)

**Phase to address:**
Phase 2 (Core Features) - Implement correctly when calendar integration is built

---

### Pitfall 7: WhatsApp Message Template Rejection Hell

**What goes wrong:**
Spending days getting message templates rejected by Meta for unclear reasons, then resubmitting only to face another rejection. Templates stuck in "pending" review for 48 hours. Entire notification strategy blocked because templates aren't approved.

**Why it happens:**
Developers treat templates like email copy, using promotional language ("Limited time!", "Act now!"), asking for sensitive info (passwords, PINs), or using incorrect variable parameter formatting ({{name}} instead of {{1}}). Picking wrong template category (marketing vs utility) or including competitor brand names.

**Consequences:**

- Can't send notifications outside 24-hour window (no reminders)
- 2-day delay for every template revision (manual review)
- Launch blocked waiting for template approval
- Template rejection cascades to dependent features
- Users experience bot as "doesn't send reminders"

**Prevention:**

- Follow template guidelines religiously: utility templates for transactional/operational messages
- Use sequential variable parameters: {{1}}, {{2}}, {{3}} - no skipping
- Never put variables at message start/end
- Avoid promotional language entirely ("Your event is tomorrow" not "Don't miss your event!")
- Use high-quality images (500x500px minimum)
- Keep messages clear and specific to purpose
- Submit templates early in development cycle for review time
- Create conservative templates first, test edge cases later

**Detection:**

- Template status shows "REJECTED" in Meta Business Manager
- Common rejection reasons: category mismatch, variable formatting, promotional tone
- Templates stuck in "PENDING" for >48 hours (escalate to Meta support)
- Rejection message cites policy violations

**Phase to address:**
Phase 1 (Foundation) - Submit first templates during architecture phase for approval lead time

---

### Pitfall 8: Natural Language Parsing Ambiguity Failures

**What goes wrong:**
Bot confidently creates wrong events because it misinterpreted ambiguous input ("next Tuesday" when user meant "week from Tuesday", "3pm" without timezone context, "dinner with mom" creates event titled exactly that with no time inference). Silent failures where parsing yields low confidence but bot proceeds anyway.

**Why it happens:**
Developers rely entirely on LLM to parse dates/times without validation, don't implement confidence scoring, or fail to clarify ambiguous inputs. No confirmation step before committing calendar changes.

**Consequences:**

- Events created at wrong dates/times
- User loses trust after first mistake
- No way to detect parsing confidence before action
- Family coordination breaks down due to incorrect events

**Prevention:**

- Implement confidence scoring for all parsed date/time entities (0.0-1.0)
- Set confidence threshold (0.8+) for automatic action; below threshold triggers clarification
- Always confirm parsed details before calendar mutation: "Creating 'Dinner' on Tuesday March 4th at 6pm - correct?"
- Maintain conversation context for relative dates ("next Tuesday" relative to conversation date)
- Use structured follow-up for ambiguous input: "Did you mean this Tuesday (Feb 18) or next Tuesday (Feb 25)?"
- Implement explicit disambiguation prompts for timezone if user preference unknown
- Log all parsing decisions with confidence scores for debugging

**Detection:**

- Users frequently say "no that's wrong" after confirmation
- Events created at times user didn't intend
- Support requests about "wrong event times"
- Low user retention (users abandon after bad experience)

**Phase to address:**
Phase 2 (Core Features) - Critical for calendar operation reliability

---

### Pitfall 9: Multi-User Permission and Access Control Failures

**What goes wrong:**
Any family member can delete/modify anyone's events, no distinction between personal and shared events, or one user's calendar auth token expires causing failures for entire family. No audit trail of who made changes.

**Why it happens:**
Developers assume "shared family calendar = everyone has full access" and don't implement granular permissions. Using single service account for all operations instead of per-user OAuth. No separation between bot permissions and user permissions.

**Consequences:**

- Kids can delete parents' work meetings
- No accountability for calendar changes
- Single auth failure breaks calendar for everyone
- Privacy violations (everyone sees everyone's events without consent)
- Google Calendar permission conflicts between user levels

**Prevention:**

- Implement per-user OAuth tokens for calendar access (user acts through bot, not bot acts as god)
- Use Google Calendar ACL to set explicit permissions per user
- Maintain user roles in your database (admin, editor, viewer)
- Validate permissions before every calendar operation
- Log all mutations with user attribution for audit trail
- Implement "undo last action" feature using audit log
- Use Calendar.acl.list() to verify user has required permission level before operation
- Design for token refresh handling per-user, with graceful degradation

**Detection:**

- Users report unauthorized changes to their events
- One user's auth expiry breaks calendar for whole family
- Google Calendar shows permission errors for specific users
- No way to determine who created/modified an event

**Phase to address:**
Phase 2 (Core Features) - Access control must be designed before multi-user features

---

### Pitfall 10: Webhook Processing Without Display (Silent Failures)

**What goes wrong:**
WhatsApp Cloud API webhooks arrive at your server, return HTTP 200 OK, job processing completes successfully in logs, but messages never appear in application UI or get processed by bot logic. Common with n8n, Chatwoot, Rocket.Chat integrations.

**Why it happens:**
Webhook forwarding chains break context (WhatsApp -> n8n -> Your App), integration platform versions incompatible with webhook format, or message routing logic fails silently after successful receipt. Headers lost during forwarding.

**Consequences:**

- Users send messages that appear delivered but bot never responds
- Debugging nightmare: webhooks logged as successful but no action taken
- Intermittent failures hard to reproduce
- Integration platform upgrades break working webhooks

**Prevention:**

- Log webhook payloads at every step in processing chain
- Implement end-to-end webhook testing with real WhatsApp messages, not just test events
- Monitor webhook-to-response latency (should be <2 seconds)
- Set up alerting when webhooks received but no corresponding bot action logged
- Avoid webhook forwarding chains; prefer direct endpoint when possible
- Version-pin integration platforms to known-working versions
- Implement webhook processing heartbeat check

**Detection:**

- Webhook endpoint returns 200 OK in Meta logs
- Your application logs show webhook received
- But no message appears in chat history or triggers bot response
- User reports "bot not responding" despite message showing as delivered

**Phase to address:**
Phase 1 (Foundation) - Webhook reliability is foundational infrastructure

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                             | Immediate Benefit                             | Long-term Cost                                                                 | When Acceptable                                                       |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| File-based state storage (useMultiFileAuthState)     | Fast to implement, works in tutorials         | Can't scale, loses state on restart, no multi-instance                         | Never in production; dev/testing only                                 |
| Sending full conversation history to LLM             | Simple implementation, "maximum context"      | Exploding costs, token limit failures, performance degradation                 | Never; always implement context management                            |
| Skipping webhook signature validation                | Faster initial setup, one less thing to debug | Security vulnerability, potential for spoofed messages                         | Never; security requirement                                           |
| Single service account for all calendar operations   | Simpler auth flow, one token to manage        | Quota exhaustion, no user attribution, privacy issues                          | Never for multi-user; only acceptable for single-user bot             |
| No timezone confirmation with user                   | Fewer interaction steps, feels faster         | Wrong event times, DST failures, multi-timezone chaos                          | Never; timezone mistakes destroy trust                                |
| Automatic event creation without confirmation        | Feels "smarter", fewer steps                  | Wrong events committed, no user validation                                     | Only after confidence score >0.95 AND user has opted into auto-create |
| Using ChatGPT/generic LLM instead of domain-specific | Easier setup, familiar tools                  | May violate WhatsApp AI policy (as of Jan 2026), no task-specific optimization | Never on WhatsApp since Jan 2026 policy change                        |
| Hardcoding message templates in code                 | Fast to change, no approval wait              | Can't send outside 24hr window, violates WhatsApp policy                       | Never; templates must be pre-approved in Meta console                 |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration         | Common Mistake                                             | Correct Approach                                                                 |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| WhatsApp Cloud API  | Not handling message status webhooks (sent/delivered/read) | Store message IDs and update status based on webhook events                      |
| WhatsApp Cloud API  | Using personal WhatsApp account instead of Business API    | Always use official WhatsApp Business Cloud API with Business Manager            |
| Google Calendar API | Creating events without explicit timezone parameter        | Always specify timeZone in event resource, never rely on defaults                |
| Google Calendar API | Not using quotaUser parameter with service accounts        | Set quotaUser to end-user ID for every request to attribute quota correctly      |
| Claude API          | Not leveraging prompt caching for system prompts           | Cache static instructions/examples to reduce costs by 90%                        |
| Claude API          | Setting max_tokens to maximum (8000+) for all requests     | Set realistic max_tokens based on expected response (500-1000 for calendar ops)  |
| All webhooks        | Returning non-200 status during processing                 | Return 200 immediately, process asynchronously; retry logic can cause duplicates |
| All webhooks        | Processing webhooks synchronously (blocking)               | Enqueue webhook payload to job queue, return 200, process async                  |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                           | Symptoms                              | Prevention                                                           | When It Breaks                                    |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| Synchronous calendar API calls in request path | Slow bot responses (5-10 seconds)     | Use async/await, queue heavy operations                              | >10 concurrent users or >5 events per operation   |
| No connection pooling to database              | "Too many connections" errors         | Use connection pool with max connections limit                       | >50 concurrent conversations                      |
| Loading all family calendar events to LLM      | High latency, token limit errors      | Filter events by date range (±7 days from now) before sending to LLM | >100 events in calendar or >3 family members      |
| No caching of calendar event lists             | Hitting rate limits, slow responses   | Cache event list with 5-minute TTL, invalidate on mutation           | >20 calendar reads per minute                     |
| Polling Google Calendar for changes            | Excessive API calls, quota exhaustion | Use Google Calendar push notifications (watch API)                   | >5 active users or >10 checks/day                 |
| In-memory conversation state                   | Server runs out of memory, crashes    | Use Redis/database for state, set TTL on sessions                    | >100 active users or >24hr conversation retention |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake                                                 | Risk                                                                   | Prevention                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Not validating X-Hub-Signature-256 on WhatsApp webhooks | Attacker spoofs messages from fake users, injects malicious commands   | Always validate HMAC signature using app secret before processing        |
| Exposing Google Calendar OAuth tokens in logs           | Token theft leads to full calendar access                              | Redact tokens in logs, store encrypted in database                       |
| No rate limiting on bot commands                        | Attacker spams event creation, exhausts quotas, creates calendar chaos | Implement per-user rate limits (10 commands/minute)                      |
| Storing family member PII in LLM prompts without audit  | Data sent to third-party API without consent/tracking                  | Log what data is sent to Claude, implement data minimization             |
| Using same verify token across environments             | Dev webhook token leaks, attacker can spoof production webhooks        | Unique verify tokens per environment (dev/staging/prod)                  |
| No input sanitization before calendar event creation    | User injects malicious content into event descriptions/titles          | Sanitize all user input, limit event title/description length            |
| Sharing service account credentials in code             | Credentials leak via git history, full system compromise               | Use environment variables, secret management (AWS Secrets Manager, etc.) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall                                                     | User Impact                                                | Better Approach                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Bot doesn't confirm before creating/deleting events         | Users don't trust bot, fear accidental changes             | Always confirm with "Create [event] - yes/no?" before mutating calendar         |
| No "undo last action" capability                            | Users can't recover from mistakes, abandon bot             | Implement "undo" command that reverses last mutation using audit log            |
| Bot responds with "I don't understand" to slight variations | Users feel frustrated, think bot is dumb                   | Use fuzzy matching, suggest alternatives: "Did you mean: [option1, option2]?"   |
| No conversation timeout/reset                               | Users stuck in abandoned conversation state from days ago  | Auto-reset conversation after 1 hour of inactivity with welcome message         |
| Replying with verbose LLM output                            | WhatsApp messages become walls of text, users stop reading | Constrain LLM to concise responses (max 2-3 sentences), use formatting          |
| Not showing calendar event links                            | Users can't access events directly from WhatsApp           | Always include event URL in confirmation messages                               |
| No help command or conversation escape hatch                | Users lost mid-conversation with no way out                | Implement "help", "cancel", "start over" commands always available              |
| Bot doesn't explain why it can't do something               | Users think bot is broken, not understanding constraints   | Explain limitations: "I can only send reminders for pre-approved message types" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Calendar event creation:** Often missing timezone specification — verify all events have explicit timeZone parameter
- [ ] **WhatsApp message sending:** Often missing template approval — verify templates are approved in Meta Business Manager before depending on them
- [ ] **Webhook endpoint:** Often missing signature validation — verify X-Hub-Signature-256 is checked before processing
- [ ] **Multi-user access:** Often missing per-user permissions — verify each user has appropriate Google Calendar ACL
- [ ] **LLM integration:** Often missing prompt caching — verify static prompts are cached to reduce costs
- [ ] **Error handling:** Often missing exponential backoff — verify all API calls retry with backoff on rate limit errors
- [ ] **Conversation state:** Often missing timeout/reset — verify abandoned conversations auto-reset after timeout
- [ ] **Date parsing:** Often missing confidence scoring — verify ambiguous dates trigger clarification prompts
- [ ] **Message templates:** Often missing 24-hour window handling — verify fallback to templates outside customer service window
- [ ] **OAuth tokens:** Often missing refresh logic — verify token expiry is handled gracefully per user

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                             | Recovery Cost | Recovery Steps                                                                                                                                                       |
| ----------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File-based state in production      | MEDIUM        | Migrate to Redis/PostgreSQL; dump existing file state to database; update code to use new state store; zero-downtime possible with feature flag                      |
| No timezone specification           | LOW           | Add timezone prompt to onboarding flow; update all event creation code to use user timezone; script to fix existing events with user confirmation                    |
| Template not approved               | HIGH (time)   | While waiting for approval: disable reminder features, explain limitation to users; expedite: contact Meta support; workaround: use 24hr window for manual reminders |
| Webhook signature not validated     | LOW           | Add validation middleware; test with valid/invalid signatures; deploy with monitoring                                                                                |
| LLM context bloat                   | MEDIUM        | Implement conversation summarization; set max context length; migrate existing conversations to summarized format; expect 2-3 day implementation                     |
| Service account quota exhaustion    | LOW           | Add quotaUser parameter to all requests; request quota increase from Google; temporary: implement request queuing to stay under limits                               |
| Multi-user permissions not enforced | MEDIUM-HIGH   | Implement permission layer; audit existing calendar operations; add per-user OAuth; migrate from service account (requires user re-auth)                             |
| No conversation timeout             | LOW           | Add session TTL to state store; add timeout check middleware; gracefully reset timed-out conversations                                                               |
| No event confirmation               | LOW           | Add confirmation step before mutations; store pending operations; very low user friction to add                                                                      |
| Timezone DST failures               | LOW-MEDIUM    | Always use IANA timezones (not UTC offsets); test around DST boundaries; script to audit events near DST transitions                                                 |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                       | Prevention Phase       | Verification                                                                      |
| ----------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| 24-hour messaging window      | Phase 1: Foundation    | Message template approval workflow in place, windowing logic tested               |
| Webhook security              | Phase 1: Foundation    | Signature validation tests passing, HTTPS with valid cert                         |
| Conversation state management | Phase 1: Foundation    | State survives server restart, multiple instances work correctly                  |
| Timezone chaos                | Phase 2: Core Features | Events created in multiple timezones display correctly in Google Calendar         |
| LLM context management        | Phase 1: Foundation    | Token usage tracked per request, costs scale sublinearly with conversation length |
| Calendar API rate limits      | Phase 2: Core Features | quotaUser parameter in all requests, exponential backoff tested                   |
| Template rejection            | Phase 1: Foundation    | First set of templates approved before feature development                        |
| NLP ambiguity                 | Phase 2: Core Features | Confidence scoring implemented, clarification prompts tested                      |
| Multi-user permissions        | Phase 2: Core Features | Per-user OAuth working, ACL enforced, audit log implemented                       |
| Webhook silent failures       | Phase 1: Foundation    | End-to-end webhook test passing, monitoring alerts configured                     |

---

## Sources

**WhatsApp Business API:**

- [WhatsApp Business API Compliance 2026 - Simple Guide](https://gmcsco.com/your-simple-guide-to-whatsapp-api-compliance-2026/)
- [Avoiding Common Pitfalls: What Not to Do When Using WhatsApp for Business](https://www.interakt.shop/whatsapp-business-api/business-common-mistakes/)
- [Common mistakes to avoid while implementing WhatsApp Business API](https://www.airtel.in/b2b/insights/blogs/whatsapp-business-api-implementation-mistakes/)
- [WhatsApp API Rate Limits: How They Work & How to Avoid Blocks](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/)

**WhatsApp Webhooks:**

- [WhatsApp Cloud API webhooks forwarded via n8n return 200 OK but messages are not created](https://github.com/chatwoot/chatwoot/issues/13324)
- [Meta Webhook for WhatsApp Cloud API not working](https://github.com/EvolutionAPI/evolution-api/issues/807)
- [Tips to Resolve Common Issues in WhatsApp Cloud API](https://www.sobot.io/article/resolve-whatsapp-cloud-api-issues/)
- [WhatsApp Business API Security Checklist](https://www.zoko.io/post/whatsapp-business-api-security)

**24-Hour Messaging Window:**

- [WhatsApp Business Platform 24 Hour Rule](https://www.enchant.com/whatsapp-business-platform-24-hour-rule)
- [What is the WhatsApp 24-Hour Rule, and How to Bypass It](https://blog.polser.io/what-is-the-whatsapp-24-hour-rule-and-how-to-bypass-it/)
- [Understanding the 24-hour conversation window in WhatsApp messaging](https://help.activecampaign.com/hc/en-us/articles/20679458055964-Understanding-the-24-hour-conversation-window-in-WhatsApp-messaging)

**WhatsApp State Management:**

- [Common WhatsApp Automation Mistakes (And How to Fix Them)](https://createautochat.com/common-whatsapp-automation-mistakes-and-how-to-fix-them/)
- [Mistakes when using chatbots on WhatsApp, and how to fix them](https://aunoa.ai/en/blog/common-mistakes-when-using-chatbots-on-whatsapp/)
- [WhatsApp Bot with Session Management & Group Messages](https://www.twilio.com/code-exchange/whatsapp-session-bot)

**Google Calendar API:**

- [Manage quotas | Google Calendar](https://developers.google.com/workspace/calendar/api/guides/quota)
- [Rate Limit Exceeded Issue with Google Calendar API Integration](https://community.latenode.com/t/rate-limit-exceeded-issue-with-google-calendar-api-integration/39496)
- [Common Problems with Google Calendar – Zapier](https://help.zapier.com/hc/en-us/articles/8495964746381-Common-Problems-with-Google-Calendar)

**Timezone Issues:**

- [Critical bug - Published Calendar ICS is mishandling meetings set in other timezones](https://learn.microsoft.com/en-us/answers/questions/4753914/critical-bug-published-calendar-ics-is-mishandling)
- [Troubleshooting for Google Calendar syncing](https://learn.gqueues.com/en/articles/5301365-troubleshooting-for-google-calendar-syncing)
- [Time Zone Troubleshooting Guide](https://community.calendly.com/how-do-i-40/time-zone-troubleshooting-guide-242)

**Message Templates:**

- [WhatsApp Template Approval Checklist: 27 Reasons Meta Rejects Messages](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/)
- [Message template approvals and statuses | Twilio](https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses)
- [Tips to Avoid WhatsApp Message Template Rejections](https://gallabox.com/blog/tips-guidelines-to-avoid-whatsapp-message-template-rejections)

**LLM Context Management:**

- [Context Window Management: Strategies for Long-Context AI Agents and Chatbots](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [LLM Context Management: How to Improve Performance and Lower Costs](https://eval.16x.engineer/blog/llm-context-management-guide)
- [Top techniques to Manage Context Lengths in LLMs](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms)

**Claude API Optimization:**

- [Anthropic Claude API Pricing 2026: Complete Cost Breakdown](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Anthropic API Pricing: Complete Guide and Cost Optimization Strategies](https://www.finout.io/blog/anthropic-api-pricing)
- [Claude API Quota Tiers and Limits Explained: Complete Guide 2026](https://www.aifreeapi.com/en/posts/claude-api-quota-tiers-limits)

**Natural Language Parsing:**

- [Parse natural language dates with OpenAI GPT-4o for smart scheduling](https://n8n.io/workflows/5460-parse-natural-language-dates-with-openai-gpt-4o-for-smart-scheduling/)
- [How do you handle ambiguity, uncertainty, and errors in natural language processing and chatbot development?](https://www.linkedin.com/advice/3/how-do-you-handle-ambiguity-uncertainty)
- [Ambiguity Handling in Natural Language Processing (NLP)](https://medium.com/@22bt04001/ambiguity-handling-in-natural-language-processing-nlp-002c06ad25b7)

**Calendar Permissions:**

- [Control access to a shared calendar - Google Calendar Help](https://support.google.com/calendar/answer/15716974?hl=en)
- [Managing Calendar Permissions on Exchange Server and Microsoft 365](https://woshub.com/manage-calendar-permissions-exchange-microsoft-365/)

---

_Research completed: 2026-02-13_
_Confidence level: MEDIUM-HIGH (based on official documentation, recent community issues, and verified best practices)_
