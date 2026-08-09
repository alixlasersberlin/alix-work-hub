
CREATE OR REPLACE FUNCTION public.collect_sync_customer(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_case_id uuid;
  v_name text; v_currency text; v_open numeric; v_overdue numeric;
  v_oldest date; v_days int;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN RETURN; END IF;

  CREATE TEMP TABLE _inv_one ON COMMIT DROP AS
  SELECT i.id, i.customer_name, i.currency, i.balance, i.total, i.invoice_number,
         i.invoice_date, i.due_date, i.status, COALESCE(i.is_deposit,false) AS is_deposit,
         'zoho'::text AS source
    FROM public.zoho_invoices i
   WHERE COALESCE(NULLIF(i.customer_id,''), i.customer_name) = p_key
  UNION ALL
  SELECT r.id, r.customer_name, r.currency, r.balance, r.total, r.invoice_number,
         r.invoice_date, r.due_date, r.status, COALESCE(r.is_deposit,false),
         'zoho_recurring'::text
    FROM public.zoho_recurring_invoices r
   WHERE COALESCE(NULLIF(r.customer_id,''), r.customer_name) = p_key;

  SELECT MAX(customer_name), MAX(COALESCE(currency,'EUR')),
         SUM(COALESCE(balance,0)),
         SUM(CASE WHEN due_date < CURRENT_DATE THEN COALESCE(balance,0) ELSE 0 END),
         MIN(due_date),
         GREATEST(0, COALESCE(MAX(CURRENT_DATE - due_date),0))::int
    INTO v_name, v_currency, v_open, v_overdue, v_oldest, v_days
    FROM _inv_one
   WHERE COALESCE(balance,0) > 0.009
     AND COALESCE(status,'') NOT IN ('void','draft','cancelled')
     AND COALESCE(customer_name,'') <> '';

  IF v_name IS NULL THEN
    UPDATE public.collect_cases
       SET status = 'closed', open_amount = 0, overdue_amount = 0, ampel = 'gruen',
           stage_code = 'pre_due', max_days_overdue = 0
     WHERE customer_key = p_key AND status <> 'closed'
     RETURNING id INTO v_case_id;
    IF v_case_id IS NOT NULL THEN
      DELETE FROM public.collect_case_items WHERE case_id = v_case_id;
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.collect_cases (customer_key, customer_name, currency, open_amount,
    overdue_amount, oldest_due_date, max_days_overdue, status)
  VALUES (p_key, v_name, v_currency, v_open, v_overdue, v_oldest, v_days, 'active')
  ON CONFLICT (customer_key) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    currency = EXCLUDED.currency,
    open_amount = EXCLUDED.open_amount,
    overdue_amount = EXCLUDED.overdue_amount,
    oldest_due_date = EXCLUDED.oldest_due_date,
    max_days_overdue = EXCLUDED.max_days_overdue,
    status = CASE WHEN public.collect_cases.status IN ('inkasso','anwalt','insolvenz','kulanz','payment_plan')
                  THEN public.collect_cases.status ELSE 'active' END
  RETURNING id INTO v_case_id;

  UPDATE public.collect_cases c
     SET customer_id = cu.id
    FROM public.customers cu
   WHERE c.id = v_case_id AND c.customer_id IS NULL AND cu.company_name = c.customer_name;

  DELETE FROM public.collect_case_items WHERE case_id = v_case_id;

  INSERT INTO public.collect_case_items (case_id, invoice_id, invoice_number, invoice_date,
    due_date, total, balance, currency, days_overdue, is_deposit, source)
  SELECT DISTINCT ON (COALESCE(i.invoice_number,''))
         v_case_id, i.id, i.invoice_number, i.invoice_date, i.due_date,
         COALESCE(i.total,0), COALESCE(i.balance,0), COALESCE(i.currency,'EUR'),
         GREATEST(0, COALESCE(CURRENT_DATE - i.due_date, 0))::int, i.is_deposit, i.source
    FROM _inv_one i
   WHERE COALESCE(i.balance,0) > 0.009
     AND COALESCE(i.status,'') NOT IN ('void','draft','cancelled')
   ORDER BY COALESCE(i.invoice_number,''), i.due_date ASC NULLS LAST, i.balance DESC;

  UPDATE public.collect_cases c
     SET stage_code = st.code,
         stage_day = st.day_offset,
         ampel = CASE WHEN c.status IN ('inkasso','anwalt','insolvenz') THEN 'schwarz' ELSE st.ampel END,
         fee_amount = COALESCE((SELECT SUM(x.fee_amount) FROM public.collect_stage_config x
                                 WHERE x.active AND x.day_offset <= c.max_days_overdue),0),
         interest_amount = ROUND(COALESCE(c.overdue_amount,0) * (COALESCE(st.interest_rate_pct,0)/100.0) * (GREATEST(c.max_days_overdue,0)/365.0), 2)
    FROM LATERAL (
      SELECT sc.code, sc.day_offset, sc.ampel, sc.interest_rate_pct
        FROM public.collect_stage_config sc
       WHERE sc.active AND sc.day_offset <= GREATEST(v_days, -7)
       ORDER BY sc.day_offset DESC LIMIT 1
    ) st
   WHERE c.id = v_case_id AND c.status <> 'closed';

  DROP TABLE IF EXISTS _inv_one;
END;
$function$;

CREATE OR REPLACE FUNCTION public.collect_invoice_realtime_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_key text;
  v_new_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_key := COALESCE(NULLIF(OLD.customer_id,''), OLD.customer_name);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_key := COALESCE(NULLIF(NEW.customer_id,''), NEW.customer_name);
  END IF;

  IF v_new_key IS NOT NULL THEN
    PERFORM public.collect_sync_customer(v_new_key);
  END IF;
  IF v_old_key IS NOT NULL AND v_old_key IS DISTINCT FROM v_new_key THEN
    PERFORM public.collect_sync_customer(v_old_key);
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_collect_realtime_invoices ON public.zoho_invoices;
CREATE TRIGGER trg_collect_realtime_invoices
AFTER INSERT OR UPDATE OF balance, total, status, due_date, customer_id, customer_name, invoice_number, is_deposit
OR DELETE ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.collect_invoice_realtime_sync();

DROP TRIGGER IF EXISTS trg_collect_realtime_recurring ON public.zoho_recurring_invoices;
CREATE TRIGGER trg_collect_realtime_recurring
AFTER INSERT OR UPDATE OF balance, total, status, due_date, customer_id, customer_name, invoice_number, is_deposit
OR DELETE ON public.zoho_recurring_invoices
FOR EACH ROW EXECUTE FUNCTION public.collect_invoice_realtime_sync();
