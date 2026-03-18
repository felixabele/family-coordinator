# T02: 04-advanced-features 03

**Slice:** S04 — **Milestone:** M001

## Description

Wire conflict detection and recurring event handling into the message processing pipeline.

Purpose: Completes Phase 4 by integrating advanced features into the live application — users experience conflict warnings, recurring event creation with confirmation, and recurring event deletion with scope selection.

Output: Fully integrated advanced features — conflict detection before event creation, recurring event CRUD with proper UX flows.

## Must-Haves

- [ ] "Bot detects scheduling conflicts and warns user before creating events"
- [ ] "Conflict warning asks 'Trotzdem erstellen?' and user can confirm or cancel"
- [ ] "All-day events do not trigger conflict warnings"
- [ ] "Recurring event creation shows pattern + next 3 dates in confirmation"
- [ ] "Recurring event deletion asks 'Nur dieses oder alle zukünftigen?'"
- [ ] "Help text includes recurring events and conflict detection features"

## Files

- `src/signal/listener.ts`
- `src/calendar/conflicts.ts`
- `src/config/constants.ts`
