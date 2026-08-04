CREATE TABLE IF NOT EXISTS public.zoho_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  zoho_creditnote_id text NOT NULL,
  creditnote_number text,
  reference_number text,
  customer_id text,
  customer_name text,
  creditnote_date date,
  status text,
  currency text,
  total numeric,
  balance numeric,
  accounting_region public.accounting_region NOT NULL DEFAULT 'EU',
  raw_data jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_zoho_credit_notes_src_id ON public.zoho_credit_notes (source_system, zoho_creditnote_id);
CREATE INDEX IF NOT EXISTS idx_zoho_credit_notes_customer ON public.zoho_credit_notes (customer_id);
CREATE INDEX IF NOT EXISTS idx_zoho_credit_notes_date ON public.zoho_credit_notes (creditnote_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_credit_notes TO authenticated;
GRANT ALL ON public.zoho_credit_notes TO service_role;

ALTER TABLE public.zoho_credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read zoho credit notes" ON public.zoho_credit_notes
  FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "admins can insert zoho credit notes" ON public.zoho_credit_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admins can update zoho credit notes" ON public.zoho_credit_notes
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "only super admin can delete zoho credit notes" ON public.zoho_credit_notes
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'::text));