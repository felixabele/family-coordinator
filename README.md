# Family Coordinator

A Signal-based calendar agent for family coordination. Message the bot on Signal to view, add, edit, or delete events on a shared Google Calendar — no app switching needed.

## Architecture

```
Signal ← signal-cli (daemon) → Listener → Claude LLM → Signal Response
                                   ↕
                           PostgreSQL (state)
```

- **signal-cli** — Community CLI tool for Signal, run in daemon mode for event-driven message receiving
- **signal-sdk** — TypeScript wrapper around signal-cli's JSON-RPC interface
- **Claude (Anthropic)** — Natural language understanding via tool use for structured intent extraction
- **PostgreSQL** — Conversation state persistence and message deduplication

## Prerequisites

- [Node.js 22+](https://nodejs.org/) (LTS)
- [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL)
- [signal-cli](https://github.com/AsamK/signal-cli) installed and registered with a phone number
- [Anthropic API key](https://console.anthropic.com/settings/keys)

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd family-cordinator
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts **PostgreSQL 16** on port 5432 (database: `family_coordinator`, password: `postgres`).

To check it's running:

```bash
docker compose ps
```

To stop:

```bash
docker compose down
```

To stop and remove data:

```bash
docker compose down -v
```

### 3. Set up signal-cli

Install signal-cli and register a phone number:

```bash
# Install (macOS)
brew install signal-cli

# Register a phone number (requires CAPTCHA)
signal-cli -u +YOUR_NUMBER register

# Verify with the SMS code
signal-cli -u +YOUR_NUMBER verify CODE
```

Start signal-cli in daemon mode (must be running before starting the bot):

```bash
signal-cli -u +YOUR_NUMBER daemon --socket
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Your registered Signal phone number in E.164 format
SIGNAL_PHONE_NUMBER=+12025551234

# Get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Pre-configured for docker compose
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/family_coordinator
```

### 5. Run database migrations

```bash
npm run migrate
```

### 6. Start the bot

```bash
npm run dev
```

The bot connects to signal-cli and starts listening for incoming messages.

## Testing the Bot

### Send a message from your phone

Open the Signal app on your phone and send a text message to the bot's registered phone number (the one in your `.env`). The bot will process it and reply.

### Send a message via signal-cli

From a separate terminal, use another registered number to send a test message:

```bash
signal-cli -u +YOUR_OTHER_NUMBER send -m "What's on today?" +BOT_PHONE_NUMBER
```

### Troubleshooting

- Make sure signal-cli daemon is running before starting the bot
- The bot's phone number must be registered with Signal via signal-cli
- The sender must be a real Signal user (you can't message yourself)
- Check the bot's terminal output for logs — all incoming messages and errors are logged

## Scripts

| Script     | Command           | Description                            |
| ---------- | ----------------- | -------------------------------------- |
| Dev server | `npm run dev`     | Start with hot-reload (tsx watch)      |
| Production | `npm start`       | Start with Node 22 native TS stripping |
| Type check | `npm run build`   | Run TypeScript compiler (no emit)      |
| Migrate    | `npm run migrate` | Apply database migrations              |
| Test       | `npm test`        | Run tests with vitest                  |

## Project Structure

```
src/
  index.ts              # Entry point — connects to Signal, starts listener
  config/
    env.ts              # Zod-validated environment variables
    constants.ts        # App constants (timeouts, limits)
  signal/
    client.ts           # signal-sdk client factory with retry/rate-limit config
    listener.ts         # Message listener — receive → deduplicate → LLM → respond
    sender.ts           # Send messages via Signal
    types.ts            # Signal message TypeScript types
  llm/
    client.ts           # Anthropic SDK client
    intent.ts           # Intent extraction via Claude tool use
    prompts.ts          # System prompt for calendar intent parsing
    types.ts            # CalendarIntent types + Zod schemas
  state/
    conversation.ts     # PostgreSQL conversation state CRUD
    idempotency.ts      # PostgreSQL deduplication for message IDs
    types.ts            # ConversationState type
  db/
    pool.ts             # PostgreSQL connection pool
    migrate.ts          # Migration runner
    migrations/
      001_init.sql      # conversations + message_log tables
      002_idempotency.sql # processed_messages table
  utils/
    logger.ts           # Pino logger (pretty in dev, JSON in prod)
    errors.ts           # Custom error classes
```
