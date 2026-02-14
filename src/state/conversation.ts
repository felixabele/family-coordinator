/**
 * PostgreSQL-backed Conversation State Management
 */

import type { Pool } from "pg";
import { logger } from "../utils/logger.js";
import { MAX_HISTORY_MESSAGES } from "../config/constants.js";
import { ConversationState, MessageHistoryEntry } from "./types.js";

/**
 * Conversation store for managing persistent conversation state
 *
 * Stores conversation state in PostgreSQL with automatic session expiry
 * after 30 minutes of inactivity.
 */
export class ConversationStore {
  constructor(private readonly pool: Pool) {}

  /**
   * Get conversation state for a phone number
   *
   * Returns null if no active session exists (expired or never existed).
   * Sessions expire after 30 minutes of inactivity.
   *
   * @param phoneNumber - Phone number in E.164 format
   * @returns ConversationState or null if expired/nonexistent
   */
  async getState(phoneNumber: string): Promise<ConversationState | null> {
    logger.debug({ phoneNumber }, "Fetching conversation state");

    const result = await this.pool.query(
      `SELECT phone_number, current_intent, pending_entities, message_history, last_message_at
       FROM conversations
       WHERE phone_number = $1
         AND last_message_at > NOW() - INTERVAL '30 minutes'`,
      [phoneNumber],
    );

    if (result.rows.length === 0) {
      logger.debug({ phoneNumber }, "No active conversation found");
      return null;
    }

    const row = result.rows[0];

    const state: ConversationState = {
      phoneNumber: row.phone_number,
      currentIntent: row.current_intent,
      pendingEntities: row.pending_entities || {},
      messageHistory: row.message_history || [],
      lastMessageAt: new Date(row.last_message_at),
    };

    logger.debug(
      {
        phoneNumber,
        currentIntent: state.currentIntent,
        historyCount: state.messageHistory.length,
      },
      "Conversation state retrieved",
    );

    return state;
  }

  /**
   * Save conversation state
   *
   * Upserts the conversation state. Creates new conversation if it doesn't
   * exist, updates if it does. Always sets last_message_at to NOW().
   *
   * @param state - ConversationState to persist
   */
  async saveState(state: ConversationState): Promise<void> {
    logger.debug(
      {
        phoneNumber: state.phoneNumber,
        currentIntent: state.currentIntent,
      },
      "Saving conversation state",
    );

    await this.pool.query(
      `INSERT INTO conversations (phone_number, current_intent, pending_entities, message_history, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (phone_number)
       DO UPDATE SET
         current_intent = EXCLUDED.current_intent,
         pending_entities = EXCLUDED.pending_entities,
         message_history = EXCLUDED.message_history,
         last_message_at = NOW()`,
      [
        state.phoneNumber,
        state.currentIntent,
        JSON.stringify(state.pendingEntities),
        JSON.stringify(state.messageHistory),
      ],
    );

    logger.debug(
      { phoneNumber: state.phoneNumber },
      "Conversation state saved",
    );
  }

  /**
   * Clear conversation state
   *
   * Deletes the conversation state for a phone number. Used when conversation
   * completes or user sends a reset command.
   *
   * @param phoneNumber - Phone number in E.164 format
   */
  async clearState(phoneNumber: string): Promise<void> {
    logger.debug({ phoneNumber }, "Clearing conversation state");

    await this.pool.query(`DELETE FROM conversations WHERE phone_number = $1`, [
      phoneNumber,
    ]);

    logger.debug({ phoneNumber }, "Conversation state cleared");
  }

  /**
   * Add message to conversation history
   *
   * Appends a message to the history and automatically trims to
   * MAX_HISTORY_MESSAGES (keeps only the latest N entries).
   *
   * @param phoneNumber - Phone number in E.164 format
   * @param role - Message role (user or assistant)
   * @param content - Message content
   */
  async addToHistory(
    phoneNumber: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    logger.debug({ phoneNumber, role }, "Adding message to history");

    // Get current state
    const state = await this.getState(phoneNumber);

    // Initialize if no state exists
    const currentHistory = state?.messageHistory || [];
    const currentIntent = state?.currentIntent || null;
    const pendingEntities = state?.pendingEntities || {};

    // Append new message
    const newMessage: MessageHistoryEntry = { role, content };
    const updatedHistory = [...currentHistory, newMessage];

    // Trim to MAX_HISTORY_MESSAGES (keep only latest N)
    const trimmedHistory = updatedHistory.slice(-MAX_HISTORY_MESSAGES);

    logger.debug(
      {
        phoneNumber,
        before: updatedHistory.length,
        after: trimmedHistory.length,
        trimmed: updatedHistory.length - trimmedHistory.length,
      },
      "Message history trimmed",
    );

    // Save updated state
    await this.saveState({
      phoneNumber,
      currentIntent,
      pendingEntities,
      messageHistory: trimmedHistory,
      lastMessageAt: new Date(),
    });

    logger.debug(
      { phoneNumber, historyCount: trimmedHistory.length },
      "Message added to history",
    );
  }
}
