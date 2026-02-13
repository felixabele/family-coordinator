/**
 * Claude Intent Extraction via Tool Use
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { MAX_HISTORY_MESSAGES } from '../config/constants.js';
import { CALENDAR_SYSTEM_PROMPT } from './prompts.js';
import {
  CalendarIntent,
  CalendarIntentSchema,
  IntentExtractionError,
} from './types.js';

/**
 * Claude tool definition for calendar intent parsing
 *
 * This tool forces Claude to return structured JSON output that matches
 * our CalendarIntent interface. Using tool_choice: 'tool' guarantees
 * we always get structured output (no free-text parsing needed).
 */
const calendarIntentTool: Anthropic.Tool = {
  name: 'parse_calendar_intent',
  description:
    'Parse a natural language message and extract calendar intent with entities',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'create_event',
          'query_events',
          'update_event',
          'delete_event',
          'greeting',
          'help',
          'unclear',
        ],
        description: 'The primary intent of the user message',
      },
      entities: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title or description',
          },
          date: {
            type: 'string',
            description: 'Event date in YYYY-MM-DD format',
          },
          time: {
            type: 'string',
            description: 'Event time in HH:MM 24-hour format',
          },
          duration_minutes: {
            type: 'number',
            description: 'Event duration in minutes',
          },
        },
        description: 'Extracted calendar entities',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score between 0 and 1',
      },
      clarification_needed: {
        type: 'string',
        description:
          'Message to user when confidence < 0.7 or entities are missing',
      },
    },
    required: ['intent', 'entities', 'confidence'],
  },
};

/**
 * Message history entry for LLM context
 */
export interface MessageHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Extracts calendar intent from natural language using Claude tool use
 *
 * @param client - Initialized Anthropic client
 * @param userMessage - The user's natural language message
 * @param conversationHistory - Optional message history for context (last N messages)
 * @returns Validated CalendarIntent with structured entities
 * @throws IntentExtractionError if extraction fails or output is invalid
 */
export async function extractIntent(
  client: Anthropic,
  userMessage: string,
  conversationHistory?: MessageHistoryEntry[]
): Promise<CalendarIntent> {
  try {
    // Build message context with current date/time for relative date resolution
    const now = new Date();
    const dateContext = `[Current date/time: ${now.toISOString()}]`;
    const userMessageWithContext = `${dateContext}\n\n${userMessage}`;

    // Build messages array from conversation history
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history (limited to MAX_HISTORY_MESSAGES)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
      for (const entry of recentHistory) {
        messages.push({
          role: entry.role,
          content: entry.content,
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessageWithContext,
    });

    logger.debug(
      {
        messageCount: messages.length,
        historyCount: conversationHistory?.length ?? 0,
      },
      'Calling Claude for intent extraction'
    );

    // Call Claude with tool use and prompt caching
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: CALENDAR_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [calendarIntentTool],
      tool_choice: {
        type: 'tool',
        name: 'parse_calendar_intent',
      },
      messages,
    });

    // Log cache metrics for monitoring
    if (response.usage) {
      const cacheReadTokens =
        'cache_read_input_tokens' in response.usage
          ? response.usage.cache_read_input_tokens ?? 0
          : 0;
      const cacheCreationTokens =
        'cache_creation_input_tokens' in response.usage
          ? response.usage.cache_creation_input_tokens ?? 0
          : 0;

      logger.info(
        {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_read_tokens: cacheReadTokens,
          cache_creation_tokens: cacheCreationTokens,
        },
        'Claude API usage metrics'
      );

      // Log cache hit/miss
      if (cacheReadTokens > 0) {
        logger.debug(
          { tokens: cacheReadTokens },
          'Prompt cache HIT (cost savings)'
        );
      } else if (cacheCreationTokens > 0) {
        logger.debug(
          { tokens: cacheCreationTokens },
          'Prompt cache MISS (cache created)'
        );
      }
    }

    // Find the tool_use block in response
    const toolUseBlock = response.content.find(
      (block) => block.type === 'tool_use'
    );

    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new IntentExtractionError(
        'No tool_use block found in Claude response'
      );
    }

    // Validate the tool input with Zod schema
    const validationResult = CalendarIntentSchema.safeParse(
      toolUseBlock.input
    );

    if (!validationResult.success) {
      logger.error(
        {
          errors: validationResult.error.issues,
          raw_input: toolUseBlock.input,
        },
        'Intent validation failed'
      );
      throw new IntentExtractionError(
        'Invalid intent structure from Claude',
        validationResult.error
      );
    }

    const intent = validationResult.data;

    logger.debug(
      {
        intent: intent.intent,
        confidence: intent.confidence,
        has_clarification: !!intent.clarification_needed,
      },
      'Intent extracted successfully'
    );

    return intent;
  } catch (error) {
    if (error instanceof IntentExtractionError) {
      throw error;
    }

    logger.error({ error }, 'Failed to extract intent from message');
    throw new IntentExtractionError(
      'Intent extraction failed',
      error as Error
    );
  }
}
