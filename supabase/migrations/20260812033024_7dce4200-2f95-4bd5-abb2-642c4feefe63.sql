
CREATE TABLE IF NOT EXISTS public.fc_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL,
  trigger_event text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  order_id uuid,
  customer_id uuid,
  customer_name text,
  customer_number text,
  reference_number text,
  order_amount numeric NOT NULL DEFAULT 0,
  delivered_amount numeric NOT NULL DEFAULT 0,
  invoiced_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  open_to_invoice numeric NOT NULL DEFAULT 0,
  open_to_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'neu',
  priority text NOT NULL DEFAULT 'normal',
  traffic text NOT NULL DEFAULT 'gelb',
  billing_flag text,
  assigned_to uuid,
  due_date date,
  notes text,
  accounting_region text,
  tenant_id uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fc_cases_source ON public.fc_cases (source_table, source_id, trigger_event);
CREATE INDEX IF NOT EXISTS idx_fc_cases_order ON public.fc_cases (order_id);
CREATE INDEX IF NOT EXISTS idx_fc_cases_status ON public.fc_cases (status);
CREATE INDEX IF NOT EXISTS idx_fc_cases_created ON public.fc_cases (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fc_cases TO authenticated;
GRANT ALL ON public.fc_cases TO service_role;
ALTER TABLE public.fc_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc_cases_read" ON public.fc_cases FOR SELECT TO authenticated
USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY "fc_cases_insert" ON public.fc_cases FOR INSERT TO authenticated
WITH CHECK (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY "fc_cases_update" ON public.fc_cases FOR UPDATE TO authenticated
USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY "fc_cases_delete" ON public.fc_cases FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.fc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.fc_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  invoice_number text,
  comment text,
  user_id uuid,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fc_events_case ON public.fc_events (case_id, created_at DESC);

GRANT SELECT, INSERT ON public.fc_events TO authenticated;
GRANT ALL ON public.fc_events TO service_role;
ALTER TABLE public.fc_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc_events_read" ON public.fc_events FOR SELECT TO authenticated
USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY "fc_events_insert" ON public.fc_events FOR INSERT TO authenticated
WITH CHECK (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));

CREATE OR REPLACE FUNCTION public.fc_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_fc_cases_touch BEFORE UPDATE ON public.fc_cases
FOR EACH ROW EXECUTE FUNCTION public.fc_touch_updated_at();

CREATE OR REPLACE FUNCTION public.fc_order_financials(p_order_id uuid)
RETURNS TABLE (order_amount numeric, invoiced numeric, paid numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric; RETURN; END IF;
  RETURN QUERY
  SELECT COALESCE(o.total_amount, 0)::numeric,
         COALESCE(SUM(i.total), 0)::numeric,
         COALESCE(SUM(GREATEST(COALESCE(i.total,0) - COALESCE(i.balance,0), 0)), 0)::numeric
  FROM public.zoho_invoices i
  WHERE lower(COALESCE(i.status,'')) NOT IN ('void','draft','storniert')
    AND (
      (o.order_number IS NOT NULL AND i.reference_number = o.order_number)
      OR (o.internal_number IS NOT NULL AND i.reference_number = o.internal_number)
    );
END; $$;

CREATE OR REPLACE FUNCTION public.fc_upsert_case(
  p_case_type text, p_event text, p_table text, p_source_id uuid,
  p_order_id uuid, p_customer_id uuid, p_customer_name text, p_reference text,
  p_amount numeric, p_billing_flag text DEFAULT NULL, p_critical boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv numeric := 0; v_paid numeric := 0; v_total numeric := COALESCE(p_amount,0);
        v_open_inv numeric; v_open_pay numeric; v_traffic text; v_prio text; v_status text; v_id uuid;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT f.order_amount, f.invoiced, f.paid INTO v_total, v_inv, v_paid FROM public.fc_order_financials(p_order_id) f;
    IF COALESCE(v_total,0) = 0 THEN v_total := COALESCE(p_amount,0); END IF;
  END IF;
  v_open_inv := ROUND(COALESCE(v_total,0) - COALESCE(v_inv,0), 2);
  v_open_pay := ROUND(COALESCE(v_inv,0) - COALESCE(v_paid,0), 2);

  IF p_billing_flag IN ('garantie','kulanz') THEN
    v_traffic := 'gruen'; v_prio := 'normal'; v_status := 'pruefung_erforderlich';
  ELSIF v_open_inv <= 0.01 THEN
    v_traffic := 'gruen'; v_prio := 'normal'; v_status := 'rechnung_vorhanden';
  ELSIF p_critical THEN
    v_traffic := 'kritisch'; v_prio := 'kritisch'; v_status := 'rechnung_erforderlich';
  ELSE
    v_traffic := 'rot'; v_prio := 'hoch'; v_status := 'rechnung_erforderlich';
  END IF;

  INSERT INTO public.fc_cases (
    case_type, trigger_event, source_table, source_id, order_id, customer_id, customer_name,
    reference_number, order_amount, invoiced_amount, paid_amount, open_to_invoice, open_to_pay,
    status, priority, traffic, billing_flag
  ) VALUES (
    p_case_type, p_event, p_table, p_source_id, p_order_id, p_customer_id, p_customer_name,
    p_reference, COALESCE(v_total,0), COALESCE(v_inv,0), COALESCE(v_paid,0), v_open_inv, v_open_pay,
    v_status, v_prio, v_traffic, p_billing_flag
  )
  ON CONFLICT (source_table, source_id, trigger_event) DO UPDATE SET
    order_amount = EXCLUDED.order_amount,
    invoiced_amount = EXCLUDED.invoiced_amount,
    paid_amount = EXCLUDED.paid_amount,
    open_to_invoice = EXCLUDED.open_to_invoice,
    open_to_pay = EXCLUDED.open_to_pay,
    traffic = CASE WHEN public.fc_cases.status IN ('freigegeben','abgeschlossen') THEN public.fc_cases.traffic ELSE EXCLUDED.traffic END,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.fc_events (case_id, event_type, new_status, comment)
  VALUES (v_id, p_event, v_status, 'Automatisch aus ' || p_table || ' erzeugt/aktualisiert');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_refresh_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.fc_order_financials(p_order_id);
  UPDATE public.fc_cases c SET
    order_amount = f.order_amount,
    invoiced_amount = f.invoiced,
    paid_amount = f.paid,
    open_to_invoice = ROUND(f.order_amount - f.invoiced, 2),
    open_to_pay = ROUND(f.invoiced - f.paid, 2),
    traffic = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.traffic
                   WHEN ROUND(f.order_amount - f.invoiced, 2) <= 0.01 THEN 'gruen'
                   WHEN c.priority = 'kritisch' THEN 'kritisch' ELSE 'rot' END,
    updated_at = now()
  WHERE c.order_id = p_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_orders_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; cname text;
BEGIN
  s := lower(COALESCE(NEW.order_status, ''));
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.order_status,'')) = s THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(company_name, contact_name) INTO cname FROM public.customers WHERE id = NEW.customer_id;

  IF s IN ('bestätigt','bestaetigt','confirmed','approved') THEN
    PERFORM public.fc_upsert_case('AUFTRAG','auftrag_bestaetigt','orders',NEW.id,NEW.id,NEW.customer_id,cname,NEW.order_number,NEW.total_amount,NULL,false);
  ELSIF s IN ('teilgeliefert','partially_invoiced') THEN
    PERFORM public.fc_upsert_case('TEILLIEFERUNG','teillieferung','orders',NEW.id,NEW.id,NEW.customer_id,cname,NEW.order_number,NEW.total_amount,NULL,false);
  ELSIF s IN ('geliefert','delivered','versendet') THEN
    PERFORM public.fc_upsert_case('LIEFERUNG','auftrag_geliefert','orders',NEW.id,NEW.id,NEW.customer_id,cname,NEW.order_number,NEW.total_amount,NULL,false);
  ELSIF s IN ('geschlossen','abgeschlossen','closed','invoiced') THEN
    PERFORM public.fc_upsert_case('SCHLUSSRECHNUNG','auftrag_geschlossen','orders',NEW.id,NEW.id,NEW.customer_id,cname,NEW.order_number,NEW.total_amount,NULL,true);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fc_orders AFTER INSERT OR UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fc_orders_trigger();

CREATE OR REPLACE FUNCTION public.fc_delivery_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; amt numeric;
BEGIN
  s := lower(COALESCE(NEW.status::text,''));
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status::text,'')) = s THEN RETURN NEW; END IF;
  SELECT COALESCE(total_amount,0) INTO amt FROM public.orders WHERE id = NEW.order_id;
  IF s IN ('erfolgreich_ausgeliefert','abgeschlossen') THEN
    PERFORM public.fc_upsert_case('LIEFERUNG','lieferung_abgeschlossen','delivery_appointments',NEW.id,NEW.order_id,NEW.customer_id,COALESCE(NEW.company_name,NEW.customer_name),COALESCE(NEW.order_number,''),amt,NULL,false);
  ELSIF s = 'teilweise_ausgeliefert' THEN
    PERFORM public.fc_upsert_case('TEILLIEFERUNG','teillieferung_abgeschlossen','delivery_appointments',NEW.id,NEW.order_id,NEW.customer_id,COALESCE(NEW.company_name,NEW.customer_name),COALESCE(NEW.order_number,''),amt,NULL,false);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fc_delivery AFTER INSERT OR UPDATE OF status ON public.delivery_appointments
FOR EACH ROW EXECUTE FUNCTION public.fc_delivery_trigger();

CREATE OR REPLACE FUNCTION public.fc_repair_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; amt numeric;
BEGIN
  s := lower(COALESCE(NEW.repair_status,''));
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.repair_status,'')) = s THEN RETURN NEW; END IF;
  IF s IN ('reparatur abgeschlossen','erledigt','abgeschlossen','ausgeliefert') THEN
    amt := COALESCE(NEW.actual_cost, NEW.estimated_cost, 0);
    IF COALESCE(amt,0) > 0 THEN
      PERFORM public.fc_upsert_case('REPARATUR','reparatur_abgeschlossen','repair_orders',NEW.id,NEW.order_id,NEW.customer_id,NEW.customer_name,NEW.repair_number,amt,NULL,false);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fc_repair AFTER INSERT OR UPDATE OF repair_status ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.fc_repair_trigger();

CREATE OR REPLACE FUNCTION public.fc_invoice_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid uuid;
BEGIN
  IF NEW.reference_number IS NULL THEN RETURN NEW; END IF;
  FOR oid IN SELECT id FROM public.orders WHERE order_number = NEW.reference_number OR internal_number = NEW.reference_number LOOP
    PERFORM public.fc_refresh_order(oid);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fc_invoice AFTER INSERT OR UPDATE OF total, balance, status ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.fc_invoice_trigger();
