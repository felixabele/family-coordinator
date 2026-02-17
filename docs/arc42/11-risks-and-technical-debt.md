# 11. Risks and Technical Debt

## 11.1 Risks

| Risk                               | Probability | Impact | Mitigation                                                                                       |
| ---------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------ |
| signal-sdk breaks or is abandoned  | M           | H      | signal-sdk is a third-party wrapper; no official Signal bot API exists. Monitor for alternatives |
| Claude API cost increases          | L           | M      | Prompt caching reduces cost ~90%. Commands bypass LLM. Monitor token usage via logs              |
| Claude API outage                  | L           | H      | No fallback LLM configured. Users get error message; daemon stays up                             |
| signal-cli subprocess crashes      | M           | H      | PM2 auto-restarts the entire process. signal-cli is spawned fresh on restart                     |
| Google Calendar API quota exceeded | L           | M      | Retry config with backoff for 429/5xx. Low traffic (family-only) makes this unlikely             |
| PostgreSQL data loss               | L           | L      | Daily backups via `scripts/backup.sh`. State data is ephemeral (30-min TTL). No critical data    |
| Single point of failure (one VPS)  | M           | H      | No redundancy. Acceptable for a family tool. Health check enables quick detection                |

## 11.2 Technical Debt

| Item                                                   | Location                                 | Impact                                                                        | Effort to Fix |
| ------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------- | ------------- |
| No test suite                                          | Project-wide                             | No automated verification of behavior changes                                 | L             |
| CI test job commented out                              | `.github/workflows/ci.yml`               | Changes deploy without test verification                                      | S             |
| `message_log` table column named `whatsapp_message_id` | `src/db/migrations/001_init.sql`         | Misleading name; system uses Signal, not WhatsApp                             | S             |
| `message_log` table exists but is unused in code       | `src/db/migrations/001_init.sql`         | Dead schema; adds confusion                                                   | S             |
| Listener file is 893 lines                             | `src/signal/listener.ts`                 | Large file with mixed concerns (orchestration + intent handling + formatting) | M             |
| Hardcoded affirmative detection                        | `src/signal/listener.ts` (lines 126-132) | Brittle keyword matching for conflict confirmation ("ja", "ok", "trotzdem")   | S             |
| `any` type usage in update event handling              | `src/signal/listener.ts` (line 547)      | Bypasses TypeScript's type checking                                           | S             |
| No migration tracking table                            | `src/db/migrate.ts`                      | Migrations use `IF NOT EXISTS` but re-run all files on every deploy           | M             |
| Prompt caching relies on exact prompt match            | `src/llm/intent.ts`                      | Any prompt change invalidates cache; no versioning                            | S             |
| German responses hardcoded in listener                 | `src/signal/listener.ts`                 | Not externalized; difficult to adjust tone or add languages                   | M             |
