-- Restrict Realtime broadcast/presence subscriptions.
-- This app uses postgres_changes (table RLS already governs access) and does
-- not rely on Realtime broadcast or presence channels, so deny by default.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny all realtime broadcast" ON realtime.messages;
CREATE POLICY "deny all realtime broadcast"
ON realtime.messages
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);