/**
 * Application Constants
 */

// Session and message processing
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const PROCESSED_MESSAGE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
export const MAX_HISTORY_MESSAGES = 5; // messages sent to LLM context

// Signal client configuration
export const SIGNAL_MAX_CONCURRENT = 5; // concurrent message processing limit
export const SIGNAL_RATE_LIMIT_MS = 200; // minimum interval between Signal API calls
export const SIGNAL_RETRY_MAX_ATTEMPTS = 3;
export const SIGNAL_RETRY_INITIAL_DELAY_MS = 1000;
export const SIGNAL_RETRY_MAX_DELAY_MS = 10000;
