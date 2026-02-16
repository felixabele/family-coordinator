-- Widen phone_number columns to support Signal UUIDs (36 chars)
-- Signal may identify senders by UUID instead of phone number

ALTER TABLE conversations
  ALTER COLUMN phone_number TYPE VARCHAR(40);

ALTER TABLE message_log
  ALTER COLUMN phone_number TYPE VARCHAR(40);
