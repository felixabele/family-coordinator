---
status: complete
phase: 04-advanced-features
source: 04-01-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-02-16T08:10:00Z
updated: 2026-02-16T08:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create a recurring weekly event

expected: Send "Fußball jeden Dienstag um 16 Uhr" (or similar). Bot creates recurring event and confirms with German frequency pattern ("jeden Dienstag"), time, and next 3 occurrences (dd.MM format like "Nächste: 18.02, 25.02, 04.03").
result: pass

### 2. Smart German date parsing — relative date

expected: Send "Zahnarzt nächsten Donnerstag um 10 Uhr". Bot resolves "nächsten Donnerstag" to the correct upcoming Thursday (not today if today is Thursday) and creates the event on the right date.
result: pass

### 3. Vague time expression

expected: Send "Meeting morgens" or "Arzttermin nachmittags". Bot resolves "morgens" to 09:00 and "nachmittags" to 15:00. The event appears in Google Calendar at the correct time.
result: pass

### 4. Conflict detection warning

expected: Create two events at overlapping times. When the second event overlaps, bot warns in German: "Achtung: Überschneidung mit {existing event} um {time} Uhr. Trotzdem erstellen?" — then wait for your response.
result: pass

### 5. Confirm or cancel after conflict warning

expected: After receiving a conflict warning, reply "ja" to create the event anyway, or "nein" to cancel. Bot confirms creation or says "Alles klar, Termin wurde nicht erstellt."
result: pass

### 6. Recurring event with end date

expected: Send "Täglich um 9 Meeting bis Ende März" (or similar with an end date). Bot creates recurring event and confirmation shows the end date (e.g., "Endet: 31.03.2026").
result: pass

### 7. Delete a recurring event instance — scope question

expected: Delete a single instance of a recurring event. Bot asks "Das ist ein wiederkehrender Termin. Nur dieses Mal oder alle zukünftigen löschen?" with options "1) Nur dieses Mal" and "2) Alle zukünftigen".
result: pass

### 8. Delete all future recurring instances

expected: After the scope question, reply "2" or "alle zukünftigen". Bot deletes all future occurrences (past instances preserved in Google Calendar). Confirms with "Alle zukünftigen Termine ab {date} gelöscht."
result: pass

### 9. Help text shows recurring events

expected: Send "hilfe" or "help" to the bot. Response includes "Wiederkehrende Termine" as a listed feature (e.g., "Jeden Dienstag Fußball um 16 Uhr").
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
