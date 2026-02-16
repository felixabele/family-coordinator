# Quick Task 2: Fix weekend query returning Sunday+Monday

**One-liner:** Replaced vague weekend prompt rules with explicit day-aware calculation logic so LLM always returns Saturday+Sunday, never Sunday+Monday.

**Completed:** 2026-02-16
**Duration:** ~1 min
**Commit:** 113cf46

## Problem

The LLM prompt's weekend section used vague language ("Samstag in 7+ Tagen") for "nächstes Wochenende" which caused the LLM to sometimes pick Sunday+Monday instead of Saturday+Sunday.

## Changes

- Rewrote "### Wochenende (WICHTIG)" section in src/llm/prompts.ts
- Added hard definition: "Wochenende = Samstag und Sonntag. NIEMALS andere Tage."
- Added explicit "dieses Wochenende" rules for three day-of-week scenarios (Mo-Fr, Sa, So)
- Added explicit "nächstes Wochenende" rules distinguishing Mo-Fr vs Sa/So
- Added constraint: "Gib NIEMALS Montag, Dienstag oder einen anderen Wochentag als Teil des Wochenendes zurück"
- Removed ambiguous "Samstag in 7+ Tagen" phrasing

## Files Modified

- src/llm/prompts.ts (lines 82-97)

## Deviations from Plan

None - plan executed exactly as written.
