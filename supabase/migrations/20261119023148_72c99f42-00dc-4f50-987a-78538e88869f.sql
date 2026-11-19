CREATE OR REPLACE FUNCTION public.revision_cases()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN RAISE EXCEPTION 'Keine Berechtigung für REVISION' USING ERRCODE='42501'; END IF;
 WITH tx AS MATERIALIZED (SELECT * FROM public.bank_transactions WHERE public.tenant_scope_id_ok(tenant_id)),
 inv AS MATERIALIZED (SELECT id,invoice_number,customer_name,total,balance,currency,tenant_id FROM public.zoho_invoices WHERE public.tenant_scope_id_ok(tenant_id) UNION ALL SELECT id,invoice_number,customer_name,total,balance,currency,tenant_id FROM public.zoho_recurring_invoices WHERE public.tenant_scope_id_ok(tenant_id)),
 allocations AS (SELECT a.bank_transaction_id,sum(a.allocated_amount) amount FROM public.bank_transaction_allocations a JOIN tx ON tx.id=a.bank_transaction_id GROUP BY 1),
 returned AS (SELECT r.id,r.bank_transaction_id,r.booking_date,r.currency,r.tenant_id,a.invoice_id,i.invoice_number,i.customer_name,sum(a.allocated_amount) amount FROM public.bank_return_debits r JOIN public.bank_return_debit_allocations a ON a.return_debit_id=r.id JOIN inv i ON i.id::text=a.invoice_id JOIN tx ON tx.id=r.bank_transaction_id WHERE public.tenant_scope_id_ok(r.tenant_id) AND r.status IN ('bestaetigt','mahnprozess','erledigt') AND i.balance<=0.009 AND i.currency=r.currency GROUP BY r.id,r.bank_transaction_id,r.booking_date,r.currency,r.tenant_id,a.invoice_id,i.invoice_number,i.customer_name),
 cases AS (
 SELECT 'unbooked:'||t.id case_key,'unbooked' category,t.id transaction_id,NULL::text invoice_id,t.booking_date,t.currency,t.tenant_id,t.sender_receiver_name customer_name,NULL::text invoice_number,abs(t.amount) amount,'Zahlungseingang noch nicht verbucht' reason FROM tx t WHERE t.status IN ('offen','sicher','vorschlag') AND t.transaction_type='eingang' AND NOT coalesce(t.is_return_debit,false)
 UNION ALL
 SELECT 'duplicate:'||t.id,'duplicate',t.id,NULL,t.booking_date,t.currency,t.tenant_id,t.sender_receiver_name,NULL,a.amount-abs(t.amount),'Zuordnungssumme übersteigt den Bankeingang' FROM tx t JOIN allocations a ON a.bank_transaction_id=t.id WHERE t.status='verbucht' AND NOT coalesce(t.is_return_debit,false) AND a.amount>abs(t.amount)+0.01
 UNION ALL
 SELECT 'paid_target:'||t.id,'paid_target',t.id,i.id::text,t.booking_date,t.currency,t.tenant_id,t.sender_receiver_name,i.invoice_number,abs(t.amount),'Unverbuchter Umsatz verweist auf bezahlte Rechnung' FROM tx t JOIN inv i ON i.id::text=t.matched_invoice_id AND i.currency=t.currency WHERE t.status IN ('offen','sicher','vorschlag') AND i.balance<=0.009
 UNION ALL
 SELECT 'return:'||r.id||':'||r.invoice_id,'return',r.bank_transaction_id,r.invoice_id,r.booking_date,r.currency,r.tenant_id,r.customer_name,r.invoice_number,r.amount,'Rücklastschrift, Rechnung bezahlt; spätere Bankzahlung nicht ausreichend belegt' FROM returned r WHERE coalesce((SELECT sum(a.allocated_amount) FROM public.bank_transaction_allocations a JOIN tx t ON t.id=a.bank_transaction_id WHERE a.invoice_id=r.invoice_id AND a.currency=r.currency AND t.currency=r.currency AND t.status='verbucht' AND NOT coalesce(t.is_return_debit,false) AND t.booking_date>r.booking_date AND a.allocation_type IN ('rechnung','invoice','gegenbuchung','ruecklastschrift')),0)<r.amount-0.009
 )
 SELECT coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('review_status',coalesce(e.new_value->>'status','open'),'review_note',e.new_value->>'note','reviewed_at',e.created_at,'history',coalesce(h.events,'[]'::jsonb)) ORDER BY c.booking_date DESC,c.case_key),'[]'::jsonb) INTO result FROM cases c LEFT JOIN LATERAL (SELECT new_value,created_at FROM public.bank_audit_log WHERE action='REVISION_REVIEW' AND bank_transaction_id=c.transaction_id AND new_value->>'case_key'=c.case_key ORDER BY created_at DESC,id DESC LIMIT 1) e ON true LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('status',new_value->>'status','note',new_value->>'note','at',created_at,'user_id',user_id) ORDER BY created_at DESC) events FROM public.bank_audit_log WHERE action='REVISION_REVIEW' AND bank_transaction_id=c.transaction_id AND new_value->>'case_key'=c.case_key) h ON true;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.revision_cases() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revision_cases() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.revision_review(p_case_key text,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb; event_id uuid;
BEGIN
 IF p_status NOT IN ('open','in_progress','clarification','reviewed') THEN RAISE EXCEPTION 'Ungültiger Prüfstatus'; END IF;
 IF length(btrim(coalesce(p_note,'')))<5 OR length(p_note)>4000 THEN RAISE EXCEPTION 'Prüfnotiz muss 5 bis 4000 Zeichen enthalten'; END IF;
 SELECT value INTO c FROM jsonb_array_elements(public.revision_cases()) WHERE value->>'case_key'=p_case_key LIMIT 1;
 IF c IS NULL THEN RAISE EXCEPTION 'Fall ist nicht mehr vorhanden oder nicht zugänglich' USING ERRCODE='42501'; END IF;
 INSERT INTO public.bank_audit_log(tenant_id,bank_transaction_id,action,new_value,user_id,user_email) VALUES((c->>'tenant_id')::uuid,(c->>'transaction_id')::uuid,'REVISION_REVIEW',jsonb_build_object('case_key',p_case_key,'status',p_status,'note',btrim(p_note),'category',c->>'category'),auth.uid(),(SELECT email FROM public.user_profiles WHERE id=auth.uid())) RETURNING id INTO event_id;
 RETURN jsonb_build_object('id',event_id,'status',p_status);
END $$;
REVOKE ALL ON FUNCTION public.revision_review(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revision_review(text,text,text) TO authenticated;
