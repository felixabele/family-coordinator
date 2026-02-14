/**
 * Signal Message Sender
 *
 * Provides a simple interface for sending Signal messages with error handling and logging.
 */

import type { SignalClient } from "./client.js";
import { SignalSendError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Send a text message via Signal
 *
 * Wraps signal-sdk's sendMessage with error handling and logging.
 * Retries are handled automatically by the SignalClient's retry configuration.
 *
 * @param client - Configured SignalClient instance
 * @param recipient - Recipient phone number in E.164 format (e.g., +12025551234)
 * @param text - Message text content
 * @throws SignalSendError if sending fails after retries
 */
export async function sendSignalMessage(
  client: SignalClient,
  recipient: string,
  text: string,
): Promise<void> {
  try {
    logger.debug(
      { recipient, textLength: text.length },
      "Sending Signal message",
    );

    // Call signal-sdk's sendMessage method
    // The SignalClient has retry and rate limiting configured
    await client.sendMessage(recipient, text);

    logger.info(
      { recipient, textLength: text.length },
      "Signal message sent successfully",
    );
  } catch (error) {
    logger.error(
      {
        error,
        recipient,
        textLength: text.length,
      },
      "Failed to send Signal message",
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new SignalSendError(`Failed to send message: ${errorMessage}`);
  }
}
