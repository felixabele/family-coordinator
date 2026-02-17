# 1. Introduction and Goals

## 1.1 Requirements Overview

Family Coordinator is a Signal messenger bot that lets family members manage a shared Google Calendar through natural language messages in German. The system eliminates the need to open a calendar app -- family members simply text the bot.

Core use cases (all validated and shipped in v1.0):

- **Query events** -- Ask what is on the calendar for today, this week, or any date range (e.g., "Was steht heute an?")
- **Create events** -- Add events via natural language with automatic date/time parsing (e.g., "Zahnarzt am Montag um 10 Uhr")
- **Create recurring events** -- Set up daily, weekly, or monthly repetitions (e.g., "Jeden Dienstag Fussball um 16 Uhr")
- **Edit events** -- Reschedule or rename existing events (e.g., "Verschieb den Zahnarzt auf Donnerstag")
- **Delete events** -- Remove events with confirmation, including recurring event scope selection (e.g., "Loesche den Zahnarzt-Termin")
- **Conflict detection** -- Warn about scheduling overlaps before creating events

## 1.2 Quality Goals

| Priority | Quality Goal   | Scenario                                                                                  |
| -------- | -------------- | ----------------------------------------------------------------------------------------- |
| 1        | Reliability    | The bot runs 24/7 as a daemon, survives individual message failures without crashing      |
| 2        | Usability      | Family members can manage calendar events without learning any special syntax or commands |
| 3        | Correctness    | Events are created at the right date/time in the correct timezone (Europe/Berlin)         |
| 4        | Responsiveness | Bot responds to messages within a few seconds                                             |
| 5        | Security       | Only whitelisted family members can interact with the bot                                 |

## 1.3 Stakeholders

| Role            | Expectations                                                                    |
| --------------- | ------------------------------------------------------------------------------- |
| Family members  | Easy, friction-free calendar management via Signal in German                    |
| System operator | Low maintenance, automatic restarts, structured logs for debugging              |
| Developer       | Clear module boundaries, type safety, easy local development with `npm run dev` |
