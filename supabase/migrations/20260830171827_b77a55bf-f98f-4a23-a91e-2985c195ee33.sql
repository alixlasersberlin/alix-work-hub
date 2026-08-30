-- 1) Profil additiv erweitern
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS compliance_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_role text,
  ADD COLUMN IF NOT EXISTS compliance_only_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_default_project_id uuid;

-- 2) Projekte
CREATE TABLE IF NOT EXISTS public.compliance_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  device_id uuid,
  status text NOT NULL DEFAULT 'active',
  safety_class text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_projects TO authenticated;
GRANT ALL ON public.compliance_projects TO service_role;
ALTER TABLE public.compliance_projects ENABLE ROW LEVEL SECURITY;

-- 3) Mitglieder
CREATE TABLE IF NOT EXISTS public.compliance_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.compliance_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'COMPLIANCE_USER',
  active boolean NOT NULL DEFAULT true,
  can_review boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_project_members TO authenticated;
GRANT ALL ON public.compliance_project_members TO service_role;
ALTER TABLE public.compliance_project_members ENABLE ROW LEVEL SECURITY;

-- 4) Helferfunktionen (SECURITY DEFINER, keine Rekursion)
CREATE OR REPLACE FUNCTION public.compliance_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin')
      OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.compliance_access = true
          AND up.compliance_role IN ('SUPERADMIN','PROJECT_MANAGER','QA_REVIEWER','REGULATORY','VALIDATION_LEAD')
      );
$$;

CREATE OR REPLACE FUNCTION public.compliance_has_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin')
      OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.compliance_access = true);
$$;

CREATE OR REPLACE FUNCTION public.compliance_is_member(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.compliance_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.compliance_project_members m
        WHERE m.project_id = _project_id AND m.user_id = auth.uid() AND m.active = true
      );
$$;

CREATE OR REPLACE FUNCTION public.compliance_can_write(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.compliance_is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.compliance_project_members m
        JOIN public.user_profiles up ON up.id = m.user_id
        WHERE m.project_id = _project_id AND m.user_id = auth.uid() AND m.active = true
          AND COALESCE(up.compliance_role,'COMPLIANCE_USER') NOT IN ('AUDITOR_READONLY','SUPPLIER_READONLY')
      );
$$;

-- 5) Policies Projekte / Mitglieder
DROP POLICY IF EXISTS cp_select ON public.compliance_projects;
CREATE POLICY cp_select ON public.compliance_projects FOR SELECT TO authenticated
  USING (public.compliance_is_member(id));
DROP POLICY IF EXISTS cp_write ON public.compliance_projects;
CREATE POLICY cp_write ON public.compliance_projects FOR ALL TO authenticated
  USING (public.compliance_is_admin()) WITH CHECK (public.compliance_is_admin());

DROP POLICY IF EXISTS cpm_select ON public.compliance_project_members;
CREATE POLICY cpm_select ON public.compliance_project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.compliance_is_member(project_id));
DROP POLICY IF EXISTS cpm_write ON public.compliance_project_members;
CREATE POLICY cpm_write ON public.compliance_project_members FOR ALL TO authenticated
  USING (public.compliance_is_admin()) WITH CHECK (public.compliance_is_admin());

-- 6) Aufgaben
CREATE TABLE IF NOT EXISTS public.compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.compliance_projects(id) ON DELETE CASCADE,
  task_no integer,
  title text NOT NULL,
  purpose text,
  category text,
  ref_codes text[] NOT NULL DEFAULT '{}',
  mandatory boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ready',
  priority text NOT NULL DEFAULT 'normal',
  progress integer NOT NULL DEFAULT 0,
  assignee_id uuid,
  reviewer_id uuid,
  due_date date,
  defer_reason text,
  defer_comment text,
  defer_until date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_comment text,
  completed_at timestamptz,
  last_saved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_tasks TO authenticated;
GRANT ALL ON public.compliance_tasks TO service_role;
ALTER TABLE public.compliance_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ct_select ON public.compliance_tasks;
CREATE POLICY ct_select ON public.compliance_tasks FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR reviewer_id = auth.uid() OR public.compliance_is_member(project_id));
DROP POLICY IF EXISTS ct_insert ON public.compliance_tasks;
CREATE POLICY ct_insert ON public.compliance_tasks FOR INSERT TO authenticated
  WITH CHECK (public.compliance_can_write(project_id));
DROP POLICY IF EXISTS ct_update ON public.compliance_tasks;
CREATE POLICY ct_update ON public.compliance_tasks FOR UPDATE TO authenticated
  USING (public.compliance_can_write(project_id) AND (assignee_id = auth.uid() OR reviewer_id = auth.uid() OR public.compliance_is_admin()))
  WITH CHECK (public.compliance_can_write(project_id));
DROP POLICY IF EXISTS ct_delete ON public.compliance_tasks;
CREATE POLICY ct_delete ON public.compliance_tasks FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 7) Aufgabenschritte
CREATE TABLE IF NOT EXISTS public.compliance_task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.compliance_tasks(id) ON DELETE CASCADE,
  step_no integer NOT NULL DEFAULT 1,
  label text NOT NULL,
  hint text,
  input_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT true,
  value text,
  file_url text,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_task_steps TO authenticated;
GRANT ALL ON public.compliance_task_steps TO service_role;
ALTER TABLE public.compliance_task_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cts_select ON public.compliance_task_steps;
CREATE POLICY cts_select ON public.compliance_task_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = task_id
    AND (t.assignee_id = auth.uid() OR t.reviewer_id = auth.uid() OR public.compliance_is_member(t.project_id))));
DROP POLICY IF EXISTS cts_write ON public.compliance_task_steps;
CREATE POLICY cts_write ON public.compliance_task_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = task_id
    AND public.compliance_can_write(t.project_id)
    AND (t.assignee_id = auth.uid() OR t.reviewer_id = auth.uid() OR public.compliance_is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = task_id
    AND public.compliance_can_write(t.project_id)));

-- 8) Lieferantenanfragen
CREATE TABLE IF NOT EXISTS public.compliance_supplier_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.compliance_projects(id) ON DELETE CASCADE,
  request_code text NOT NULL,
  topic text NOT NULL,
  requirement text,
  supplier_user_id uuid,
  status text NOT NULL DEFAULT 'open',
  answer text,
  file_url text,
  na_requested boolean NOT NULL DEFAULT false,
  na_reason text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, request_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_supplier_requests TO authenticated;
GRANT ALL ON public.compliance_supplier_requests TO service_role;
ALTER TABLE public.compliance_supplier_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csr_select ON public.compliance_supplier_requests;
CREATE POLICY csr_select ON public.compliance_supplier_requests FOR SELECT TO authenticated
  USING (supplier_user_id = auth.uid() OR public.compliance_is_member(project_id));
DROP POLICY IF EXISTS csr_insert ON public.compliance_supplier_requests;
CREATE POLICY csr_insert ON public.compliance_supplier_requests FOR INSERT TO authenticated
  WITH CHECK (public.compliance_can_write(project_id));
DROP POLICY IF EXISTS csr_update ON public.compliance_supplier_requests;
CREATE POLICY csr_update ON public.compliance_supplier_requests FOR UPDATE TO authenticated
  USING (supplier_user_id = auth.uid() OR public.compliance_can_write(project_id))
  WITH CHECK (supplier_user_id = auth.uid() OR public.compliance_can_write(project_id));
DROP POLICY IF EXISTS csr_delete ON public.compliance_supplier_requests;
CREATE POLICY csr_delete ON public.compliance_supplier_requests FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 9) Audit Trail
CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  project_id uuid,
  task_id uuid,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.compliance_audit_log TO authenticated;
GRANT ALL ON public.compliance_audit_log TO service_role;
ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cal_insert ON public.compliance_audit_log;
CREATE POLICY cal_insert ON public.compliance_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cal_select ON public.compliance_audit_log;
CREATE POLICY cal_select ON public.compliance_audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.compliance_is_admin());

-- 10) updated_at Trigger
CREATE OR REPLACE FUNCTION public.compliance_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cp_touch ON public.compliance_projects;
CREATE TRIGGER trg_cp_touch BEFORE UPDATE ON public.compliance_projects FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();
DROP TRIGGER IF EXISTS trg_cpm_touch ON public.compliance_project_members;
CREATE TRIGGER trg_cpm_touch BEFORE UPDATE ON public.compliance_project_members FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ct_touch ON public.compliance_tasks;
CREATE TRIGGER trg_ct_touch BEFORE UPDATE ON public.compliance_tasks FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();
DROP TRIGGER IF EXISTS trg_cts_touch ON public.compliance_task_steps;
CREATE TRIGGER trg_cts_touch BEFORE UPDATE ON public.compliance_task_steps FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();
DROP TRIGGER IF EXISTS trg_csr_touch ON public.compliance_supplier_requests;
CREATE TRIGGER trg_csr_touch BEFORE UPDATE ON public.compliance_supplier_requests FOR EACH ROW EXECUTE FUNCTION public.compliance_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_ct_project ON public.compliance_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_ct_assignee ON public.compliance_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cts_task ON public.compliance_task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_csr_supplier ON public.compliance_supplier_requests(supplier_user_id);