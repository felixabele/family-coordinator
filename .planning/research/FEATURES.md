# Feature Landscape

**Domain:** WhatsApp-based Calendar/Scheduling Bots
**Researched:** 2026-02-13
**Confidence:** MEDIUM

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| View events (query calendar) | Users need to see what's scheduled before adding new events. Prevents conflicts. | Low | Natural language queries: "What's on Friday?", "Do I have anything tomorrow?" |
| Add events (create) | Core use case. Users must be able to schedule without switching to calendar app. | Medium | Requires NLP to parse date/time, event title, location from natural language input |
| Edit events (update) | Plans change. Users expect to modify existing events directly in chat. | Medium | Must identify which event to edit, parse what fields to change. Confirm changes. |
| Delete events (remove) | Cancelled plans need removal. Table stakes for any CRUD system. | Low-Medium | Requires event identification and deletion confirmation to prevent accidents |
| Event confirmations | After any modification (add/edit/delete), users expect clear feedback of what happened. | Low | "Added: Dentist appointment on March 5 at 2pm" - prevents misunderstandings |
| 24/7 availability | WhatsApp is always-on. Bot must respond instantly any time of day. | Low | No human scheduling delays. Immediate responses expected. |
| Natural language input | Users won't type structured commands. Expect conversational interface. | High | "Lunch with mom tomorrow 1pm" not "/add event:lunch date:tomorrow time:13:00" |
| Event details in responses | When querying, users expect to see title, date, time, location (if present). | Low | Format: "March 5, 2pm - Dentist appointment at Main St Clinic" |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conflict detection | Proactively warn: "You already have Soccer practice at 3pm on Saturday" before confirming booking | Medium | Checks existing events before adding. Prevents double-booking. Major pain point for families. |
| Smart date parsing | Understand "next Tuesday", "this Friday", "in 2 weeks", relative dates | Medium | Libraries exist (Chrono, date-fns). Improves UX significantly over exact dates only. |
| Multi-user context awareness | Track who added what. "Sarah added Soccer practice" vs "You added Dentist" | Medium | Requires user authentication/identification. Helps families coordinate. |
| Recurring event support | "Every Monday at 4pm - Piano lessons" | High | Google Calendar supports this. Complex NLP to parse recurrence patterns. High user value for regular activities. |
| Event reminders | Proactive notifications: "Reminder: Dentist appointment in 1 hour" sent via WhatsApp | Medium | Requires background job scheduling. Reduces no-shows. Expected in appointment booking contexts. |
| Time zone intelligence | Handle "tomorrow" correctly across time zones if family members travel | Medium | Google Calendar handles TZ. Bot must preserve/respect TZ in queries. |
| Ambiguity resolution | "Which event? 1) Dentist 2pm 2) Soccer 3pm" when editing/deleting | Medium | When multiple events match, present options. Prevents wrong event modification. |
| Event search/filtering | "Show me all events next week" or "Find all dentist appointments" | Medium | Beyond just "what's today" - enables planning, review. |
| Shared calendar visibility | All family members see same events. One source of truth. | Low | Already scoped: one shared Google Calendar. Core value prop. |
| Quick replies / buttons | Present confirmation options as buttons: [Confirm] [Cancel] [Edit] instead of text-only | Low-Medium | WhatsApp supports interactive messages. Reduces typing, clearer UX. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multiple calendar support (v1) | Scope creep. One shared family calendar is the core use case. Multi-calendar adds complexity without validation. | Stick to single shared Google Calendar for v1. Consider multi-calendar only after validation. |
| Rich media in events (images, files) | WhatsApp supports media, but calendar events with attachments add complexity. Google Calendar supports it, but NLP for "add this photo to the event" is non-trivial. | Support text-based event details only. Location as text field. Defer media support. |
| Calendar sync across multiple platforms | Supporting Google + Outlook + Apple Calendar simultaneously in v1 = massive scope. Each has different APIs, quirks. | Google Calendar only for v1. It's most common for families, well-documented API. |
| User permissions/roles (v1) | "Admin can delete, members can only view" - adds complexity. Families expect equal access. | All users have full CRUD on shared calendar. Permissions not needed for family use case. |
| AI-suggested scheduling | "Find a time that works for everyone" - requires parsing all family members' availability, preference learning, negotiation. Too complex for v1. | Users specify exact times. Bot confirms/warns of conflicts but doesn't auto-suggest alternatives. |
| Integration with other tools (Slack, email, etc) | WhatsApp-only is the differentiator. Multi-channel = scope creep. | WhatsApp Business API only. Other channels are separate products. |
| Voice message input | WhatsApp supports voice, but transcription + NLP on transcribed text adds complexity and accuracy issues. | Text-based natural language only. Users can voice-type via keyboard but bot processes text. |
| Event analytics/reporting | "You had 15 events last month" - nice to have but not core to scheduling coordination. | Focus on CRUD operations. Defer analytics to future versions. |

## Feature Dependencies

```
View events (query)
    ├──requires──> Google Calendar API read access
    └──requires──> Natural language date parsing

Add events (create)
    ├──requires──> Google Calendar API write access
    ├──requires──> Natural language parsing (date, time, title, location)
    └──enhances──> Conflict detection (check before adding)

Edit events (update)
    ├──requires──> View events (to identify which event)
    ├──requires──> Google Calendar API write access
    └──requires──> Ambiguity resolution (when multiple matches)

Delete events (remove)
    ├──requires──> View events (to identify which event)
    ├──requires──> Deletion confirmation pattern
    └──requires──> Google Calendar API write access

Event confirmations
    └──requires──> Success/failure responses from all CRUD operations

Conflict detection
    ├──requires──> View events (to check existing schedule)
    └──enhances──> Add events (warn before confirming)

Recurring events
    ├──requires──> Add events (create recurring rule)
    └──requires──> Complex NLP for recurrence patterns

Event reminders
    ├──requires──> View events (know what to remind about)
    ├──requires──> Background job scheduler
    └──requires──> WhatsApp message sending (proactive, not reactive)

Ambiguity resolution
    └──enhances──> Edit events, Delete events (when multiple matches)

Multi-user context
    ├──requires──> User authentication/identification
    └──enhances──> View events (show who added what)

Quick replies / buttons
    └──enhances──> Event confirmations, Ambiguity resolution (better UX)
```

## MVP Recommendation

### Launch With (v1)

Prioritize table stakes + minimal differentiators to validate core value proposition.

- [x] **View events (query)** - Essential. Must see schedule.
- [x] **Add events (create)** - Core use case. Replace app-switching.
- [x] **Edit events (update)** - Plans change. Non-negotiable for real-world use.
- [x] **Delete events (remove)** - Complete CRUD. Cancelled plans happen.
- [x] **Event confirmations** - Prevents misunderstandings. Low complexity, high value.
- [x] **Natural language input** - Core differentiator. Conversational interface is the point.
- [x] **24/7 availability** - Expected for bots. No additional work beyond hosting.
- [x] **Conflict detection** - HIGH value for families. Prevents double-booking frustration. Include in v1.
- [x] **Ambiguity resolution** - Necessary for edit/delete to work safely with multiple events.

### Add After Validation (v1.x)

Features to add once core CRUD is validated and working.

- [ ] **Event reminders** - High value (reduce no-shows) but requires background jobs. Add after core flow is solid.
- [ ] **Recurring events** - Common family use case (weekly activities) but complex NLP. v1.1 candidate.
- [ ] **Smart date parsing** - "Next Tuesday" is better UX than "2026-02-18" but absolute dates work for v1.
- [ ] **Event search/filtering** - "Show all events next week" - nice to have, not critical for initial validation.
- [ ] **Quick replies / buttons** - Better UX but text-based confirmations work for v1. UX polish for v1.1.
- [ ] **Multi-user context awareness** - "Who added this?" - useful but not critical. Requires auth complexity.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Time zone intelligence** - Only needed if families travel internationally. Edge case for most users.
- [ ] **Multiple calendar support** - Different product. Validate single shared calendar first.
- [ ] **Rich media in events** - Complex. Validate text-based events first.
- [ ] **AI-suggested scheduling** - Complex negotiation logic. Requires significant validation and learning.
- [ ] **Event analytics** - Not core to coordination. Future monetization opportunity.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| View events | HIGH | LOW | P1 |
| Add events | HIGH | MEDIUM | P1 |
| Edit events | HIGH | MEDIUM | P1 |
| Delete events | HIGH | LOW-MEDIUM | P1 |
| Event confirmations | HIGH | LOW | P1 |
| Natural language input | HIGH | HIGH | P1 |
| Conflict detection | HIGH | MEDIUM | P1 |
| Ambiguity resolution | HIGH | MEDIUM | P1 |
| Event reminders | MEDIUM | MEDIUM | P2 |
| Recurring events | MEDIUM | HIGH | P2 |
| Smart date parsing | MEDIUM | LOW-MEDIUM | P2 |
| Event search/filtering | MEDIUM | MEDIUM | P2 |
| Quick replies / buttons | MEDIUM | LOW-MEDIUM | P2 |
| Multi-user context | LOW-MEDIUM | MEDIUM | P2 |
| Time zone intelligence | LOW | MEDIUM | P3 |
| Multiple calendar support | MEDIUM | HIGH | P3 |
| Rich media in events | LOW | HIGH | P3 |
| AI-suggested scheduling | MEDIUM | HIGH | P3 |
| Event analytics | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (core CRUD + conflict detection)
- P2: Should have, add when possible (UX improvements, reminders, recurring)
- P3: Nice to have, future consideration (scope expansion, advanced AI)

## Competitor Feature Analysis

Based on research of WhatsApp calendar bots and conversational calendar assistants in 2026:

| Feature | Famulor | Clawdbot | Coco AI | Our Approach |
|---------|---------|----------|---------|--------------|
| Natural language booking | Yes - guided dialogue | Yes - chat commands | Yes - conversational | Yes - Claude LLM for intent parsing |
| Calendar integration | Multi-platform | Email + Calendar | Google Account | Google Calendar (single shared) |
| Conflict detection | Yes - checks availability | Yes - dynamic calendar check | Yes - knows when busy/free | Yes - check before confirming new events |
| Automated confirmations | Yes - with .ics file | Yes | Yes | Yes - text confirmation in chat |
| Event reminders | Yes - reduces no-shows | Yes | Yes - to friends via messaging | v1.1 - via WhatsApp proactive messages |
| Multi-user support | Business-focused | Personal assistant | Personal + friends | Family-focused (shared calendar) |
| Recurring events | Likely yes (appointment booking) | Yes - adjust appointments | Likely yes | v1.1 - Google Calendar supports it |
| Event editing | Yes | Yes - adjust appointments | Yes | Yes - core CRUD requirement |
| Channel | Phone, WhatsApp, web widget | WhatsApp, Telegram | Telegram, WhatsApp | WhatsApp Business API only |

**Competitive positioning:** Competitors focus on business appointment booking (Famulor) or personal productivity assistants (Clawdbot, Coco). Our family coordination angle with shared calendar is underserved. Family-specific features (conflict detection for shared events, equal access for all members) differentiate us.

## Research Sources

### WhatsApp Calendar Bot Ecosystem
- [Famulor: AI Assistant Automates Calendar Across Channels](https://www.famulor.io/blog/rethinking-scheduling-how-famulors-ai-assistant-automates-your-calendar-across-all-channels)
- [ChatCompose: Schedule appointments with WhatsApp chatbot](https://www.chatcompose.com/whatsappbooking.html)
- [8x8 Tutorial: WhatsApp + Google Calendar Chat Bot](https://developer.8x8.com/connect/docs/tutorial-building-a-whatsapp-google-calendar-chat-bot/)
- [Clawdbot: AI Assistant for Email, Calendar & Tasks](https://seczine.com/technology/2026/01/clawdbot-launches-ai-assistant-for-email-calendar/)
- [Wassenger: WhatsApp Appointments AI Agent](https://wassenger.com/flows/ai-agent-whatsapp-appointments)

### WhatsApp Business API & Policy (2026)
- [WhatsApp 2026 AI Policy Explained](https://learn.turn.io/l/en/article/khmn56xu3a-whats-app-s-2026-ai-policy-explained) - CRITICAL: bots must perform "concrete business tasks" (appointment booking qualifies)
- [Chatarmin: WhatsApp Business API Integration 2026](https://chatarmin.com/en/blog/whats-app-business-api-integration)

### Family Calendar Coordination
- [Koalendar: Best Shared Calendar Apps 2026](https://koalendar.com/blog/best-shared-calendar-app)
- [Cybernews: Best digital calendar for families 2026](https://cybernews.com/reviews/best-digital-calendar-for-families/)
- [OneCal: How to Sync Family Calendars 2026](https://www.onecal.io/blog/how-to-sync-family-calendars)
- [Oreate AI: Sharing Calendars With WhatsApp](https://www.oreateai.com/blog/beyond-the-group-chat-seamlessly-sharing-calendars-with-whatsapp-and-beyond/c50e33cf789f1017cf3930a00d550855)
- [Fhynix: AI-powered family calendar with WhatsApp integration](https://fhynix.com/family-calendar-apps/)

### Conversational AI & NLP for Calendars
- [Google Gemini: Secondary and Shared Calendar Support](https://www.webpronews.com/googles-gemini-ai-assistant-finally-bridges-the-calendar-gap-with-secondary-and-shared-event-support/)
- [Clockwise Prism: Natural Language AI Assistant](https://www.getclockwise.com/ai)
- [Nearform: Google Calendar with Natural Language via LangChain](https://nearform.com/insights/using-google-calendar-with-natural-language-via-langchain/)
- [KDnuggets: 5 NLP Trends Shaping 2026](https://www.kdnuggets.com/5-cutting-edge-natural-language-processing-trends-shaping-2026)

### Chatbot Best Practices & UX Patterns
- [Botpress: Booking Chatbot Build Guide 2026](https://botpress.com/blog/chatbot-for-bookings)
- [Botpress: 24 Chatbot Best Practices 2026](https://botpress.com/blog/chatbot-best-practices)
- [YourGPT: WhatsApp Appointment Booking AI](https://yourgpt.ai/blog/general/whatsapp-appointment-booking-ai)
- [Happoin: WhatsApp Chatbot for Appointments](https://happoin.com/en/whatsapp-chatbot-for-appointment-booking)
- [Parallel: Chatbot UX Design Complete Guide](https://www.parallelhq.com/blog/chatbot-ux-design)

### Calendar Conflict Detection & Scheduling
- [Reclaim.ai: AI Calendar for Work & Life](https://reclaim.ai/)
- [IEEE: Chatbot for Conflict Detection and Resolution](https://ieeexplore.ieee.org/document/8823615/)
- [Lindy: AI Calendar Assistant](https://www.lindy.ai/tools/ai-calendar-assistant)

### Calendar Permissions & Multi-User Access
- [Google Calendar: Control access to shared calendar](https://support.google.com/calendar/answer/15716974?hl=en)
- [Microsoft: Calendar sharing in Microsoft 365](https://support.microsoft.com/en-us/office/calendar-sharing-in-microsoft-365-b576ecc3-0945-4d75-85f1-5efafb8a37b4)

### Confirmation & Deletion Patterns
- [NN/g: Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/)
- [Cloudscape: Delete with additional confirmation pattern](https://cloudscape.design/patterns/resource-management/delete/delete-with-additional-confirmation/)
- [UX Psychology: How to design better destructive action modals](https://uxpsychology.substack.com/p/how-to-design-better-destructive)

---
*Feature research for WhatsApp-based family calendar coordination bot*
*Researched: 2026-02-13*
*Confidence: MEDIUM (web search verified with multiple sources, official API docs confirmed separately)*
