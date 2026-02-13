-- Initial schema for Family Coordinator

-- Conversations table: tracks current conversation state per phone number
CREATE TABLE IF NOT EXISTS conversations (
  phone_number VARCHAR(20) PRIMARY KEY,
  current_intent VARCHAR(50),
  pending_entities JSONB DEFAULT '{}'::JSONB,
  message_history JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for TTL queries (finding stale conversations)
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at);

-- Message log: immutable audit trail of all messages
CREATE TABLE IF NOT EXISTS message_log (
  id SERIAL PRIMARY KEY,
  whatsapp_message_id VARCHAR(100) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'incoming' or 'outgoing'
  message_type VARCHAR(20) NOT NULL, -- 'text', 'image', etc.
  content TEXT,
  intent VARCHAR(50),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for message log queries
CREATE INDEX IF NOT EXISTS idx_message_log_phone
  ON message_log(phone_number);

CREATE INDEX IF NOT EXISTS idx_message_log_whatsapp_id
  ON message_log(whatsapp_message_id);
