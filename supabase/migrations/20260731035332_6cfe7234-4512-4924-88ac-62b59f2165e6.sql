
-- 1) Auto-Region-Trigger für manuellen Umzug übersteuerbar machen
CREATE OR REPLACE FUNCTION public.zoho_invoice_set_region()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('finance.skip_region_trigger', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF (NEW.raw_data::text ILIKE '%Alix Lasers ® Schweiz%')
     OR (NEW.raw_data::text ILIKE '%Alix Lasers (R) Schweiz%')
     OR (upper(coalesce(NEW.currency,'')) = 'CHF') THEN
    NEW.accounting_region := 'CH';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.zoho_recurring_invoice_set_region()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('finance.skip_region_trigger', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF upper(coalesce(NEW.currency, '')) = 'CHF'
     OR coalesce(NEW.raw_data::text, '') ILIKE '%Alix Lasers ® Schweiz%'
     OR coalesce(NEW.raw_data::text, '') ILIKE '%Alix Lasers (R) Schweiz%'
     OR coalesce(NEW.billing_address::text, '') ILIKE '%schweiz%'
     OR coalesce(NEW.billing_address::text, '') ILIKE '%switzerland%'
  THEN
    NEW.accounting_region := 'CH';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Umzugs-Funktion
CREATE OR REPLACE FUNCTION public.finance_move_region(
  p_target public.accounting_region,
  p_customer_names text[] DEFAULT NULL,
  p_invoice_ids uuid[] DEFAULT NULL,
  p_recurring_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_names text[];
  v_customers uuid[];
  v_res jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')) THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;

  PERFORM set_config('finance.skip_region_trigger', '1', true);

  v_names := (SELECT array_agg(DISTINCT lower(btrim(x))) FROM unnest(coalesce(p_customer_names, '{}')) AS x WHERE btrim(x) <> '');

  -- Rechnungen (explizit gewählt oder über Kundenkonto)
  UPDATE public.zoho_invoices SET accounting_region = p_target
   WHERE (p_invoice_ids IS NOT NULL AND id = ANY(p_invoice_ids))
      OR (v_names IS NOT NULL AND lower(btrim(coalesce(customer_name,''))) = ANY(v_names));
  GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('invoices', n);

  UPDATE public.zoho_recurring_invoices SET accounting_region = p_target
   WHERE (p_recurring_ids IS NOT NULL AND id = ANY(p_recurring_ids))
      OR (v_names IS NOT NULL AND lower(btrim(coalesce(customer_name,''))) = ANY(v_names));
  GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('recurring_invoices', n);

  IF v_names IS NOT NULL THEN
    UPDATE public.zoho_recurring_profiles SET accounting_region = p_target
     WHERE lower(btrim(coalesce(customer_name,''))) = ANY(v_names)
        OR lower(btrim(coalesce(company_name,''))) = ANY(v_names);
    GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('recurring_profiles', n);

    SELECT array_agg(id) INTO v_customers FROM public.customers
      WHERE lower(btrim(coalesce(company_name,''))) = ANY(v_names)
         OR lower(btrim(coalesce(contact_name,''))) = ANY(v_names);

    IF v_customers IS NOT NULL THEN
      UPDATE public.customers SET accounting_region = p_target WHERE id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('customers', n);

      UPDATE public.finance_transactions SET accounting_region = p_target WHERE customer_id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('transactions', n);

      UPDATE public.finance_deposits SET accounting_region = p_target WHERE customer_id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('deposits', n);

      UPDATE public.finance_contracts SET accounting_region = p_target WHERE customer_id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('contracts', n);

      UPDATE public.finance_accounts SET accounting_region = p_target WHERE customer_id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('accounts', n);

      UPDATE public.finance_reminders SET accounting_region = p_target WHERE customer_id = ANY(v_customers);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('reminders', n);

      UPDATE public.orders SET accounting_region = p_target
       WHERE customer_id = ANY(v_customers)
         AND accounting_region IS DISTINCT FROM p_target
         AND NOT EXISTS (SELECT 1 FROM public.finance_transactions ft WHERE ft.order_id = orders.id);
      GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('orders', n);
    END IF;
  END IF;

  -- Journalbuchungen der betroffenen Rechnungen mitnehmen
  UPDATE public.finance_journal j SET accounting_region = p_target
   WHERE j.source_table IN ('zoho_invoices','zoho_recurring_invoices')
     AND (
       (p_invoice_ids IS NOT NULL AND j.source_id = ANY(p_invoice_ids))
       OR (p_recurring_ids IS NOT NULL AND j.source_id = ANY(p_recurring_ids))
       OR (v_names IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.zoho_invoices zi
              WHERE zi.id = j.source_id AND lower(btrim(coalesce(zi.customer_name,''))) = ANY(v_names))
       )
     );
  GET DIAGNOSTICS n = ROW_COUNT; v_res := v_res || jsonb_build_object('journal', n);

  PERFORM set_config('finance.skip_region_trigger', '0', true);
  RETURN v_res || jsonb_build_object('target', p_target);
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_move_region(public.accounting_region, text[], uuid[], uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finance_move_region(public.accounting_region, text[], uuid[], uuid[]) TO authenticated, service_role;
