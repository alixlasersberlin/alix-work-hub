CREATE OR REPLACE FUNCTION public.settle_deposit_on_order_ok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dep RECORD; v_book_date date; v_uid uuid;
BEGIN
  IF NEW.deposit_ok IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.deposit_ok IS NOT DISTINCT FROM NEW.deposit_ok THEN RETURN NEW; END IF;

  v_book_date := COALESCE(NEW.deposit_booking_date, CURRENT_DATE);
  BEGIN v_uid := NULLIF(NEW.deposit_ok_by,'')::uuid; EXCEPTION WHEN others THEN v_uid := NULL; END;

  FOR v_dep IN
    SELECT * FROM public.finance_deposits
    WHERE order_id = NEW.id
      AND COALESCE(status,'offen') <> 'gebucht'
      AND COALESCE(paid_amount,0) >= COALESCE(gross_amount,0)
      AND COALESCE(gross_amount,0) > 0
  LOOP
    UPDATE public.finance_deposits
       SET status         = 'gebucht',
           release_status = 'manuell_freigegeben',
           released_at    = COALESCE(released_at, now()),
           released_by    = COALESCE(released_by, v_uid),
           updated_at     = now()
     WHERE id = v_dep.id;

    IF NOT EXISTS (
      SELECT 1 FROM public.finance_journal
       WHERE source_table = 'finance_deposits' AND source_id = v_dep.id AND vorgang = 'Anzahlung'
    ) THEN
      INSERT INTO public.finance_journal (
        booking_date, booking_time, source_module, source_table, source_id,
        reference, order_number, invoice_number, customer_id,
        vorgang, amount_net, amount_vat, amount_gross, description, status, user_id
      ) VALUES (
        v_book_date, CURRENT_TIME, 'anzahlungen',
        'finance_deposits', v_dep.id,
        v_dep.invoice_number, v_dep.order_number, v_dep.invoice_number, v_dep.customer_id,
        'Anzahlung', v_dep.net_amount, v_dep.vat_amount, v_dep.gross_amount,
        COALESCE(v_dep.note, 'Anzahlung ' || COALESCE(v_dep.invoice_number,'')),
        'aktiv', v_uid
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;