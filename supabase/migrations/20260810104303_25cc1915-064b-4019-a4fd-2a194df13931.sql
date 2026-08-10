
CREATE TABLE public.plm_sw_soup (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  soup_code text, name text not null, vendor text, version text, license text,
  purpose text, functional_requirements text, hardware_requirements text,
  safety_class text, known_anomalies text, anomaly_evaluation text,
  risk_assessment text, verification text, update_strategy text,
  eol_date date, source_url text, status text default 'in_pruefung',
  responsible text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_plans (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  plan_code text, plan_kind text default 'development_plan', title text not null,
  version text, scope text, lifecycle_model text, deliverables text, activities text,
  roles_responsibilities text, tools_environment text, configuration_items text,
  change_control text, problem_resolution text, maintenance_strategy text,
  file_path text, status text default 'entwurf', approved_by text, approved_at date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_anomalies (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  release_id uuid references public.plm_sw_releases(id) on delete set null,
  bug_id uuid references public.plm_sw_bugs(id) on delete set null,
  anomaly_code text, title text not null, description text,
  severity text default 'niedrig', safety_relevant boolean default false,
  risk_evaluation text, workaround text, planned_fix_version text,
  accepted_by text, accepted_at date, status text default 'offen', notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_problems (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  problem_code text, title text not null, description text,
  source text default 'post_market', reported_by text, reported_at date default current_date,
  serial_number text, sw_version text, severity text default 'mittel',
  safety_relevant boolean default false, vigilance_relevant boolean default false,
  investigation text, root_cause text, correction text,
  capa_id uuid references public.capas(id) on delete set null,
  bug_id uuid references public.plm_sw_bugs(id) on delete set null,
  risk_id uuid references public.plm_sw_risks(id) on delete set null,
  effectiveness_check text, closed_at date, status text default 'offen',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_risk_measures (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  risk_id uuid references public.plm_sw_risks(id) on delete set null,
  measure_code text, title text not null, measure_type text default 'software_control',
  description text,
  requirement_id uuid references public.plm_sw_requirements(id) on delete set null,
  test_id uuid references public.plm_sw_tests(id) on delete set null,
  implemented_in_version text, implemented_by text, implemented_at date,
  effectiveness_method text, effectiveness_result text,
  effectiveness_confirmed boolean default false, effectiveness_by text, effectiveness_at date,
  new_risk_introduced boolean default false, status text default 'offen', notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_classification (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  title text not null, product_safety_class text default 'B', rationale text,
  hazard_analysis_ref text, external_risk_control text, segregation_description text,
  mdr_class text, standards text, valid_from date, status text default 'entwurf',
  approved_by text, approved_at date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.plm_sw_signatures (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.plm_devices(id) on delete set null,
  entity_table text not null, entity_id uuid, entity_label text,
  meaning text not null default 'freigabe',
  signer_name text not null, signer_role text, signer_user_id uuid,
  signed_at timestamptz not null default now(),
  statement text, document_hash text, ip_address text,
  status text default 'gueltig', notes text,
  created_at timestamptz not null default now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plm_sw_soup','plm_sw_plans','plm_sw_anomalies','plm_sw_problems','plm_sw_risk_measures','plm_sw_classification','plm_sw_signatures']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.plm_can_write())', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.plm_can_write()) WITH CHECK (public.plm_can_write())', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''))', t, t);
  END LOOP;
END $$;
