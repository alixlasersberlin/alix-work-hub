CREATE OR REPLACE FUNCTION public.merge_customers(_primary_id uuid, _duplicate_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbls text[] := ARRAY[
    'academy_bookings','aic_tasks','alix_sign_requests','alix_sign_signatures',
    'customer_communication_log','customer_notes','customer_portal_document_downloads',
    'customer_portal_quote_responses','customer_portal_tickets','customer_portal_users',
    'device_lifecycle','device_maintenance','finance_accounts','finance_contracts',
    'finance_documents','finance_reminders','finance_sepa_mandates','finance_sepa_run_items',
    'finance_transactions','goodwill_cases','loaner_device_assignments','mail_attachments',
    'mail_automation_runs','mail_followups','mail_internal_messages','mail_messages',
    'mail_notes','mail_phone_notes','mail_recipients','mail_tasks','mail_unsubscribes',
    'maintenance_confirmations','maintenance_reminder_log','orders','production_orders',
    'repair_invoice_proposals','repair_orders','reviews','route_plans','spare_part_consumption',
    'warranty_decisions','warranty_records','whatsapp_consents','whatsapp_messages'
  ];
  t text;
  moved jsonb := '{}'::jsonb;
  rc integer;
  result jsonb;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Kunden zusammenführen';
  END IF;

  IF _primary_id IS NULL OR _duplicate_ids IS NULL OR array_length(_duplicate_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Primärer Kunde und Duplikate erforderlich';
  END IF;

  IF _primary_id = ANY(_duplicate_ids) THEN
    RAISE EXCEPTION 'Primärer Kunde darf nicht in der Duplikatliste sein';
  END IF;

  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('UPDATE public.%I SET customer_id = $1 WHERE customer_id = ANY($2)', t)
      USING _primary_id, _duplicate_ids;
    GET DIAGNOSTICS rc = ROW_COUNT;
    IF rc > 0 THEN
      moved := moved || jsonb_build_object(t, rc);
    END IF;
  END LOOP;

  UPDATE public.customers p SET
    email        = COALESCE(NULLIF(p.email, ''), d.email),
    phone        = COALESCE(NULLIF(p.phone, ''), d.phone),
    company_name = COALESCE(NULLIF(p.company_name, ''), d.company_name),
    contact_name = COALESCE(NULLIF(p.contact_name, ''), d.contact_name),
    birth_date   = COALESCE(p.birth_date, d.birth_date),
    updated_at   = now()
  FROM (
    SELECT
      (array_agg(email)        FILTER (WHERE email IS NOT NULL AND email <> ''))[1] AS email,
      (array_agg(phone)        FILTER (WHERE phone IS NOT NULL AND phone <> ''))[1] AS phone,
      (array_agg(company_name) FILTER (WHERE company_name IS NOT NULL AND company_name <> ''))[1] AS company_name,
      (array_agg(contact_name) FILTER (WHERE contact_name IS NOT NULL AND contact_name <> ''))[1] AS contact_name,
      (array_agg(birth_date)   FILTER (WHERE birth_date IS NOT NULL))[1] AS birth_date
    FROM public.customers
    WHERE id = ANY(_duplicate_ids)
  ) d
  WHERE p.id = _primary_id;

  DELETE FROM public.customers WHERE id = ANY(_duplicate_ids);
  GET DIAGNOSTICS rc = ROW_COUNT;

  result := jsonb_build_object(
    'primary_id', _primary_id,
    'deleted', rc,
    'moved', moved,
    'skipped_text_customer_id_tables', jsonb_build_array('zoho_invoices', 'zoho_recurring_invoices', 'zoho_recurring_profiles')
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[]) FROM anon, public;