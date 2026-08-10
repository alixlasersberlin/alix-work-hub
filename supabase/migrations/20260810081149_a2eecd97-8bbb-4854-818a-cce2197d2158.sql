CREATE TABLE IF NOT EXISTS public.finance_invoice_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_source text NOT NULL DEFAULT 'invoice',
  invoice_number text,
  is_revision boolean NOT NULL DEFAULT true,
  revised_at timestamptz NOT NULL DEFAULT now(),
  revised_by uuid,
  revised_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_invoice_revisions_unique UNIQUE (invoice_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_invoice_revisions TO authenticated;
GRANT ALL ON public.finance_invoice_revisions TO service_role;

ALTER TABLE public.finance_invoice_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fir_select_authenticated" ON public.finance_invoice_revisions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fir_insert_authenticated" ON public.finance_invoice_revisions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fir_update_authenticated" ON public.finance_invoice_revisions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fir_delete_super_admin" ON public.finance_invoice_revisions
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_fir_invoice_id ON public.finance_invoice_revisions (invoice_id);

CREATE TRIGGER trg_fir_updated_at
  BEFORE UPDATE ON public.finance_invoice_revisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();