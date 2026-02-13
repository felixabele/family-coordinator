/**
 * WhatsApp Cloud API Message Sender
 */

import { WHATSAPP_API_VERSION } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import type { WhatsAppSendMessagePayload, WhatsAppApiResponse, WhatsAppApiError } from './types.js';

/**
 * Sends a text message via WhatsApp Cloud API
 *
 * @param phoneNumberId - WhatsApp Business Phone Number ID
 * @param accessToken - WhatsApp access token
 * @param to - Recipient phone number (E.164 format)
 * @param text - Message text content
 * @throws {Error} If API request fails
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const payload: WhatsAppSendMessagePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: text,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Parse error response
      const errorData = await response.json() as WhatsAppApiError;
      logger.error({
        error: errorData.error,
        status: response.status,
        to,
      }, 'WhatsApp API error');

      throw new Error(
        `WhatsApp API error: ${errorData.error.message} (type: ${errorData.error.type}, code: ${errorData.error.code})`
      );
    }

    const data = await response.json() as WhatsAppApiResponse;
    const messageId = data.messages[0]?.id;

    logger.info({
      messageId,
      to,
      textLength: text.length,
    }, 'WhatsApp message sent successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('WhatsApp API error')) {
      // Re-throw API errors as-is
      throw error;
    }

    // Network or other errors
    logger.error({
      error,
      to,
    }, 'Failed to send WhatsApp message');

    throw new Error(`Failed to send WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
