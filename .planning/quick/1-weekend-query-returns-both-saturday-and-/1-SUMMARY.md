# Quick Task 1: Weekend query returns both Saturday and Sunday events

**One-liner:** Weekend queries ("Was machen wir am Wochenende?") now return events for both Saturday and Sunday with day headers.

**Completed:** 2026-02-16
**Commit:** fc04d26

## Changes

- Added `date_end` field to CalendarEntities interface and Zod schema (src/llm/types.ts)
- Added `date_end` property to LLM tool schema (src/llm/intent.ts)
- Added "Wochenende" rules to system prompt: LLM sets date=Saturday, date_end=Sunday (src/llm/prompts.ts)
- Updated query_events handler to iterate date range and format each day with headers (src/signal/listener.ts)

## Output Format

```
Samstag: 10:00 - Fußball | 14:00 - Geburtstag
Sonntag: frei
```
