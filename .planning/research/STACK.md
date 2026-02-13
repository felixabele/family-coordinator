# Technology Stack

**Project:** WhatsApp Calendar Agent
**Researched:** 2026-02-13
**Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 22.x LTS | Runtime environment | Node.js 22 (LTS) provides native TypeScript support with `--experimental-strip-types`, native .env file loading with `--env-file`, and stable performance for webhook servers. Always-on requirement makes Node.js ideal over serverless. |
| **TypeScript** | 5.5+ | Type safety and developer experience | TypeScript-first development prevents runtime errors, especially critical when integrating three external APIs (WhatsApp, Google Calendar, Anthropic). Modern tooling (ESLint, Vitest, Zod) all expect TS 5.5+. |
| **Fastify** | 5.x | HTTP server framework | 2.3x faster than Express with built-in schema validation and JSON serialization. Production-ready webhook handling with async logging support. Better than Hono (edge-focused) or Express (legacy) for always-on Node.js servers. |

### API Clients

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@great-detail/whatsapp** | latest | WhatsApp Business Cloud API client | The official Meta SDK (`whatsapp` on npm) is 3 years outdated (v0.0.5-Alpha). This community fork is actively maintained, supports TypeScript, webhooks, and all Cloud API features. Originally forked from the deprecated official SDK. |
| **@anthropic-ai/sdk** | 0.74.0+ | Claude AI/LLM client | Official Anthropic SDK with full TypeScript support, streaming, tool use, and MCP integration. Version 0.74.0 (Feb 2026) includes latest Claude models and Message Batching API. |
| **@googleapis/calendar** | 14.2.0+ | Google Calendar API client | Official Google Calendar v3 API client. Standalone package preferred over full `googleapis` (lighter bundle). Supports OAuth 2.0 and Service Account authentication. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16.x | Persistent storage for conversation history, user preferences, calendar event cache | Relational model handles complex queries for conversation history and analytics. High availability through replication. Better than DynamoDB for structured calendar data and better than Redis for persistent storage. Use managed service (Railway, Render, etc.). |
| **Redis** (optional) | 7.x | Active session/conversation state cache | Sub-millisecond response for active conversation state. Ideal for multi-turn conversations where context matters. Optional: can start with PostgreSQL-only and add Redis when scaling. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Railway** or **Render** | N/A | Cloud hosting platform | Railway supports webhooks (Fly.io does not). Both offer managed PostgreSQL, Git-based deployment, automatic SSL, and simple scaling. Railway has usage-based pricing; Render has flat monthly tiers. Avoid serverless (cold starts hurt webhook latency). |
| **Docker** | latest | Containerization for consistent deployment | Ensures dev/prod parity. All hosting platforms support Docker. Not required but recommended for local development matching production environment. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **zod** | 4.x | Runtime validation and type inference | Validate all external inputs (WhatsApp messages, webhook payloads, environment variables). Zod 4 (stable 2026) provides zero-dependency TypeScript-first validation. Better than alternatives (Valibot, ArkType) for battle-tested stability. |
| **pino** | 9.x | Structured JSON logging | 5x faster than Winston. Async processing prevents logging from blocking webhook responses. Structured JSON integrates with monitoring tools. Essential for production debugging. |
| **dotenv** | 16.x | Local environment variable management | For local development only. Use native Node.js 22 `--env-file` flag in production. Never commit `.env` files. Use secrets manager (Railway/Render built-in) for production secrets. |
| **vitest** | 2.x | Unit and integration testing | 10-20x faster than Jest in watch mode. Native ESM and TypeScript support without configuration. Better for modern TypeScript projects. Jest only if migrating existing tests. |
| **tsx** | 4.x | TypeScript execution for development | Fastest TypeScript runner for development. Replaces ts-node/nodemon. Hot reload for rapid iteration. Production uses compiled JavaScript. |
| **@fastify/rate-limit** | 10.x | Rate limiting for webhook endpoints | Prevent abuse of public webhook endpoints. Essential security for production WhatsApp webhooks. |
| **date-fns** | 4.x | Date manipulation for calendar operations | Modern, immutable, tree-shakeable. Better than Moment.js (deprecated) or Day.js (smaller API). Calendar agents need reliable timezone and date parsing. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **ESLint** (flat config) | Code linting | Use ESLint v9+ flat config with TypeScript plugin. Flat config is default since ESLint v9. Use `defineConfig()` for type safety. |
| **Prettier** | Code formatting | Auto-format on save. Integrate with ESLint via `eslint-config-prettier` to prevent conflicts. |
| **Husky** + **lint-staged** | Git hooks for code quality | Pre-commit hooks run linting and formatting only on staged files. Prevents bad code from entering repo. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **Runtime** | Node.js 22 LTS | Bun 1.x | Bun is fast but ecosystem compatibility issues remain (especially with native modules). Node.js 22 LTS is production-stable and all libraries are tested against it. |
| **HTTP Framework** | Fastify 5 | Express 4/5 | Express is 2.3x slower and lacks modern async patterns. Fastify has better performance, built-in schema validation, and async-first design. |
| **HTTP Framework** | Fastify 5 | Hono 4 | Hono is designed for edge/serverless and multi-runtime. For Node.js-only always-on servers, Fastify has better ecosystem and stability. Use Hono if deploying to Cloudflare Workers. |
| **WhatsApp SDK** | @great-detail/whatsapp | Official Meta `whatsapp` npm | Official SDK hasn't been updated in 3 years (v0.0.5-Alpha). Community fork is actively maintained and production-ready. |
| **Database** | PostgreSQL | DynamoDB | DynamoDB requires AWS lock-in and is optimized for key-value access. Calendar data has relational structure (users, events, preferences). PostgreSQL provides better query flexibility and managed options (Railway/Render). |
| **Database** | PostgreSQL | MongoDB | Calendar events have fixed schema. PostgreSQL's relational model handles event relationships (recurrence, attendees) better than document model. |
| **Session Store** | PostgreSQL (or Redis) | In-memory (process.env) | In-memory state is lost on deploy/restart. Webhooks require persistent conversation state across multiple message exchanges. |
| **Testing** | Vitest 2 | Jest 30 | Vitest is 10-20x faster and has native ESM/TypeScript support. Jest 30 improved but still requires more configuration. Choose Jest only for existing test suites. |
| **Logger** | Pino 9 | Winston 3 | Pino is 5x faster with async processing. Winston blocks on log calls. For high-throughput webhook processing, Pino prevents logging from becoming bottleneck. |
| **Validation** | Zod 4 | TypeScript types only | Runtime validation is essential for external inputs (WhatsApp messages, API responses). TypeScript is compile-time only and can't validate untrusted data. |
| **Hosting** | Railway/Render | Fly.io | Fly.io doesn't support webhooks (critical blocker). Railway and Render both support webhooks, managed databases, and simpler deployment. |
| **Hosting** | Railway/Render | Vercel/Netlify | Vercel/Netlify are serverless-first. Cold starts hurt webhook response time. WhatsApp expects sub-200ms responses. Always-on server is better. |
| **Hosting** | Railway/Render | AWS EC2 | Managed platforms (Railway/Render) handle SSL, deployments, scaling, monitoring automatically. EC2 requires manual DevOps. Overkill for this project scale. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Official Meta WhatsApp SDK** (`whatsapp` npm) | 3 years outdated (v0.0.5-Alpha). No recent updates. Not production-ready. | `@great-detail/whatsapp` (actively maintained fork) |
| **Serverless Functions** (AWS Lambda, Vercel Functions) | Cold starts cause 500ms+ latency. WhatsApp webhooks expect sub-200ms responses or they retry. | Always-on Node.js server (Railway/Render) |
| **Environment variables for secrets in production** | Plain text in process memory. Logged in crash reports. Inherited by child processes. Security risk for API keys. | Secrets manager (Railway/Render built-in, AWS Secrets Manager, or dotenv-vault's successor: dotenvx) |
| **Moment.js** | Deprecated since 2020. Large bundle size. Mutable API causes bugs. | `date-fns` 4.x (modern, immutable, tree-shakeable) |
| **ts-node** | Slow TypeScript execution. Heavy on CPU. | `tsx` 4.x (10x faster, hot reload) |
| **eslintrc** format | Deprecated in ESLint v9. Flat config is now default. | ESLint flat config (`eslint.config.mjs`) |
| **CommonJS** (`require`/`module.exports`) | ESM is the standard. Better tree-shaking, native browser/Node support. All modern tools expect ESM. | ESM (`import`/`export`) with `"type": "module"` in package.json |

## Installation

```bash
# Core dependencies
npm install fastify @fastify/rate-limit \
  @great-detail/whatsapp \
  @anthropic-ai/sdk \
  @googleapis/calendar \
  pg \
  pino pino-pretty \
  zod \
  date-fns

# Development dependencies
npm install -D typescript @types/node \
  tsx \
  vitest \
  eslint @eslint/js typescript-eslint \
  prettier eslint-config-prettier \
  husky lint-staged \
  dotenv

# Optional: Redis for session state (add when scaling)
# npm install redis
```

## Environment Variables Setup

```bash
# .env.example (commit this to repo)
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Anthropic Claude
ANTHROPIC_API_KEY=

# Google Calendar API
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_ID=
# Or for Service Account:
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: Redis
# REDIS_URL=redis://host:port

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## TypeScript Configuration

**tsconfig.json** (recommended settings):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitOverride": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Production Build

```bash
# Compile TypeScript
npx tsc

# Run production server
NODE_ENV=production node --env-file=.env dist/index.js

# Or with Docker:
# docker build -t whatsapp-calendar-agent .
# docker run -p 3000:3000 --env-file .env whatsapp-calendar-agent
```

## Confidence Assessment

| Technology Layer | Confidence | Rationale |
|------------------|------------|-----------|
| **Core Runtime** (Node.js, TypeScript, Fastify) | **HIGH** | Node.js 22 LTS is production-stable. Fastify is battle-tested for webhook servers. TypeScript 5.5+ is industry standard. |
| **WhatsApp API** (@great-detail/whatsapp) | **MEDIUM** | Community fork, not official Meta SDK. However, official SDK is abandoned. Fork is actively maintained and used in production by multiple projects. Verified from npm and GitHub. |
| **Anthropic SDK** (@anthropic-ai/sdk) | **HIGH** | Official SDK from Anthropic. Version 0.74.0 published Feb 2026. Well-documented, actively maintained. |
| **Google Calendar API** (@googleapis/calendar) | **HIGH** | Official Google SDK. Version 14.2.0 published Dec 2025. Part of googleapis suite. Production-ready. |
| **Database** (PostgreSQL) | **HIGH** | Industry standard for relational data. Managed PostgreSQL available on all major platforms. Well-suited for calendar event data. |
| **Hosting** (Railway/Render) | **HIGH** | Both platforms explicitly support webhooks, managed databases, and Node.js. Verified from official docs and comparison articles. |
| **Supporting Libraries** (Zod, Pino, Vitest, etc.) | **HIGH** | All are current 2026 best practices verified from multiple sources. Zod 4, Pino 9, Vitest 2 are latest stable versions. |

## Sources

**WhatsApp Business API:**
- [WhatsApp/WhatsApp-Nodejs-SDK - GitHub](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK) (official but outdated)
- [@great-detail/whatsapp - npm](https://www.npmjs.com/package/@great-detail/whatsapp) (recommended alternative)
- [WhatsApp Business Platform Node.js SDK Quickstart](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/)

**Anthropic Claude SDK:**
- [@anthropic-ai/sdk - npm](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [anthropic-sdk-typescript - GitHub](https://github.com/anthropics/anthropic-sdk-typescript)
- [How to Implement Anthropic API Integration](https://oneuptime.com/blog/post/2026-01-25-anthropic-api-integration/view)

**Google Calendar API:**
- [@googleapis/calendar - npm](https://www.npmjs.com/package/@googleapis/calendar)
- [Node.js quickstart - Google Calendar API](https://developers.google.com/workspace/calendar/api/quickstart/nodejs)
- [googleapis - GitHub](https://github.com/googleapis/google-api-nodejs-client)

**Framework Comparisons:**
- [Comparing Hono, Express, and Fastify - Red Sky Digital](https://redskydigital.com/us/comparing-hono-express-and-fastify-lightweight-frameworks-today/)
- [Fastify vs Express vs Hono - Medium](https://medium.com/@arifdewi/fastify-vs-express-vs-hono-choosing-the-right-node-js-framework-for-your-project-da629adebd4e)
- [Hono vs Fastify - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)

**Cloud Hosting:**
- [Railway vs Render - Northflank](https://northflank.com/blog/railway-vs-render)
- [Railway vs. Fly - Railway Docs](https://docs.railway.com/platform/compare-to-fly)
- [Awesome Web Hosting 2026 - GitHub](https://github.com/iSoumyaDey/Awesome-Web-Hosting-2026)

**Best Practices:**
- [TypeScript Node.js project setup 2026](https://javascript.plainenglish.io/how-to-start-a-node-js-typescript-project-in-2025-bdd3600b356c)
- [Node.js webhook server best practices 2026](https://twimbit.com/about/blogs/building-robust-webhook-services-in-node-js-best-practices-and-techniques)
- [Environment variables secrets management 2026](https://securityboulevard.com/2025/12/are-environment-variables-still-safe-for-secrets-in-2026/)

**Testing & Tooling:**
- [Vitest vs Jest 2026](https://howtotestfrontend.com/resources/vitest-vs-jest-which-to-pick)
- [Pino vs Winston - Better Stack](https://betterstack.com/community/comparisons/pino-vs-winston/)
- [Zod validation 2026](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view)
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/migration-guide)

**Database & State Management:**
- [PostgreSQL vs DynamoDB vs Redis](https://db-engines.com/en/system/Amazon+DynamoDB%3BPostgreSQL%3BRedis)
- [Database for webhook state WhatsApp bot 2026](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions)
- [State Machines for WhatsApp Messaging Bots](https://developer.vonage.com/en/blog/state-machines-for-messaging-bots)

**Security:**
- [Webhook signature verification HMAC 2026](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification)
- [HMAC Signatures in Node.js - Authgear](https://www.authgear.com/post/generate-verify-hmac-signatures)

---

*Stack research for: WhatsApp Calendar Agent*
*Researched: 2026-02-13*
*Mode: Ecosystem Research*
*Researcher: GSD Project Researcher*
