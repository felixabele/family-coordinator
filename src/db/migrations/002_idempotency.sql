-- Idempotency tracking for Signal messages
-- Prevents duplicate message processing when Signal retries delivery

CREATE TABLE IF NOT EXISTS processed_messages (
  message_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries (delete old records)
CREATE INDEX idx_processed_messages_processed_at ON processed_messages (processed_at);
