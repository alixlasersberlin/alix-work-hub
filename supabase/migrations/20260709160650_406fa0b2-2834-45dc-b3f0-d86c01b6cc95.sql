
-- =========================================================================
-- SECURITY FIX 1: Finance policies scoped to 'authenticated' (was 'public')
-- =========================================================================
ALTER POLICY finance_accounts_insert           ON public.finance_accounts             TO authenticated;
ALTER POLICY finance_accounts_select           ON public.finance_accounts             TO authenticated;
ALTER POLICY finance_accounts_update           ON public.finance_accounts             TO authenticated;

ALTER POLICY finance_contracts_insert          ON public.finance_contracts            TO authenticated;
ALTER POLICY finance_contracts_select          ON public.finance_contracts            TO authenticated;
ALTER POLICY finance_contracts_update          ON public.finance_contracts            TO authenticated;

ALTER POLICY finance_reminders_insert          ON public.finance_reminders            TO authenticated;
ALTER POLICY finance_reminders_select          ON public.finance_reminders            TO authenticated;
ALTER POLICY finance_reminders_update          ON public.finance_reminders            TO authenticated;

ALTER POLICY finance_reminder_items_insert     ON public.finance_reminder_items       TO authenticated;
ALTER POLICY finance_reminder_items_select     ON public.finance_reminder_items       TO authenticated;
ALTER POLICY finance_reminder_items_update     ON public.finance_reminder_items       TO authenticated;

ALTER POLICY finance_history_insert            ON public.finance_history              TO authenticated;
ALTER POLICY finance_history_select            ON public.finance_history              TO authenticated;
ALTER POLICY finance_history_update            ON public.finance_history              TO authenticated;

ALTER POLICY finance_bank_statements_insert    ON public.finance_bank_statements      TO authenticated;
ALTER POLICY finance_bank_statements_select    ON public.finance_bank_statements      TO authenticated;
ALTER POLICY finance_bank_statements_update    ON public.finance_bank_statements      TO authenticated;

ALTER POLICY finance_sepa_mandates_insert      ON public.finance_sepa_mandates        TO authenticated;
ALTER POLICY finance_sepa_mandates_select      ON public.finance_sepa_mandates        TO authenticated;
ALTER POLICY finance_sepa_mandates_update      ON public.finance_sepa_mandates        TO authenticated;

ALTER POLICY finance_bank_lines_insert         ON public.finance_bank_lines           TO authenticated;
ALTER POLICY finance_bank_lines_select         ON public.finance_bank_lines           TO authenticated;
ALTER POLICY finance_bank_lines_update         ON public.finance_bank_lines           TO authenticated;

ALTER POLICY finance_cashbook_insert           ON public.finance_cashbook             TO authenticated;
ALTER POLICY finance_cashbook_select           ON public.finance_cashbook             TO authenticated;
ALTER POLICY finance_cashbook_update           ON public.finance_cashbook             TO authenticated;

ALTER POLICY finance_cashbook_closures_insert  ON public.finance_cashbook_closures    TO authenticated;
ALTER POLICY finance_cashbook_closures_select  ON public.finance_cashbook_closures    TO authenticated;
ALTER POLICY finance_cashbook_closures_update  ON public.finance_cashbook_closures    TO authenticated;

ALTER POLICY finance_deposits_insert           ON public.finance_deposits             TO authenticated;
ALTER POLICY finance_deposits_select           ON public.finance_deposits             TO authenticated;
ALTER POLICY finance_deposits_update           ON public.finance_deposits             TO authenticated;

ALTER POLICY finance_deposit_bookings_insert   ON public.finance_deposit_bookings     TO authenticated;
ALTER POLICY finance_deposit_bookings_select   ON public.finance_deposit_bookings     TO authenticated;
ALTER POLICY finance_deposit_bookings_update   ON public.finance_deposit_bookings     TO authenticated;

ALTER POLICY finance_deposit_history_insert    ON public.finance_deposit_history      TO authenticated;
ALTER POLICY finance_deposit_history_select    ON public.finance_deposit_history      TO authenticated;
ALTER POLICY finance_deposit_history_update    ON public.finance_deposit_history      TO authenticated;

ALTER POLICY finance_deposit_notifications_insert ON public.finance_deposit_notifications TO authenticated;
ALTER POLICY finance_deposit_notifications_select ON public.finance_deposit_notifications TO authenticated;
ALTER POLICY finance_deposit_notifications_update ON public.finance_deposit_notifications TO authenticated;

ALTER POLICY finance_bank_postings_insert      ON public.finance_bank_postings        TO authenticated;
ALTER POLICY finance_bank_postings_select      ON public.finance_bank_postings        TO authenticated;
ALTER POLICY finance_bank_postings_update      ON public.finance_bank_postings        TO authenticated;

-- =========================================================================
-- SECURITY FIX 2: Restrict customers.iban / bic / bank_name to Finance only
-- Revoke column-level SELECT from authenticated; expose banking via SECURITY
-- DEFINER RPC that checks Finance access.
-- =========================================================================
REVOKE SELECT (iban, bic, bank_name) ON public.customers FROM authenticated;
REVOKE SELECT (iban, bic, bank_name) ON public.customers FROM anon;

-- Keep UPDATE on those columns for admins (RLS still governs row access);
-- Finance/Admin write paths continue to work because table-level UPDATE grant remains.
COMMENT ON COLUMN public.customers.iban IS 'Sensitive banking data. Read via public.get_customer_banking(). Column-level SELECT restricted to service_role.';
COMMENT ON COLUMN public.customers.bic IS 'Sensitive banking data. Read via public.get_customer_banking().';
COMMENT ON COLUMN public.customers.bank_name IS 'Sensitive banking data. Read via public.get_customer_banking().';

CREATE OR REPLACE FUNCTION public.get_customer_banking(_customer_id uuid)
RETURNS TABLE (iban text, bic text, bank_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_finance_module() THEN
    RAISE EXCEPTION 'Not authorized to read customer banking data' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.iban, c.bic, c.bank_name
      FROM public.customers c
     WHERE c.id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_banking(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_customer_banking(uuid) TO authenticated;

-- =========================================================================
-- SECURITY FIX 3: Server-side validation & light abuse controls for
-- anonymous public booking submissions (esc_public_bookings)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.validate_esc_public_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent int;
BEGIN
  -- Length caps (defensive; UI limits already exist)
  IF length(coalesce(NEW.customer_name, '')) = 0 OR length(NEW.customer_name) > 120 THEN
    RAISE EXCEPTION 'Ungültiger Name (1–120 Zeichen erforderlich)';
  END IF;
  IF length(coalesce(NEW.customer_email, '')) = 0 OR length(NEW.customer_email) > 255 THEN
    RAISE EXCEPTION 'Ungültige E-Mail-Adresse';
  END IF;
  IF NEW.customer_email !~* '^[A-Za-z0-9._%%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'E-Mail-Format ungültig';
  END IF;
  IF NEW.customer_phone IS NOT NULL AND length(NEW.customer_phone) > 40 THEN
    RAISE EXCEPTION 'Telefonnummer zu lang';
  END IF;
  IF NEW.company_name IS NOT NULL AND length(NEW.company_name) > 200 THEN
    RAISE EXCEPTION 'Firmenname zu lang';
  END IF;
  IF NEW.message IS NOT NULL AND length(NEW.message) > 2000 THEN
    RAISE EXCEPTION 'Nachricht zu lang (max. 2000 Zeichen)';
  END IF;
  IF NEW.preferred_start_at IS NOT NULL AND NEW.preferred_start_at < now() - interval '1 day' THEN
    RAISE EXCEPTION 'Wunschtermin liegt in der Vergangenheit';
  END IF;

  -- Light abuse control: max 3 submissions per email per hour
  SELECT count(*) INTO v_recent
    FROM public.esc_public_bookings
   WHERE lower(customer_email) = lower(NEW.customer_email)
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Zu viele Anfragen. Bitte später erneut versuchen.' USING ERRCODE = '42901';
  END IF;

  -- Light abuse control: max 10 submissions per IP per hour
  IF NEW.ip_address IS NOT NULL THEN
    SELECT count(*) INTO v_recent
      FROM public.esc_public_bookings
     WHERE ip_address = NEW.ip_address
       AND created_at > now() - interval '1 hour';
    IF v_recent >= 10 THEN
      RAISE EXCEPTION 'Zu viele Anfragen von dieser IP.' USING ERRCODE = '42901';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_esc_public_booking ON public.esc_public_bookings;
CREATE TRIGGER trg_validate_esc_public_booking
BEFORE INSERT ON public.esc_public_bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_esc_public_booking();
