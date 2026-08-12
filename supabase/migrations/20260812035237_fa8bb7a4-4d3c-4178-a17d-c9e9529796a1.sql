-- 1) Approval + task + escalation columns
ALTER TABLE public.fc_cases
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'offen',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_date date,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 2) Auto task defaults on insert
CREATE OR REPLACE FUNCTION public.fc_set_task_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_default uuid;
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (COALESCE(NEW.created_at, now()) + interval '3 days')::date;
  END IF;
  IF NEW.followup_date IS NULL THEN
    NEW.followup_date := NEW.due_date;
  END IF;
  IF NEW.assigned_to IS NULL THEN
    SELECT NULLIF(value, '')::uuid INTO v_default
      FROM public.app_settings WHERE key = 'fc_default_assignee' LIMIT 1;
    IF v_default IS NOT NULL THEN
      NEW.assigned_to := v_default;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fc_task_defaults ON public.fc_cases;
CREATE TRIGGER trg_fc_task_defaults
BEFORE INSERT ON public.fc_cases
FOR EACH ROW EXECUTE FUNCTION public.fc_set_task_defaults();

-- 3) Escalation engine (gelb -> rot after 3 days without invoice) + notifications
CREATE OR REPLACE FUNCTION public.fc_run_escalation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case record;
  v_count int := 0;
  v_notified int := 0;
  v_uid uuid;
BEGIN
  FOR v_case IN
    SELECT * FROM public.fc_cases
    WHERE status <> 'abgeschlossen'
      AND open_to_invoice > 0.01
      AND traffic IN ('gruen', 'gelb')
      AND created_at < now() - interval '3 days'
  LOOP
    UPDATE public.fc_cases
       SET traffic = 'rot',
           priority = CASE WHEN priority = 'normal' THEN 'hoch' ELSE priority END,
           escalated_at = now(),
           updated_at = now()
     WHERE id = v_case.id;

    INSERT INTO public.fc_events (case_id, event_type, comment, payload)
    VALUES (v_case.id, 'eskalation',
            'Automatische Eskalation: seit über 3 Tagen ohne vollständige Rechnung',
            jsonb_build_object('open_to_invoice', v_case.open_to_invoice));

    v_count := v_count + 1;

    IF v_case.assigned_to IS NOT NULL THEN
      INSERT INTO public.app_notifications (user_id, category, title, message, priority, action_url, metadata)
      VALUES (v_case.assigned_to, 'finance',
              'Finance Controlling: Vorgang eskaliert',
              COALESCE(v_case.reference_number, '') || ' · ' || COALESCE(v_case.customer_name, '') ||
              ' – noch zu fakturieren: ' || to_char(COALESCE(v_case.open_to_invoice, 0), 'FM999G999G990D00') || ' EUR',
              'high', '/finance/finance-controlling',
              jsonb_build_object('case_id', v_case.id));
      v_notified := v_notified + 1;
    ELSE
      FOR v_uid IN
        SELECT ur.user_id FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE r.name IN ('Super Admin', 'Admin', 'Buchhaltung')
      LOOP
        INSERT INTO public.app_notifications (user_id, category, title, message, priority, action_url, metadata)
        VALUES (v_uid, 'finance',
                'Finance Controlling: Vorgang eskaliert',
                COALESCE(v_case.reference_number, '') || ' · ' || COALESCE(v_case.customer_name, ''),
                'high', '/finance/finance-controlling',
                jsonb_build_object('case_id', v_case.id));
        v_notified := v_notified + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('escalated', v_count, 'notifications', v_notified);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fc_run_escalation() FROM anon;
GRANT EXECUTE ON FUNCTION public.fc_run_escalation() TO authenticated, service_role;

-- 4) Monatsabschluss
CREATE OR REPLACE FUNCTION public.fc_month_close(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'orders_closed', (SELECT count(*) FROM public.fc_cases
        WHERE trigger_event = 'auftrag_geschlossen'
          AND created_at::date BETWEEN p_from AND p_to),
    'invoices_created', (SELECT count(*) FROM public.fc_cases
        WHERE invoiced_amount > 0 AND created_at::date BETWEEN p_from AND p_to),
    'invoices_missing', (SELECT count(*) FROM public.fc_cases
        WHERE open_to_invoice > 0.01 AND status <> 'abgeschlossen'
          AND created_at::date BETWEEN p_from AND p_to),
    'revenue_not_invoiced', (SELECT COALESCE(sum(open_to_invoice), 0) FROM public.fc_cases
        WHERE open_to_invoice > 0.01 AND status <> 'abgeschlossen'
          AND created_at::date BETWEEN p_from AND p_to),
    'open_final_invoices', (SELECT count(*) FROM public.fc_cases
        WHERE case_type = 'SCHLUSSRECHNUNG' AND open_to_invoice > 0.01
          AND created_at::date BETWEEN p_from AND p_to),
    'open_repair_invoices', (SELECT count(*) FROM public.fc_cases
        WHERE case_type = 'REPARATUR' AND open_to_invoice > 0.01
          AND created_at::date BETWEEN p_from AND p_to),
    'open_partial_deliveries', (SELECT count(*) FROM public.fc_cases
        WHERE case_type = 'TEILLIEFERUNG' AND open_to_invoice > 0.01
          AND created_at::date BETWEEN p_from AND p_to),
    'open_to_pay_total', (SELECT COALESCE(sum(open_to_pay), 0) FROM public.fc_cases
        WHERE open_to_pay > 0.01 AND created_at::date BETWEEN p_from AND p_to),
    'approved', (SELECT count(*) FROM public.fc_cases
        WHERE approval_status = 'freigegeben' AND created_at::date BETWEEN p_from AND p_to),
    'awaiting_approval', (SELECT count(*) FROM public.fc_cases
        WHERE approval_status = 'offen' AND status <> 'abgeschlossen'
          AND created_at::date BETWEEN p_from AND p_to)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.fc_month_close(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.fc_month_close(date, date) TO authenticated, service_role;

-- 5) Daily escalation cron 06:00 UTC
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fc-escalation-daily';
SELECT cron.schedule('fc-escalation-daily', '0 6 * * *', $$ SELECT public.fc_run_escalation(); $$);