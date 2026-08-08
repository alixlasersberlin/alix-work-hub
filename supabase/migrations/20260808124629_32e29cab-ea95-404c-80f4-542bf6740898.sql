CREATE TABLE public.collect_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  customer_id uuid,
  customer_name text,
  doc_type text NOT NULL DEFAULT 'mahnschreiben',
  title text,
  language text NOT NULL DEFAULT 'de',
  amount numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  channel text,
  sent_at timestamptz,
  sent_to text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_documents TO authenticated;
GRANT ALL ON public.collect_documents TO service_role;

ALTER TABLE public.collect_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collect_documents_select" ON public.collect_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "collect_documents_insert" ON public.collect_documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collect_documents_update" ON public.collect_documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "collect_documents_delete" ON public.collect_documents
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_collect_documents_case ON public.collect_documents(case_id);
CREATE INDEX idx_collect_documents_created ON public.collect_documents(created_at DESC);

CREATE TRIGGER trg_collect_documents_updated_at
  BEFORE UPDATE ON public.collect_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.collect_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  customer_id uuid,
  customer_name text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'open',
  allow_installments boolean NOT NULL DEFAULT true,
  max_installments integer NOT NULL DEFAULT 6,
  note text,
  customer_response jsonb,
  responded_at timestamptz,
  opened_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_payment_links TO authenticated;
GRANT ALL ON public.collect_payment_links TO service_role;

ALTER TABLE public.collect_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collect_payment_links_select" ON public.collect_payment_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "collect_payment_links_insert" ON public.collect_payment_links
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collect_payment_links_update" ON public.collect_payment_links
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "collect_payment_links_delete" ON public.collect_payment_links
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_collect_payment_links_case ON public.collect_payment_links(case_id);

CREATE TRIGGER trg_collect_payment_links_updated_at
  BEFORE UPDATE ON public.collect_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.collect_device_links
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_status text;