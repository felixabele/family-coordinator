/**
 * WhatsApp Cloud API Webhook Types
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

import { z } from 'zod';

/**
 * Webhook message text content
 */
export const WebhookTextSchema = z.object({
  body: z.string(),
});

/**
 * Individual message from WhatsApp webhook
 */
export const WebhookMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: WebhookTextSchema.optional(),
});

/**
 * Contact information in webhook payload
 */
export const WebhookContactSchema = z.object({
  profile: z.object({
    name: z.string(),
  }),
  wa_id: z.string(),
});

/**
 * Value object containing messages, contacts, and metadata
 */
export const WebhookValueSchema = z.object({
  messaging_product: z.string(),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(WebhookContactSchema).optional(),
  messages: z.array(WebhookMessageSchema).optional(),
  statuses: z.array(z.unknown()).optional(), // Status updates (sent/delivered/read)
});

/**
 * Change object in webhook entry
 */
export const WebhookChangeSchema = z.object({
  value: WebhookValueSchema,
  field: z.string(),
});

/**
 * Entry object in webhook payload
 */
export const WebhookEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WebhookChangeSchema),
});

/**
 * Top-level WhatsApp webhook payload
 */
export const WhatsAppWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(WebhookEntrySchema),
});

// TypeScript types inferred from Zod schemas
export type WebhookText = z.infer<typeof WebhookTextSchema>;
export type WebhookMessage = z.infer<typeof WebhookMessageSchema>;
export type WebhookContact = z.infer<typeof WebhookContactSchema>;
export type WebhookValue = z.infer<typeof WebhookValueSchema>;
export type WebhookChange = z.infer<typeof WebhookChangeSchema>;
export type WebhookEntry = z.infer<typeof WebhookEntrySchema>;
export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>;

/**
 * Parsed message for application processing
 */
export interface ParsedMessage {
  messageId: string;
  from: string;
  timestamp: string;
  type: string;
  text: string | null;
  senderName: string | null;
}
