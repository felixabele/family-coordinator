/**
 * Redis Connection Factory for BullMQ
 * Separate connection configs for producers (Queue) and consumers (Worker)
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * Create Redis connection for BullMQ Queue (producer)
 *
 * Configuration:
 * - maxRetriesPerRequest: 20 (fail-fast for producers)
 * - enableReadyCheck: false (faster startup)
 *
 * @param redisUrl - Redis connection URL (e.g., redis://localhost:6379)
 * @returns Redis instance configured for queue producers
 */
export function createQueueConnection(redisUrl: string): Redis {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: 20, // Fail fast for producers
    enableReadyCheck: false,
  });

  // Log connection events
  connection.on('connect', () => {
    logger.info({ redisUrl }, 'Queue connection established');
  });

  connection.on('error', (err: Error) => {
    logger.error({ error: err.message }, 'Queue connection error');
  });

  connection.on('close', () => {
    logger.warn('Queue connection closed');
  });

  return connection;
}

/**
 * Create Redis connection for BullMQ Worker (consumer)
 *
 * CRITICAL: Workers require maxRetriesPerRequest: null for blocking operations
 * Reference: https://docs.bullmq.io/guide/connections
 *
 * Configuration:
 * - maxRetriesPerRequest: null (REQUIRED for BullMQ workers - blocking BRPOPLPUSH)
 * - enableReadyCheck: false (faster startup)
 *
 * @param redisUrl - Redis connection URL (e.g., redis://localhost:6379)
 * @returns Redis instance configured for BullMQ workers
 */
export function createWorkerConnection(redisUrl: string): Redis {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // CRITICAL: Required for BullMQ workers
    enableReadyCheck: false,
  });

  // Log connection events
  connection.on('connect', () => {
    logger.info({ redisUrl }, 'Worker connection established');
  });

  connection.on('error', (err: Error) => {
    logger.error({ error: err.message }, 'Worker connection error');
  });

  connection.on('close', () => {
    logger.warn('Worker connection closed');
  });

  return connection;
}
