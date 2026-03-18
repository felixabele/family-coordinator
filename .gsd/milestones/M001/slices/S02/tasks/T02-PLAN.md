# T02: 02-calendar-crud 02

**Slice:** S02 — **Milestone:** M001

## Description

Wire Google Calendar operations into the Signal message pipeline: update Claude prompts for German responses, replace Phase 1 stub responses with real calendar CRUD operations, and connect the CalendarClient in the application entry point.

Purpose: This plan transforms the bot from a stub-response demo into a working calendar assistant. After this plan, a family member can send a Signal message like "Was steht morgen an?" and receive real events from Google Calendar.

Output: Fully integrated Signal-to-Calendar pipeline responding in casual German.

## Must-Haves

- [ ] "Bot responds in German with casual du-form tone"
- [ ] "Bot shows events in compact one-line-per-event format"
- [ ] "Bot confirms every calendar mutation with a summary of what changed"
- [ ] "Bot asks for clarification when multiple events match"
- [ ] "Bot asks for time when user provides date but no time for event creation"
- [ ] "Calendar operations are wired end-to-end: Signal message -> Claude -> Google Calendar -> Signal response"
- [ ] "Empty calendar state shows simple German message"

## Files

- `src/llm/prompts.ts`
- `src/llm/types.ts`
- `src/llm/intent.ts`
- `src/signal/listener.ts`
- `src/index.ts`
