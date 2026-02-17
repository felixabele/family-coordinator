# 2. Constraints

## 2.1 Technical Constraints

| Constraint                    | Rationale                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Node.js 22                    | Required for native TypeScript stripping (`--experimental-strip-types`), eliminating build step  |
| ESM modules exclusively       | Modern Node.js standard; `"type": "module"` in `package.json`                                    |
| signal-sdk (wraps signal-cli) | No official Signal Bot API exists; signal-sdk is the most mature wrapper for programmatic access |
| Dedicated Signal phone number | signal-cli requires a registered phone number to send/receive messages                           |
| Google Cloud service account  | Google Calendar API access requires a service account with calendar sharing                      |
| PostgreSQL                    | Persistent storage for conversation state and message idempotency                                |
| Always-on daemon              | Must listen continuously for incoming Signal messages; no request/response HTTP model            |
| Per-token LLM cost            | Every user interaction incurs Anthropic API charges; prompt caching mitigates cost               |

## 2.2 Organizational Constraints

| Constraint            | Rationale                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| Single developer      | Solo project -- architecture must be simple and maintainable             |
| German-only responses | All user-facing text in German with casual du-form to match family style |
| One shared calendar   | Family uses a single shared Google Calendar; no multi-calendar support   |
| Privacy-focused       | Signal chosen for end-to-end encryption; no data leaves Signal + Google  |

## 2.3 Conventions

| Convention              | Details                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| Prettier formatting     | Enforced via husky pre-commit hook + lint-staged for `*.{ts,js,json,md}` files |
| TypeScript strict mode  | `"strict": true` in `tsconfig.json`; all code is fully typed                   |
| Zod validation          | Runtime validation at system boundaries (env vars, LLM output, family config)  |
| E.164 phone format      | All phone numbers normalized to E.164 via `libphonenumber-js`                  |
| Structured JSON logging | Pino with JSON output in production, pretty-printed in development             |
| File-per-module exports | Each module exposes functions/classes via explicit exports; no barrel files    |
