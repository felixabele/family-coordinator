/**
 * Signal Message Type Definitions
 */

/**
 * SignalEnvelope - the outer message envelope from signal-cli
 */
export interface SignalEnvelope {
  source: string; // Sender phone number (E.164)
  sourceNumber: string; // Same as source
  sourceName?: string; // Sender's Signal profile name
  timestamp: number; // Unix epoch milliseconds (unique message ID)
  dataMessage?: SignalDataMessage;
  syncMessage?: unknown; // Ignore sync messages
  typingMessage?: unknown; // Ignore typing indicators
}

/**
 * SignalDataMessage - the actual message content
 */
export interface SignalDataMessage {
  message: string | null; // Text content (null for media-only)
  timestamp: number;
  groupInfo?: {
    groupId: string;
    type: string;
  };
  attachments?: SignalAttachment[];
}

/**
 * SignalAttachment - for future media support
 */
export interface SignalAttachment {
  contentType: string;
  filename?: string;
  size: number;
}

/**
 * SignalIncomingMessage - our processed internal type
 */
export interface SignalIncomingMessage {
  messageId: string; // envelope.timestamp.toString()
  phoneNumber: string; // envelope.source (E.164)
  senderName?: string; // envelope.sourceName
  text: string; // dataMessage.message
  timestamp: Date; // new Date(envelope.timestamp)
  isGroup: boolean; // !!dataMessage.groupInfo
  groupId?: string; // dataMessage.groupInfo?.groupId
}
