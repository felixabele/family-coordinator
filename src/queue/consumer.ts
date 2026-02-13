/**
 * BullMQ Worker for Message Processing
 *
 * Processes queued WhatsApp messages through the complete pipeline:
 * 1. Load conversation state
 * 2. Extract intent via Claude
 * 3. Format response
 * 4. Send via WhatsApp
 * 5. Update conversation state
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { Redis } from 'ioredis';
import { Worker, Job } from 'bullmq';
import type { Logger } from 'pino';
import { logger } from '../utils/logger.js';
import { QUEUE_NAME, MAX_CONCURRENT_JOBS } from '../config/constants.js';
import type { Env } from '../config/env.js';
import type { MessageJobData, MessageJobResult } from './types.js';
import type { ConversationStore } from '../state/conversation.js';
import type { IdempotencyStore } from '../state/idempotency.js';
import { extractIntent } from '../llm/intent.js';
import { formatIntentResponse } from '../messaging/templates.js';
import { sendWhatsAppMessage } from '../messaging/sender.js';

/**
 * Dependencies required by the worker
 */
export interface WorkerDependencies {
  anthropicClient: Anthropic;
  conversationStore: ConversationStore;
  idempotencyStore: IdempotencyStore;
  config: Env;
  logger: Logger;
}

/**
 * Creates and configures a BullMQ worker for processing messages
 *
 * @param workerConnection - Redis connection for worker (maxRetriesPerRequest: null)
 * @param deps - Worker dependencies (clients, stores, config)
 * @returns Configured Worker instance
 */
export function createMessageWorker(
  workerConnection: Redis,
  deps: WorkerDependencies
): Worker<MessageJobData, MessageJobResult> {
  const { anthropicClient, conversationStore, idempotencyStore, config, logger: workerLogger } = deps;

  const worker = new Worker<MessageJobData, MessageJobResult>(
    QUEUE_NAME,
    async (job: Job<MessageJobData>): Promise<MessageJobResult> => {
      const { messageId, from, text, senderName } = job.data;

      workerLogger.info(
        {
          jobId: job.id,
          messageId,
          from,
          senderName,
        },
        'Processing message job'
      );

      try {
        // Skip non-text messages
        if (!text) {
          workerLogger.info(
            { messageId, from, type: job.data.type },
            'Skipping non-text message'
          );
          await idempotencyStore.markProcessed(messageId);
          return {
            success: true,
            responseText: '(skipped non-text message)',
          };
        }

        // 1. Belt-and-suspenders idempotency check
        // (webhook already checks, but verify again in case of race conditions)
        const alreadyProcessed = await idempotencyStore.isProcessed(messageId);
        if (alreadyProcessed) {
          workerLogger.info(
            { messageId, from },
            'Message already processed (duplicate detected at worker level)'
          );
          return {
            success: true,
            responseText: '(skipped duplicate)',
          };
        }

        // 2. Load conversation state
        const conversationState = await conversationStore.getState(from);
        const isNewConversation = conversationState === null;

        workerLogger.debug(
          {
            from,
            isNewConversation,
            existingIntent: conversationState?.currentIntent,
            historyCount: conversationState?.messageHistory.length ?? 0,
          },
          'Conversation state loaded'
        );

        // 3. Add user message to conversation history
        await conversationStore.addToHistory(from, 'user', text);

        // 4. Build conversation history for LLM context
        const updatedState = await conversationStore.getState(from);
        const conversationHistory = updatedState?.messageHistory ?? [];

        // 5. Extract intent via Claude
        workerLogger.debug({ from, text }, 'Extracting intent via Claude');

        let intent;
        let responseText: string;

        try {
          intent = await extractIntent(
            anthropicClient,
            text,
            conversationHistory
          );

          workerLogger.info(
            {
              from,
              intent: intent.intent,
              confidence: intent.confidence,
              entities: intent.entities,
              hasClarification: !!intent.clarification_needed,
            },
            'Intent extracted successfully'
          );

          // 6. Format response based on intent
          responseText = formatIntentResponse(intent);
        } catch (error) {
          // Claude extraction failed - send fallback message
          workerLogger.error(
            { error, from, messageId },
            'Intent extraction failed, sending fallback message'
          );

          responseText = "Sorry, I'm having trouble understanding right now. Please try again in a moment.";
          intent = null; // No intent extracted
        }

        // 7. Send WhatsApp response
        workerLogger.debug(
          { from, responseLength: responseText.length },
          'Sending WhatsApp response'
        );

        try {
          await sendWhatsAppMessage(
            config.WHATSAPP_PHONE_NUMBER_ID,
            config.WHATSAPP_ACCESS_TOKEN,
            from,
            responseText
          );
        } catch (error) {
          // WhatsApp send failed - log but don't retry (job will retry from scratch)
          workerLogger.error(
            { error, from, messageId },
            'Failed to send WhatsApp message'
          );

          // Mark as processed anyway to prevent retry loops on permanent failures
          await idempotencyStore.markProcessed(messageId);

          return {
            success: false,
            error: `Failed to send WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }

        // 8. Add assistant response to conversation history
        await conversationStore.addToHistory(from, 'assistant', responseText);

        // 9. Update conversation state with current intent and entities
        if (intent) {
          const latestState = await conversationStore.getState(from);
          await conversationStore.saveState({
            phoneNumber: from,
            currentIntent: intent.intent,
            pendingEntities: intent.entities as Record<string, unknown>,
            messageHistory: latestState?.messageHistory ?? [],
            lastMessageAt: new Date(),
          });
        }

        // 10. Mark message as processed
        await idempotencyStore.markProcessed(messageId);

        workerLogger.info(
          {
            messageId,
            from,
            intent: intent?.intent,
            confidence: intent?.confidence,
            responseLength: responseText.length,
          },
          'Message processed successfully'
        );

        return {
          success: true,
          responseText,
        };
      } catch (error) {
        // Unexpected error - log and mark as processed to prevent infinite retries
        workerLogger.error(
          { error, messageId, from },
          'Unexpected error during message processing'
        );

        // Mark as processed even on error to prevent retry loops
        await idempotencyStore.markProcessed(messageId);

        throw error;
      }
    },
    {
      connection: workerConnection as any,
      concurrency: MAX_CONCURRENT_JOBS,
    }
  );

  // Attach event handlers
  worker.on('completed', (job, result) => {
    logger.info(
      {
        jobId: job.id,
        messageId: job.data.messageId,
        from: job.data.from,
        success: result.success,
      },
      'Job completed'
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        messageId: job?.data.messageId,
        from: job?.data.from,
        error,
      },
      'Job failed'
    );
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'Worker error');
  });

  logger.info(
    { concurrency: MAX_CONCURRENT_JOBS, queue: QUEUE_NAME },
    'BullMQ worker created'
  );

  return worker;
}
