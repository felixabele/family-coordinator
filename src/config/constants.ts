/**
 * Application Constants
 */

// Session and message processing
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const PROCESSED_MESSAGE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
export const MAX_HISTORY_MESSAGES = 5; // messages sent to LLM context

// WhatsApp API
export const WHATSAPP_API_VERSION = 'v21.0';

// Queue processing
export const QUEUE_NAME = 'whatsapp-messages';
export const MAX_CONCURRENT_JOBS = 3;
