# Phase 2: Calendar Integration & CRUD - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Family members perform all calendar operations (view, add, edit, delete) through Signal messages, with Google Calendar as the backend. This phase connects the existing Signal+Claude pipeline to a real Google Calendar. Multi-user identification and advanced features (recurring events, reminders) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Google Calendar auth

- Service account authentication (bot has its own Google identity)
- JSON key file for credentials, path configured via `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` env var
- Single `GOOGLE_CALENDAR_ID` env var pointing to the existing shared family calendar
- Calendar is already shared with the service account email with "Make changes to events" permission

### Timezone handling

- Single family-wide timezone: `Europe/Berlin`
- Configure via env var but default to Europe/Berlin
- When no date given ("Add dinner at 7pm"): assume today if time hasn't passed, otherwise tomorrow
- When no time given ("Add dentist on Thursday"): bot asks for a time before creating

### Confirmation & safety

- Deletes execute immediately — bot confirms what was deleted after the fact
- Mutations (create, edit, delete) always show a summary of what changed: "Hinzugefügt: Fußball, Di 16:00-17:00"
- When multiple events match an ambiguous request: bot lists matching events with numbers and asks which one
- Default event duration: 1 hour when no end time specified

### Response formatting

- Compact one-line-per-event format for listings: "15:00 - Zahnarzt | 17:00 - Fußball"
- Always respond in German
- Casual/familiar tone — du-form, like texting a family member ("Klar, hab ich eingetragen!")
- Empty state: simple message ("Samstag ist frei!") — no proactive suggestions

### Claude's Discretion

- Exact confirmation message wording (within casual German tone)
- How to format edit confirmations (show before/after or just the result)
- Error message design for API failures
- How many upcoming events to show by default for open-ended queries

</decisions>

<specifics>
## Specific Ideas

- Bot language and tone should feel like a family group chat member, not a formal assistant
- Compact event listings keep Signal messages scannable — avoid walls of text

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 02-calendar-crud_
_Context gathered: 2026-02-14_
