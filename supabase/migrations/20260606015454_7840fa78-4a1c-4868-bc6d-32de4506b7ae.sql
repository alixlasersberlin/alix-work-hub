
CREATE TABLE IF NOT EXISTS public.mail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.mail_messages(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  repair_order_id uuid REFERENCES public.repair_orders(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'Rechnung','Angebot','Lieferschein','Reparaturbericht',
    'Servicebericht','Vertrag','Schulungszertifikat','Mahnung','Sonstiges'
  )),
  file_name text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text DEFAULT 'application/pdf',
  status text NOT NULL DEFAULT 'erstellt'
    CHECK (status IN ('erstellt','versendet','geoeffnet','heruntergeladen','signiert','fehler')),
  sent_at timestamptz,
  opened_at timestamptz,
  downloaded_at timestamptz,
  signed_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  is_signed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mail_attachments TO authenticated;
GRANT DELETE ON public.mail_attachments TO authenticated;
GRANT ALL ON public.mail_attachments TO service_role;

ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_attachments_select" ON public.mail_attachments
  FOR SELECT TO authenticated
  USING (public.can_access_mail());

CREATE POLICY "mail_attachments_insert" ON public.mail_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_mail());

CREATE POLICY "mail_attachments_update" ON public.mail_attachments
  FOR UPDATE TO authenticated
  USING (public.can_access_mail());

CREATE POLICY "mail_attachments_delete" ON public.mail_attachments
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_mail_attachments_message ON public.mail_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_mail_attachments_customer ON public.mail_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_mail_attachments_order ON public.mail_attachments(order_id);
CREATE INDEX IF NOT EXISTS idx_mail_attachments_repair ON public.mail_attachments(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_mail_attachments_type ON public.mail_attachments(document_type);
CREATE INDEX IF NOT EXISTS idx_mail_attachments_created ON public.mail_attachments(created_at DESC);

CREATE TRIGGER trg_mail_attachments_updated_at
  BEFORE UPDATE ON public.mail_attachments
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();
