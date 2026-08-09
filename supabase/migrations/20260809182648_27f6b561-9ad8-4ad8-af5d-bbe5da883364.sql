-- Helper: Mandanten-Scope über den Eltern-Auftrag
CREATE OR REPLACE FUNCTION public.order_tenant_scope_ok(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _order_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = _order_id AND public.tenant_scope_ok(o.source_system)
      );
$$;

DROP POLICY IF EXISTS tenant_data_scope_all ON public.order_items;
CREATE POLICY tenant_data_scope_all ON public.order_items
AS RESTRICTIVE FOR ALL
USING (public.order_tenant_scope_ok(order_id))
WITH CHECK (public.order_tenant_scope_ok(order_id));

DROP POLICY IF EXISTS tenant_data_scope_all ON public.route_plans;
CREATE POLICY tenant_data_scope_all ON public.route_plans
AS RESTRICTIVE FOR ALL
USING (public.order_tenant_scope_ok(order_id))
WITH CHECK (public.order_tenant_scope_ok(order_id));

-- Collect BI: optionaler Mandantenfilter
CREATE OR REPLACE FUNCTION public.collect_bi(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        FROM collect_cases c
        WHERE c.status <> 'closed'
          AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
        ORDER BY c.open_amount DESC NULLS LAST LIMIT 20) x), '[]'::jsonb),
    'by_stage', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT stage_code, COUNT(*)::int AS cnt, COALESCE(SUM(overdue_amount),0)::numeric AS amount
        FROM collect_cases
        WHERE status <> 'closed'
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        GROUP BY stage_code ORDER BY stage_code) x), '[]'::jsonb),
    'payments_by_week', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT to_char(date_trunc('week', booking_date), 'IYYY-IW') AS week,
               COALESCE(SUM(amount),0)::numeric AS amount
        FROM bank_transactions
        WHERE amount > 0 AND COALESCE(is_duplicate,false) = false
          AND booking_date >= current_date - 84
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        GROUP BY 1 ORDER BY 1) x), '[]'::jsonb),
    'by_region', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(accounting_region::text,'unbekannt') AS region,
               COUNT(*)::int AS cnt, COALESCE(SUM(balance),0)::numeric AS amount
        FROM zoho_invoices
        WHERE balance > 0
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        GROUP BY 1 ORDER BY 3 DESC) x), '[]'::jsonb),
    'return_debit_rate', COALESCE((
      SELECT jsonb_build_object(
        'returns', (SELECT COUNT(*) FROM bank_return_debits),
        'payments', (SELECT COUNT(*) FROM bank_transactions
                     WHERE amount > 0 AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)))), '{}'::jsonb),
    'dunning_costs', COALESCE((
      SELECT jsonb_build_object(
        'fees', COALESCE(SUM(fee_amount),0),
        'interest', COALESCE(SUM(interest_amount),0))
      FROM collect_cases
      WHERE status <> 'closed'
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)), '{}'::jsonb)
  ) INTO res;
  RETURN res;
END $function$;