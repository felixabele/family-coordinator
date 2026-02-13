/**
 * WhatsApp Response Message Templates
 *
 * Generates human-friendly response text based on extracted calendar intent.
 * Phase 1: Placeholder responses acknowledging the user's intent.
 * Phase 2: Will replace with actual calendar operations.
 */

import type { CalendarIntent } from '../llm/types.js';

/**
 * Formats a human-friendly response based on the extracted calendar intent
 *
 * @param intent - The structured intent extracted by Claude
 * @returns Response text to send back to the user via WhatsApp
 */
export function formatIntentResponse(intent: CalendarIntent): string {
  const { intent: intentType, entities } = intent;

  switch (intentType) {
    case 'greeting':
      return 'Hi! I\'m your family calendar assistant. I can help you add events, check what\'s coming up, edit existing plans, or delete events. Just send me a message like "Add dentist appointment tomorrow at 3pm" and I\'ll handle it!';

    case 'help':
      return 'Here\'s what I can do for you:\n\n' +
        '📅 View events: "What\'s on my calendar today?"\n' +
        '➕ Add events: "Schedule team meeting Friday 2pm"\n' +
        '✏️ Edit events: "Move the dentist appointment to 4pm"\n' +
        '🗑️ Delete events: "Cancel the meeting with John"\n\n' +
        'Just tell me what you need!';

    case 'create_event':
      {
        const titlePart = entities.title ? `"${entities.title}"` : 'an event';
        const datePart = entities.date ? ` on ${entities.date}` : '';
        const timePart = entities.time ? ` at ${entities.time}` : '';

        return `I understood you want to add ${titlePart}${datePart}${timePart}. Calendar integration coming soon!`;
      }

    case 'query_events':
      {
        const datePart = entities.date ? ` for ${entities.date}` : '';
        return `I understood you want to check events${datePart}. Calendar integration coming soon!`;
      }

    case 'update_event':
      {
        const titlePart = entities.title ? ` "${entities.title}"` : ' an event';
        return `I understood you want to update${titlePart}. Calendar integration coming soon!`;
      }

    case 'delete_event':
      {
        const titlePart = entities.title ? ` "${entities.title}"` : ' an event';
        return `I understood you want to delete${titlePart}. Calendar integration coming soon!`;
      }

    case 'unclear':
      {
        // Use the clarification text from the LLM if provided
        if (intent.clarification_needed) {
          return intent.clarification_needed;
        }
        return 'I didn\'t quite understand that. Could you rephrase? For example:\n' +
          '- "Add lunch with Sarah tomorrow at noon"\n' +
          '- "What\'s on my calendar this week?"\n' +
          '- "Delete the team meeting"';
      }

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = intentType;
      return 'I didn\'t quite understand that. Could you rephrase?';
  }
}
