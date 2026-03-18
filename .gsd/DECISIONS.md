# Decisions

| ID | Scope | Decision | Choice | Rationale |
|----|-------|----------|--------|-----------|
| D001 | library | Signal messaging SDK | signal-sdk from GitHub (benoitpetit/signal-sdk) | Most mature TypeScript wrapper for signal-cli, event-driven API |
| D002 | architecture | Dependency cleanup for Signal migration | Removed WhatsApp Business API, BullMQ, Redis, and Fastify | Signal uses event-driven messaging — no webhook/queue infrastructure needed |
| D003 | architecture | Phone number validation format | E.164 format validation with regex in Zod schema | Signal requires E.164 international format; consistent across registration and sending |
| D004 | architecture | Retry configuration | 3 max attempts, exponential backoff from 1s to 10s | Handles transient Signal API failures without overwhelming the service |
| D005 | architecture | Rate limiting | 5 concurrent, 200ms minimum interval between API calls | Prevents Signal API rate limits |
| D006 | architecture | Timezone handling | IANA timezone identifiers (Europe/Berlin) instead of UTC offsets | DST-safe handling for Google Calendar API |
| D007 | architecture | Default event duration | 1 hour when no end time specified | Matches typical calendar behavior |
| D008 | architecture | Date inference logic | Assume today if time hasn't passed, otherwise tomorrow | Enables natural language like "add meeting at 3pm" |
| D009 | architecture | Event search result pattern | Returns single/multiple/not found for disambiguation | Clean separation of event lookup outcomes |
| D010 | architecture | Calendar API retry strategy | 3 max attempts on 429 and 5xx errors | Uses googleapis built-in retry mechanism |
| D011 | architecture | LLM prompt language | System prompt rewritten entirely in German | Instructs Claude's German response generation with casual du-form |
| D012 | architecture | Missing time handling | Bot asks for time when user creates event without time specified | Better UX than guessing a default time |
| D013 | architecture | Empty calendar display | Simple German message (e.g., 'Samstag ist frei!') | Clean, friendly response instead of verbose explanation |
| D014 | architecture | Multiple event disambiguation | Numbered list for multiple event matches | Clear, unambiguous selection UX |
| D015 | architecture | Event display format | Compact 'HH:mm - Title \| HH:mm - Title' format | One-line-per-event, easy to scan |
| D016 | architecture | Mutation confirmations | All mutation operations confirm what changed in German | User always knows what the bot did |
| D017 | architecture | Calendar error handling | Calendar errors mapped to user-friendly German messages | NOT_FOUND, PERMISSION_DENIED, RATE_LIMITED, API_ERROR all have German messages |
| D018 | observability | formatDayName investigation | formatDayName function is correct — no code change needed | Bug root cause was LLM date resolution, not display formatting |

---

_Extracted from migrated slice summaries_
