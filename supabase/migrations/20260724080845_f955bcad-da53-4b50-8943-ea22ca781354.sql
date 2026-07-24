
-- Order-Block-Check
CREATE OR REPLACE FUNCTION public.credit_check_order_block(_customer_id uuid, _amount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.credit_assessments%ROWTYPE;
  max_credit numeric;
  block boolean := false;
  reason text := NULL;
BEGIN
  IF _customer_id IS NULL THEN
    RETURN jsonb_build_object('block', false, 'reason', 'no_customer', 'has_assessment', false);
  END IF;

  SELECT * INTO a
  FROM public.credit_assessments
  WHERE customer_id = _customer_id
    AND status IN ('approved','approved_with_conditions','rejected','pending_review')
    AND (valid_until IS NULL OR valid_until >= now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF a.id IS NULL THEN
    RETURN jsonb_build_object('block', false, 'has_assessment', false, 'hint', 'Keine aktive Bonitätsprüfung – Empfehlung: Prüfung anlegen.');
  END IF;

  max_credit := COALESCE((a.recommendation->>'max_credit')::numeric, 0);

  IF a.status = 'rejected' THEN
    block := true; reason := 'Bonitätsprüfung abgelehnt.';
  ELSIF a.status = 'pending_review' THEN
    block := true; reason := format('Bonitätsprüfung wartet auf Freigabe (Stufe: %s).', a.workflow_stage);
  ELSIF _amount IS NOT NULL AND max_credit > 0 AND _amount > max_credit THEN
    block := true; reason := format('Betrag %s EUR überschreitet empfohlenen Rahmen %s EUR.', _amount, max_credit);
  END IF;

  RETURN jsonb_build_object(
    'block', block, 'reason', reason, 'has_assessment', true,
    'assessment_id', a.id, 'score', a.score, 'ampel', a.ampel,
    'status', a.status, 'max_credit', max_credit, 'valid_until', a.valid_until,
    'recommendation', a.recommendation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_check_order_block(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_check_order_block(uuid, numeric) TO authenticated, service_role;

-- Cron: abgelaufene Prüfungen markieren + alte Logs löschen
CREATE OR REPLACE FUNCTION public.credit_daily_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credit_assessments
  SET status = 'expired', workflow_stage = 'done', updated_at = now()
  WHERE status IN ('approved','approved_with_conditions','pending_review','draft','calculating')
    AND valid_until IS NOT NULL
    AND valid_until < now();

  DELETE FROM public.credit_decision_log
  WHERE created_at < now() - interval '3 years'
    AND assessment_id IN (
      SELECT id FROM public.credit_assessments WHERE status IN ('expired','rejected','cancelled')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_daily_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_daily_maintenance() TO service_role;

-- Schedule (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('credit-daily-maintenance') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'credit-daily-maintenance'
    );
    PERFORM cron.schedule(
      'credit-daily-maintenance',
      '15 3 * * *',
      $CRON$ SELECT public.credit_daily_maintenance(); $CRON$
    );
  END IF;
END $$;
