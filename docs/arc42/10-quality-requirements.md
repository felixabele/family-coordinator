# 10. Quality Requirements

## 10.1 Quality Tree

```
Quality
├── Reliability
│   ├── Individual message failures must not crash the daemon
│   ├── Process auto-restarts on crash (PM2, max 10 restarts)
│   └── Duplicate messages are deduplicated via idempotency store
├── Usability
│   ├── Natural language input in German (no special syntax)
│   ├── Casual du-form responses matching family communication style
│   └── Help and cancel commands available without LLM
├── Correctness
│   ├── Timezone-aware date/time handling (Europe/Berlin via Luxon)
│   ├── Conflict detection before event creation
│   └── Zod validation at all system boundaries
├── Performance
│   ├── Prompt caching reduces LLM cost by ~90% on cache hits
│   └── Signal rate limiting (200ms interval) prevents API abuse
├── Security
│   ├── Whitelist-only access (phone number + UUID)
│   ├── End-to-end encryption via Signal protocol
│   └── Secrets never logged (phone numbers masked)
└── Maintainability
    ├── TypeScript strict mode with full type coverage
    ├── Structured logging for production debugging
    └── Automated deployment via GitHub Actions
```

## 10.2 Quality Scenarios

| ID    | Quality         | Scenario                                         | Expected Response                                                  |
| ----- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| QS-1  | Reliability     | Claude API is temporarily unavailable            | Error caught, user receives German error message, daemon continues |
| QS-2  | Reliability     | Signal delivers the same message twice           | Second message detected by idempotency store and silently skipped  |
| QS-3  | Reliability     | Process crashes unexpectedly                     | PM2 auto-restarts within 5 seconds; health check verifies recovery |
| QS-4  | Usability       | User sends "Zahnarzt morgen um 10"               | Bot creates event for tomorrow at 10:00 and confirms in German     |
| QS-5  | Usability       | User sends ambiguous message without time        | Bot asks for clarification in German du-form                       |
| QS-6  | Correctness     | User creates event overlapping with existing one | Bot warns about conflict, asks for confirmation before creating    |
| QS-7  | Correctness     | User says "naechsten Montag" on a Monday         | Date resolves to next week's Monday, not today                     |
| QS-8  | Security        | Unknown phone number sends message               | Rejection message sent (max once per 5 min), message not processed |
| QS-9  | Performance     | Multiple family members message simultaneously   | Up to 5 messages processed concurrently (SIGNAL_MAX_CONCURRENT)    |
| QS-10 | Maintainability | New environment variable needed                  | Add to Zod schema in `src/config/env.ts`; startup fails if missing |
