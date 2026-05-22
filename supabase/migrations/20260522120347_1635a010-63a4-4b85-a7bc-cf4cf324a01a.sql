
CREATE TABLE public.order_additional_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  booking_date date NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_additional_deposits_order_id ON public.order_additional_deposits(order_id);

ALTER TABLE public.order_additional_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized roles can read additional deposits"
  ON public.order_additional_deposits FOR SELECT
  TO authenticated
  USING (public.can_access_orders() OR public.can_access_finance());

CREATE POLICY "authorized roles can insert additional deposits"
  ON public.order_additional_deposits FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_orders());

CREATE POLICY "authorized roles can update additional deposits"
  ON public.order_additional_deposits FOR UPDATE
  TO authenticated
  USING (public.can_manage_orders())
  WITH CHECK (public.can_manage_orders());

CREATE POLICY "admins can delete additional deposits"
  ON public.order_additional_deposits FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_order_additional_deposits_updated_at
  BEFORE UPDATE ON public.order_additional_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
