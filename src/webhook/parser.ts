/**
 * WhatsApp Webhook Payload Parser
 * Safely extracts messages from deeply nested WhatsApp webhook structure
 */

import { logger } from '../utils/logger.js';
import {
  WhatsAppWebhookPayload,
  WebhookMessageSchema,
  ParsedMessage,
} from './types.js';

/**
 * Extract messages from WhatsApp webhook payload
 *
 * WhatsApp payloads are deeply nested:
 * payload.entry[0].changes[0].value.messages[0]
 *
 * This function:
 * - Safely traverses the nested structure with null checks
 * - Skips entries without messages (status updates)
 * - Validates each message with Zod before including
 * - Handles non-text message types gracefully
 *
 * @param payload - Validated WhatsApp webhook payload
 * @returns Array of parsed messages ready for processing
 */
export function extractMessages(payload: WhatsAppWebhookPayload): ParsedMessage[] {
  const parsedMessages: ParsedMessage[] = [];

  // Traverse: entry[] -> changes[] -> value.messages[]
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { value } = change;

      // Skip if no messages (e.g., status updates)
      if (!value.messages || value.messages.length === 0) {
        logger.debug(
          { field: change.field },
          'Skipping webhook change without messages (likely status update)'
        );
        continue;
      }

      // Extract contact name mapping (contacts[].wa_id -> profile.name)
      const contactNameMap = new Map<string, string>();
      if (value.contacts) {
        for (const contact of value.contacts) {
          contactNameMap.set(contact.wa_id, contact.profile.name);
        }
      }

      // Process each message
      for (const message of value.messages) {
        // Validate message structure with Zod
        const validation = WebhookMessageSchema.safeParse(message);
        if (!validation.success) {
          logger.warn(
            { message, error: validation.error },
            'Invalid message structure, skipping'
          );
          continue;
        }

        const validatedMessage = validation.data;

        // Extract text content (null for non-text messages)
        let text: string | null = null;
        if (validatedMessage.type === 'text' && validatedMessage.text) {
          text = validatedMessage.text.body;
        } else {
          logger.debug(
            { messageId: validatedMessage.id, type: validatedMessage.type },
            'Non-text message type received'
          );
        }

        // Get sender name from contacts array
        const senderName = contactNameMap.get(validatedMessage.from) || null;

        // Build parsed message
        const parsedMessage: ParsedMessage = {
          messageId: validatedMessage.id,
          from: validatedMessage.from,
          timestamp: validatedMessage.timestamp,
          type: validatedMessage.type,
          text,
          senderName,
        };

        parsedMessages.push(parsedMessage);
      }
    }
  }

  logger.info({ count: parsedMessages.length }, 'Extracted messages from webhook');
  return parsedMessages;
}
