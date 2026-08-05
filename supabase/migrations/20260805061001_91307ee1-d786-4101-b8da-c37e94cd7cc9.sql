-- 1) Mahnstufen-Konfiguration für CMR
ALTER TABLE public.cmr_settings
  ADD COLUMN IF NOT EXISTS dunning_days_1 integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS dunning_days_2 integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dunning_days_3 integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS dunning_gap_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS dunning_fee_1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_fee_2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_fee_3 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_interest_pct numeric NOT NULL DEFAULT 0;

-- 2) E-Mail-Versandprotokoll je Beleg
CREATE TABLE IF NOT EXISTS public.cmr_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_id uuid REFERENCES public.cmr_documents(id) ON DELETE CASCADE,
  recipients text NOT NULL,
  subject text,
  provider text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cmr_email_log TO authenticated;
GRANT ALL ON public.cmr_email_log TO service_role;

ALTER TABLE public.cmr_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cmr_email_log_read ON public.cmr_email_log;
CREATE POLICY cmr_email_log_read ON public.cmr_email_log
  FOR SELECT TO authenticated
  USING (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS cmr_email_log_insert ON public.cmr_email_log;
CREATE POLICY cmr_email_log_insert ON public.cmr_email_log
  FOR INSERT TO authenticated
  WITH CHECK (has_tenant_access(tenant_id));

CREATE INDEX IF NOT EXISTS idx_cmr_email_log_doc ON public.cmr_email_log(document_id, created_at DESC);

-- 3) Eigene Rolle "CMR"
INSERT INTO public.roles (name, description)
SELECT 'CMR', 'Zugriff auf den Mandanten CMR (Cloud Marketing Research)'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'CMR');