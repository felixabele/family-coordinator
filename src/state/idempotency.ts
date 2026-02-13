/**
 * Idempotency Store
 * PostgreSQL-backed deduplication for Signal message IDs
 * Prevents duplicate processing when Signal retries message delivery
 */

import type { Pool } from 'pg';

/**
 * Idempotency store for tracking processed Signal messages
 *
 * Signal may deliver the same message multiple times in edge cases.
 * This store prevents duplicate processing by tracking message IDs.
 *
 * Retention: 7 days (cleanup via periodic task)
 */
export class IdempotencyStore {
  constructor(private pool: Pool) {}

  /**
   * Check if a message has already been processed
   *
   * @param messageId - Signal message ID (timestamp)
   * @returns true if message was already processed, false otherwise
   */
  async isProcessed(messageId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM processed_messages WHERE message_id = $1',
      [messageId]
    );
    return result.rows.length > 0;
  }

  /**
   * Mark a message as processed
   *
   * @param messageId - Signal message ID (timestamp)
   */
  async markProcessed(messageId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT (message_id) DO NOTHING',
      [messageId]
    );
  }

  /**
   * Cleanup old processed message records
   *
   * Deletes records older than 7 days to prevent table bloat.
   * Should be called periodically (e.g., on application startup or via cron).
   */
  async cleanup(): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM processed_messages WHERE processed_at < NOW() - INTERVAL '7 days'"
    );
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old processed message records`);
    }
  }
}
