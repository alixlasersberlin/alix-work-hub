-- Guard: kontrollierte Nummernvergabe zulassen (nur ueber protokollierte Funktionen)
CREATE OR REPLACE FUNCTION public.gobd_invoice_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service boolean := public.gobd_is_service_context();
  v_final boolean;
  v_changed text[] := '{}';
  v_locked boolean;
  v_patch jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_ref text;
  v_numop boolean := coalesce(nullif(current_setting('gobd.number_op', true), ''), 'off') = 'on';
  v_only_num boolean;
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.invoice_date IS NOT NULL AND NOT v_service
       AND public.gobd_period_state(NEW.accounting_region, NEW.invoice_date) = 'hard_locked' THEN
      RAISE EXCEPTION 'GoBD: Periode % (%) ist hart gesperrt. Keine neue Rechnung in dieser Periode.',
        to_char(NEW.invoice_date, 'YYYY-MM'), NEW.accounting_region;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF public.gobd_invoice_is_final(OLD.status) THEN
      RAISE EXCEPTION 'GoBD: Finalisierte Rechnung % darf nicht geloescht werden. Bitte Storno/Gutschrift verwenden.',
        coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text);
    END IF;
    RETURN OLD;
  END IF;

  v_final := public.gobd_invoice_is_final(OLD.status);
  IF NOT v_final THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH f IN ARRAY ARRAY['invoice_number','legal_invoice_number','beleg_id','invoice_date',
                           'customer_id','customer_name','billing_address','city','currency',
                           'total','due_date','raw_data','accounting_region','is_deposit',
                           'reference_number'] LOOP
    IF v_new -> f IS DISTINCT FROM v_old -> f THEN
      v_changed := v_changed || f;
    END IF;
  END LOOP;

  IF NOT public.gobd_invoice_is_final(NEW.status) THEN
    v_changed := array_append(v_changed, 'status (final -> Entwurf)'::text);
  END IF;

  v_locked := OLD.invoice_date IS NOT NULL
              AND public.gobd_period_state(OLD.accounting_region, OLD.invoice_date) = 'hard_locked';

  IF v_locked AND NOT v_service AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed := array_append(v_changed, 'status (gesperrte Periode)'::text);
  END IF;

  IF array_length(v_changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kontrollierte Vergabe/Korrektur der gesetzlichen Rechnungsnummer
  IF v_numop THEN
    v_only_num := true;
    FOREACH f IN ARRAY v_changed LOOP
      IF f NOT IN ('legal_invoice_number','beleg_id') THEN
        v_only_num := false;
      END IF;
    END LOOP;

    IF v_only_num THEN
      INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, fields, metadata)
      VALUES (OLD.id, coalesce(NEW.legal_invoice_number, OLD.invoice_number), OLD.tenant_id, auth.uid(),
              'NUMBER_ASSIGN', v_changed,
              jsonb_build_object('old_legal_number', v_old ->> 'legal_invoice_number',
                                 'new_legal_number', v_new ->> 'legal_invoice_number'));
      RETURN NEW;
    END IF;
  END IF;

  IF v_service THEN
    v_ref := coalesce(v_new ->> 'zoho_invoice_id', v_old ->> 'zoho_invoice_id',
                      v_new ->> 'source_system', v_old ->> 'source_system');

    FOREACH f IN ARRAY v_changed LOOP
      IF f NOT IN ('invoice_number','legal_invoice_number','beleg_id','invoice_date',
                   'customer_id','customer_name','billing_address','city','currency',
                   'total','due_date','raw_data','accounting_region','is_deposit',
                   'reference_number') THEN
        CONTINUE;
      END IF;
      v_patch := v_patch || jsonb_build_object(f, v_old -> f);

      IF NOT EXISTS (
        SELECT 1 FROM public.gobd_sync_conflicts c
        WHERE c.invoice_id = OLD.id AND c.field = f AND c.status = 'OFFEN'
          AND coalesce(c.external_value,'') = coalesce(left(v_new ->> f, 4000),'')
      ) THEN
        INSERT INTO public.gobd_sync_conflicts(invoice_id, invoice_number, tenant_id, source,
          zoho_reference, field, local_value, external_value)
        VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id,
          'zoho', v_ref, f, left(v_old ->> f, 4000), left(v_new ->> f, 4000));
      END IF;
    END LOOP;

    IF NOT public.gobd_invoice_is_final(NEW.status) THEN
      v_patch := v_patch || jsonb_build_object('status', v_old -> 'status');
      INSERT INTO public.gobd_sync_conflicts(invoice_id, invoice_number, tenant_id, source,
        zoho_reference, field, local_value, external_value)
      VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id,
        'zoho', v_ref, 'status', v_old ->> 'status', v_new ->> 'status');
    END IF;

    IF v_patch <> '{}'::jsonb THEN
      NEW := jsonb_populate_record(NEW, v_patch);
      INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, fields, metadata)
      VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id, auth.uid(),
              'ZOHO_SYNC_CONFLICT', ARRAY(SELECT jsonb_object_keys(v_patch)),
              jsonb_build_object('source','service','zoho_reference', v_ref));
    END IF;
    RETURN NEW;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'GoBD: Periode % ist hart gesperrt. Aenderung der Rechnung % abgewiesen (Felder: %).',
      to_char(OLD.invoice_date, 'YYYY-MM'),
      coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
      array_to_string(v_changed, ', ');
  END IF;

  RAISE EXCEPTION 'GoBD: Rechnung % ist finalisiert. Gesperrte Felder: %. Korrektur nur per Storno/Gutschrift/Berichtigung.',
    coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
    array_to_string(v_changed, ', ');
END;
$function$;

-- Vergabe: Flag setzen
CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_invoice_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.zoho_invoices%ROWTYPE;
  v_num text;
BEGIN
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rechnung % nicht gefunden', p_invoice_id;
  END IF;

  IF v_inv.legal_invoice_number IS NOT NULL THEN
    RETURN v_inv.legal_invoice_number;
  END IF;

  v_num := public.next_invoice_number(coalesce(v_inv.invoice_date, current_date));

  PERFORM set_config('gobd.number_op', 'on', true);
  UPDATE public.zoho_invoices
  SET beleg_id = coalesce(beleg_id, invoice_number),
      legal_invoice_number = v_num,
      legal_number_assigned_at = now(),
      legal_number_locked = true
  WHERE id = p_invoice_id;
  PERFORM set_config('gobd.number_op', 'off', true);

  INSERT INTO public.invoice_number_audit (invoice_id, beleg_id, old_number, new_number, action, actor)
  VALUES (p_invoice_id, coalesce(v_inv.beleg_id, v_inv.invoice_number), v_inv.invoice_number, v_num, 'assign', auth.uid());

  RETURN v_num;
END;
$function$;

-- Migration: Flag setzen
CREATE OR REPLACE FUNCTION public.run_invoice_renumbering(p_period text DEFAULT NULL::text, p_limit integer DEFAULT 300)
 RETURNS TABLE(migrated integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
  v_num text;
  v_remaining integer;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Migration';
  END IF;

  FOR r IN
    SELECT i.id,
           i.invoice_number,
           i.invoice_date,
           to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') AS per
    FROM public.zoho_invoices i
    WHERE i.legal_invoice_number IS NULL
      AND (p_period IS NULL OR to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') = p_period)
    ORDER BY to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM'),
             i.invoice_date NULLS LAST, i.created_at, i.invoice_number
    LIMIT greatest(coalesce(p_limit, 300), 1)
  LOOP
    v_num := public.next_invoice_number(coalesce(r.invoice_date, current_date));

    PERFORM set_config('gobd.number_op', 'on', true);
    UPDATE public.zoho_invoices
    SET beleg_id = coalesce(beleg_id, invoice_number),
        legal_invoice_number = v_num,
        legal_number_assigned_at = now(),
        legal_number_locked = true
    WHERE id = r.id;
    PERFORM set_config('gobd.number_op', 'off', true);

    INSERT INTO public.invoice_number_audit (invoice_id, beleg_id, old_number, new_number, action, reason, actor)
    VALUES (r.id, r.invoice_number, r.invoice_number, v_num, 'migrate', 'Migration Nummernkreis YYYY-MM-NNNN', auth.uid());

    INSERT INTO public.invoice_number_migrations (invoice_id, old_number, new_number, invoice_date, status)
    VALUES (r.id, r.invoice_number, v_num, r.invoice_date, 'erfolgreich')
    ON CONFLICT (invoice_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  SELECT count(*) INTO v_remaining
  FROM public.zoho_invoices i
  WHERE i.legal_invoice_number IS NULL
    AND (p_period IS NULL OR to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') = p_period);

  RETURN QUERY SELECT v_count, v_remaining;
END;
$function$;

-- Korrektur (nur Super Admin, Begruendung Pflicht): Flag setzen
CREATE OR REPLACE FUNCTION public.correct_invoice_number(p_invoice_id uuid, p_new_number text, p_reason text, p_old_pdf_url text DEFAULT NULL::text, p_new_pdf_url text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old text;
  v_beleg text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Rechnungsnummern korrigieren';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Begründung erforderlich';
  END IF;
  IF p_new_number !~ '^[0-9]{4}-[0-9]{2}-[0-9]{3,6}$' THEN
    RAISE EXCEPTION 'Format muss YYYY-MM-NNNN sein';
  END IF;

  SELECT legal_invoice_number, coalesce(beleg_id, invoice_number)
    INTO v_old, v_beleg
  FROM public.zoho_invoices WHERE id = p_invoice_id FOR UPDATE;

  PERFORM set_config('gobd.number_op', 'on', true);
  UPDATE public.zoho_invoices
  SET legal_invoice_number = p_new_number,
      legal_number_assigned_at = now()
  WHERE id = p_invoice_id;
  PERFORM set_config('gobd.number_op', 'off', true);

  INSERT INTO public.invoice_number_audit
    (invoice_id, beleg_id, old_number, new_number, action, reason, actor, old_pdf_url, new_pdf_url)
  VALUES (p_invoice_id, v_beleg, v_old, p_new_number, 'correct', p_reason, auth.uid(), p_old_pdf_url, p_new_pdf_url);

  RETURN p_new_number;
END;
$function$;