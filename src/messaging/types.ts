/**
 * WhatsApp Cloud API Messaging Types
 */

/**
 * Payload for sending a text message via WhatsApp Cloud API
 */
export interface WhatsAppSendMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

/**
 * Success response from WhatsApp Cloud API
 */
export interface WhatsAppApiResponse {
  messages: Array<{
    id: string;
  }>;
}

/**
 * Error response from WhatsApp Cloud API
 */
export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
  };
}
