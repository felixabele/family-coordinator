/**
 * Custom Error Classes
 */

export class SignalConnectionError extends Error {
  code = 'SIGNAL_CONNECTION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'SignalConnectionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SignalSendError extends Error {
  code = 'SIGNAL_SEND_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'SignalSendError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class MessageProcessingError extends Error {
  code = 'MESSAGE_PROCESSING_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'MessageProcessingError';
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
