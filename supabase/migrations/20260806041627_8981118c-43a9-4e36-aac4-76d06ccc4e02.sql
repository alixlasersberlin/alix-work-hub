
CREATE TABLE IF NOT EXISTS public.delivery_readiness_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.delivery_appointments(id) ON DELETE CASCADE,
  order_id uuid,
  previous_readiness text,
  reason text NOT NULL,
  overridden_by uuid,
  overridden_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.delivery_readiness_overrides TO authenticated;
GRANT ALL ON public.delivery_readiness_overrides TO service_role;

ALTER TABLE public.delivery_readiness_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dro_select" ON public.delivery_readiness_overrides
  FOR SELECT TO authenticated USING (public.can_view_delivery());

CREATE POLICY "dro_insert" ON public.delivery_readiness_overrides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TRIGGER trg_dro_updated_at BEFORE UPDATE ON public.delivery_readiness_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_dro_order ON public.delivery_readiness_overrides(order_id);

CREATE OR REPLACE FUNCTION public.check_delivery_readiness(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  c RECORD;
  issues jsonb := '[]'::jsonb;
  reds int := 0;
  yellows int := 0;
  ship jsonb;
  street text; zip text; city text; country text;
  phone text; email text;
  has_serial boolean := false;
  item_name text;
  light text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('readiness','rot','issues', jsonb_build_array(
      jsonb_build_object('key','order','level','rot','label','Auftrag nicht gefunden')));
  END IF;

  SELECT * INTO c FROM public.customers WHERE id = o.customer_id;

  ship := COALESCE(o.shipping_address, o.billing_address, c.shipping_address, c.billing_address, '{}'::jsonb);
  street  := NULLIF(TRIM(COALESCE(ship->>'address', ship->>'street', '')), '');
  zip     := NULLIF(TRIM(COALESCE(ship->>'zip', ship->>'zip_code', ship->>'postal_code', '')), '');
  city    := NULLIF(TRIM(COALESCE(ship->>'city', '')), '');
  country := NULLIF(TRIM(COALESCE(ship->>'country', '')), '');

  IF LOWER(COALESCE(o.order_status,'')) IN ('void','cancelled','canceled','storniert') THEN
    issues := issues || jsonb_build_object('key','status','level','rot','label','Auftrag ist storniert');
    reds := reds + 1;
  END IF;

  IF COALESCE(o.finance_overdue_amount, 0) > 0 THEN
    issues := issues || jsonb_build_object('key','payment','level','rot',
      'label', 'Überfälliger Betrag offen: ' || to_char(o.finance_overdue_amount, 'FM999G999G990D00'));
    reds := reds + 1;
  ELSIF COALESCE(o.deposit_ok, false) = false AND COALESCE(o.finance_paid_amount, 0) <= 0 THEN
    issues := issues || jsonb_build_object('key','deposit','level','rot','label','Keine Anzahlung / kein Zahlungseingang erfasst');
    reds := reds + 1;
  ELSIF COALESCE(o.finance_open_amount, 0) > 0 THEN
    issues := issues || jsonb_build_object('key','open_amount','level','gelb',
      'label','Restbetrag offen: ' || to_char(o.finance_open_amount, 'FM999G999G990D00'));
    yellows := yellows + 1;
  END IF;

  IF street IS NULL OR zip IS NULL OR city IS NULL THEN
    issues := issues || jsonb_build_object('key','address','level','rot','label','Lieferadresse unvollständig');
    reds := reds + 1;
  ELSIF country IS NULL THEN
    issues := issues || jsonb_build_object('key','country','level','gelb','label','Land in der Lieferadresse fehlt');
    yellows := yellows + 1;
  END IF;

  phone := NULLIF(TRIM(COALESCE(ship->>'phone', c.phone, '')), '');
  email := NULLIF(TRIM(COALESCE(c.email, '')), '');
  IF phone IS NULL AND email IS NULL THEN
    issues := issues || jsonb_build_object('key','contact','level','rot','label','Keine Kontaktdaten (Telefon/E-Mail)');
    reds := reds + 1;
  ELSIF phone IS NULL THEN
    issues := issues || jsonb_build_object('key','phone','level','gelb','label','Telefonnummer fehlt');
    yellows := yellows + 1;
  ELSIF email IS NULL THEN
    issues := issues || jsonb_build_object('key','email','level','gelb','label','E-Mail-Adresse fehlt');
    yellows := yellows + 1;
  END IF;

  SELECT NULLIF(TRIM(li->>'name'), '') INTO item_name
  FROM jsonb_array_elements(COALESCE(o.raw_data->'line_items', '[]'::jsonb)) li
  LIMIT 1;

  IF item_name IS NULL THEN
    issues := issues || jsonb_build_object('key','device','level','gelb','label','Kein Artikel/Gerät im Auftrag hinterlegt');
    yellows := yellows + 1;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.lager_devices d
    WHERE (d.reserved_order_id = o.id OR d.delivered_order_id = o.id)
      AND NULLIF(TRIM(COALESCE(d.serial_number,'')), '') IS NOT NULL
  ) INTO has_serial;

  IF NOT has_serial THEN
    issues := issues || jsonb_build_object('key','serial','level','gelb','label','Keine Seriennummer / kein Gerät reserviert');
    yellows := yellows + 1;
  END IF;

  IF COALESCE(o.signature_status,'') NOT IN ('signed','signiert','completed') THEN
    issues := issues || jsonb_build_object('key','signature','level','gelb','label','Vertrag noch nicht signiert');
    yellows := yellows + 1;
  END IF;

  light := CASE WHEN reds > 0 THEN 'rot' WHEN yellows > 0 THEN 'gelb' ELSE 'gruen' END;

  RETURN jsonb_build_object(
    'readiness', light,
    'reds', reds,
    'yellows', yellows,
    'checked_at', now(),
    'issues', issues
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_delivery_readiness(uuid) TO authenticated;
