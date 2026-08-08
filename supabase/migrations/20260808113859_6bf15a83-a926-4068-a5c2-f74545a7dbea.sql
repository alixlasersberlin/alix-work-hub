
CREATE TABLE public.collect_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_name text,
  task_type text NOT NULL DEFAULT 'call',
  title text NOT NULL,
  description text,
  due_date date NOT NULL DEFAULT current_date,
  priority integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  source text NOT NULL DEFAULT 'manual',
  amount numeric DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid,
  result_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collect_tasks_due ON public.collect_tasks(status, due_date);
CREATE INDEX idx_collect_tasks_case ON public.collect_tasks(case_id);

CREATE TABLE public.collect_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  phone text,
  outcome text NOT NULL DEFAULT 'no_answer',
  note text,
  duration_seconds integer,
  followup_date date,
  called_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collect_calls_case ON public.collect_calls(case_id, created_at DESC);

CREATE TABLE public.collect_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  promised_date date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  kept_amount numeric DEFAULT 0,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collect_promises_status ON public.collect_promises(status, promised_date);

CREATE TABLE public.collect_credit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  customer_name text,
  credit_limit numeric,
  unlimited boolean NOT NULL DEFAULT false,
  used_amount numeric NOT NULL DEFAULT 0,
  traffic_light text NOT NULL DEFAULT 'green',
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  rating_class text,
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.collect_credit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text,
  provider text NOT NULL DEFAULT 'manual',
  trigger_reason text,
  score numeric,
  rating_class text,
  recommended_limit numeric,
  result text,
  raw_response jsonb,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now(),
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.collect_insolvencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  claim_amount numeric NOT NULL DEFAULT 0,
  administrator_name text,
  administrator_contact text,
  quota_pct numeric,
  registered_at date,
  file_number text,
  deadline_at date,
  status text NOT NULL DEFAULT 'open',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.collect_legal_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  kind text NOT NULL DEFAULT 'inkasso',
  partner_name text,
  file_number text,
  claim_amount numeric NOT NULL DEFAULT 0,
  cost_amount numeric NOT NULL DEFAULT 0,
  recovered_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  handed_over_at date DEFAULT current_date,
  closed_at date,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.collect_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  purpose text NOT NULL DEFAULT 'inkasso',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_promises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_credit_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_credit_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_insolvencies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_legal_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_dossiers TO authenticated;
GRANT ALL ON public.collect_tasks, public.collect_calls, public.collect_promises,
  public.collect_credit_limits, public.collect_credit_checks, public.collect_insolvencies,
  public.collect_legal_cases, public.collect_dossiers TO service_role;

ALTER TABLE public.collect_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_credit_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_credit_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_insolvencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collect_dossiers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collect_tasks','collect_calls','collect_promises','collect_credit_checks','collect_insolvencies','collect_legal_cases','collect_dossiers'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_access_finance())', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_finance())', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''))', t||'_del', t);
  END LOOP;
END $$;

CREATE POLICY collect_credit_limits_sel ON public.collect_credit_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY collect_credit_limits_ins ON public.collect_credit_limits FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY collect_credit_limits_upd ON public.collect_credit_limits FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY collect_credit_limits_del ON public.collect_credit_limits FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collect_tasks','collect_promises','collect_credit_limits','collect_insolvencies','collect_legal_cases'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'trg_'||t||'_upd', t);
  END LOOP;
END $$;
