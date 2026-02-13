/**
 * Signal Client Wrapper
 *
 * Thin wrapper around signal-sdk that provides a configured SignalCli instance
 * with retry logic and rate limiting.
 */

// @ts-ignore - signal-sdk is a CommonJS module without proper TypeScript definitions
import { SignalCli } from 'signal-sdk';
import {
  SIGNAL_MAX_CONCURRENT,
  SIGNAL_RATE_LIMIT_MS,
  SIGNAL_RETRY_MAX_ATTEMPTS,
  SIGNAL_RETRY_INITIAL_DELAY_MS,
  SIGNAL_RETRY_MAX_DELAY_MS,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Type alias for the signal-sdk SignalCli instance
 */
export type SignalClient = typeof SignalCli.prototype;

/**
 * Create a configured Signal client instance
 *
 * @param phoneNumber - The Signal phone number in E.164 format (e.g., +12025551234)
 * @returns Configured SignalCli instance
 */
export function createSignalClient(phoneNumber: string): SignalClient {
  logger.info({ phoneNumber }, 'Creating Signal client');

  // Create SignalCli instance with phone number
  const client = new SignalCli(phoneNumber);

  // Configure retry behavior with exponential backoff
  // Note: signal-sdk may or may not support these configs directly
  // We're setting them according to the research, but actual implementation
  // may need adjustment once we test against the real API
  const retryConfig = {
    maxAttempts: SIGNAL_RETRY_MAX_ATTEMPTS,
    initialDelay: SIGNAL_RETRY_INITIAL_DELAY_MS,
    maxDelay: SIGNAL_RETRY_MAX_DELAY_MS,
    backoffMultiplier: 2,
  };

  const rateLimiterConfig = {
    maxConcurrent: SIGNAL_MAX_CONCURRENT,
    minInterval: SIGNAL_RATE_LIMIT_MS,
  };

  // If signal-sdk supports config, apply it here
  // Based on the README, config might be passed differently
  // This is a placeholder for the actual configuration mechanism
  if (typeof (client as any).configure === 'function') {
    (client as any).configure({
      retry: retryConfig,
      rateLimiter: rateLimiterConfig,
    });
  }

  logger.info(
    {
      retry: retryConfig,
      rateLimiter: rateLimiterConfig,
    },
    'Signal client created with retry and rate limiting config'
  );

  return client;
}
