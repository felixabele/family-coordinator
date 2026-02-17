---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/llm/prompts.ts
  - src/llm/intent.ts
  - src/llm/types.ts
  - src/calendar/types.ts
  - src/calendar/timezone.ts
  - src/calendar/operations.ts
  - src/signal/listener.ts
autonomous: true
must_haves:
  truths:
    - "Multi-day events (e.g. 'Urlaub vom 5. bis 10. Marz') are created as all-day events without asking for time"
    - "Single-day events without time still prompt for time as before"
    - "All-day events span the correct date range in Google Calendar"
    - "Confirmation message shows date range instead of time for all-day events"
  artifacts:
    - path: "src/llm/prompts.ts"
      provides: "Updated system prompt with multi-day all-day event rules"
      contains: "all_day"
    - path: "src/calendar/operations.ts"
      provides: "createAllDayEvent function"
      exports: ["createAllDayEvent"]
    - path: "src/calendar/types.ts"
      provides: "CreateAllDayEventInput type"
  key_links:
    - from: "src/llm/prompts.ts"
      to: "src/llm/intent.ts"
      via: "LLM returns all_day: true + date + date_end for multi-day create_event"
      pattern: "all_day"
    - from: "src/signal/listener.ts"
      to: "src/calendar/operations.ts"
      via: "listener detects all_day flag and calls createAllDayEvent"
      pattern: "createAllDayEvent"
---

<objective>
Make multi-day events (e.g. "Urlaub vom 5. bis 10. Marz") default to all-day events instead of prompting for a time.

Purpose: When a user specifies a date range spanning multiple days, the bot should automatically create all-day events without asking "zu welcher Uhrzeit soll ich den Event eintragen".

Output: Updated LLM prompt, intent schema, calendar operations, and listener to handle multi-day all-day event creation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/llm/prompts.ts
@src/llm/intent.ts
@src/llm/types.ts
@src/calendar/types.ts
@src/calendar/timezone.ts
@src/calendar/operations.ts
@src/signal/listener.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add all-day event support to intent schema, types, and calendar operations</name>
  <files>
    src/llm/types.ts
    src/llm/intent.ts
    src/calendar/types.ts
    src/calendar/operations.ts
  </files>
  <action>
    1. In `src/llm/types.ts`:
       - Add `all_day?: boolean` field to `CalendarEntities` interface
       - Add `all_day: z.boolean().optional()` to `CalendarEntitiesSchema`

    2. In `src/llm/intent.ts`:
       - In the `calendarIntentTool` tool definition, add `all_day` to the entities properties:
         ```
         all_day: {
           type: "boolean",
           description: "True for all-day events (no specific time). Set automatically for multi-day date ranges."
         }
         ```
       - Update `date_end` description to remove "Only for query_events" restriction — it should now say:
         "End date in YYYY-MM-DD format for multi-day events or queries (e.g., 'Urlaub vom 5. bis 10. Marz', weekend queries)"

    3. In `src/calendar/types.ts`:
       - Add `CreateAllDayEventInput` interface:
         ```typescript
         export interface CreateAllDayEventInput {
           summary: string;
           startDate: string;  // YYYY-MM-DD (first day)
           endDate: string;    // YYYY-MM-DD (day AFTER last day — Google Calendar convention)
           description?: string;
         }
         ```

    4. In `src/calendar/operations.ts`:
       - Add import for `CreateAllDayEventInput`
       - Add `createAllDayEvent` function that creates an event using Google Calendar's all-day format:
         ```typescript
         export async function createAllDayEvent(
           client: CalendarClient,
           input: CreateAllDayEventInput,
         ): Promise<CalendarEvent> {
         ```
         - Use `{ date: input.startDate }` for start and `{ date: input.endDate }` for end (NOT dateTime — this is how Google Calendar handles all-day events)
         - IMPORTANT: Google Calendar all-day events use exclusive end dates. For an event spanning March 5-10, endDate must be "2026-03-11" (the day AFTER the last day). The caller (listener.ts) will handle this calculation.
         - Follow the same error handling pattern as `createEvent`
         - Log the creation with appropriate fields

  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors.
  </verify>
  <done>
    - `CalendarEntities` has `all_day` field
    - Tool schema includes `all_day` boolean and updated `date_end` for create_event
    - `CreateAllDayEventInput` type exists
    - `createAllDayEvent` function exists and uses `{ date }` format for Google Calendar
  </done>
</task>

<task type="auto">
  <name>Task 2: Update LLM prompt and listener to handle multi-day all-day events</name>
  <files>
    src/llm/prompts.ts
    src/signal/listener.ts
  </files>
  <action>
    1. In `src/llm/prompts.ts`, update the `CALENDAR_SYSTEM_PROMPT`:

       a. Replace the existing "Regeln fur create_event" section with an expanded version:
          ```
          ## Regeln fur create_event

          ### Mehrtägige Events (WICHTIG)

          Wenn ein Benutzer einen Termin uber mehrere Tage erstellt (z.B. "Urlaub vom 5. bis 10. Marz", "Ferien 20. bis 28. Dezember", "Konferenz von Montag bis Mittwoch"):
          - Setze all_day: true
          - Setze date: Startdatum im Format YYYY-MM-DD
          - Setze date_end: Enddatum im Format YYYY-MM-DD (letzter Tag des Events)
          - NICHT nach einer Uhrzeit fragen
          - Confidence normal setzen (0.9+), NICHT auf < 0.7 setzen
          - time NICHT setzen

          Beispiele:
          - "Trag Urlaub vom 5. bis 10. Marz ein" -> intent: create_event, entities: {title: "Urlaub", date: "2026-03-05", date_end: "2026-03-10", all_day: true}, confidence: 0.95
          - "Konferenz nachste Woche Montag bis Mittwoch" -> intent: create_event, entities: {title: "Konferenz", date: "2026-02-23", date_end: "2026-02-25", all_day: true}, confidence: 0.9

          ### Eintägige Events ohne Uhrzeit

          Wenn keine Uhrzeit fur einen EINZELNEN Tag angegeben ist:
          - Setze confidence < 0.7
          - Frage in clarification_needed nach der Uhrzeit in deutscher du-form
          - Beispiel: "Zu welcher Uhrzeit soll ich das eintragen?"
          ```

       b. Add an example (Example 9) for multi-day all-day event:
          ```
          **Beispiel 9: Mehrtägiger Ganztags-Event**
          Benutzer: "Trag Urlaub vom 5. bis 10. Marz ein"
          Intent: create_event
          Entities: { title: "Urlaub", date: "2026-03-05", date_end: "2026-03-10", all_day: true }
          Confidence: 0.95
          ```

    2. In `src/signal/listener.ts`, update the `create_event` case in `handleIntent`:

       a. Add import for `createAllDayEvent` and `CreateAllDayEventInput` at the top

       b. BEFORE the existing `if (!intent.entities.time)` check, add a new block to handle all-day multi-day events:
          ```typescript
          // Handle all-day / multi-day events
          if (intent.entities.all_day && intent.entities.date && intent.entities.date_end) {
            const title = intent.entities.title || "Termin";
            const startDate = intent.entities.date;
            const endDateRaw = intent.entities.date_end;

            // Google Calendar exclusive end date: add 1 day to the user's end date
            const endDateExclusive = DateTime.fromISO(endDateRaw, { zone: tz })
              .plus({ days: 1 })
              .toFormat("yyyy-MM-dd");

            const allDayInput: CreateAllDayEventInput = {
              summary: title,
              startDate,
              endDate: endDateExclusive,
            };

            const createdEvent = await createAllDayEvent(deps.calendarClient, allDayInput);

            // Format confirmation with date range
            const startFormatted = DateTime.fromISO(startDate, { zone: tz })
              .setLocale("de")
              .toFormat("d. MMM");
            const endFormatted = DateTime.fromISO(endDateRaw, { zone: tz })
              .setLocale("de")
              .toFormat("d. MMM");

            return `Klar, hab ich eingetragen! ${title}, ${startFormatted} bis ${endFormatted} (ganztägig)`;
          }
          ```

       c. The existing `if (!intent.entities.time)` check remains for single-day events without time — this preserves backward compatibility.

  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Then run `npm test` if tests exist.
  </verify>
  <done>
    - LLM prompt instructs Claude to set all_day: true + date + date_end for multi-day events without asking for time
    - Single-day events without time still trigger the clarification question
    - Listener detects all_day flag and creates all-day events via createAllDayEvent
    - Confirmation message shows date range with "(ganztägig)" suffix
    - The existing single-day-without-time clarification flow is preserved
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no type errors
2. `npm run format` passes (prettier/husky compliance)
3. Manual test: Send "Trag Urlaub vom 5. bis 10. Marz ein" to the bot — should create all-day event without asking for time
4. Manual test: Send "Trag Zahnarzt morgen ein" — should still ask "Zu welcher Uhrzeit soll ich das eintragen?"
</verification>

<success_criteria>

- Multi-day date range events create all-day Google Calendar events without time prompt
- Single-day events without time continue to prompt for time
- Google Calendar shows the event spanning the correct date range as all-day
- Confirmation message shows readable date range with "(ganztägig)" label
  </success_criteria>

<output>
After completion, create `.planning/quick/4-multi-day-events-should-default-to-all-d/4-SUMMARY.md`
</output>
