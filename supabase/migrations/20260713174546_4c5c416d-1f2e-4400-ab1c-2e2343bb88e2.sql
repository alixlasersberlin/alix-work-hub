
-- 1) ticket_history: actor_label -> actor_name
ALTER TABLE public.ticket_history RENAME COLUMN actor_label TO actor_name;

-- 2) system_maintenance: allow anon + authenticated to read status
DROP POLICY IF EXISTS "Internal staff can read maintenance status" ON public.system_maintenance;
CREATE POLICY "Anyone can read maintenance status"
  ON public.system_maintenance FOR SELECT
  TO anon, authenticated
  USING (true);
GRANT SELECT ON public.system_maintenance TO anon;
