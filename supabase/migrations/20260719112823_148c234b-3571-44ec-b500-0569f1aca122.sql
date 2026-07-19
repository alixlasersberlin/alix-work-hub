
ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS match_score int,
  ADD COLUMN IF NOT EXISTS match_confidence text,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS match_candidates jsonb,
  ADD COLUMN IF NOT EXISTS matched_by uuid;

CREATE INDEX IF NOT EXISTS idx_alixdocs_match_confidence
  ON public.alixdocs_documents(match_confidence);

CREATE TABLE IF NOT EXISTS public.alixdocs_match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  chosen_entity_type text NOT NULL,
  chosen_entity_id uuid,
  rejected_candidates jsonb,
  match_score_before int,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_match_feedback TO authenticated;
GRANT ALL ON public.alixdocs_match_feedback TO service_role;
ALTER TABLE public.alixdocs_match_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read feedback" ON public.alixdocs_match_feedback
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "internal insert feedback" ON public.alixdocs_match_feedback
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_user());

CREATE TABLE IF NOT EXISTS public.alixdocs_matching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  field text NOT NULL CHECK (field IN ('filename','ocr','email_sender')),
  target_type text NOT NULL,
  target_id uuid,
  target_category_id uuid,
  weight_bonus int NOT NULL DEFAULT 30,
  hit_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_matching_rules TO authenticated;
GRANT ALL ON public.alixdocs_matching_rules TO service_role;
ALTER TABLE public.alixdocs_matching_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read rules" ON public.alixdocs_matching_rules
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "admin manage rules" ON public.alixdocs_matching_rules
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.alixdocs_smart_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weights jsonb NOT NULL DEFAULT '{
    "order_number":100,"serial_number":90,"customer_number":80,
    "email":70,"phone":60,"company":50,"name":40,
    "address":35,"device_name":25,"invoice_number":20
  }'::jsonb,
  auto_assign_threshold int NOT NULL DEFAULT 95,
  suggest_threshold int NOT NULL DEFAULT 60,
  auto_assign_gap int NOT NULL DEFAULT 20,
  blacklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.alixdocs_smart_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.alixdocs_smart_config TO authenticated;
GRANT ALL ON public.alixdocs_smart_config TO service_role;
ALTER TABLE public.alixdocs_smart_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read config" ON public.alixdocs_smart_config
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "admin update config" ON public.alixdocs_smart_config
  FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
