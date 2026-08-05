CREATE TABLE public.bank_match_rules (
  id uuid primary key default gen_random_uuid(),
  accounting_area text not null default 'EU',
  payer_key text not null,
  payer_iban text,
  payer_name text,
  customer_id text,
  customer_name text,
  allocation_type text not null default 'rechnung',
  hit_count integer not null default 1,
  auto_book boolean not null default false,
  last_used_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX uq_bank_match_rules_key ON public.bank_match_rules (accounting_area, payer_key);
CREATE INDEX idx_bank_match_rules_area ON public.bank_match_rules (accounting_area, last_used_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_match_rules TO authenticated;
GRANT ALL ON public.bank_match_rules TO service_role;

ALTER TABLE public.bank_match_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_match_rules_read ON public.bank_match_rules FOR SELECT TO authenticated
  USING (has_role('Admin'::text) OR has_role('Super Admin'::text));
CREATE POLICY bank_match_rules_insert ON public.bank_match_rules FOR INSERT TO authenticated
  WITH CHECK (has_role('Admin'::text) OR has_role('Super Admin'::text));
CREATE POLICY bank_match_rules_update ON public.bank_match_rules FOR UPDATE TO authenticated
  USING (has_role('Admin'::text) OR has_role('Super Admin'::text));
CREATE POLICY bank_match_rules_delete ON public.bank_match_rules FOR DELETE TO authenticated
  USING (has_role('Super Admin'::text));

CREATE TRIGGER trg_bank_match_rules_updated BEFORE UPDATE ON public.bank_match_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();