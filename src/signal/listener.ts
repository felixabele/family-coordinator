/**
 * Signal Message Listener
 *
 * Event handler for incoming Signal messages with full processing pipeline:
 * receive -> deduplicate -> state -> LLM intent extraction -> response -> send
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { SignalClient } from "./client.js";
import type { SignalEnvelope } from "./types.js";
import type { CalendarIntent } from "../llm/types.js";
import { sendSignalMessage } from "./sender.js";
import { ConversationStore } from "../state/conversation.js";
import { IdempotencyStore } from "../state/idempotency.js";
import { extractIntent } from "../llm/intent.js";
import { logger } from "../utils/logger.js";

/**
 * Dependencies for the message listener
 */
export interface MessageListenerDeps {
  signalClient: SignalClient;
  anthropicClient: Anthropic;
  conversationStore: ConversationStore;
  idempotencyStore: IdempotencyStore;
}

/**
 * Generate a response message based on extracted intent
 *
 * For Phase 1, calendar operations return stub messages indicating
 * that calendar integration is coming in Phase 2.
 *
 * @param intent - Extracted intent from LLM
 * @returns Response message text
 */
function generateResponse(intent: CalendarIntent): string {
  switch (intent.intent) {
    case "greeting":
      return "Hello! I'm your family calendar assistant. You can ask me to add events, check your schedule, or manage existing events.";

    case "help":
      return `I can help you with:
- Adding events: 'Add soccer practice Tuesday at 4pm'
- Checking schedule: 'What's on today?'
- Editing events: 'Move dentist to Thursday'
- Deleting events: 'Cancel soccer this week'`;

    case "create_event":
    case "query_events":
    case "update_event":
    case "delete_event": {
      // Format entities for display
      const entitySummary = Object.entries(intent.entities)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      const intentLabel = intent.intent.replace("_", " ");
      return `I understood you want to ${intentLabel}. Calendar integration is coming in Phase 2! For now, I can confirm I understood: ${entitySummary || "no specific details"}`;
    }

    case "unclear":
      return (
        intent.clarification_needed ||
        "I'm not sure what you mean. Could you rephrase that? You can ask me about your calendar."
      );

    default:
      return "I'm not sure how to help with that. Try asking about your calendar or say 'help' for options.";
  }
}

/**
 * Setup the Signal message listener
 *
 * Registers an event handler that:
 * 1. Receives incoming Signal messages
 * 2. Filters out non-text and group messages
 * 3. Checks idempotency to prevent duplicate processing
 * 4. Extracts intent via Claude LLM
 * 5. Generates appropriate response
 * 6. Sends response via Signal
 * 7. Manages conversation state
 *
 * Error handling ensures individual message failures don't crash the daemon.
 *
 * @param deps - Dependencies (SignalClient, Anthropic, stores)
 */
export function setupMessageListener(deps: MessageListenerDeps): void {
  logger.info("Setting up Signal message listener");

  // Register the message event handler
  // signal-sdk emits response.params which wraps envelope: { envelope: {...} }
  deps.signalClient.on("message", async (params: any) => {
    let phoneNumber: string | undefined;
    let messageId: string | undefined;

    try {
      // Log raw params to understand the structure
      logger.debug({ params: JSON.stringify(params) }, "Raw message event");

      // Extract envelope — signal-sdk wraps it in { envelope: {...} }
      const envelope: SignalEnvelope = params?.envelope || params;

      // Extract message data from envelope
      phoneNumber = envelope.source || envelope.sourceNumber;
      messageId = envelope.timestamp?.toString();
      const text = envelope.dataMessage?.message || "";

      logger.debug(
        {
          phoneNumber,
          messageId,
          hasText: !!text,
          isGroup: !!envelope.dataMessage?.groupInfo,
        },
        "Received Signal message",
      );

      // Skip if no text (media-only messages, typing indicators, sync messages)
      if (!text) {
        logger.debug({ messageId }, "Skipping message without text content");
        return;
      }

      // Skip group messages (Phase 1: direct messages only)
      if (envelope.dataMessage?.groupInfo) {
        logger.debug(
          {
            messageId,
            groupId: envelope.dataMessage.groupInfo.groupId,
          },
          "Skipping group message (not supported in Phase 1)",
        );
        return;
      }

      // Idempotency check
      const isAlreadyProcessed =
        await deps.idempotencyStore.isProcessed(messageId);

      if (isAlreadyProcessed) {
        logger.debug(
          { messageId, phoneNumber },
          "Duplicate message detected, skipping",
        );
        return;
      }

      // Mark as processed BEFORE processing to prevent race conditions
      await deps.idempotencyStore.markProcessed(messageId);

      logger.info(
        { phoneNumber, messageId, text },
        "Processing new Signal message",
      );

      // Get conversation state
      const state = await deps.conversationStore.getState(phoneNumber);

      // Add user message to history
      await deps.conversationStore.addToHistory(phoneNumber, "user", text);

      // Extract intent via Claude LLM
      const intent = await extractIntent(
        deps.anthropicClient,
        text,
        state?.messageHistory || [],
      );

      logger.info(
        {
          phoneNumber,
          intent: intent.intent,
          confidence: intent.confidence,
          hasEntities: Object.keys(intent.entities).length > 0,
        },
        "Intent extracted successfully",
      );

      // Generate response based on intent
      const response = generateResponse(intent);

      // Send response via Signal
      await sendSignalMessage(deps.signalClient, phoneNumber, response);

      // Add assistant response to history
      await deps.conversationStore.addToHistory(
        phoneNumber,
        "assistant",
        response,
      );

      logger.info(
        { phoneNumber, messageId, intent: intent.intent },
        "Message processed successfully",
      );
    } catch (error) {
      logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          phoneNumber,
          messageId,
        },
        "Error processing Signal message",
      );

      // Attempt to send error response to user
      if (phoneNumber) {
        try {
          await sendSignalMessage(
            deps.signalClient,
            phoneNumber,
            "Sorry, I had trouble processing your message. Please try again.",
          );
        } catch (sendError) {
          logger.error(
            {
              err:
                sendError instanceof Error
                  ? sendError
                  : new Error(String(sendError)),
              phoneNumber,
            },
            "Failed to send error response to user",
          );
        }
      }

      // Do NOT re-throw - event handlers should not crash the daemon
    }
  });

  logger.info("Signal message listener setup complete");
}
