/**
 * WhatsApp Webhook Signature Validation
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks#verify-the-webhook-signature
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validate WhatsApp webhook signature using HMAC-SHA256
 *
 * @param rawBody - Raw request body buffer (must be unmodified)
 * @param signatureHeader - X-Hub-Signature-256 header value (e.g., "sha256=abc123...")
 * @param appSecret - WhatsApp app secret from Meta developer console
 * @returns true if signature is valid, false otherwise
 *
 * Security notes:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Signature is computed on the raw body bytes (not re-serialized JSON)
 * - Missing signature or length mismatch returns false (fail-safe)
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  // Missing signature header - reject immediately
  if (!signatureHeader) {
    return false;
  }

  // Compute expected HMAC-SHA256 signature
  const expectedSignature = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Extract signature from header (format: "sha256=<hex>")
  const receivedSignature = signatureHeader.replace('sha256=', '');

  // Convert to buffers for timing-safe comparison
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(receivedSignature, 'hex');

  // Length mismatch - reject immediately (prevents timingSafeEqual error)
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
