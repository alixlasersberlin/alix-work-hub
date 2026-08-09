CREATE OR REPLACE FUNCTION public.collect_sync_cases()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_created int := 0;
  v_updated int := 0;
  v_closed  int := 0;
BEGIN
  CREATE TEMP TABLE _inv ON COMMIT DROP AS
  SELECT i.id, i.customer_id, i.customer_name, i.currency, i.balance, i.total,
         i.invoice_number, i.invoice_date, i.due_date, i.status,
         COALESCE(i.is_deposit,false) AS is_deposit, 'zoho'::text AS source
    FROM public.zoho_invoices i
  UNION ALL
  SELECT r.id, r.customer_id, r.customer_name, r.currency, r.balance, r.total,
         r.invoice_number, r.invoice_date, r.due_date, r.status,
         COALESCE(r.is_deposit,false) AS is_deposit, 'zoho_recurring'::text AS source
    FROM public.zoho_recurring_invoices r;

  CREATE TEMP TABLE _open ON COMMIT DROP AS
  SELECT
    COALESCE(NULLIF(i.customer_id,''), i.customer_name) AS customer_key,
    MAX(i.customer_name) AS customer_name,
    MAX(COALESCE(i.currency,'EUR')) AS currency,
    SUM(COALESCE(i.balance,0)) AS open_amount,
    SUM(CASE WHEN i.due_date < CURRENT_DATE THEN COALESCE(i.balance,0) ELSE 0 END) AS overdue_amount,
    MIN(i.due_date) AS oldest_due_date,
    GREATEST(0, COALESCE(MAX(CURRENT_DATE - i.due_date),0))::int AS max_days_overdue
  FROM _inv i
  WHERE COALESCE(i.balance,0) > 0.009
    AND COALESCE(i.status,'') NOT IN ('void','draft','cancelled')
    AND COALESCE(i.customer_name,'') <> ''
  GROUP BY 1;

  INSERT INTO public.collect_cases (customer_key, customer_name, currency, open_amount, overdue_amount,
    oldest_due_date, max_days_overdue, status)
  SELECT o.customer_key, o.customer_name, o.currency, o.open_amount, o.overdue_amount,
         o.oldest_due_date, o.max_days_overdue, 'active'
  FROM _open o
  ON CONFLICT (customer_key) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    currency = EXCLUDED.currency,
    open_amount = EXCLUDED.open_amount,
    overdue_amount = EXCLUDED.overdue_amount,
    oldest_due_date = EXCLUDED.oldest_due_date,
    max_days_overdue = EXCLUDED.max_days_overdue,
    status = CASE WHEN public.collect_cases.status IN ('inkasso','anwalt','insolvenz','kulanz','payment_plan')
                  THEN public.collect_cases.status ELSE 'active' END;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.collect_cases c
     SET customer_id = cu.id
    FROM public.customers cu
   WHERE c.customer_id IS NULL
     AND cu.company_name = c.customer_name;

  UPDATE public.collect_cases c
     SET status = 'closed', open_amount = 0, overdue_amount = 0, ampel = 'gruen',
         stage_code = 'pre_due', max_days_overdue = 0
   WHERE c.status <> 'closed'
     AND NOT EXISTS (SELECT 1 FROM _open o WHERE o.customer_key = c.customer_key);
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  DELETE FROM public.collect_case_items ci
   USING public.collect_cases c
   WHERE ci.case_id = c.id;

  INSERT INTO public.collect_case_items (case_id, invoice_id, invoice_number, invoice_date, due_date,
    total, balance, currency, days_overdue, is_deposit, source)
  SELECT DISTINCT ON (c.id, COALESCE(i.invoice_number,''))
         c.id, i.id, i.invoice_number, i.invoice_date, i.due_date,
         COALESCE(i.total,0), COALESCE(i.balance,0), COALESCE(i.currency,'EUR'),
         GREATEST(0, COALESCE(CURRENT_DATE - i.due_date, 0))::int,
         i.is_deposit, i.source
    FROM _inv i
    JOIN public.collect_cases c
      ON c.customer_key = COALESCE(NULLIF(i.customer_id,''), i.customer_name)
   WHERE COALESCE(i.balance,0) > 0.009
     AND COALESCE(i.status,'') NOT IN ('void','draft','cancelled')
   ORDER BY c.id, COALESCE(i.invoice_number,''), i.due_date ASC NULLS LAST, i.balance DESC;

  UPDATE public.collect_cases c
     SET stage_code = s.code,
         stage_day = s.day_offset,
         ampel = CASE WHEN c.status IN ('inkasso','anwalt','insolvenz') THEN 'schwarz' ELSE s.ampel END,
         fee_amount = COALESCE((SELECT SUM(x.fee_amount) FROM public.collect_stage_config x
                                 WHERE x.active AND x.day_offset <= c.max_days_overdue),0),
         interest_amount = ROUND(COALESCE(c.overdue_amount,0) * (COALESCE(s.interest_rate_pct,0)/100.0) * (GREATEST(c.max_days_overdue,0)/365.0), 2)
    FROM (
      SELECT cc.id, st.code, st.day_offset, st.ampel, st.interest_rate_pct
        FROM public.collect_cases cc
        CROSS JOIN LATERAL (
          SELECT sc.code, sc.day_offset, sc.ampel, sc.interest_rate_pct
            FROM public.collect_stage_config sc
           WHERE sc.active AND sc.day_offset <= GREATEST(cc.max_days_overdue, -7)
           ORDER BY sc.day_offset DESC LIMIT 1
        ) st
       WHERE cc.status <> 'closed'
    ) s
   WHERE s.id = c.id;

  UPDATE public.collect_cases c
     SET priority = r.rn
    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY overdue_amount DESC, max_days_overdue DESC) rn
            FROM public.collect_cases WHERE status <> 'closed') r
   WHERE r.id = c.id;

  SELECT COUNT(*) INTO v_created FROM public.collect_cases WHERE status <> 'closed';

  RETURN jsonb_build_object('active_cases', v_created, 'upserted', v_updated, 'closed', v_closed);
END;
$function$;