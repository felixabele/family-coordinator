# 3. Context and Scope

## 3.1 Business Context

Family members interact with the bot through Signal messenger. The bot understands German natural language, extracts calendar intent via Claude LLM, and performs CRUD operations on a shared Google Calendar.

```mermaid
graph LR
    FM[Family Members] -->|"Signal message (German)"| FC[Family Coordinator Bot]
    FC -->|"Response (German)"| FM
    FC -->|"CRUD operations"| GC[Google Calendar]
    GC -->|"Event data"| FC
    FC -->|"Intent extraction"| Claude[Claude LLM]
    Claude -->|"Structured intent"| FC
```

| Communication Partner | Input                                | Output                                         |
| --------------------- | ------------------------------------ | ---------------------------------------------- |
| Family members        | Natural language messages via Signal | Calendar confirmations/queries in German       |
| Google Calendar       | Event CRUD requests via API          | Event data, conflict information               |
| Claude LLM            | User message + conversation history  | Structured intent with entities and confidence |

## 3.2 Technical Context

```mermaid
graph LR
    subgraph "VPS (Production)"
        subgraph "Family Coordinator Process"
            SL[Signal Listener]
            LLM[LLM Client]
            CAL[Calendar Client]
            DB_C[DB Pool]
        end
        PG[(PostgreSQL)]
    end

    SC[signal-cli subprocess] <-->|"JSON-RPC"| SL
    SC <-->|"Signal Protocol"| Signal[Signal Servers]
    LLM -->|"HTTPS REST"| Anthropic[Anthropic API]
    CAL -->|"HTTPS REST"| Google[Google Calendar API]
    DB_C -->|"TCP :5432"| PG
    Signal <-->|"E2E Encrypted"| Phone[Signal Mobile App]
```

| Channel          | Protocol                                                | Format                                        |
| ---------------- | ------------------------------------------------------- | --------------------------------------------- |
| Signal messaging | Signal Protocol (E2E encrypted) via signal-cli JSON-RPC | Text messages                                 |
| Anthropic API    | HTTPS REST                                              | JSON (tool use with structured output)        |
| Google Calendar  | HTTPS REST                                              | JSON (Google Calendar API v3)                 |
| PostgreSQL       | TCP                                                     | pg wire protocol (connection pooling, max 10) |
| Health check     | HTTP                                                    | JSON on port 3000 (`GET /health`)             |
