/**
 * BullMQ Queue Producer
 * Creates message queue for enqueueing incoming WhatsApp messages
 */

import { Queue } from 'bullmq';
import { QUEUE_NAME } from '../config/constants.js';
import type { MessageJobData } from './types.js';

/**
 * Create message processing queue
 *
 * Configuration:
 * - attempts: 3 (retry failed jobs up to 3 times)
 * - backoff: exponential starting at 1000ms (1s, 2s, 4s)
 * - removeOnComplete: keep last 1000 completed jobs
 * - removeOnFail: keep last 5000 failed jobs for debugging
 *
 * @param connection - Redis instance from createQueueConnection()
 * @returns Queue instance for enqueueing messages
 */
export function createMessageQueue(connection: any) {
  return new Queue<MessageJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: {
        count: 1000, // Keep last 1000 completed
      },
      removeOnFail: {
        count: 5000, // Keep last 5000 failed for debugging
      },
    },
  });
}
