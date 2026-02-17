# 8. Crosscutting Concepts

## 8.1 Error Handling

**Strategy:** Errors are caught at the message processing level to prevent individual message failures from crashing the daemon. Domain-specific error classes enable targeted error responses in German.

**Implementation:**

- `src/utils/errors.ts` -- Custom error classes: `SignalConnectionError`, `SignalSendError`, `MessageProcessingError`, `IntentExtractionError`
- `src/calendar/types.ts` -- `CalendarError` with typed codes: `NOT_FOUND`, `PERMISSION_DENIED`, `RATE_LIMITED`, `API_ERROR`
- `src/llm/types.ts` -- `IntentExtractionError` with optional cause chain

**Error flow in `src/signal/listener.ts`:**

1. Calendar errors (`CalendarError`) map to German user-facing messages (e.g., `RATE_LIMITED` -> "Zu viele Anfragen, probier's gleich nochmal.")
2. All other errors caught by outer try/catch; user receives generic "da ist was schiefgelaufen" message
3. Errors are logged with full context but never crash the event handler
4. If sending the error response itself fails, that failure is logged but swallowed

## 8.2 Logging and Monitoring

**Logging:** Pino structured JSON logger (`src/utils/logger.ts`)

- Development: Pretty-printed with colors, timestamps as `HH:MM:ss`, no pid/hostname
- Production: Raw JSON output to stdout/stderr, captured by PM2 to `./logs/`
- Log levels configurable via `LOG_LEVEL` env var (default: `info`)
- All log entries include contextual data (phoneNumber, messageId, intent, etc.)

**Monitoring:**

- HTTP health check endpoint at `GET /health` on port 3000 (`src/health.ts`)
- Returns JSON with `status` ("healthy"/"unhealthy"), `uptime`, `timestamp`, and database connectivity check
- Returns HTTP 200 when healthy, 503 when unhealthy
- Used by deployment scripts to verify successful deployments
- Claude API usage metrics (input/output tokens, cache hits) logged at `info` level

## 8.3 Configuration Management

**Approach:** Environment variables validated at startup via Zod schema. Fail-fast: invalid configuration exits the process immediately.

**Key files:**

- `src/config/env.ts` -- Zod schema for all environment variables
- `.env.example` -- Template showing required variables
- `.env` / `.env.production` -- Actual environment files (never committed)
- `family-members.json` -- Family member whitelist (phone + name + optional UUID)

**Environment variables:**

| Variable                          | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `SIGNAL_PHONE_NUMBER`             | Bot's Signal phone number (E.164)      |
| `ANTHROPIC_API_KEY`               | Claude API key                         |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to Google service account JSON    |
| `GOOGLE_CALENDAR_ID`              | Shared family calendar ID              |
| `FAMILY_TIMEZONE`                 | IANA timezone (default: Europe/Berlin) |
| `DATABASE_URL`                    | PostgreSQL connection string           |
| `NODE_ENV`                        | development / production / test        |
| `LOG_LEVEL`                       | Pino log level (default: info)         |

## 8.4 Testing Strategy

**Framework:** Vitest (`vitest` v4, configured in `package.json` with `npm test`)

**Current state:** Test infrastructure is set up (vitest dependency, npm script) but no test files exist in the source tree yet. The CI test job in `.github/workflows/ci.yml` is currently commented out.

**Diagnostic tooling:** `scripts/debug-calendar.ts` provides a standalone script to verify Google Calendar API connectivity and permissions.

## 8.5 Security

**Authentication:**

- Family members authenticated by phone number or Signal UUID against a whitelist loaded from `family-members.json`
- `FamilyWhitelist` class (`src/config/family-members.ts`) provides O(1) lookup
- Unknown senders receive a rejection message (rate-limited to once per 5 minutes per sender to prevent spam loops)

**Authorization:**

- All whitelisted family members have equal access to all calendar operations
- No role-based access control (all members can create, edit, and delete events)

**Data protection:**

- Signal provides end-to-end encryption for all messages
- Sensitive values (phone numbers, API keys) masked in log output
- Environment files (`.env`, `.env.production`) excluded from version control
- Service account key file stored on VPS filesystem, not in repository
- No user data stored beyond conversation state (auto-expires after 30 minutes) and message IDs (auto-cleaned after 7 days)

## 8.6 Persistence

**Database:** PostgreSQL (run via Docker in both development and production)

**Schema** (3 tables):

| Table                | Purpose                                               | Key Columns                                                                                  |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `conversations`      | Active conversation state per phone number            | `phone_number` (PK), `current_intent`, `pending_entities` (JSONB), `message_history` (JSONB) |
| `processed_messages` | Idempotency tracking for Signal message deduplication | `message_id` (PK), `processed_at`                                                            |
| `message_log`        | Immutable audit trail of all messages                 | `id` (serial), `whatsapp_message_id`, `phone_number`, `direction`, `content`                 |

**Migrations:** Sequential SQL files in `src/db/migrations/`, executed by `src/db/migrate.ts`. Run automatically during deployment (`scripts/deploy.sh`) and manually via `npm run migrate`.

**Connection pool:** `pg.Pool` with max 10 connections, configured via `DATABASE_URL` environment variable.
