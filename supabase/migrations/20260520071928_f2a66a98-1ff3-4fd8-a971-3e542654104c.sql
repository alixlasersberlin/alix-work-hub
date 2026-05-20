
-- Bank financing requests per order
CREATE TABLE public.bank_financing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  request_date date,
  has_offer boolean NOT NULL DEFAULT false,
  offer_file_path text,
  decision_text text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decision_note text,
  decided_at timestamp with time zone,
  decided_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(order_id)
);

ALTER TABLE public.bank_financing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read bank requests"
  ON public.bank_financing_requests FOR SELECT
  TO authenticated
  USING (can_access_finance() OR can_access_orders());

CREATE POLICY "finance can insert bank requests"
  ON public.bank_financing_requests FOR INSERT
  TO authenticated
  WITH CHECK (can_access_finance());

CREATE POLICY "finance can update bank requests"
  ON public.bank_financing_requests FOR UPDATE
  TO authenticated
  USING (can_access_finance())
  WITH CHECK (can_access_finance());

CREATE POLICY "admins delete bank requests"
  ON public.bank_financing_requests FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE TRIGGER bank_financing_requests_updated_at
  BEFORE UPDATE ON public.bank_financing_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_bank_financing_requests_order ON public.bank_financing_requests(order_id);
CREATE INDEX idx_bank_financing_requests_status ON public.bank_financing_requests(status);

-- Storage bucket for offer PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('bank-offers', 'bank-offers', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "finance read bank offers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bank-offers' AND (public.can_access_finance() OR public.can_access_orders()));

CREATE POLICY "finance upload bank offers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bank-offers' AND public.can_access_finance());

CREATE POLICY "finance update bank offers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'bank-offers' AND public.can_access_finance());

CREATE POLICY "finance delete bank offers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bank-offers' AND public.can_access_finance());
