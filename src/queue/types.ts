/**
 * BullMQ Job Types
 */

/**
 * Data passed to message processing jobs
 * Matches ParsedMessage from webhook/types.ts
 */
export interface MessageJobData {
  messageId: string;
  from: string;
  timestamp: string;
  type: string;
  text: string | null;
  senderName: string | null;
}

/**
 * Result returned from message processing jobs
 */
export interface MessageJobResult {
  success: boolean;
  responseText?: string;
  error?: string;
}
