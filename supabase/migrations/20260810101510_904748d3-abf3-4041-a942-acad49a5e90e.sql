-- ALIX SOFTWARE COMPLIANCE (IEC 62304) — Software Documentation & Traceability Center

CREATE TABLE public.plm_sw_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  unit_code text,
  name text NOT NULL,
  description text,
  version text,
  safety_class text DEFAULT 'B',
  owner text,
  source_location text,
  inputs text,
  outputs text,
  dependencies text,
  verification_status text NOT NULL DEFAULT 'offen',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_units TO authenticated;
GRANT ALL ON public.plm_sw_units TO service_role;
ALTER TABLE public.plm_sw_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_units_sel ON public.plm_sw_units FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_units_ins ON public.plm_sw_units FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_units_upd ON public.plm_sw_units FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_units_del ON public.plm_sw_units FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  req_code text,
  title text NOT NULL,
  description text,
  source text,
  priority text DEFAULT 'mittel',
  unit_id uuid REFERENCES public.plm_sw_units(id) ON DELETE SET NULL,
  verification_method text,
  acceptance_criteria text,
  status text NOT NULL DEFAULT 'entwurf',
  version text,
  responsible text,
  safety_related boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_requirements TO authenticated;
GRANT ALL ON public.plm_sw_requirements TO service_role;
ALTER TABLE public.plm_sw_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_req_sel ON public.plm_sw_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_req_ins ON public.plm_sw_requirements FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_req_upd ON public.plm_sw_requirements FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_req_del ON public.plm_sw_requirements FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  risk_code text,
  hazard text NOT NULL,
  hazardous_situation text,
  sequence_of_events text,
  potential_harm text,
  severity integer NOT NULL DEFAULT 1,
  probability integer NOT NULL DEFAULT 1,
  risk_control text,
  requirement_id uuid REFERENCES public.plm_sw_requirements(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.plm_sw_units(id) ON DELETE SET NULL,
  plm_risk_id uuid REFERENCES public.plm_risks(id) ON DELETE SET NULL,
  verification text,
  residual_severity integer,
  residual_probability integer,
  acceptable boolean NOT NULL DEFAULT false,
  responsible text,
  review_date date,
  status text NOT NULL DEFAULT 'offen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_risks TO authenticated;
GRANT ALL ON public.plm_sw_risks TO service_role;
ALTER TABLE public.plm_sw_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_risks_sel ON public.plm_sw_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_risks_ins ON public.plm_sw_risks FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_risks_upd ON public.plm_sw_risks FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_risks_del ON public.plm_sw_risks FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'verification',
  test_code text,
  test_group text,
  title text NOT NULL,
  preconditions text,
  steps text,
  expected_result text,
  actual_result text,
  result text NOT NULL DEFAULT 'offen',
  executed_confirmed boolean NOT NULL DEFAULT false,
  requirement_id uuid REFERENCES public.plm_sw_requirements(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.plm_sw_units(id) ON DELETE SET NULL,
  risk_id uuid REFERENCES public.plm_sw_risks(id) ON DELETE SET NULL,
  tester text,
  test_date date,
  sw_version text,
  hw_version text,
  evidence_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_tests TO authenticated;
GRANT ALL ON public.plm_sw_tests TO service_role;
ALTER TABLE public.plm_sw_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_tests_sel ON public.plm_sw_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_tests_ins ON public.plm_sw_tests FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_tests_upd ON public.plm_sw_tests FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_tests_del ON public.plm_sw_tests FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  version text NOT NULL,
  release_date date,
  developer text,
  git_commit text,
  firmware_hash text,
  device_compatibility text,
  changed_requirements text,
  changed_units text,
  fixed_bugs text,
  new_risks text,
  tests_required integer,
  tests_passed integer,
  approved_by text,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'entwurf',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_releases TO authenticated;
GRANT ALL ON public.plm_sw_releases TO service_role;
ALTER TABLE public.plm_sw_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_rel_sel ON public.plm_sw_releases FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_rel_ins ON public.plm_sw_releases FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_rel_upd ON public.plm_sw_releases FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_rel_del ON public.plm_sw_releases FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  bug_code text,
  title text NOT NULL,
  description text,
  sw_version text,
  unit_id uuid REFERENCES public.plm_sw_units(id) ON DELETE SET NULL,
  requirement_id uuid REFERENCES public.plm_sw_requirements(id) ON DELETE SET NULL,
  risk_id uuid REFERENCES public.plm_sw_risks(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'mittel',
  reporter text,
  reported_at date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'offen',
  root_cause text,
  capa text,
  correction text,
  verification text,
  released_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_bugs TO authenticated;
GRANT ALL ON public.plm_sw_bugs TO service_role;
ALTER TABLE public.plm_sw_bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_bugs_sel ON public.plm_sw_bugs FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_bugs_ins ON public.plm_sw_bugs FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_bugs_upd ON public.plm_sw_bugs FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_bugs_del ON public.plm_sw_bugs FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  team text NOT NULL DEFAULT 'software',
  name text NOT NULL,
  company text,
  email text,
  position text,
  is_lead boolean NOT NULL DEFAULT false,
  ide text,
  version_control text,
  versioning_scheme text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_team TO authenticated;
GRANT ALL ON public.plm_sw_team TO service_role;
ALTER TABLE public.plm_sw_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_team_sel ON public.plm_sw_team FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_team_ins ON public.plm_sw_team FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_team_upd ON public.plm_sw_team FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_team_del ON public.plm_sw_team FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_hw_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  doc_kind text NOT NULL DEFAULT 'schematic',
  title text NOT NULL,
  board text,
  version text,
  revision text,
  file_path text,
  approval_status text NOT NULL DEFAULT 'entwurf',
  released_by text,
  released_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_hw_docs TO authenticated;
GRANT ALL ON public.plm_hw_docs TO service_role;
ALTER TABLE public.plm_hw_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_hw_docs_sel ON public.plm_hw_docs FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_hw_docs_ins ON public.plm_hw_docs FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_hw_docs_upd ON public.plm_hw_docs FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_hw_docs_del ON public.plm_hw_docs FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE public.plm_sw_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.plm_devices(id) ON DELETE CASCADE,
  respondent_id text,
  survey_date date,
  serial_number text,
  sw_version text,
  original_file_path text,
  original_answers text,
  evaluation text,
  risk_signal boolean NOT NULL DEFAULT false,
  capa_required boolean NOT NULL DEFAULT false,
  software_issue boolean NOT NULL DEFAULT false,
  usability_issue boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_sw_surveys TO authenticated;
GRANT ALL ON public.plm_sw_surveys TO service_role;
ALTER TABLE public.plm_sw_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_sw_surv_sel ON public.plm_sw_surveys FOR SELECT TO authenticated USING (true);
CREATE POLICY plm_sw_surv_ins ON public.plm_sw_surveys FOR INSERT TO authenticated WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_surv_upd ON public.plm_sw_surveys FOR UPDATE TO authenticated USING (plm_can_write()) WITH CHECK (plm_can_write());
CREATE POLICY plm_sw_surv_del ON public.plm_sw_surveys FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE INDEX idx_plm_sw_units_dev ON public.plm_sw_units(device_id);
CREATE INDEX idx_plm_sw_req_dev ON public.plm_sw_requirements(device_id);
CREATE INDEX idx_plm_sw_risks_dev ON public.plm_sw_risks(device_id);
CREATE INDEX idx_plm_sw_tests_dev ON public.plm_sw_tests(device_id, kind);
CREATE INDEX idx_plm_sw_tests_req ON public.plm_sw_tests(requirement_id);
CREATE INDEX idx_plm_sw_bugs_dev ON public.plm_sw_bugs(device_id);
CREATE INDEX idx_plm_sw_rel_dev ON public.plm_sw_releases(device_id);

CREATE TRIGGER trg_plm_sw_units_upd BEFORE UPDATE ON public.plm_sw_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_req_upd BEFORE UPDATE ON public.plm_sw_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_risks_upd BEFORE UPDATE ON public.plm_sw_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_tests_upd BEFORE UPDATE ON public.plm_sw_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_rel_upd BEFORE UPDATE ON public.plm_sw_releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_bugs_upd BEFORE UPDATE ON public.plm_sw_bugs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_team_upd BEFORE UPDATE ON public.plm_sw_team FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_hw_docs_upd BEFORE UPDATE ON public.plm_hw_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plm_sw_surv_upd BEFORE UPDATE ON public.plm_sw_surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();