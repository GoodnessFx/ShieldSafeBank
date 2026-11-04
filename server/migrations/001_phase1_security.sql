-- PHASE 1: SECURITY
-- Additive, idempotent schema changes. No DROP/TRUNCATE/DELETE on existing tables.

-- 1) Add nullable auth_id column to users table (links to Supabase Auth uuid)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS auth_id uuid;

-- 2) Enable RLS on all 9 public tables (additive, IF NOT EXISTS pattern)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kyc_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS counters ENABLE ROW LEVEL SECURITY;

-- 3) Users: signed-in user may SELECT only their own row (auth.uid() = auth_id)
CREATE POLICY IF NOT EXISTS users_select_own
  ON users FOR SELECT
  USING (auth_id = auth.uid());

-- 4) Users: clients get NO insert/update/delete (no policy = denied by default for non-admin)
--    Admin (app_metadata.role = 'admin') may read everything
CREATE POLICY IF NOT EXISTS users_read_admin
  ON users FOR SELECT
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 5) Transactions: signed-in user may SELECT only their own transactions
CREATE POLICY IF NOT EXISTS transactions_select_own
  ON transactions FOR SELECT
  USING ((data->>'userId') = auth.uid()::text OR (data->>'userId') IS NOT NULL AND EXISTS (
    SELECT 1 FROM users WHERE users.id = (data->>'userId') AND users.auth_id = auth.uid()
  ));

-- 6) kyc_queue, threads, messages, support_messages: admin read only (no client policy = no client access)
CREATE POLICY IF NOT EXISTS kyc_queue_read_admin
  ON kyc_queue FOR SELECT
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY IF NOT EXISTS threads_read_admin
  ON threads FOR SELECT
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY IF NOT EXISTS messages_read_admin
  ON messages FOR SELECT
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY IF NOT EXISTS support_messages_read_admin
  ON support_messages FOR SELECT
  USING (auth.jwt()->>'app_metadata' ? 'role' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 7) login_events, activity_events, counters: no client access at all (no policies = denied)

-- 8) Index on auth_id for fast lookups (additive)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);