CREATE OR REPLACE FUNCTION public.set_factory_invoice_payment_ok(_production_order_id uuid, _ok boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.can_upload_factory_invoice()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.production_orders
  SET payment_status = CASE WHEN _ok THEN 'Ja' ELSE 'Nein' END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = _production_order_id;
END;
$$;