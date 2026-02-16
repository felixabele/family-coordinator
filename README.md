# Family Coordinator

A Signal-based calendar agent for family coordination. Message the bot on Signal to view, add, edit, or delete events on a shared Google Calendar — no app switching needed.

## Architecture

```
Signal ← signal-cli (daemon) → Listener → Claude LLM → Signal Response
                                   ↕              ↕
                           PostgreSQL (state)  Google Calendar
```

- **signal-cli** — Community CLI tool for Signal, run in daemon mode for event-driven message receiving
- **signal-sdk** — TypeScript wrapper around signal-cli's JSON-RPC interface
- **Claude (Anthropic)** — Natural language understanding via tool use for structured intent extraction
- **Google Calendar** — Shared family calendar via service account with full CRUD operations
- **PostgreSQL** — Conversation state persistence and message deduplication

## Prerequisites

- [Node.js 22+](https://nodejs.org/) (LTS)
- [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL)
- [signal-cli](https://github.com/AsamK/signal-cli) installed and registered with a phone number
- [Anthropic API key](https://console.anthropic.com/settings/keys)
- Google Cloud service account with Calendar API enabled

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

This starts **PostgreSQL 16** on port 5433 (database: `family_coordinator`, password: `postgres`).

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

### 4. Set up Google Calendar

1. Create a Google Cloud project and enable the Google Calendar API
2. Create a service account and download the JSON key file
3. Create a shared Google Calendar and share it with the service account email (grant "Make changes to events" permission)
4. Save the key file as `service-account-key.json` in the project root

### 5. Configure family members

```bash
cp family-members.example.json family-members.json
```

Edit `family-members.json` with your family's phone numbers (E.164 format):

```json
{
  "members": [
    { "phone": "+491234567890", "name": "Papa" },
    { "phone": "+490987654321", "name": "Mama" }
  ]
}
```

Only listed phone numbers can interact with the bot. Unknown senders receive a polite rejection.

### 6. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Your registered Signal phone number in E.164 format
SIGNAL_PHONE_NUMBER=+12025551234

# Get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Path to Google service account key file
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account-key.json

# Calendar ID (find in Calendar Settings -> Calendar ID)
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Family timezone (IANA format)
FAMILY_TIMEZONE=Europe/Berlin

# Pre-configured for docker compose
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/family_coordinator
```

### 7. Run database migrations

```bash
npm run migrate
```

### 8. Start the bot

```bash
npm run dev
```

The bot connects to signal-cli, validates the family whitelist, and starts listening for incoming messages.

## Usage

The bot responds in German with a casual "du" tone. Only whitelisted family members can interact.

**Calendar operations:**

- "Was steht heute an?" — View today's events
- "Termine diese Woche" — View this week's events
- "Zahnarzt am Montag um 10 Uhr" — Create an event
- "Verschiebe den Zahnarzt auf Dienstag" — Edit an event
- "Lösche den Zahnarzt-Termin" — Delete an event

**Commands (bypass LLM, instant response):**

- "hilfe" / "help" / "?" — Show capabilities and reset conversation
- "abbrechen" / "cancel" / "reset" — Clear conversation state

The bot works in both 1:1 and group chats. Greetings are personalized with the family member's name.

## Testing the Bot

### Send a message from your phone

Open the Signal app on your phone and send a text message to the bot's registered phone number (the one in your `.env`). Your phone number must be in `family-members.json`.

### Send a message via signal-cli

From a separate terminal, use another registered number to send a test message:

```bash
signal-cli -u +YOUR_OTHER_NUMBER send -m "Was steht heute an?" +BOT_PHONE_NUMBER
```

### Troubleshooting

- Make sure signal-cli daemon is running before starting the bot
- The bot's phone number must be registered with Signal via signal-cli
- The sender's phone number must be in `family-members.json`
- The sender must be a real Signal user (you can't message yourself)
- Check the bot's terminal output for logs — all incoming messages and errors are logged

## Scripts

| Script     | Command           | Description                            |
| ---------- | ----------------- | -------------------------------------- |
| Dev server | `npm run dev`     | Start with hot-reload (tsx watch)      |
| Production | `npm start`       | Start with Node 22 native TS stripping |
| Type check | `npm run build`   | Run TypeScript compiler (no emit)      |
| Migrate    | `npm run migrate` | Apply database migrations              |
| Format     | `npm run format`  | Format code with Prettier              |
| Test       | `npm test`        | Run tests with vitest                  |

## Project Structure

```
src/
  index.ts              # Entry point — loads config, connects Signal, starts listener
  config/
    env.ts              # Zod-validated environment variables
    constants.ts        # App constants (timeouts, limits, help text)
    family-members.ts   # Family whitelist config with Zod + libphonenumber-js
  signal/
    client.ts           # signal-sdk client factory with retry/rate-limit config
    listener.ts         # Message pipeline — access control → commands → LLM → respond
    sender.ts           # Send messages via Signal
    types.ts            # Signal message TypeScript types
  calendar/
    client.ts           # Google Calendar API client (googleapis)
    operations.ts       # Calendar CRUD operations (list, create, update, delete)
    timezone.ts         # Timezone utilities for DST-safe date handling
    types.ts            # Calendar event TypeScript types
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
family-members.example.json  # Example family member config
```
