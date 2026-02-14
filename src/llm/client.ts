/**
 * Anthropic SDK Client Factory
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Creates an Anthropic SDK client instance
 *
 * @param apiKey - Anthropic API key (should be validated from env)
 * @returns Initialized Anthropic client
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: "https://api.anthropic.com",
  });
}
