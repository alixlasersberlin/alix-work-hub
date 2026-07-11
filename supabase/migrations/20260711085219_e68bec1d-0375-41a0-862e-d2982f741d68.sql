CREATE TABLE public.esc_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.esc_events(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_role text NOT NULL DEFAULT 'customer',
  signature_data_url text NOT NULL,
  checkin_at timestamptz,
  checkout_at timestamptz,
  geo_lat numeric,
  geo_lng numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esc_signatures TO authenticated;
GRANT SELECT, INSERT ON public.esc_signatures TO anon;
GRANT ALL ON public.esc_signatures TO service_role;

ALTER TABLE public.esc_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esc_signatures admin all" ON public.esc_signatures
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE POLICY "esc_signatures auth read" ON public.esc_signatures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "esc_signatures auth insert" ON public.esc_signatures
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "esc_signatures public insert via token" ON public.esc_signatures
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.esc_ics_tokens t
    WHERE t.event_id = esc_signatures.event_id
      AND t.action = 'checkin'
      AND (t.expires_at IS NULL OR t.expires_at > now())
  ));

CREATE TRIGGER update_esc_signatures_updated_at
  BEFORE UPDATE ON public.esc_signatures
  FOR EACH ROW EXECUTE FUNCTION public.esc_touch_updated_at();

CREATE INDEX idx_esc_signatures_event ON public.esc_signatures(event_id);