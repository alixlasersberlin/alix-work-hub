
-- Helper: ensure updated_at trigger fn exists (reuse pattern)
CREATE OR REPLACE FUNCTION public.qm_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- iso_audits
-- ============================================================
CREATE TABLE public.iso_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number text,
  title text NOT NULL,
  audit_type text NOT NULL DEFAULT 'internal', -- internal | external | supplier | regulatory
  standard text NOT NULL DEFAULT 'ISO 13485',  -- ISO 13485 | MDR | ISO 9001 | ...
  scope text,
  auditor text,
  audit_date date,
  status text NOT NULL DEFAULT 'geplant',      -- geplant | laufend | abgeschlossen | nachbearbeitung
  result text,                                  -- bestanden | mit_abweichungen | nicht_bestanden
  summary text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_audits TO authenticated;
GRANT ALL ON public.iso_audits TO service_role;
ALTER TABLE public.iso_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_audits read" ON public.iso_audits FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "iso_audits insert" ON public.iso_audits FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_audits update" ON public.iso_audits FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_audits delete" ON public.iso_audits FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_audits_updated BEFORE UPDATE ON public.iso_audits FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- iso_audit_findings_ext (extended findings; existing audit_findings stays untouched)
-- ============================================================
CREATE TABLE public.iso_audit_findings_ext (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.iso_audits(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'minor',   -- critical | major | minor | observation
  description text NOT NULL,
  clause text,
  responsible uuid,
  due_date date,
  status text NOT NULL DEFAULT 'offen',     -- offen | in_bearbeitung | geschlossen
  capa_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_audit_findings_ext TO authenticated;
GRANT ALL ON public.iso_audit_findings_ext TO service_role;
ALTER TABLE public.iso_audit_findings_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_findings_ext read" ON public.iso_audit_findings_ext FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "iso_findings_ext insert" ON public.iso_audit_findings_ext FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_findings_ext update" ON public.iso_audit_findings_ext FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_findings_ext delete" ON public.iso_audit_findings_ext FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_findings_ext_updated BEFORE UPDATE ON public.iso_audit_findings_ext FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- iso_trainings
-- ============================================================
CREATE TABLE public.iso_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  standard text,                              -- ISO 13485, MDR, MPDG, ...
  is_mandatory boolean NOT NULL DEFAULT false,
  validity_months integer,                    -- e.g. 12 = jährlich
  target_roles text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_trainings TO authenticated;
GRANT ALL ON public.iso_trainings TO service_role;
ALTER TABLE public.iso_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_trainings read" ON public.iso_trainings FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "iso_trainings insert" ON public.iso_trainings FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_trainings update" ON public.iso_trainings FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_trainings delete" ON public.iso_trainings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_trainings_updated BEFORE UPDATE ON public.iso_trainings FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- iso_training_records
-- ============================================================
CREATE TABLE public.iso_training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.iso_trainings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at date NOT NULL DEFAULT current_date,
  expires_at date,
  score numeric,
  certificate_path text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_training_records TO authenticated;
GRANT ALL ON public.iso_training_records TO service_role;
ALTER TABLE public.iso_training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_training_records read" ON public.iso_training_records FOR SELECT TO authenticated USING (public.can_access_qm() OR user_id = auth.uid());
CREATE POLICY "iso_training_records insert" ON public.iso_training_records FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_training_records update" ON public.iso_training_records FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_training_records delete" ON public.iso_training_records FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_training_records_updated BEFORE UPDATE ON public.iso_training_records FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- iso_supplier_evaluations
-- ============================================================
CREATE TABLE public.iso_supplier_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid,
  supplier_name text NOT NULL,
  evaluation_year integer NOT NULL,
  quality_score numeric,            -- 0-100
  delivery_score numeric,
  service_score numeric,
  overall_score numeric,
  classification text,              -- A | B | C | gesperrt
  remarks text,
  evaluated_by uuid,
  evaluated_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_name, evaluation_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_supplier_evaluations TO authenticated;
GRANT ALL ON public.iso_supplier_evaluations TO service_role;
ALTER TABLE public.iso_supplier_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_supplier_eval read" ON public.iso_supplier_evaluations FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "iso_supplier_eval insert" ON public.iso_supplier_evaluations FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_supplier_eval update" ON public.iso_supplier_evaluations FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_supplier_eval delete" ON public.iso_supplier_evaluations FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_supplier_eval_updated BEFORE UPDATE ON public.iso_supplier_evaluations FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- iso_change_controls
-- ============================================================
CREATE TABLE public.iso_change_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_number text,
  title text NOT NULL,
  area text,                        -- Produkt | Prozess | Dokument | Lieferant | IT
  description text,
  reason text,
  risk_class text,                  -- niedrig | mittel | hoch
  status text NOT NULL DEFAULT 'eingereicht', -- eingereicht | bewertung | genehmigt | abgelehnt | umgesetzt | geschlossen
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  effective_date date,
  impact_assessment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_change_controls TO authenticated;
GRANT ALL ON public.iso_change_controls TO service_role;
ALTER TABLE public.iso_change_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_changes read" ON public.iso_change_controls FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "iso_changes insert" ON public.iso_change_controls FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_changes update" ON public.iso_change_controls FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "iso_changes delete" ON public.iso_change_controls FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_iso_changes_updated BEFORE UPDATE ON public.iso_change_controls FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();

-- ============================================================
-- mdr_vigilance_reports
-- ============================================================
CREATE TABLE public.mdr_vigilance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text,
  device_name text,
  serial_number text,
  udi text,
  incident_date date,
  reported_at date NOT NULL DEFAULT current_date,
  severity text NOT NULL DEFAULT 'gering', -- gering | mittel | schwer | tödlich
  incident_description text NOT NULL,
  patient_harm boolean NOT NULL DEFAULT false,
  immediate_action text,
  root_cause text,
  authority_status text NOT NULL DEFAULT 'intern', -- intern | gemeldet | rückfrage | abgeschlossen
  authority_reference text,
  reported_by uuid,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mdr_vigilance_reports TO authenticated;
GRANT ALL ON public.mdr_vigilance_reports TO service_role;
ALTER TABLE public.mdr_vigilance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdr_vigilance read" ON public.mdr_vigilance_reports FOR SELECT TO authenticated USING (public.can_access_qm());
CREATE POLICY "mdr_vigilance insert" ON public.mdr_vigilance_reports FOR INSERT TO authenticated WITH CHECK (public.can_access_qm());
CREATE POLICY "mdr_vigilance update" ON public.mdr_vigilance_reports FOR UPDATE TO authenticated USING (public.can_access_qm()) WITH CHECK (public.can_access_qm());
CREATE POLICY "mdr_vigilance delete" ON public.mdr_vigilance_reports FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_mdr_vigilance_updated BEFORE UPDATE ON public.mdr_vigilance_reports FOR EACH ROW EXECUTE FUNCTION public.qm_set_updated_at();
