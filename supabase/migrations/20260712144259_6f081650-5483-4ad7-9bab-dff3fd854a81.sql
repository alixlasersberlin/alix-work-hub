
CREATE OR REPLACE FUNCTION public.trg_ticket_notify_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NEW.kind NOT IN ('assigned','mention','new_customer_message','sla_breach','handover','escalation') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL; v_key := NULL;
  END;

  IF v_url IS NULL THEN
    v_url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/ticket-user-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_key, current_setting('app.settings.service_role_key', true))
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_notify_user_email ON public.ticket_notifications;
CREATE TRIGGER trg_ticket_notify_user_email
AFTER INSERT ON public.ticket_notifications
FOR EACH ROW
EXECUTE FUNCTION public.trg_ticket_notify_user_email();
