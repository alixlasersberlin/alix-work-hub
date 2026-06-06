
-- ===== ai_service_analyses =====
CREATE TABLE public.ai_service_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid,
  repair_id uuid,
  serial_number text,
  device_name text,
  error_description text,
  probable_cause text,
  confidence_score numeric,
  recommended_steps jsonb,
  recommended_repair text,
  recommended_parts jsonb,
  estimated_diagnosis_time_minutes integer,
  estimated_repair_time_minutes integer,
  estimated_total_time_minutes integer,
  recommended_technician text,
  ai_model text,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_service_analyses_ticket ON public.ai_service_analyses(ticket_id);
CREATE INDEX idx_ai_service_analyses_repair ON public.ai_service_analyses(repair_id);
CREATE INDEX idx_ai_service_analyses_serial ON public.ai_service_analyses(serial_number);
CREATE INDEX idx_ai_service_analyses_created ON public.ai_service_analyses(created_at DESC);

GRANT SELECT, INSERT ON public.ai_service_analyses TO authenticated;
GRANT ALL ON public.ai_service_analyses TO service_role;

ALTER TABLE public.ai_service_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Service read"
  ON public.ai_service_analyses FOR SELECT TO authenticated
  USING (public.can_access_ai_service());

CREATE POLICY "AI Service insert"
  ON public.ai_service_analyses FOR INSERT TO authenticated
  WITH CHECK (public.can_run_ai_service());

CREATE POLICY "AI Service delete super admin"
  ON public.ai_service_analyses FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ===== ai_service_logs =====
CREATE TABLE public.ai_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  payload jsonb,
  result jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_service_logs_action ON public.ai_service_logs(action);
CREATE INDEX idx_ai_service_logs_created ON public.ai_service_logs(created_at DESC);

GRANT SELECT ON public.ai_service_logs TO authenticated;
GRANT ALL ON public.ai_service_logs TO service_role;

ALTER TABLE public.ai_service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Service logs admin read"
  ON public.ai_service_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- ===== service_knowledge_base – additive English fields =====
ALTER TABLE public.service_knowledge_base
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS symptom_en text,
  ADD COLUMN IF NOT EXISTS probable_cause text,
  ADD COLUMN IF NOT EXISTS solution text,
  ADD COLUMN IF NOT EXISTS recommended_parts jsonb,
  ADD COLUMN IF NOT EXISTS estimated_work_time_minutes integer,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_reference_id text;
