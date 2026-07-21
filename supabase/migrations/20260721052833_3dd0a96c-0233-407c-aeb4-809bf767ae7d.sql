
ALTER TABLE public.ac_pbx_settings
  ADD COLUMN IF NOT EXISTS missed_call_sms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_call_sms_template TEXT NOT NULL DEFAULT 'Hallo, wir haben Ihren Anruf leider verpasst. Wir rufen Sie schnellstmöglich zurück. Ihr Alix-Team.',
  ADD COLUMN IF NOT EXISTS missed_call_sms_business_hours_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_call_sms_cooldown_minutes INT NOT NULL DEFAULT 60;

ALTER TABLE public.ac_calls
  ADD COLUMN IF NOT EXISTS missed_sms_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.ac_trigger_missed_call_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_anon TEXT;
BEGIN
  IF NEW.status <> 'missed' OR NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'missed' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_url FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO v_anon FROM public.app_settings WHERE key = 'supabase_anon_key';

  -- Fallback: harte Werte, falls app_settings leer
  IF v_url IS NULL THEN v_url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co'; END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/ac-missed-call-sms',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey', COALESCE(v_anon,'')
    ),
    body := jsonb_build_object('call_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_missed_call_sms ON public.ac_calls;
CREATE TRIGGER trg_ac_missed_call_sms
AFTER INSERT OR UPDATE OF status ON public.ac_calls
FOR EACH ROW EXECUTE FUNCTION public.ac_trigger_missed_call_sms();
