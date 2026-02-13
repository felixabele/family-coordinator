/**
 * Custom Error Classes
 */

export class WebhookValidationError extends Error {
  code = 'WEBHOOK_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'WebhookValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class WhatsAppApiError extends Error {
  code = 'WHATSAPP_API_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class IntentExtractionError extends Error {
  code = 'INTENT_EXTRACTION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'IntentExtractionError';
    Error.captureStackTrace(this, this.constructor);
  }
}
