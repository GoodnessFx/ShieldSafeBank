-- PHASE 3: REAL-TIME CHAT TABLES
-- Additive schema changes. No DROP/TRUNCATE/DELETE on existing tables.
-- Old threads/messages/support_messages tables remain as read-only history.

-- 1) chat_conversations — one per customer
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) chat_messages — messages within a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK (from_role IN ('user','admin')),
  text TEXT NOT NULL CHECK (char_length(text) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 4) Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5) RLS policies — customer reads/writes only their own conversation
CREATE POLICY IF NOT EXISTS chat_conversations_select_own
  ON chat_conversations FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS chat_conversations_insert_own
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS chat_conversations_update_own
  ON chat_conversations FOR UPDATE
  USING (auth.uid()::text = user_id);

-- 6) RLS policies — admin reads/writes all conversations
CREATE POLICY IF NOT EXISTS chat_conversations_admin_all
  ON chat_conversations FOR ALL
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 7) RLS policies — customer reads/writes messages on their own conversation
CREATE POLICY IF NOT EXISTS chat_messages_select_own
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()::text
  ));

CREATE POLICY IF NOT EXISTS chat_messages_insert_own
  ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()::text
  ));

-- 8) RLS policies — admin reads/writes all messages
CREATE POLICY IF NOT EXISTS chat_messages_admin_all
  ON chat_messages FOR ALL
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 9) Add both tables to the Supabase Realtime publication
-- Run this SQL in the Supabase SQL Editor after creating the tables:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations, chat_messages;