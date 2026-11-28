CREATE OR REPLACE FUNCTION public.notify_customer_event(_event text, _ticket_id uuid, _repair_order_id uuid, _recipient_email text, _customer_name text, _ticket_number text, _repair_number text, _message text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_secret text;
begin
  if _recipient_email is null or length(trim(_recipient_email)) = 0 then
    return;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ticket-customer-notify',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret,'x-cron-secret',v_secret),
    body := jsonb_build_object('event', _event, 'ticket_id', _ticket_id, 'repair_order_id', _repair_order_id,
      'recipient_email', _recipient_email, 'customer_name', _customer_name, 'ticket_number', _ticket_number,
      'repair_number', _repair_number, 'message', _message)
  );
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.notify_customer_event(text, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_customer_event(text, uuid, uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_order_change_request()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u RECORD; v_secret text;
BEGIN
  FOR u IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name = 'Super Admin'
  LOOP
    INSERT INTO public.app_notifications(user_id, category, title, message, priority, action_url, metadata)
    VALUES (
      u.user_id, 'order_change_request',
      'Neue Auftrags-Änderung zur Freigabe',
      COALESCE(NEW.requested_by_name, 'Ein Mitarbeiter') || ' möchte Auftrag ' || COALESCE(NEW.order_number,'') || ' ändern.',
      'high', '/freigaben',
      jsonb_build_object('change_request_id', NEW.id, 'order_id', NEW.order_id)
    );
  END LOOP;

  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/notify-order-change-request',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret,'x-cron-secret',v_secret),
      body := jsonb_build_object('id', NEW.id, 'event', 'created')
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.ac_trigger_missed_call_sms()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF NEW.status <> 'missed' OR NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'missed' THEN
    RETURN NEW;
  END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-missed-call-sms',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret,'x-cron-secret',v_secret),
    body := jsonb_build_object('call_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  j record;
  v_new text;
  v_hdr constant text := $h$headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1))$h$;
BEGIN
  FOR j IN SELECT jobid, command FROM cron.job WHERE jobid IN (28,29,39,44,51,56,63,71,75,79,86,87,97,111,112,133,136) LOOP
    v_new := regexp_replace(j.command, $re$headers\s*:=\s*'\{[^']*\}'(::jsonb)?$re$, v_hdr, 'i');
    IF v_new = j.command OR v_new NOT LIKE '%CRON_SECRET%' THEN
      RAISE EXCEPTION 'cron job % header not rewritten', j.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := j.jobid, command := v_new);
  END LOOP;
END $$;