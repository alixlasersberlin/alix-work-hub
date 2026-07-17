
-- 1. sig_partners
CREATE TABLE IF NOT EXISTS public.sig_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#D4AF37',
  custom_domain text,
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  api_key_hash text,
  api_key_prefix text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial')),
  monthly_quota int NOT NULL DEFAULT 100,
  used_quota int NOT NULL DEFAULT 0,
  contact_email text,
  webhook_url text,
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_partners TO authenticated;
GRANT ALL ON public.sig_partners TO service_role;
GRANT SELECT ON public.sig_partners TO anon;
ALTER TABLE public.sig_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin manage partners" ON public.sig_partners FOR ALL
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "Partner owner reads own" ON public.sig_partners FOR SELECT
  USING (owner_user_id = auth.uid());
CREATE POLICY "Public branding read" ON public.sig_partners FOR SELECT TO anon
  USING (status = 'active');

-- 2. sig_partner_usage
CREATE TABLE IF NOT EXISTS public.sig_partner_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.sig_partners(id) ON DELETE CASCADE,
  month date NOT NULL,
  signatures_count int NOT NULL DEFAULT 0,
  api_calls int NOT NULL DEFAULT 0,
  revenue_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_partner_usage TO authenticated;
GRANT ALL ON public.sig_partner_usage TO service_role;
ALTER TABLE public.sig_partner_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin all usage" ON public.sig_partner_usage FOR ALL
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "Partner owner reads own usage" ON public.sig_partner_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sig_partners p WHERE p.id = partner_id AND p.owner_user_id = auth.uid()));

-- 3. sig_ai_analyses
CREATE TABLE IF NOT EXISTS public.sig_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.sig_documents(id) ON DELETE CASCADE,
  risk_score int,
  summary text,
  clauses jsonb DEFAULT '[]'::jsonb,
  suggested_fields jsonb DEFAULT '[]'::jsonb,
  model text,
  tokens_used int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_ai_analyses TO authenticated;
GRANT ALL ON public.sig_ai_analyses TO service_role;
ALTER TABLE public.sig_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read analyses" ON public.sig_ai_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert analyses" ON public.sig_ai_analyses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Super Admin manage analyses" ON public.sig_ai_analyses FOR ALL
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- 4. sig_approval_chains
CREATE TABLE IF NOT EXISTS public.sig_approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_id uuid REFERENCES public.sig_templates(id) ON DELETE SET NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_approval_chains TO authenticated;
GRANT ALL ON public.sig_approval_chains TO service_role;
ALTER TABLE public.sig_approval_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read chains" ON public.sig_approval_chains FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin manage chains" ON public.sig_approval_chains FOR ALL
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- 5. sig_approval_states
CREATE TABLE IF NOT EXISTS public.sig_approval_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sig_requests(id) ON DELETE CASCADE,
  chain_id uuid REFERENCES public.sig_approval_chains(id) ON DELETE SET NULL,
  current_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_approver uuid,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_approval_states TO authenticated;
GRANT ALL ON public.sig_approval_states TO service_role;
ALTER TABLE public.sig_approval_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read approval states" ON public.sig_approval_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "Current approver updates" ON public.sig_approval_states FOR UPDATE TO authenticated
  USING (current_approver = auth.uid() OR public.has_role('Super Admin'))
  WITH CHECK (current_approver = auth.uid() OR public.has_role('Super Admin'));
CREATE POLICY "Super Admin manage approvals" ON public.sig_approval_states FOR ALL
  USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

-- 6. sig_bulk_jobs
CREATE TABLE IF NOT EXISTS public.sig_bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL,
  template_id uuid REFERENCES public.sig_templates(id) ON DELETE SET NULL,
  csv_path text,
  total int NOT NULL DEFAULT 0,
  processed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  error_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_bulk_jobs TO authenticated;
GRANT ALL ON public.sig_bulk_jobs TO service_role;
ALTER TABLE public.sig_bulk_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own bulk jobs read" ON public.sig_bulk_jobs FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "Insert own bulk jobs" ON public.sig_bulk_jobs FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Update own bulk jobs" ON public.sig_bulk_jobs FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role('Super Admin'))
  WITH CHECK (uploaded_by = auth.uid() OR public.has_role('Super Admin'));

-- 7. updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER trg_sig_partners_updated BEFORE UPDATE ON public.sig_partners
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sig_partner_usage_updated BEFORE UPDATE ON public.sig_partner_usage
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sig_ai_analyses_updated BEFORE UPDATE ON public.sig_ai_analyses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sig_approval_chains_updated BEFORE UPDATE ON public.sig_approval_chains
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sig_approval_states_updated BEFORE UPDATE ON public.sig_approval_states
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sig_bulk_jobs_updated BEFORE UPDATE ON public.sig_bulk_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sig_bulk_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sig_approval_states;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
