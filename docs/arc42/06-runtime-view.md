# 6. Runtime View

## 6.1 Message Processing Pipeline (Primary Flow)

The main runtime scenario: a family member sends a message, the bot extracts intent, performs a calendar operation, and responds.

```mermaid
sequenceDiagram
    participant FM as Family Member
    participant Signal as Signal Servers
    participant SL as Signal Listener
    participant WL as Family Whitelist
    participant ID as Idempotency Store
    participant CS as Conversation Store
    participant LLM as Claude LLM
    participant CAL as Calendar Operations
    participant GC as Google Calendar API

    FM->>Signal: Send text message
    Signal->>SL: Message event (envelope)
    SL->>SL: Filter sync/non-data messages
    SL->>WL: isAllowed(phoneNumber)
    WL-->>SL: true

    SL->>ID: isProcessed(messageId)
    ID-->>SL: false
    SL->>ID: markProcessed(messageId)

    SL->>SL: detectCommand(text)
    Note over SL: Not a command, proceed to LLM

    SL->>CS: getState(phoneNumber)
    CS-->>SL: conversation history
    SL->>CS: addToHistory(phoneNumber, "user", text)

    SL->>LLM: extractIntent(text, history, timezone)
    LLM->>LLM: Build messages with date context
    LLM-->>SL: CalendarIntent {intent, entities, confidence}

    SL->>CAL: handleIntent(intent)
    CAL->>GC: Calendar API call
    GC-->>CAL: Event data
    CAL-->>SL: Response text (German)

    SL->>Signal: sendMessage(response)
    Signal->>FM: Deliver response
    SL->>CS: addToHistory(phoneNumber, "assistant", response)
```

## 6.2 Conflict Detection and Confirmation Flow

When creating an event that overlaps with existing events, the bot asks for confirmation before proceeding.

```mermaid
sequenceDiagram
    participant FM as Family Member
    participant SL as Signal Listener
    participant LLM as Claude LLM
    participant CF as Conflict Detector
    participant CS as Conversation Store
    participant GC as Google Calendar API

    FM->>SL: "Zahnarzt Montag um 10 Uhr"
    SL->>LLM: extractIntent(message)
    LLM-->>SL: {intent: "create_event", entities: {title, date, time}}

    SL->>CF: findConflicts(start, end)
    CF->>GC: list events for day
    GC-->>CF: existing events
    CF-->>SL: [conflicting event]

    SL->>CS: saveState(awaiting_conflict_confirmation, pendingEvent)
    SL->>FM: "Achtung: Ueberschneidung mit Meeting um 10:00. Trotzdem erstellen?"

    FM->>SL: "Ja"
    SL->>CS: getState(phoneNumber)
    CS-->>SL: {currentIntent: "awaiting_conflict_confirmation", pendingEntities}

    SL->>GC: createEvent(pendingEvent)
    GC-->>SL: created event
    SL->>CS: clearState(phoneNumber)
    SL->>FM: "Klar, hab ich eingetragen! Zahnarzt, Montag 10:00-11:00"
```

## 6.3 Recurring Event Delete Scope Flow

When deleting a recurring event instance, the bot asks whether to delete just that instance or all future instances.

```mermaid
sequenceDiagram
    participant FM as Family Member
    participant SL as Signal Listener
    participant CS as Conversation Store
    participant GC as Google Calendar API

    FM->>SL: "Loesch das Fussball"
    SL->>GC: findEvents(date, "Fussball")
    GC-->>SL: event with recurringEventId

    SL->>CS: saveState(awaiting_delete_scope, {eventId, recurringEventId})
    SL->>FM: "Das ist ein wiederkehrender Termin. 1) Nur dieses Mal 2) Alle zukuenftigen"

    FM->>SL: "2"
    SL->>CS: getState(phoneNumber)
    CS-->>SL: {currentIntent: "awaiting_delete_scope"}

    SL->>GC: trimRecurringEvent(recurringEventId, beforeDate)
    Note over GC: Modifies RRULE UNTIL to end series
    SL->>CS: clearState(phoneNumber)
    SL->>FM: "Alle zukuenftigen Termine ab 17.02. geloescht."
```

## 6.4 Startup and Shutdown

**Startup sequence** (in `src/index.ts`):

1. Validate environment variables via Zod schema (`src/config/env.ts`)
2. Load and validate family member whitelist from `family-members.json`
3. Create service instances: Signal client, Anthropic client, Calendar client, ConversationStore, IdempotencyStore
4. Run idempotency cleanup (delete records older than 7 days)
5. Connect to Signal via signal-cli subprocess
6. Register message event listener with all dependencies
7. Start HTTP health check server on port 3000

**Graceful shutdown** (SIGTERM/SIGINT handlers):

1. Stop health check HTTP server
2. Gracefully shut down Signal client (stops signal-cli)
3. Close PostgreSQL connection pool
4. Exit process with code 0 (or 1 on error)
