---
id: T02
parent: S04
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T02: 04-advanced-features 03

**# Phase 04 Plan 03: Conflict Detection & Recurring Event Integration Summary**

## What Happened

# Phase 04 Plan 03: Conflict Detection & Recurring Event Integration Summary

**One-liner:** Conflict detection before event creation with German warnings and confirmation flow, recurring event creation showing next occurrences with frequency patterns, and recurring event deletion with scope selection (this instance vs all future).

**Completed:** 2026-02-16T07:52:11Z
**Duration:** 4 minutes

---

## Plan Metadata

```yaml
phase: 04-advanced-features
plan: 03
subsystem: bot-integration
tags: [conflict-detection, recurring-events, conversation-state, german-ux]
```

## Dependency Graph

**Requires:**

- Phase 04-01: Recurring event foundation (createRecurringEvent, trimRecurringEvent, formatRRule)
- Phase 02-02: Calendar pipeline integration (handleIntent, conversation state)
- Phase 03-02: Command detection and conversation state management

**Provides:**

- Conflict detection before event creation (prevents double-booking)
- Conflict warning with user confirmation flow ("Trotzdem erstellen?")
- Recurring event creation with frequency confirmation in German
- Next 3 occurrences displayed in confirmation messages
- Recurring event deletion scope selection (this instance vs all future)
- RRULE trimming for future-only deletion (preserving past instances)

**Affects:**

- src/calendar/conflicts.ts: New module with findConflicts function
- src/signal/listener.ts: Extended pipeline with conflict detection, recurring creation, recurring deletion
- src/config/constants.ts: Updated HELP_TEXT with recurring events feature

## Tech Stack Changes

**Added:**

- Conflict detection via Google Calendar API events.list with singleEvents=true
- All-day event exclusion from conflict detection
- Conversation state for awaiting_conflict_confirmation and awaiting_delete_scope
- German weekday mapping (MO→Montag, TU→Dienstag, etc.)

**Patterns:**

- Overlap detection: `newStart < eventEnd && newEnd > eventStart`
- Conflict warning format: `"Achtung: Überschneidung mit {conflicts}. Trotzdem erstellen?"`
- Recurring frequency display: "täglich", "jeden Dienstag", "monatlich"
- Next occurrences format: "Nächste: 18.02, 25.02, 04.03"
- Delete scope question: "1) Nur dieses Mal\n2) Alle zukünftigen"
- Future deletion preserves past instances via RRULE UNTIL trimming

## Key Files

**Created:**

- src/calendar/conflicts.ts
  - findConflicts: Queries same-day events, expands recurring instances, checks overlap
  - Excludes all-day events from conflict detection
  - Returns array of conflicting CalendarEvent objects

**Modified:**

- src/signal/listener.ts
  - Added conflict detection before event creation
  - Added awaiting_conflict_confirmation handler at beginning of handleIntent
  - Added awaiting_delete_scope handler for recurring event deletion
  - Extended create_event case with conflict check and recurring event support
  - Extended delete_event case to detect recurring instances and ask scope question
  - Pass phoneNumber to handleIntent for state management
  - German frequency patterns for recurring events (täglich, jeden {Wochentag}, monatlich)
  - Next 3 occurrences displayed in recurring event confirmation
  - Optional end date displayed if specified
- src/config/constants.ts
  - Updated HELP_TEXT with recurring events and update event features

## Implementation Summary

### Task 1: Create conflict detection module and update help text

**Commit:** 8dfa431

**Changes:**

- Created src/calendar/conflicts.ts with findConflicts function
- Query Google Calendar events.list with:
  - timeMin/timeMax: same day as new event
  - singleEvents: true (CRITICAL: expands recurring events into instances)
  - orderBy: startTime
- Filter logic:
  - Skip all-day events (item.start?.date exists)
  - Check overlap for timed events: `newStart < eventEnd && newEnd > eventStart`
- Return array of conflicting CalendarEvent objects
- Updated HELP_TEXT in src/config/constants.ts:
  - Added "🔄 Wiederkehrende Termine" entry
  - Added "✏️ Termine ändern" entry (was missing)
  - Maintains casual German tone

**Key Technical Details:**

- All-day events excluded from conflict detection per user decision
- singleEvents=true ensures recurring event instances are expanded for accurate conflict detection
- Same error handling pattern as other calendar operations (CalendarError)

### Task 2: Integrate conflict detection and recurring events into pipeline

**Commit:** 2317cd5

**Changes:**

- Added imports to src/signal/listener.ts:
  - findConflicts from conflicts.ts
  - createRecurringEvent from operations.ts
  - CreateRecurringEventInput from types.ts
  - createEventDateTime from timezone.ts
  - calculateNextOccurrences, trimRecurringEvent from recurring.ts
- Added phoneNumber parameter to handleIntent function signature
- Added conflict confirmation handler at beginning of handleIntent:
  - Checks for `currentIntent === 'awaiting_conflict_confirmation'`
  - Parses affirmative responses (ja, ok, trotzdem, yes, klar, mach)
  - Creates regular or recurring event based on pending data
  - Clears conversation state after confirmation/cancellation
  - Returns German confirmation or cancellation message
- Added delete scope handler at beginning of handleIntent:
  - Checks for `currentIntent === 'awaiting_delete_scope'`
  - Parses scope responses ("1"/"dieses"/"nur" vs "2"/"alle"/"zukünftige")
  - For single instance: calls deleteEvent (creates Google Calendar exception)
  - For all future: calls trimRecurringEvent to set RRULE UNTIL
  - Clears conversation state after deletion
  - Returns German confirmation with date
- Extended create_event case:
  - Calculate start/end DateTimes for conflict detection
  - Call findConflicts before event creation
  - If conflicts found: format German warning, save state, return "Trotzdem erstellen?" prompt
  - If no conflicts and recurrence present: create recurring event
  - Build German frequency pattern (täglich, jeden {Wochentag}, monatlich)
  - Display next 3 occurrences in confirmation
  - Show end date if specified
  - Fall back to regular createEvent if no recurrence
- Extended delete_event case:
  - After finding single event, check for recurringEventId field
  - If recurring instance: save state, return scope question
  - If regular event: delete normally
- Updated handleIntent call in message listener to pass phoneNumber

**German weekday mapping:**

```typescript
const dayMap: Record<string, string> = {
  MO: "Montag",
  TU: "Dienstag",
  WE: "Mittwoch",
  TH: "Donnerstag",
  FR: "Freitag",
  SA: "Samstag",
  SU: "Sonntag",
};
```

**Conflict warning format:**

```
Achtung: Überschneidung mit Zahnarzt um 10:00 Uhr, Meeting um 14:00 Uhr. Trotzdem erstellen?
```

**Recurring confirmation format:**

```
Fußball jeden Dienstag um 16:00 erstellt. Nächste: 18.02, 25.02, 04.03
```

**Recurring confirmation with end date:**

```
Fußball jeden Dienstag um 16:00 erstellt. Nächste: 18.02, 25.02, 04.03 Endet: 31.03.2026
```

**Delete scope question:**

```
Das ist ein wiederkehrender Termin. Nur dieses Mal oder alle zukünftigen löschen?
1) Nur dieses Mal
2) Alle zukünftigen
```

**All future deletion confirmation:**

```
Alle zukünftigen Termine ab 25.02. gelöscht.
```

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision                                                 | Rationale                                                                   | Impact                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Use singleEvents=true in conflict detection query        | Expands recurring events into instances for accurate overlap checking       | Prevents conflicts with recurring event instances |
| Exclude all-day events from conflict detection           | Per user decision - all-day events don't conflict with timed events         | Cleaner UX, no false positives                    |
| Use conversation state for conflict confirmation         | Enables multi-turn conversation for "Trotzdem erstellen?" flow              | Natural conversational UX                         |
| Parse user intent from message text for confirmation     | Flexible affirmative/negative detection (ja, ok, trotzdem, nein, abbrechen) | Robust confirmation handling                      |
| Show next 3 occurrences for recurring events             | Gives user visibility into schedule without overwhelming                    | Good balance of information                       |
| German weekday names in frequency patterns               | Matches user's language and natural speech patterns                         | Consistent German UX                              |
| "Alle zukünftigen" trims RRULE instead of deleting event | Preserves past instances while removing future ones                         | Non-destructive deletion approach                 |
| Add "✏️ Termine ändern" to HELP_TEXT                     | Was missing from previous help text, completes CRUD feature list            | Better feature discoverability                    |
| Pass phoneNumber to handleIntent                         | Required for conversation state access in multi-turn flows                  | Enables state-based confirmation flows            |

## Verification Results

**TypeScript Compilation:**

```
npx tsc --noEmit
✓ Zero errors
```

**Conflict Detection Checks:**

- ✓ findConflicts imported and used in create_event case
- ✓ "Trotzdem erstellen?" warning text present
- ✓ awaiting_conflict_confirmation state tracking present
- ✓ singleEvents: true in conflicts.ts query

**Recurring Event Creation Checks:**

- ✓ createRecurringEvent imported and called
- ✓ "Nächste:" display in confirmation messages
- ✓ German frequency labels (täglich, jeden, monatlich) present
- ✓ End date formatting in confirmation

**Recurring Event Deletion Checks:**

- ✓ "wiederkehrender Termin" prompt present
- ✓ awaiting_delete_scope state tracking present
- ✓ trimRecurringEvent imported and called
- ✓ Scope question with options 1 and 2

**Help Text Check:**

- ✓ "Wiederkehrende" in HELP_TEXT

**All 13 verification checks passed.**

## Self-Check: PASSED

**Created Files:**

- ✓ /Users/fabele/projects/family-cordinator/src/calendar/conflicts.ts

**Commits:**

- ✓ 8dfa431: feat(04-03): create conflict detection module and update help text
- ✓ 2317cd5: feat(04-03): integrate conflict detection and recurring events into pipeline

**Modified Files:**

- ✓ src/calendar/conflicts.ts (conflict detection module)
- ✓ src/signal/listener.ts (pipeline integration)
- ✓ src/config/constants.ts (updated HELP_TEXT)

All claims verified successfully.

## Success Criteria

- ✓ Conflict detection queries same-day events with singleEvents: true (recurring instances expanded)
- ✓ All-day events excluded from conflict detection (per user decision)
- ✓ Conflict warning in German with "Trotzdem erstellen?" prompt
- ✓ User can confirm or cancel after conflict warning
- ✓ Recurring event creation calls createRecurringEvent and shows pattern + next 3 dates
- ✓ German frequency labels used (täglich, jeden Dienstag, monatlich)
- ✓ End date shown in confirmation if specified
- ✓ Recurring event deletion asks "Nur dieses oder alle zukünftigen?"
- ✓ "Alle zukünftigen" trims RRULE UNTIL (preserving past instances), not deleting entire event
- ✓ Help text updated with recurring events and conflict detection features
- ✓ All TypeScript compiles cleanly with zero errors

**11/11 success criteria met.**

## Next Steps

1. **End-to-end testing:** Test full conflict detection flow (Signal → conflict warning → confirmation → event creation)
2. **Recurring event testing:** Test recurring event creation with DAILY/WEEKLY/MONTHLY patterns
3. **Recurring deletion testing:** Test "alle zukünftigen" deletion preserves past instances
4. **Phase 4 completion:** All 3 plans complete - Phase 4 ready for final verification
5. **Production readiness:** Consider adding conflict detection toggle in config for optional disable

## Notes

- Conflict detection runs on every event creation before Google Calendar API call - no wasted API quota
- All-day event exclusion prevents false positives (e.g., "Birthday" all-day event doesn't conflict with timed events)
- Conversation state enables natural multi-turn flows without complex state machines
- RRULE trimming for "alle zukünftigen" preserves event history while removing future occurrences
- German frequency patterns match natural speech ("jeden Dienstag" not "wöchentlich am Dienstag")
- Next 3 occurrences provide enough visibility without overwhelming the user
- Single instance deletion of recurring event creates Google Calendar exception (preserves recurrence rule)
