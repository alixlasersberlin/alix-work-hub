
ALTER TABLE public.ac_user_presence
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_queue_id uuid;

CREATE TABLE IF NOT EXISTS public.ac_pbx_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  extension text,
  strategy text NOT NULL DEFAULT 'ringall' CHECK (strategy IN ('ringall','roundrobin','leastrecent','skills','priority')),
  required_skills text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_queues TO authenticated;
GRANT ALL ON public.ac_pbx_queues TO service_role;
ALTER TABLE public.ac_pbx_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queues read staff" ON public.ac_pbx_queues FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Order'));
CREATE POLICY "queues write admin" ON public.ac_pbx_queues FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_pbx_queue_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.ac_pbx_queues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  priority int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_queue_agents TO authenticated;
GRANT ALL ON public.ac_pbx_queue_agents TO service_role;
ALTER TABLE public.ac_pbx_queue_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa read staff" ON public.ac_pbx_queue_agents FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Order') OR user_id = auth.uid());
CREATE POLICY "qa write admin" ON public.ac_pbx_queue_agents FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_qa_queue ON public.ac_pbx_queue_agents(queue_id);
CREATE INDEX IF NOT EXISTS idx_qa_user ON public.ac_pbx_queue_agents(user_id);

DROP TRIGGER IF EXISTS trg_ac_pbx_queues_upd ON public.ac_pbx_queues;
CREATE TRIGGER trg_ac_pbx_queues_upd BEFORE UPDATE ON public.ac_pbx_queues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_user_presence; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_pbx_queue_agents; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
