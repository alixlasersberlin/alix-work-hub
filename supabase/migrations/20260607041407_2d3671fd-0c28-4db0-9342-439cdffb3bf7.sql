
-- AlixSmart Import Engine: ergänzende Zieltabellen
CREATE TABLE IF NOT EXISTS public.alixsmart_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  sku text,
  name text,
  description text,
  category text,
  price numeric,
  currency text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.alixsmart_products TO authenticated;
GRANT ALL ON public.alixsmart_products TO service_role;
ALTER TABLE public.alixsmart_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alixsmart_products read admin/service" ON public.alixsmart_products;
CREATE POLICY "alixsmart_products read admin/service"
  ON public.alixsmart_products FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Service') OR public.has_role('Technik') OR public.has_role('Vertrieb') OR public.has_role('Marketing'));

DROP POLICY IF EXISTS "alixsmart_products write admin" ON public.alixsmart_products;
CREATE POLICY "alixsmart_products write admin"
  ON public.alixsmart_products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE,
  recipient_email text,
  subject text,
  template text,
  status text,
  provider_message_id text,
  source_system text,
  sent_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_send_log read admin/marketing" ON public.email_send_log;
CREATE POLICY "email_send_log read admin/marketing"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Marketing'));

DROP POLICY IF EXISTS "email_send_log insert admin" ON public.email_send_log;
CREATE POLICY "email_send_log insert admin"
  ON public.email_send_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Helfer: source_id-Spalte zu mail_internal_messages hinzufügen (für Migrationsschlüssel)
ALTER TABLE public.mail_internal_messages
  ADD COLUMN IF NOT EXISTS source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS mail_internal_messages_source_id_uidx
  ON public.mail_internal_messages(source_id) WHERE source_id IS NOT NULL;
