DO $$
DECLARE v_id uuid := 'f7fad3d1-ac4f-4480-8aeb-732057977191'; v_old text;
BEGIN
 SELECT status INTO v_old FROM public.zoho_recurring_profiles WHERE id=v_id AND source_system='zoho_eu_1' AND zoho_recurring_invoice_id='598077000000415193' AND customer_name='Kosmetik Janka' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ratenplan Kosmetik Janka nicht eindeutig gefunden'; END IF;
 IF v_old IS DISTINCT FROM 'legal_ended' THEN
 UPDATE public.zoho_recurring_profiles SET status='legal_ended',updated_at=now() WHERE id=v_id;
 INSERT INTO public.audit_logs(action,module,record_id,details) VALUES ('END_RECURRING_PROFILE','finance',v_id::text,jsonb_build_object('customer_name','Kosmetik Janka','old_status',v_old,'new_status','legal_ended','reason','Ratenplan auf ausdrücklichen Benutzerauftrag geschlossen; bestehende Rechnungen unverändert'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.zoho_recurring_profiles WHERE id=v_id AND status='legal_ended') THEN RAISE EXCEPTION 'Schließung nicht gespeichert'; END IF;
END $$;