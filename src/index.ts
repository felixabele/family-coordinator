/**
 * Application Entry Point
 *
 * Wires all components together:
 * - Environment validation
 * - Database and Redis connections
 * - LLM client and state stores
 * - Fastify web server with webhook routes
 * - BullMQ worker for message processing
 * - Graceful shutdown handlers
 */

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool, closePool } from './db/pool.js';
import { createQueueConnection, createWorkerConnection } from './queue/connection.js';
import { createMessageQueue } from './queue/producer.js';
import { createMessageWorker } from './queue/consumer.js';
import { createAnthropicClient } from './llm/client.js';
import { ConversationStore } from './state/conversation.js';
import { IdempotencyStore } from './state/idempotency.js';
import { webhookRoutes } from './webhook/routes.js';

/**
 * Start the application
 */
async function start() {
  // 1. Validate environment
  logger.info('Validating environment configuration...');
  const config = validateEnv();

  logger.info({
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    logLevel: config.LOG_LEVEL,
  }, 'Environment validated');

  // 2. Create Redis connections
  logger.info('Creating Redis connections...');
  const queueConnection = createQueueConnection(config.REDIS_URL);
  const workerConnection = createWorkerConnection(config.REDIS_URL);

  // 3. Create service instances
  logger.info('Initializing service instances...');
  const anthropicClient = createAnthropicClient(config.ANTHROPIC_API_KEY);
  const conversationStore = new ConversationStore(pool);
  const idempotencyStore = new IdempotencyStore(queueConnection);
  const messageQueue = createMessageQueue(queueConnection);

  logger.info('Service instances created');

  // 4. Create Fastify instance
  logger.info('Creating Fastify server...');
  const fastify = Fastify({
    logger,
  });

  // 5. Add custom content-type parser for raw body (MUST be before routes)
  // This captures the raw body for signature validation
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      // Attach raw body to request for signature validation
      (req as any).rawBody = body;

      // Parse JSON manually
      try {
        const json = JSON.parse(body.toString('utf-8'));
        done(null, json);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  // 6. Register rate limiting
  await fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute', // per minute per IP
  });

  logger.info('Rate limiting configured (100 req/min per IP)');

  // 7. Register webhook routes
  await fastify.register(webhookRoutes, {
    messageQueue,
    idempotencyStore,
    config,
  });

  logger.info('Webhook routes registered');

  // 8. Create BullMQ worker
  logger.info('Creating BullMQ worker...');
  const worker = createMessageWorker(workerConnection, {
    anthropicClient,
    conversationStore,
    idempotencyStore,
    config,
    logger,
  });

  logger.info('BullMQ worker created and started');

  // 9. Start Fastify server
  try {
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0', // Required for cloud deployment
    });

    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
      },
      '🚀 Family Coordinator server started successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }

  // 10. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, cleaning up...');

    try {
      // Close Fastify (stops accepting new requests)
      await fastify.close();
      logger.info('Fastify server closed');

      // Close BullMQ worker (finishes processing current jobs)
      await worker.close();
      logger.info('BullMQ worker closed');

      // Close Redis connections
      await queueConnection.quit();
      await workerConnection.quit();
      logger.info('Redis connections closed');

      // Close PostgreSQL pool
      await closePool();
      logger.info('PostgreSQL pool closed');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the application
start().catch((error) => {
  logger.error({ error }, 'Fatal error during startup');
  process.exit(1);
});
