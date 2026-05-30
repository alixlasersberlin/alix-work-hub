
CREATE TABLE public.order_at_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  rechnung boolean NOT NULL DEFAULT false,
  oder text,
  bezahlt boolean NOT NULL DEFAULT false,
  datum_zahlung date,
  rechnungswert numeric,
  restsumme numeric,
  bestellfreigabe boolean NOT NULL DEFAULT false,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_at_approval TO authenticated;
GRANT ALL ON public.order_at_approval TO service_role;

ALTER TABLE public.order_at_approval ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AT approval read"
  ON public.order_at_approval FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Österreich'));

CREATE POLICY "AT approval insert"
  ON public.order_at_approval FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin'));

CREATE POLICY "AT approval update"
  ON public.order_at_approval FOR UPDATE TO authenticated
  USING (has_role('Super Admin'))
  WITH CHECK (has_role('Super Admin'));

CREATE POLICY "AT approval delete"
  ON public.order_at_approval FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

CREATE TRIGGER set_updated_at_order_at_approval
  BEFORE UPDATE ON public.order_at_approval
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
