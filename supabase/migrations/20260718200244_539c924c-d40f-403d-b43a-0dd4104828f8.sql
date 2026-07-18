
CREATE TABLE public.alixsmart_customer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  alixwork_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  alixsmart_user_id text,
  alixsmart_email text,
  alixsmart_phone text,
  match_status text NOT NULL DEFAULT 'unregistered' CHECK (match_status IN ('registered','unregistered','possible','reminded')),
  match_score numeric(5,2) DEFAULT 0,
  match_method text,
  compared_fields jsonb,
  manually_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  last_checked_at timestamptz,
  last_reminder_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alixwork_customer_id)
);
CREATE INDEX idx_ascl_customer ON public.alixsmart_customer_links(alixwork_customer_id);
CREATE INDEX idx_ascl_status ON public.alixsmart_customer_links(match_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_customer_links TO authenticated;
GRANT ALL ON public.alixsmart_customer_links TO service_role;
ALTER TABLE public.alixsmart_customer_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ascl_read_staff" ON public.alixsmart_customer_links FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Vertrieb') OR has_role('Kundenservice'));
CREATE POLICY "ascl_write_admin" ON public.alixsmart_customer_links FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "ascl_update_admin" ON public.alixsmart_customer_links FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "ascl_delete_super" ON public.alixsmart_customer_links FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TABLE public.alixsmart_device_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  customer_link_id uuid REFERENCES public.alixsmart_customer_links(id) ON DELETE CASCADE,
  alixwork_customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  device_id uuid,
  serial_number text NOT NULL,
  device_name text,
  device_model text,
  alixsmart_device_id text,
  registration_status text NOT NULL DEFAULT 'unregistered' CHECK (registration_status IN ('registered','unregistered','possible')),
  registered_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alixwork_customer_id, serial_number)
);
CREATE INDEX idx_asdl_customer ON public.alixsmart_device_links(alixwork_customer_id);
CREATE INDEX idx_asdl_serial ON public.alixsmart_device_links(serial_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_device_links TO authenticated;
GRANT ALL ON public.alixsmart_device_links TO service_role;
ALTER TABLE public.alixsmart_device_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asdl_read_staff" ON public.alixsmart_device_links FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Vertrieb') OR has_role('Kundenservice'));
CREATE POLICY "asdl_write_admin" ON public.alixsmart_device_links FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asdl_update_admin" ON public.alixsmart_device_links FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asdl_delete_super" ON public.alixsmart_device_links FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TABLE public.alixsmart_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  single_use boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  used_at timestamptz,
  used_ip text,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asri_customer ON public.alixsmart_registration_invites(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_registration_invites TO authenticated;
GRANT ALL ON public.alixsmart_registration_invites TO service_role;
ALTER TABLE public.alixsmart_registration_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asri_read_admin" ON public.alixsmart_registration_invites FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asri_write_admin" ON public.alixsmart_registration_invites FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asri_update_admin" ON public.alixsmart_registration_invites FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asri_delete_super" ON public.alixsmart_registration_invites FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TABLE public.alixsmart_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  device_link_id uuid REFERENCES public.alixsmart_device_links(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms','task','manual')),
  recipient text,
  template_id text,
  message_subject text,
  message_content text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','opened','clicked','cancelled')),
  provider_message_id text,
  error_message text,
  sent_by uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asr_customer ON public.alixsmart_reminders(customer_id);
CREATE INDEX idx_asr_status ON public.alixsmart_reminders(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixsmart_reminders TO authenticated;
GRANT ALL ON public.alixsmart_reminders TO service_role;
ALTER TABLE public.alixsmart_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asr_read_staff" ON public.alixsmart_reminders FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Vertrieb') OR has_role('Kundenservice'));
CREATE POLICY "asr_write_staff" ON public.alixsmart_reminders FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Vertrieb') OR has_role('Kundenservice'));
CREATE POLICY "asr_update_admin" ON public.alixsmart_reminders FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asr_delete_super" ON public.alixsmart_reminders FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TABLE public.alixsmart_match_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  candidate_user_id text,
  match_score numeric(5,2),
  compared_fields jsonb,
  decision text CHECK (decision IN ('registered','possible','unregistered','manual_confirmed','manual_rejected')),
  decided_by uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asml_customer ON public.alixsmart_match_logs(customer_id);
GRANT SELECT, INSERT ON public.alixsmart_match_logs TO authenticated;
GRANT ALL ON public.alixsmart_match_logs TO service_role;
ALTER TABLE public.alixsmart_match_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asml_read_admin" ON public.alixsmart_match_logs FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "asml_insert_admin" ON public.alixsmart_match_logs FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE OR REPLACE FUNCTION public.tg_alixsmart_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ascl_updated BEFORE UPDATE ON public.alixsmart_customer_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_alixsmart_updated_at();
CREATE TRIGGER trg_asdl_updated BEFORE UPDATE ON public.alixsmart_device_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_alixsmart_updated_at();

CREATE OR REPLACE FUNCTION public.alixsmart_norm_email(e text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(regexp_replace(coalesce(e,''), '\s+', '', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.alixsmart_norm_phone(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  IF s LIKE '00%' THEN s := '+' || substring(s, 3); END IF;
  IF s LIKE '0%' THEN s := '+49' || substring(s, 2); END IF;
  IF s !~ '^\+' THEN s := '+' || s; END IF;
  RETURN NULLIF(s, '');
END; $$;

CREATE OR REPLACE VIEW public.v_alixsmart_customer_devices AS
SELECT DISTINCT
  src.cust_id AS customer_id,
  ld.id AS device_id,
  ld.serial_number,
  ld.model_name AS device_model,
  ld.commissioning_date,
  ld.device_status,
  ld.alixsmart_user_id
FROM public.lager_devices ld
CROSS JOIN LATERAL (
  SELECT o.customer_id AS cust_id FROM public.orders o WHERE o.id = ld.delivered_order_id AND o.customer_id IS NOT NULL
  UNION
  SELECT o.customer_id FROM public.orders o WHERE o.id = ld.reserved_order_id AND o.customer_id IS NOT NULL
  UNION
  SELECT c.id FROM public.customers c
   WHERE ld.customer_email IS NOT NULL
     AND public.alixsmart_norm_email(c.email) = public.alixsmart_norm_email(ld.customer_email)
) src
WHERE ld.serial_number IS NOT NULL AND length(trim(ld.serial_number)) > 0
  AND src.cust_id IS NOT NULL;

GRANT SELECT ON public.v_alixsmart_customer_devices TO authenticated;

CREATE OR REPLACE VIEW public.v_alixsmart_customer_status AS
SELECT
  c.id AS customer_id,
  c.external_customer_id AS customer_number,
  c.company_name,
  c.contact_name,
  c.email,
  c.phone,
  c.billing_address,
  c.shipping_address,
  c.source_system,
  COUNT(DISTINCT d.serial_number) AS device_count,
  ARRAY_AGG(DISTINCT d.serial_number) AS serial_numbers,
  cl.id AS link_id,
  COALESCE(cl.match_status,'unregistered') AS match_status,
  cl.match_score,
  cl.alixsmart_user_id,
  cl.last_checked_at,
  cl.last_reminder_at,
  cl.registered_at
FROM public.customers c
JOIN public.v_alixsmart_customer_devices d ON d.customer_id = c.id
LEFT JOIN public.alixsmart_customer_links cl ON cl.alixwork_customer_id = c.id
GROUP BY c.id, cl.id;

GRANT SELECT ON public.v_alixsmart_customer_status TO authenticated;
