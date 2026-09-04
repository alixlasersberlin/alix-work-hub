-- CAPA 2.0: additive extension of existing CAPA module
ALTER TABLE public.capas
  ADD COLUMN IF NOT EXISTS current_step smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'mittel',
  -- Step 1
  ADD COLUMN IF NOT EXISTS complaint_number text,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_ref text,
  ADD COLUMN IF NOT EXISTS udi text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS patient_affected text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS health_consequences text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS market text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS product_secured text,
  ADD COLUMN IF NOT EXISTS product_secured_reason text,
  -- Step 2
  ADD COLUMN IF NOT EXISTS immediate_danger text,
  ADD COLUMN IF NOT EXISTS containment_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correction_text text,
  -- Step 3
  ADD COLUMN IF NOT EXISTS vigilance_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vigilance_result text,
  ADD COLUMN IF NOT EXISTS vigilance_rule_code text,
  ADD COLUMN IF NOT EXISTS vigilance_deadline_date date,
  ADD COLUMN IF NOT EXISTS vigilance_preliminary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vigilance_approved_by uuid,
  ADD COLUMN IF NOT EXISTS vigilance_approved_at timestamptz,
  -- Step 4
  ADD COLUMN IF NOT EXISTS investigation jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Step 5
  ADD COLUMN IF NOT EXISTS scope_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scope_result text,
  -- Step 6
  ADD COLUMN IF NOT EXISTS pms_assessment text,
  ADD COLUMN IF NOT EXISTS pms_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Step 7
  ADD COLUMN IF NOT EXISTS capa_required boolean,
  ADD COLUMN IF NOT EXISTS decision_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS no_capa_reason text,
  ADD COLUMN IF NOT EXISTS no_capa_risk text,
  ADD COLUMN IF NOT EXISTS decision_by uuid,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_approved_by uuid,
  ADD COLUMN IF NOT EXISTS decision_approved_at timestamptz,
  -- Step 8
  ADD COLUMN IF NOT EXISTS rca_method text,
  ADD COLUMN IF NOT EXISTS rca_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS failure_mode text,
  ADD COLUMN IF NOT EXISTS direct_cause text,
  ADD COLUMN IF NOT EXISTS root_cause_kind text,
  ADD COLUMN IF NOT EXISTS root_cause_status text,
  ADD COLUMN IF NOT EXISTS root_cause_note text,
  -- Step 9
  ADD COLUMN IF NOT EXISTS risk_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_decision text,
  ADD COLUMN IF NOT EXISTS risk_evidence text,
  -- Step 11
  ADD COLUMN IF NOT EXISTS fsca_affected boolean,
  ADD COLUMN IF NOT EXISTS fsca jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fsca_released_by uuid,
  ADD COLUMN IF NOT EXISTS fsca_released_at timestamptz,
  -- Step 12
  ADD COLUMN IF NOT EXISTS eff_criterion text,
  ADD COLUMN IF NOT EXISTS eff_method text,
  ADD COLUMN IF NOT EXISTS eff_period text,
  ADD COLUMN IF NOT EXISTS eff_start date,
  ADD COLUMN IF NOT EXISTS eff_check_date date,
  ADD COLUMN IF NOT EXISTS eff_responsible_id uuid,
  ADD COLUMN IF NOT EXISTS eff_target text,
  ADD COLUMN IF NOT EXISTS eff_actual text,
  ADD COLUMN IF NOT EXISTS eff_evidence text,
  ADD COLUMN IF NOT EXISTS eff_result text,
  -- Closure
  ADD COLUMN IF NOT EXISTS closure_summary text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.capa_actions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS root_cause_ref text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS expected_result text,
  ADD COLUMN IF NOT EXISTS adverse_impact text,
  ADD COLUMN IF NOT EXISTS adverse_impact_note text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Step state
CREATE TABLE IF NOT EXISTS public.capa_step_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capas(id) ON DELETE CASCADE,
  step_no smallint NOT NULL,
  status text NOT NULL DEFAULT 'offen',
  notes text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capa_id, step_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_step_state TO authenticated;
GRANT ALL ON public.capa_step_state TO service_role;
ALTER TABLE public.capa_step_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qm read capa steps" ON public.capa_step_state FOR SELECT TO authenticated USING (can_access_qm());
CREATE POLICY "qm insert capa steps" ON public.capa_step_state FOR INSERT TO authenticated WITH CHECK (can_access_qm());
CREATE POLICY "qm update capa steps" ON public.capa_step_state FOR UPDATE TO authenticated USING (can_access_qm()) WITH CHECK (can_access_qm());
CREATE POLICY "super admin delete capa steps" ON public.capa_step_state FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Append-only timeline / audit trail
CREATE TABLE IF NOT EXISTS public.capa_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capas(id) ON DELETE CASCADE,
  step_no smallint,
  event_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capa_timeline_capa ON public.capa_timeline(capa_id, created_at DESC);
GRANT SELECT, INSERT ON public.capa_timeline TO authenticated;
GRANT ALL ON public.capa_timeline TO service_role;
ALTER TABLE public.capa_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qm read capa timeline" ON public.capa_timeline FOR SELECT TO authenticated USING (can_access_qm());
CREATE POLICY "qm insert capa timeline" ON public.capa_timeline FOR INSERT TO authenticated WITH CHECK (can_access_qm());

-- Evidence / attachments
CREATE TABLE IF NOT EXISTS public.capa_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capas(id) ON DELETE CASCADE,
  step_no smallint,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capa_attachments_capa ON public.capa_attachments(capa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_attachments TO authenticated;
GRANT ALL ON public.capa_attachments TO service_role;
ALTER TABLE public.capa_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qm read capa attachments" ON public.capa_attachments FOR SELECT TO authenticated USING (can_access_qm());
CREATE POLICY "qm insert capa attachments" ON public.capa_attachments FOR INSERT TO authenticated WITH CHECK (can_access_qm());
CREATE POLICY "qm update capa attachments" ON public.capa_attachments FOR UPDATE TO authenticated USING (can_access_qm()) WITH CHECK (can_access_qm());
CREATE POLICY "super admin delete capa attachments" ON public.capa_attachments FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Administratively maintainable vigilance deadline rules
CREATE TABLE IF NOT EXISTS public.capa_vigilance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  days smallint NOT NULL,
  description text,
  sort_order smallint NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_vigilance_rules TO authenticated;
GRANT ALL ON public.capa_vigilance_rules TO service_role;
ALTER TABLE public.capa_vigilance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qm read vigilance rules" ON public.capa_vigilance_rules FOR SELECT TO authenticated USING (can_access_qm());
CREATE POLICY "admin manage vigilance rules" ON public.capa_vigilance_rules FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin')) WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

INSERT INTO public.capa_vigilance_rules (code, label, days, description, sort_order)
VALUES
  ('serious_public_health', 'Schwerwiegende Gefahr für die öffentliche Gesundheit', 2, 'Meldung unverzüglich, spätestens 2 Tage', 10),
  ('death_or_serious_deterioration', 'Tod oder schwerwiegende Verschlechterung des Gesundheitszustands', 10, 'Meldung spätestens 10 Tage', 20),
  ('other_reportable', 'Sonstiges meldepflichtiges schwerwiegendes Vorkommnis', 15, 'Meldung spätestens 15 Tage', 30)
ON CONFLICT (code) DO NOTHING;

CREATE TRIGGER trg_capa_step_state_updated BEFORE UPDATE ON public.capa_step_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_capa_vigilance_rules_updated BEFORE UPDATE ON public.capa_vigilance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();