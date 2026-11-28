CREATE OR REPLACE FUNCTION public.finance_qr_candidates(_refs text[],_tenant uuid) RETURNS TABLE(id uuid,amount numeric,customer_id uuid,reference text,status text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT q.id,q.amount,q.customer_id,q.reference,q.status FROM public.finance_qr_invoices q JOIN public.customers c ON c.id=q.customer_id JOIN public.tenants t ON t.zoho_source_system=c.source_system AND t.id=_tenant AND t.is_active IS TRUE WHERE q.reference=ANY(_refs) AND cardinality(_refs) BETWEEN 1 AND 10 AND public.user_has_tenant(_tenant);
$$;
REVOKE ALL ON FUNCTION public.finance_qr_candidates(text[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_qr_candidates(text[],uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.camt054_match_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE account_tenant uuid; account_count integer; candidates uuid[]; match_id uuid;
BEGIN
 SELECT count(*),(array_agg(b.tenant_id))[1] INTO account_count,account_tenant FROM public.finance_camt054_notifications n JOIN public.bank_accounts b ON replace(upper(b.iban),' ','')=replace(upper(n.account_iban),' ','') JOIN public.tenants t ON t.id=b.tenant_id AND t.is_active IS TRUE WHERE n.id=NEW.notification_id;
 IF account_count<>1 OR account_tenant IS NULL THEN RAISE EXCEPTION 'Bank account ownership unconfirmed' USING ERRCODE='42501'; END IF;
 IF coalesce(auth.role(),'') IN ('anon','authenticated') THEN
  IF NOT public.user_has_tenant(account_tenant) OR NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance') OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung CH')) THEN RAISE EXCEPTION 'Bank import not authorized' USING ERRCODE='42501'; END IF;
 END IF;
 IF NEW.reference IS NULL OR NEW.reference='' OR NEW.amount<=0 THEN RETURN NEW; END IF;
 SELECT array_agg(q.id) INTO candidates FROM public.finance_qr_invoices q JOIN public.customers c ON c.id=q.customer_id JOIN public.tenants t ON t.id=account_tenant AND t.zoho_source_system=c.source_system WHERE q.reference=NEW.reference AND q.currency=NEW.currency AND q.status IN ('erstellt','versendet') AND abs(q.amount-NEW.amount)<0.01;
 IF cardinality(candidates)=1 THEN
  match_id:=candidates[1];
  PERFORM 1 FROM public.finance_qr_invoices q WHERE q.id=match_id AND q.status IN ('erstellt','versendet') FOR UPDATE;
  IF FOUND THEN
   NEW.matched_qr_invoice_id:=match_id; NEW.match_status:='zugeordnet';
   UPDATE public.finance_qr_invoices SET status='bezahlt',paid_at=now(),matched_entry_id=NEW.id WHERE id=match_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.camt054_match_entry() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.camt054_match_entry() TO service_role;