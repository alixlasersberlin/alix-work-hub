CREATE TABLE public.order_at_purchase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  einkaufspreis numeric,
  currency text DEFAULT 'EUR',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_at_purchase TO authenticated;
GRANT ALL ON public.order_at_purchase TO service_role;

ALTER TABLE public.order_at_purchase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AT purchase read" ON public.order_at_purchase
FOR SELECT TO authenticated
USING (public.has_role('Super Admin') OR public.has_role('Österreich'));

CREATE POLICY "AT purchase insert" ON public.order_at_purchase
FOR INSERT TO authenticated
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "AT purchase update" ON public.order_at_purchase
FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "AT purchase delete" ON public.order_at_purchase
FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_order_at_purchase_updated_at
BEFORE UPDATE ON public.order_at_purchase
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_order_at_purchase_updated_by
BEFORE INSERT OR UPDATE ON public.order_at_purchase
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();