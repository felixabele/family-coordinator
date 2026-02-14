/**
 * Signal Client Wrapper
 *
 * Thin wrapper around signal-sdk that provides a configured SignalCli instance
 * with retry logic and rate limiting.
 */

// @ts-ignore - signal-sdk is a CommonJS module without proper TypeScript definitions
import { SignalCli } from "signal-sdk";
import {
  SIGNAL_MAX_CONCURRENT,
  SIGNAL_RATE_LIMIT_MS,
  SIGNAL_RETRY_MAX_ATTEMPTS,
  SIGNAL_RETRY_INITIAL_DELAY_MS,
  SIGNAL_RETRY_MAX_DELAY_MS,
} from "../config/constants.js";
import { logger } from "../utils/logger.js";

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
  logger.info({ phoneNumber }, "Creating Signal client");

  // Use system-installed signal-cli (e.g. via brew) instead of the bundled one
  const signalCliPath = process.env.SIGNAL_CLI_PATH || "signal-cli";

  // Create SignalCli instance with path, phone number, and config
  const client = new SignalCli(signalCliPath, phoneNumber, {
    maxConcurrentRequests: SIGNAL_MAX_CONCURRENT,
    minRequestInterval: SIGNAL_RATE_LIMIT_MS,
  });

  logger.info(
    {
      signalCliPath,
      maxConcurrent: SIGNAL_MAX_CONCURRENT,
      minInterval: SIGNAL_RATE_LIMIT_MS,
    },
    "Signal client created",
  );

  return client;
}
