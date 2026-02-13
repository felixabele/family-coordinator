/**
 * WhatsApp Webhook Routes
 * GET /webhook: WhatsApp verification endpoint
 * POST /webhook: Message receive endpoint with signature validation and async processing
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Queue } from 'bullmq';
import { validateWebhookSignature } from './signature.js';
import { extractMessages } from './parser.js';
import { WhatsAppWebhookPayloadSchema } from './types.js';
import type { MessageJobData } from '../queue/types.js';
import type { IdempotencyStore } from '../state/idempotency.js';
import type { Env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Plugin options for webhook routes
 */
interface WebhookPluginOptions {
  messageQueue: Queue<MessageJobData>;
  idempotencyStore: IdempotencyStore;
  config: Env;
}

/**
 * Webhook routes plugin
 *
 * Registers:
 * - GET /webhook: WhatsApp verification endpoint
 * - POST /webhook: Message receive endpoint
 *
 * @param fastify - Fastify instance
 * @param options - Plugin dependencies (queue, idempotency store, config)
 */
export async function webhookRoutes(
  fastify: FastifyInstance,
  options: WebhookPluginOptions
): Promise<void> {
  const { messageQueue, idempotencyStore, config } = options;

  /**
   * GET /webhook - WhatsApp Verification Endpoint
   *
   * WhatsApp sends a GET request with hub.mode, hub.verify_token, and hub.challenge
   * to verify your webhook URL during setup in Meta developer console.
   *
   * Must return the challenge string as plain text if verification succeeds.
   */
  fastify.get('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    logger.info({ mode, token: token ? '***' : undefined }, 'Webhook verification request');

    // Verify token matches and mode is subscribe
    if (mode === 'subscribe' && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook verification successful');
      // Return challenge as plain text (not JSON)
      return reply.code(200).send(challenge);
    } else {
      logger.warn({ mode, tokenMatch: token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN }, 'Webhook verification failed');
      return reply.code(403).send('Forbidden');
    }
  });

  /**
   * POST /webhook - Message Receive Endpoint
   *
   * Flow:
   * 1. Validate HMAC signature from X-Hub-Signature-256 header
   * 2. Return 200 IMMEDIATELY (before any processing)
   * 3. Parse payload and extract messages
   * 4. Check idempotency (skip duplicates)
   * 5. Mark messages as processed
   * 6. Enqueue to BullMQ for async processing
   *
   * Critical: Must return 200 within milliseconds. WhatsApp times out at 5 seconds.
   */
  fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    // Step 1: Get raw body for signature validation
    // Raw body is attached by custom content-type parser in index.ts
    const rawBody = (request.raw as any).rawBody ?? (request as any).rawBody;
    const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;

    if (!rawBody) {
      logger.error('No raw body available for signature validation');
      return reply.code(400).send('Bad Request');
    }

    // Step 2: Validate signature
    const isValid = validateWebhookSignature(
      rawBody,
      signatureHeader,
      config.WHATSAPP_APP_SECRET
    );

    if (!isValid) {
      logger.warn({ signature: signatureHeader }, 'Invalid webhook signature');
      return reply.code(401).send('Unauthorized');
    }

    // Step 3: Return 200 IMMEDIATELY (before processing)
    // This is critical - WhatsApp expects response within milliseconds
    reply.code(200).send('OK');

    // Step 4-7: Async processing (fire-and-forget, response already sent)
    // Wrap in try-catch to prevent unhandled errors from crashing the server
    (async () => {
      try {
        // Parse and validate payload
        const payloadValidation = WhatsAppWebhookPayloadSchema.safeParse(request.body);
        if (!payloadValidation.success) {
          logger.error(
            { error: payloadValidation.error },
            'Invalid webhook payload structure'
          );
          return;
        }

        const payload = payloadValidation.data;

        // Extract messages from nested payload
        const messages = extractMessages(payload);

        // Process each message
        for (const message of messages) {
          // Skip non-text messages for now
          if (message.type !== 'text' || !message.text) {
            logger.debug(
              { messageId: message.messageId, type: message.type },
              'Skipping non-text message'
            );
            continue;
          }

          // Check idempotency
          const alreadyProcessed = await idempotencyStore.isProcessed(message.messageId);
          if (alreadyProcessed) {
            logger.info(
              { messageId: message.messageId },
              'Message already processed, skipping (duplicate webhook)'
            );
            continue;
          }

          // Mark as processed before enqueueing to prevent race conditions
          await idempotencyStore.markProcessed(message.messageId);

          // Enqueue to BullMQ
          const jobData: MessageJobData = {
            messageId: message.messageId,
            from: message.from,
            timestamp: message.timestamp,
            type: message.type,
            text: message.text,
            senderName: message.senderName,
          };

          await messageQueue.add('process-message', jobData);

          logger.info(
            { messageId: message.messageId, from: message.from },
            'Message enqueued for processing'
          );
        }
      } catch (error) {
        // Log error but don't throw (response already sent)
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Error processing webhook payload'
        );
      }
    })();
  });
}
