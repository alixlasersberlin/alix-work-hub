
CREATE OR REPLACE FUNCTION public.sync_order_deposit_to_finance(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o          RECORD;
  v_soll     numeric := 0;
  v_paid     numeric := 0;
  v_open     numeric := 0;
  v_status   text;
  v_release  text;
  v_dep      RECORD;
  v_cust     RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_soll := COALESCE(o.deposit_amount, 0)
          + COALESCE((SELECT SUM(COALESCE(amount,0)) FROM public.order_additional_deposits WHERE order_id = o.id), 0);
  v_paid := (CASE WHEN o.deposit_ok IS TRUE THEN COALESCE(o.deposit_amount,0) ELSE 0 END)
          + COALESCE((SELECT SUM(COALESCE(amount,0)) FROM public.order_additional_deposits WHERE order_id = o.id AND geleistet IS TRUE), 0);
  v_open := GREATEST(v_soll - v_paid, 0);

  SELECT * INTO v_dep
    FROM public.finance_deposits
   WHERE order_id = o.id AND source = 'alixwork' AND source_ref = 'order:' || o.id::text
   LIMIT 1;

  -- Keine Anzahlung (mehr) vereinbart -> automatischen Datensatz entfernen
  IF v_soll <= 0 THEN
    IF FOUND THEN
      DELETE FROM public.finance_deposits WHERE id = v_dep.id;
    END IF;
    RETURN;
  END IF;

  IF v_paid >= v_soll THEN
    v_status  := 'bezahlt';
    v_release := 'auto_freigegeben';
  ELSIF v_paid > 0 THEN
    v_status  := 'teilweise';
    v_release := 'teilweise';
  ELSE
    v_status  := 'offen';
    v_release := 'wartet';
  END IF;

  SELECT company_name, contact_name INTO v_cust FROM public.customers WHERE id = o.customer_id;

  IF v_dep.id IS NULL THEN
    INSERT INTO public.finance_deposits (
      source, source_ref, deposit_number, customer_id, customer_name, company_name, contact_name,
      order_id, order_number, currency,
      net_amount, vat_amount, gross_amount, paid_amount,
      issue_date, status, release_status, accounting_region, note
    ) VALUES (
      'alixwork', 'order:' || o.id::text, o.order_number, o.customer_id,
      COALESCE(v_cust.company_name, v_cust.contact_name), v_cust.company_name, v_cust.contact_name,
      o.id, o.order_number, COALESCE(o.currency, 'EUR'),
      v_soll, 0, v_soll, v_paid,
      COALESCE(o.deposit_booking_date, o.order_date::date, CURRENT_DATE),
      v_status, v_release, COALESCE(o.accounting_region, 'EU'),
      'Automatisch aus Auftrag ' || COALESCE(o.order_number, '')
    );
  ELSE
    UPDATE public.finance_deposits
       SET gross_amount   = v_soll,
           net_amount     = CASE WHEN COALESCE(vat_amount,0) > 0 THEN v_soll - COALESCE(vat_amount,0) ELSE v_soll END,
           paid_amount    = v_paid,
           order_number   = COALESCE(o.order_number, order_number),
           customer_id    = COALESCE(o.customer_id, customer_id),
           status         = CASE WHEN status = 'gebucht' AND v_paid >= v_soll THEN 'gebucht' ELSE v_status END,
           release_status = CASE WHEN release_status IN ('manuell_freigegeben','gesperrt') THEN release_status ELSE v_release END,
           updated_at     = now()
     WHERE id = v_dep.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_deposit_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_order_deposit_to_finance(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_order_add_deposit_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_order_deposit_to_finance(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_deposit_sync ON public.orders;
CREATE TRIGGER trg_orders_deposit_sync
AFTER INSERT OR UPDATE OF deposit_amount, deposit_ok, deposit_booking_date, deposit_additional
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_deposit_sync();

DROP TRIGGER IF EXISTS trg_order_add_deposit_sync ON public.order_additional_deposits;
CREATE TRIGGER trg_order_add_deposit_sync
AFTER INSERT OR UPDATE OR DELETE
ON public.order_additional_deposits
FOR EACH ROW EXECUTE FUNCTION public.trg_order_add_deposit_sync();

-- Einmaliger Abgleich bestehender Aufträge mit Anzahlung
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id
      FROM public.orders o
      LEFT JOIN public.order_additional_deposits a ON a.order_id = o.id
     WHERE COALESCE(o.deposit_amount,0) > 0 OR a.id IS NOT NULL
  LOOP
    PERFORM public.sync_order_deposit_to_finance(r.id);
  END LOOP;
END $$;
