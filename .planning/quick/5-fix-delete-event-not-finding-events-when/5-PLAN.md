---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - src/calendar/operations.ts
  - src/signal/listener.ts
autonomous: true
must_haves:
  truths:
    - "Delete event without a date finds events in the next 30 days"
    - "Update event without a date finds events in the next 30 days"
    - "Delete/update with an explicit date still searches only that day"
  artifacts:
    - path: "src/calendar/operations.ts"
      provides: "findEvents with optional dateEnd parameter"
      contains: "dateEnd"
    - path: "src/signal/listener.ts"
      provides: "30-day search range for delete_event and update_event when no date"
      contains: "plus.*days.*30"
  key_links:
    - from: "src/signal/listener.ts"
      to: "src/calendar/operations.ts"
      via: "findEvents call with dateEnd"
      pattern: "findEvents.*dateEnd"
---

<objective>
Fix delete_event and update_event handlers so they search the next 30 days when no date is specified, instead of only searching today.

Purpose: When a user says "Loesche Zahnarzt" without mentioning a date, the bot should find the event even if it is on a future date within 30 days.
Output: Updated findEvents function and both handlers in listener.ts.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/calendar/operations.ts (findEvents function — lines 100-189)
@src/calendar/types.ts (EventSearchResult type)
@src/signal/listener.ts (delete_event handler ~line 571, update_event handler ~line 496)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dateEnd parameter to findEvents</name>
  <files>src/calendar/operations.ts</files>
  <action>
    Add an optional `dateEnd?: string` parameter (YYYY-MM-DD format) to the `findEvents` function signature, after `titleHint`.

    When `dateEnd` is provided:
    - Parse it with `DateTime.fromFormat(dateEnd, "yyyy-MM-dd", { zone: client.timezone }).endOf("day")` and use it as `timeMax`.
    - Keep `timeMin` as start-of-day of the existing `date` parameter.

    When `dateEnd` is NOT provided:
    - Behavior stays exactly as-is (search single day only). This preserves backward compatibility for any other callers.

    Update the logger.info calls in findEvents to include `dateEnd` when present.

  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors.</verify>
  <done>findEvents accepts an optional dateEnd parameter and uses it as timeMax when provided, otherwise defaults to end-of-day of the date parameter.</done>
</task>

<task type="auto">
  <name>Task 2: Pass 30-day range in delete_event and update_event handlers</name>
  <files>src/signal/listener.ts</files>
  <action>
    In BOTH the `delete_event` handler (around line 571-592) and `update_event` handler (around line 496-517):

    1. Keep the existing `searchDate` logic as-is (defaults to today when no date provided).

    2. After `searchDate` is determined, compute a `searchDateEnd` variable:
       - If `intent.entities.date` is provided (user specified a date): set `searchDateEnd` to `undefined` (single-day search, current behavior).
       - If `intent.entities.date` is NOT provided (no date specified): set `searchDateEnd` to `DateTime.now().setZone(tz).plus({ days: 30 }).toFormat("yyyy-MM-dd")`.

    3. Pass `searchDateEnd` as the fourth argument to `findEvents()`:
       ```typescript
       const searchResult = await findEvents(
         deps.calendarClient,
         searchDate,
         searchQuery,
         searchDateEnd,
       );
       ```

    This means:
    - "Loesche Zahnarzt" (no date) searches today through today+30 days
    - "Loesche Zahnarzt am Freitag" (with date) searches only that Friday (unchanged behavior)

  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors. Run `npm test` to confirm all existing tests pass.</verify>
  <done>Both delete_event and update_event handlers pass a 30-day dateEnd to findEvents when no date is specified by the user. Explicit date requests still search single-day only.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm test` passes all existing tests
3. Manual review: confirm findEvents signature has `dateEnd?: string` as fourth param
4. Manual review: confirm both handlers compute `searchDateEnd` conditionally
</verification>

<success_criteria>

- findEvents supports optional dateEnd parameter for range searches
- delete_event without a date searches next 30 days
- update_event without a date searches next 30 days
- Explicit date requests are unaffected (single-day search)
- TypeScript compiles cleanly, all tests pass
  </success_criteria>

<output>
After completion, create `.planning/quick/5-fix-delete-event-not-finding-events-when/5-SUMMARY.md`
</output>
