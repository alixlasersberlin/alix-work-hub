CREATE OR REPLACE FUNCTION public.set_order_lawyer(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR public.has_role('Finance')
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Order')
    OR public.has_role('Auftragsverwaltung')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Chief Operations')
    OR public.has_role('Serviceleitung')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Anwaltsübergabe';
  END IF;

  UPDATE public.orders
  SET order_status = 'anwalt',
      lawyer_reason = _reason
  WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_order_lawyer(uuid, text) TO authenticated;