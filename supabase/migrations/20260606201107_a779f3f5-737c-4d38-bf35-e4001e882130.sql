
CREATE TABLE public.device_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL,
  device_name text,
  customer_id uuid,
  customer_name text,
  event_type text NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  event_source text NOT NULL,
  reference_id text,
  description text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_lifecycle_serial ON public.device_lifecycle(serial_number);
CREATE INDEX idx_device_lifecycle_customer ON public.device_lifecycle(customer_id);
CREATE INDEX idx_device_lifecycle_event_type ON public.device_lifecycle(event_type);
CREATE INDEX idx_device_lifecycle_event_date ON public.device_lifecycle(event_date DESC);
CREATE UNIQUE INDEX uq_device_lifecycle_dedupe
  ON public.device_lifecycle(serial_number, event_type, event_source, coalesce(reference_id,''));

GRANT SELECT ON public.device_lifecycle TO authenticated;
GRANT ALL ON public.device_lifecycle TO service_role;

ALTER TABLE public.device_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service/Admin can read device_lifecycle"
  ON public.device_lifecycle FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Service')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Finance')
    OR public.has_role('Order')
    OR public.has_role('Tourenplanung')
  );

CREATE POLICY "Super Admin can manage device_lifecycle"
  ON public.device_lifecycle FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.dl_upsert(
  _serial text, _device text, _customer_id uuid, _customer_name text,
  _event_type text, _event_date timestamptz, _event_source text,
  _reference_id text, _description text, _meta jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _serial IS NULL OR length(trim(_serial)) = 0 THEN RETURN; END IF;
  INSERT INTO public.device_lifecycle(
    serial_number, device_name, customer_id, customer_name,
    event_type, event_date, event_source, reference_id, description, meta
  ) VALUES (
    trim(_serial), _device, _customer_id, _customer_name,
    _event_type, COALESCE(_event_date, now()), _event_source,
    _reference_id, _description, _meta
  )
  ON CONFLICT (serial_number, event_type, event_source, coalesce(reference_id,'')) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.trg_dl_repair_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text := 'Reparatur';
  v_text text;
BEGIN
  v_text := lower(coalesce(NEW.device_category,'') || ' ' || coalesce(NEW.issue_description,''));
  IF v_text ~ '(wartung|inspektion|maintenance)' THEN v_event := 'Wartung'; END IF;
  PERFORM public.dl_upsert(
    NEW.device_serial_number,
    nullif(trim(concat_ws(' ', NEW.device_brand, NEW.device_model)), ''),
    NEW.customer_id, NEW.customer_name,
    v_event, NEW.created_at, 'repair_orders', NEW.id::text,
    NEW.repair_number || ' – ' || COALESCE(NEW.issue_description,''), NULL
  );
  IF v_text ~ '(garantie|warranty|gewährleistung)' THEN
    PERFORM public.dl_upsert(
      NEW.device_serial_number,
      nullif(trim(concat_ws(' ', NEW.device_brand, NEW.device_model)), ''),
      NEW.customer_id, NEW.customer_name,
      'Garantie', NEW.created_at, 'repair_orders', NEW.id::text,
      'Garantiefall: ' || NEW.repair_number, NULL
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dl_repair_order_ai
AFTER INSERT ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_repair_order();

CREATE OR REPLACE FUNCTION public.trg_dl_spare_part() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_serial text; v_brand text; v_model text; v_cust_id uuid; v_cust_name text;
BEGIN
  SELECT device_serial_number, device_brand, device_model, customer_id, customer_name
    INTO v_serial, v_brand, v_model, v_cust_id, v_cust_name
  FROM public.repair_orders WHERE id = NEW.repair_order_id;
  PERFORM public.dl_upsert(
    v_serial, nullif(trim(concat_ws(' ', v_brand, v_model)),''),
    v_cust_id, v_cust_name,
    'Ersatzteil', NEW.created_at, 'repair_spare_parts', NEW.id::text,
    COALESCE(NEW.part_name,'Ersatzteil') || ' x' || COALESCE(NEW.quantity,1),
    jsonb_build_object('repair_order_id', NEW.repair_order_id)
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dl_spare_part_ai
AFTER INSERT ON public.repair_spare_parts
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_spare_part();

CREATE OR REPLACE FUNCTION public.trg_dl_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.serial_number IS NULL THEN RETURN NEW; END IF;
  PERFORM public.dl_upsert(
    NEW.serial_number, NEW.device_name,
    NULL, NEW.customer_name,
    'Reklamation', NEW.created_at, 'tickets', NEW.id::text,
    COALESCE(NEW.external_ticket_id,'') || ' – ' || COALESCE(NEW.title,''), NULL
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dl_ticket_ai
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_ticket();

CREATE OR REPLACE FUNCTION public.trg_dl_lager_reservation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust_id uuid; v_cust_name text; v_order_number text; v_order_date timestamptz;
BEGIN
  IF NEW.reserved_order_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.reserved_order_id IS NOT DISTINCT FROM NEW.reserved_order_id THEN
    RETURN NEW;
  END IF;
  SELECT o.customer_id, COALESCE(c.company_name, c.contact_name), o.order_number, COALESCE(o.order_date, o.created_at)
    INTO v_cust_id, v_cust_name, v_order_number, v_order_date
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = NEW.reserved_order_id;
  PERFORM public.dl_upsert(
    NEW.serial_number, NEW.model_name, v_cust_id, v_cust_name,
    'Verkauf', v_order_date, 'orders', NEW.reserved_order_id::text,
    'Auftrag ' || COALESCE(v_order_number,''),
    jsonb_build_object('order_id', NEW.reserved_order_id)
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dl_lager_reservation_aiu
AFTER INSERT OR UPDATE OF reserved_order_id ON public.lager_devices
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_lager_reservation();

CREATE OR REPLACE FUNCTION public.trg_dl_order_delivered() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_cust_name text;
BEGIN
  IF NEW.order_status <> 'geliefert' THEN RETURN NEW; END IF;
  IF OLD.order_status IS NOT DISTINCT FROM NEW.order_status THEN RETURN NEW; END IF;
  SELECT COALESCE(company_name, contact_name) INTO v_cust_name FROM public.customers WHERE id = NEW.customer_id;
  FOR r IN SELECT serial_number, model_name FROM public.lager_devices WHERE reserved_order_id = NEW.id LOOP
    PERFORM public.dl_upsert(
      r.serial_number, r.model_name, NEW.customer_id, v_cust_name,
      'Lieferung', now(), 'orders', NEW.id::text,
      'Ausgeliefert – Auftrag ' || COALESCE(NEW.order_number,''),
      jsonb_build_object('order_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dl_order_delivered_au
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_order_delivered();

-- Backfill
INSERT INTO public.device_lifecycle(serial_number, device_name, customer_id, customer_name, event_type, event_date, event_source, reference_id, description, meta)
SELECT ld.serial_number, ld.model_name, o.customer_id, COALESCE(c.company_name, c.contact_name),
       'Verkauf', COALESCE(o.order_date, o.created_at), 'orders', o.id::text,
       'Auftrag ' || COALESCE(o.order_number,''), jsonb_build_object('order_id', o.id)
FROM public.lager_devices ld
JOIN public.orders o ON o.id = ld.reserved_order_id
LEFT JOIN public.customers c ON c.id = o.customer_id
WHERE ld.serial_number IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.device_lifecycle(serial_number, device_name, customer_id, customer_name, event_type, event_date, event_source, reference_id, description, meta)
SELECT ld.serial_number, ld.model_name, o.customer_id, COALESCE(c.company_name, c.contact_name),
       'Lieferung', COALESCE(o.expected_shipment_date, o.updated_at), 'orders', o.id::text,
       'Ausgeliefert – Auftrag ' || COALESCE(o.order_number,''), jsonb_build_object('order_id', o.id)
FROM public.lager_devices ld
JOIN public.orders o ON o.id = ld.reserved_order_id
LEFT JOIN public.customers c ON c.id = o.customer_id
WHERE ld.serial_number IS NOT NULL AND o.order_status = 'geliefert'
ON CONFLICT DO NOTHING;

INSERT INTO public.device_lifecycle(serial_number, device_name, customer_id, customer_name, event_type, event_date, event_source, reference_id, description)
SELECT ro.device_serial_number,
       nullif(trim(concat_ws(' ', ro.device_brand, ro.device_model)),''),
       ro.customer_id, ro.customer_name,
       CASE WHEN lower(coalesce(ro.device_category,'') || ' ' || coalesce(ro.issue_description,'')) ~ '(wartung|inspektion|maintenance)'
            THEN 'Wartung' ELSE 'Reparatur' END,
       ro.created_at, 'repair_orders', ro.id::text,
       ro.repair_number || ' – ' || COALESCE(ro.issue_description,'')
FROM public.repair_orders ro
WHERE ro.device_serial_number IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.device_lifecycle(serial_number, device_name, customer_id, customer_name, event_type, event_date, event_source, reference_id, description, meta)
SELECT ro.device_serial_number,
       nullif(trim(concat_ws(' ', ro.device_brand, ro.device_model)),''),
       ro.customer_id, ro.customer_name,
       'Ersatzteil', sp.created_at, 'repair_spare_parts', sp.id::text,
       COALESCE(sp.part_name,'Ersatzteil') || ' x' || COALESCE(sp.quantity,1),
       jsonb_build_object('repair_order_id', sp.repair_order_id)
FROM public.repair_spare_parts sp
JOIN public.repair_orders ro ON ro.id = sp.repair_order_id
WHERE ro.device_serial_number IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.device_lifecycle(serial_number, device_name, customer_name, event_type, event_date, event_source, reference_id, description)
SELECT t.serial_number, t.device_name, t.customer_name,
       'Reklamation', t.created_at, 'tickets', t.id::text,
       COALESCE(t.external_ticket_id,'') || ' – ' || COALESCE(t.title,'')
FROM public.tickets t
WHERE t.serial_number IS NOT NULL
ON CONFLICT DO NOTHING;
