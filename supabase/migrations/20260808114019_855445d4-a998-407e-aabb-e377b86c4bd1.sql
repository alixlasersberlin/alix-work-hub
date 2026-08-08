
CREATE OR REPLACE FUNCTION public.collect_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  IF NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'liquidity', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ba.id, ba.bank_name, ba.account_name, ba.currency,
               COALESCE(SUM(bt.amount),0)::numeric AS balance
        FROM bank_accounts ba
        LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id AND COALESCE(bt.is_duplicate,false) = false
        WHERE COALESCE(ba.active,true)
        GROUP BY ba.id, ba.bank_name, ba.account_name, ba.currency
        ORDER BY ba.bank_name
      ) x), '[]'::jsonb),
    'expected', jsonb_build_object(
      'today',      COALESCE((SELECT SUM(balance) FROM zoho_invoices WHERE balance > 0 AND due_date = current_date),0),
      'tomorrow',   COALESCE((SELECT SUM(balance) FROM zoho_invoices WHERE balance > 0 AND due_date = current_date + 1),0),
      'this_week',  COALESCE((SELECT SUM(balance) FROM zoho_invoices WHERE balance > 0 AND due_date BETWEEN current_date AND current_date + 7),0),
      'this_month', COALESCE((SELECT SUM(balance) FROM zoho_invoices WHERE balance > 0 AND due_date BETWEEN current_date AND (date_trunc('month', current_date) + interval '1 month - 1 day')::date),0),
      'promises',   COALESCE((SELECT SUM(amount) FROM collect_promises WHERE status = 'open' AND promised_date <= current_date + 7),0)
    ),
    'receivables', jsonb_build_object(
      'open_total',     COALESCE((SELECT SUM(open_amount) FROM collect_cases WHERE status <> 'closed'),0),
      'overdue_total',  COALESCE((SELECT SUM(overdue_amount) FROM collect_cases WHERE status <> 'closed'),0),
      'case_count',     COALESCE((SELECT COUNT(*) FROM collect_cases WHERE status <> 'closed'),0),
      'critical_count', COALESCE((SELECT COUNT(*) FROM collect_cases WHERE status <> 'closed' AND max_days_overdue >= 60),0),
      'critical_total', COALESCE((SELECT SUM(overdue_amount) FROM collect_cases WHERE status <> 'closed' AND max_days_overdue >= 60),0),
      'risk_amount',    COALESCE((SELECT SUM(overdue_amount * (100 - COALESCE(pay_probability_pct, 50)) / 100.0) FROM collect_cases WHERE status <> 'closed'),0),
      'ai_expected_today', COALESCE((
        SELECT SUM(c.overdue_amount * COALESCE(c.pay_probability_pct,50) / 100.0 / GREATEST(COALESCE(c.max_days_overdue,1),7))
        FROM collect_cases c WHERE c.status <> 'closed'),0)
    ),
    'aging', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT bucket, SUM(amount)::numeric AS amount, COUNT(*)::int AS cnt FROM (
          SELECT CASE
            WHEN max_days_overdue <= 0 THEN 'nicht faellig'
            WHEN max_days_overdue <= 30 THEN '1-30'
            WHEN max_days_overdue <= 60 THEN '31-60'
            WHEN max_days_overdue <= 90 THEN '61-90'
            ELSE '90+' END AS bucket,
            overdue_amount AS amount
          FROM collect_cases WHERE status <> 'closed'
        ) y GROUP BY bucket
      ) x), '[]'::jsonb),
    'payments_today', COALESCE((
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(amount),0))
      FROM bank_transactions
      WHERE booking_date = current_date AND amount > 0 AND COALESCE(is_duplicate,false) = false
    ), jsonb_build_object('count',0,'amount',0)),
    'promises_open', COALESCE((SELECT COUNT(*) FROM collect_promises WHERE status = 'open'),0),
    'promises_broken', COALESCE((SELECT COUNT(*) FROM collect_promises WHERE status = 'open' AND promised_date < current_date),0),
    'return_debits', COALESCE((SELECT COUNT(*) FROM bank_return_debits WHERE status <> 'closed'),0),
    'blocks_active', COALESCE((SELECT COUNT(*) FROM collect_blocks WHERE active),0),
    'legal_cases', COALESCE((SELECT COUNT(*) FROM collect_legal_cases WHERE status <> 'closed'),0),
    'insolvencies', COALESCE((SELECT COUNT(*) FROM collect_insolvencies WHERE status <> 'closed'),0),
    'tasks_today', COALESCE((SELECT COUNT(*) FROM collect_tasks WHERE status = 'open' AND due_date <= current_date),0),
    'forecast', jsonb_build_object(
      'd7',  COALESCE((SELECT SUM(balance * 0.6) FROM zoho_invoices WHERE balance > 0 AND due_date <= current_date + 7),0),
      'd30', COALESCE((SELECT SUM(balance * 0.5) FROM zoho_invoices WHERE balance > 0 AND due_date <= current_date + 30),0),
      'd90', COALESCE((SELECT SUM(balance * 0.4) FROM zoho_invoices WHERE balance > 0 AND due_date <= current_date + 90),0)
    ),
    'top_debtors', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT id, customer_name, overdue_amount, max_days_overdue, pay_probability_pct, ampel
        FROM collect_cases WHERE status <> 'closed'
        ORDER BY overdue_amount DESC NULLS LAST LIMIT 10
      ) x), '[]'::jsonb)
  ) INTO res;

  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.collect_bi()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'top20', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT c.id, c.customer_name, c.open_amount, c.overdue_amount, c.max_days_overdue,
               c.pay_probability_pct, c.risk_class
        FROM collect_cases c WHERE c.status <> 'closed'
        ORDER BY c.open_amount DESC NULLS LAST LIMIT 20) x), '[]'::jsonb),
    'by_stage', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT stage_code, COUNT(*)::int AS cnt, COALESCE(SUM(overdue_amount),0)::numeric AS amount
        FROM collect_cases WHERE status <> 'closed' GROUP BY stage_code ORDER BY stage_code) x), '[]'::jsonb),
    'payments_by_week', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT to_char(date_trunc('week', booking_date), 'IYYY-IW') AS week,
               COALESCE(SUM(amount),0)::numeric AS amount
        FROM bank_transactions
        WHERE amount > 0 AND COALESCE(is_duplicate,false) = false
          AND booking_date >= current_date - 84
        GROUP BY 1 ORDER BY 1) x), '[]'::jsonb),
    'by_region', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(accounting_region::text,'unbekannt') AS region,
               COUNT(*)::int AS cnt, COALESCE(SUM(balance),0)::numeric AS amount
        FROM zoho_invoices WHERE balance > 0 GROUP BY 1 ORDER BY 3 DESC) x), '[]'::jsonb),
    'return_debit_rate', COALESCE((
      SELECT jsonb_build_object(
        'returns', (SELECT COUNT(*) FROM bank_return_debits),
        'payments', (SELECT COUNT(*) FROM bank_transactions WHERE amount > 0))), '{}'::jsonb),
    'dunning_costs', COALESCE((
      SELECT jsonb_build_object(
        'fees', COALESCE(SUM(fee_amount),0),
        'interest', COALESCE(SUM(interest_amount),0))
      FROM collect_cases WHERE status <> 'closed'), '{}'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

REVOKE EXECUTE ON FUNCTION public.collect_dashboard() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.collect_bi() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.collect_dashboard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.collect_bi() TO authenticated, service_role;
