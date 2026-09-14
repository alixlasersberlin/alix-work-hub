
CREATE OR REPLACE FUNCTION public.gobd_invoice_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
