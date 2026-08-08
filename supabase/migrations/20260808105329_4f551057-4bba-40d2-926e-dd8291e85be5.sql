ALTER TABLE public.collect_cases ADD COLUMN IF NOT EXISTS customer_key text;
DROP INDEX IF EXISTS uq_collect_cases_customer_active;
UPDATE public.collect_cases SET customer_key = COALESCE(customer_id::text, customer_name) WHERE customer_key IS NULL;
CREATE UNIQUE INDEX uq_collect_cases_key ON public.collect_cases(customer_key);

CREATE OR REPLACE FUNCTION public.collect_sync_cases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_created int := 0;
  v_updated int := 0;
  v_closed  int := 0;
BEGIN
  CREATE TEMP TABLE _open ON COMMIT DROP AS
  SELECT
    COALESCE(NULLIF(i.customer_id,''), i.customer_name) AS customer_key,
    MAX(i.customer_name) AS customer_name,
    MAX(COALESCE(i.currency,'EUR')) AS currency,
    SUM(COALESCE(i.balance,0)) AS open_amount,
    SUM(CASE WHEN i.due_date < CURRENT_DATE THEN COALESCE(i.balance,0) ELSE 0 END) AS overdue_amount,
    MIN(i.due_date) AS oldest_due_date,
    GREATEST(0, COALESCE(MAX(CURRENT_DATE - i.due_date),0))::int AS max_days_overdue
  FROM public.zoho_invoices i
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

  -- Kunden-UUID nachtragen (eindeutiger Namens-Match)
  UPDATE public.collect_cases c
     SET customer_id = cu.id
    FROM public.customers cu
   WHERE c.customer_id IS NULL
     AND cu.company_name = c.customer_name;

  -- Fälle ohne offene Posten schließen
  UPDATE public.collect_cases c
     SET status = 'closed', open_amount = 0, overdue_amount = 0, ampel = 'gruen',
         stage_code = 'pre_due', max_days_overdue = 0
   WHERE c.status <> 'closed'
     AND NOT EXISTS (SELECT 1 FROM _open o WHERE o.customer_key = c.customer_key);
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  -- Positionen neu aufbauen
  DELETE FROM public.collect_case_items ci
   USING public.collect_cases c
   WHERE ci.case_id = c.id;

  INSERT INTO public.collect_case_items (case_id, invoice_id, invoice_number, invoice_date, due_date,
    total, balance, currency, days_overdue, is_deposit, source)
  SELECT DISTINCT ON (c.id, i.invoice_number)
         c.id, i.id, i.invoice_number, i.invoice_date, i.due_date,
         COALESCE(i.total,0), COALESCE(i.balance,0), COALESCE(i.currency,'EUR'),
         GREATEST(0, COALESCE(CURRENT_DATE - i.due_date, 0))::int,
         COALESCE(i.is_deposit,false), 'zoho'
    FROM public.zoho_invoices i
    JOIN public.collect_cases c
      ON c.customer_key = COALESCE(NULLIF(i.customer_id,''), i.customer_name)
   WHERE COALESCE(i.balance,0) > 0.009
     AND COALESCE(i.status,'') NOT IN ('void','draft','cancelled');

  -- Mahnstufe / Ampel / Kosten
  UPDATE public.collect_cases c
     SET stage_code = s.code,
         stage_day = s.day_offset,
         ampel = CASE WHEN c.status = 'inkasso' OR c.status = 'anwalt' OR c.status = 'insolvenz' THEN 'schwarz' ELSE s.ampel END,
         fee_amount = COALESCE((SELECT SUM(x.fee_amount) FROM public.collect_stage_config x
                                 WHERE x.active AND x.day_offset <= c.max_days_overdue),0),
         interest_amount = ROUND(c.overdue_amount * (COALESCE(s.interest_rate_pct,0)/100.0) * (c.max_days_overdue/365.0), 2)
    FROM LATERAL (
      SELECT * FROM public.collect_stage_config sc
       WHERE sc.active AND sc.day_offset <= GREATEST(c.max_days_overdue, -7)
       ORDER BY sc.day_offset DESC LIMIT 1
    ) s
   WHERE c.status <> 'closed';

  UPDATE public.collect_cases c
     SET priority = r.rn
    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY overdue_amount DESC, max_days_overdue DESC) rn
            FROM public.collect_cases WHERE status <> 'closed') r
   WHERE r.id = c.id;

  SELECT COUNT(*) INTO v_created FROM public.collect_cases WHERE status <> 'closed';

  RETURN jsonb_build_object('active_cases', v_created, 'upserted', v_updated, 'closed', v_closed);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.collect_sync_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collect_sync_cases() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.collect_dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE res jsonb;
BEGIN
  IF NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH inv AS (
    SELECT COALESCE(balance,0) bal, COALESCE(total,0) tot, due_date, invoice_date, last_payment_date, payment_status, status
      FROM public.zoho_invoices
     WHERE COALESCE(status,'') NOT IN ('void','draft','cancelled')
  ), open_inv AS (
    SELECT * FROM inv WHERE bal > 0.009
  )
  SELECT jsonb_build_object(
    'open_total', (SELECT COALESCE(SUM(bal),0) FROM open_inv),
    'overdue_total', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date < CURRENT_DATE),
    'due_today', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date = CURRENT_DATE),
    'bucket_1_7', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE CURRENT_DATE - due_date BETWEEN 1 AND 7),
    'bucket_8_14', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE CURRENT_DATE - due_date BETWEEN 8 AND 14),
    'bucket_15_30', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE CURRENT_DATE - due_date BETWEEN 15 AND 30),
    'bucket_31_60', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE CURRENT_DATE - due_date BETWEEN 31 AND 60),
    'bucket_60_plus', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE CURRENT_DATE - due_date > 60),
    'not_due', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date > CURRENT_DATE),
    'incoming_today', (SELECT COALESCE(SUM(tot-bal),0) FROM inv WHERE last_payment_date = CURRENT_DATE),
    'avg_payment_days', (SELECT ROUND(AVG(last_payment_date - invoice_date)::numeric,1) FROM inv
                          WHERE last_payment_date IS NOT NULL AND invoice_date IS NOT NULL AND bal <= 0.009),
    'dso', (SELECT CASE WHEN COALESCE(SUM(tot),0) = 0 THEN 0
                        ELSE ROUND((SELECT COALESCE(SUM(bal),0) FROM open_inv) / (SUM(tot)/365.0), 1) END
              FROM inv WHERE invoice_date >= CURRENT_DATE - 365),
    'payment_rate_pct', (SELECT CASE WHEN COUNT(*) = 0 THEN 0
                                ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE bal <= 0.009) / COUNT(*),1) END FROM inv),
    'cases_active', (SELECT COUNT(*) FROM public.collect_cases WHERE status <> 'closed'),
    'cases_inkasso', (SELECT COUNT(*) FROM public.collect_cases WHERE status = 'inkasso'),
    'cases_anwalt', (SELECT COUNT(*) FROM public.collect_cases WHERE status = 'anwalt'),
    'cases_insolvenz', (SELECT COUNT(*) FROM public.collect_cases WHERE status = 'insolvenz'),
    'amount_inkasso', (SELECT COALESCE(SUM(open_amount),0) FROM public.collect_cases WHERE status = 'inkasso'),
    'amount_anwalt', (SELECT COALESCE(SUM(open_amount),0) FROM public.collect_cases WHERE status = 'anwalt'),
    'amount_insolvenz', (SELECT COALESCE(SUM(open_amount),0) FROM public.collect_cases WHERE status = 'insolvenz'),
    'expected_7', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
    'expected_30', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
    'expected_90', (SELECT COALESCE(SUM(bal),0) FROM open_inv WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)
  ) INTO res;

  RETURN res;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.collect_dashboard_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collect_dashboard_kpis() TO authenticated, service_role;