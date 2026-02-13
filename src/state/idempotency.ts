/**
 * Idempotency Store
 * Redis-backed deduplication for WhatsApp message IDs
 * Prevents duplicate processing when WhatsApp retries webhook delivery
 */

import type { Redis } from 'ioredis';
import { PROCESSED_MESSAGE_TTL } from '../config/constants.js';

/**
 * Idempotency store for tracking processed WhatsApp messages
 *
 * WhatsApp retries webhook delivery on timeout or failure.
 * This store prevents duplicate processing by tracking message IDs.
 *
 * TTL: 7 days (matches WhatsApp's retry window)
 */
export class IdempotencyStore {
  constructor(private redis: Redis) {}

  /**
   * Check if a message has already been processed
   *
   * @param messageId - WhatsApp message ID
   * @returns true if message was already processed, false otherwise
   */
  async isProcessed(messageId: string): Promise<boolean> {
    const result = await this.redis.get(`processed:${messageId}`);
    return result !== null;
  }

  /**
   * Mark a message as processed
   *
   * @param messageId - WhatsApp message ID
   */
  async markProcessed(messageId: string): Promise<void> {
    await this.redis.setex(
      `processed:${messageId}`,
      PROCESSED_MESSAGE_TTL,
      '1'
    );
  }
}
