---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/llm/prompts.ts
autonomous: true
must_haves:
  truths:
    - "Query 'nächstes Wochenende' returns Saturday+Sunday, never Sunday+Monday"
    - "Query 'dieses Wochenende' returns the coming Saturday+Sunday"
    - "Weekend is always defined as Samstag+Sonntag in the prompt"
  artifacts:
    - path: "src/llm/prompts.ts"
      provides: "Clear weekend resolution rules in LLM prompt"
      contains: "Samstag und Sonntag"
  key_links:
    - from: "src/llm/prompts.ts"
      to: "LLM response"
      via: "prompt instructions"
      pattern: "Wochenende.*Samstag.*Sonntag"
---

<objective>
Fix the weekend query bug where "nächstes Wochenende" returns Sunday+Monday instead of Saturday+Sunday.

Purpose: The LLM prompt's weekend section (lines 82-90) uses vague language ("Samstag in 7+ Tagen") that confuses the LLM into picking wrong days. Replace with explicit, unambiguous rules.
Output: Updated prompt in src/llm/prompts.ts with clear weekend calculation logic.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/llm/prompts.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite weekend resolution rules in LLM prompt</name>
  <files>src/llm/prompts.ts</files>
  <action>
Replace the "### Wochenende (WICHTIG)" section (lines 82-90) in the CALENDAR_SYSTEM_PROMPT with clearer, unambiguous rules. The new section must:

1. Start with a hard definition: Wochenende = Samstag und Sonntag. NIEMALS andere Tage.

2. Replace the three bullet points with explicit calculation rules:
   - "dieses Wochenende" / "am Wochenende":
     - Wenn heute Mo-Fr: date = der KOMMENDE Samstag dieser Woche, date_end = der Sonntag direkt danach
     - Wenn heute Samstag: date = heute, date_end = morgen (Sonntag)
     - Wenn heute Sonntag: date = heute, date_end = heute (nur Sonntag noch übrig)

   - "nächstes Wochenende":
     - Wenn heute Mo-Fr: date = Samstag der ÜBERNÄCHSTEN Woche (d.h. nicht der kommende Samstag, sondern der danach), date_end = der Sonntag direkt danach
     - Wenn heute Samstag oder Sonntag: date = Samstag der NÄCHSTEN Woche, date_end = der Sonntag direkt danach

3. Keep the existing rule: "NIEMALS nur einen einzelnen Tag für 'Wochenende' zurückgeben. date_end ist NUR für query_events (Abfragen), nicht für create_event."

4. Add an explicit constraint: "WICHTIG: Wochenende ist IMMER Samstag + Sonntag. Gib NIEMALS Montag, Dienstag oder einen anderen Wochentag als Teil des Wochenendes zurück."

Keep the section header and structure consistent with the rest of the prompt. Write all rules in German to match the surrounding prompt language.
</action>
<verify>
Read src/llm/prompts.ts and confirm:

- The Wochenende section contains "Samstag und Sonntag" as explicit definition
- "nächstes Wochenende" rules clearly distinguish Mo-Fr vs Sa/So cases
- No reference to "7+ Tagen" remains
- The "NIEMALS" constraint about other weekdays is present
- File passes prettier: `npx prettier --check src/llm/prompts.ts`
  </verify>
  <done>
  The Wochenende section in the LLM prompt contains unambiguous rules that will cause the LLM to always return Saturday+Sunday for weekend queries, with clear differentiation between "dieses Wochenende" and "nächstes Wochenende" based on the current day of the week.
  </done>
  </task>

</tasks>

<verification>
- Read the updated prompt section and verify all weekend rules are explicit and unambiguous
- No occurrence of "7+ Tagen" in the file
- Prettier check passes
</verification>

<success_criteria>

- Weekend section explicitly defines Wochenende as Samstag + Sonntag
- "nächstes Wochenende" has clear, day-aware calculation rules (not vague "7+ Tagen")
- "dieses Wochenende" has clear rules for each day scenario
- Hard constraint states weekend NEVER includes Monday or other weekdays
  </success_criteria>

<output>
After completion, create `.planning/quick/2-fix-weekend-query-returning-sunday-monda/2-SUMMARY.md`
</output>
