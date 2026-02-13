/**
 * State Management Types
 */

/**
 * Message history entry for conversation context
 */
export interface MessageHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Conversation state persisted in PostgreSQL
 *
 * Tracks ongoing conversations per phone number to support multi-turn
 * interactions and intent refinement across messages.
 */
export interface ConversationState {
  /** Phone number identifier (E.164 format) */
  phoneNumber: string;

  /** The active intent being refined across messages (e.g., 'create_event') */
  currentIntent: string | null;

  /** Partial entities collected across multiple messages */
  pendingEntities: Record<string, unknown>;

  /** Recent message history for LLM context (limited to MAX_HISTORY_MESSAGES) */
  messageHistory: MessageHistoryEntry[];

  /** Timestamp of last message (for session expiry) */
  lastMessageAt: Date;
}
