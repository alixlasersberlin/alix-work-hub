CREATE INDEX IF NOT EXISTS idx_bank_alloc_invoice_currency ON public.bank_transaction_allocations(invoice_id, currency);

CREATE OR REPLACE FUNCTION public.bank_invoice_balance_ceiling(p_total numeric,p_balance numeric,p_net_paid numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN coalesce(p_net_paid,0)>0 THEN round(least(greatest(coalesce(p_balance,0),0),greatest(coalesce(p_total,0)-p_net_paid,0)),2) ELSE p_balance END;
$$;
REVOKE ALL ON FUNCTION public.bank_invoice_balance_ceiling(numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bank_invoice_balance_ceiling(numeric,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.bank_invoice_booked_evidence(p_id uuid,p_source text,p_external text,p_currency text,p_tenant uuid)
RETURNS TABLE(net_paid numeric,last_paid date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH ids AS (
 SELECT i.id FROM public.zoho_invoices i WHERE i.id=p_id OR (p_external IS NOT NULL AND i.source_system=p_source AND i.zoho_invoice_id=p_external AND i.currency=p_currency AND i.tenant_id IS NOT DISTINCT FROM p_tenant)
 UNION
 SELECT i.id FROM public.zoho_recurring_invoices i WHERE i.id=p_id OR (p_external IS NOT NULL AND i.source_system=p_source AND i.zoho_invoice_id=p_external AND i.currency=p_currency AND i.tenant_id IS NOT DISTINCT FROM p_tenant)
 )
 SELECT coalesce(sum(a.allocated_amount),0),max(b.booking_date) FILTER(WHERE a.allocated_amount>0 AND a.allocation_type IN ('rechnung','invoice'))
 FROM ids JOIN public.bank_transaction_allocations a ON a.invoice_id=ids.id::text
 JOIN public.bank_transactions b ON b.id=a.bank_transaction_id
 WHERE a.allocation_type IN ('rechnung','invoice','gegenbuchung','ruecklastschrift')
 AND b.status IN ('verbucht','allocated') AND NOT coalesce(b.is_return_debit,false)
 AND a.currency=p_currency AND b.currency=p_currency
 AND (b.tenant_id IS NULL OR p_tenant IS NULL OR b.tenant_id=p_tenant);
$$;
REVOKE ALL ON FUNCTION public.bank_invoice_booked_evidence(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bank_invoice_booked_evidence(uuid,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bank_invoice_preserve_booked_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; v_balance numeric;
BEGIN
 IF lower(coalesce(NEW.status,'')) IN ('draft','entwurf','void','storniert','cancelled') THEN RETURN NEW; END IF;
 SELECT * INTO e FROM public.bank_invoice_booked_evidence(NEW.id,NEW.source_system,NEW.zoho_invoice_id,NEW.currency,NEW.tenant_id);
 IF e.net_paid<=0 THEN RETURN NEW; END IF;
 v_balance:=public.bank_invoice_balance_ceiling(NEW.total,NEW.balance,e.net_paid);
 IF NEW.balance IS DISTINCT FROM v_balance THEN
   INSERT INTO public.audit_logs(user_id,action,module,record_id,details)
   VALUES(auth.uid(),'BANK_PAYMENT_BALANCE_RECONCILED',TG_TABLE_NAME,NEW.id::text,jsonb_build_object('invoice_number',NEW.invoice_number,'incoming_balance',NEW.balance,'effective_balance',v_balance,'booked_net_paid',e.net_paid));
 END IF;
 NEW.balance:=v_balance;
 NEW.payment_status:=CASE WHEN v_balance<=0.009 THEN 'paid' ELSE 'partially_paid' END;
 IF v_balance<=0.009 THEN NEW.status:='paid'; END IF;
 NEW.last_payment_date:=greatest(NEW.last_payment_date,e.last_paid);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bank_invoice_preserve_booked_balance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_bank_invoice_booked_balance BEFORE INSERT OR UPDATE ON public.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.bank_invoice_preserve_booked_balance();
CREATE TRIGGER zz_bank_recurring_booked_balance BEFORE INSERT OR UPDATE ON public.zoho_recurring_invoices FOR EACH ROW EXECUTE FUNCTION public.bank_invoice_preserve_booked_balance();

CREATE OR REPLACE FUNCTION public.bank_invoice_refresh_allocated_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ids text[]; v_id text;
BEGIN
 IF TG_TABLE_NAME='bank_transactions' THEN
   IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.is_return_debit IS NOT DISTINCT FROM OLD.is_return_debit AND NEW.currency IS NOT DISTINCT FROM OLD.currency AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN RETURN NULL; END IF;
   SELECT array_agg(DISTINCT invoice_id) INTO v_ids FROM public.bank_transaction_allocations WHERE bank_transaction_id=NEW.id AND invoice_id IS NOT NULL;
 ELSE
   IF TG_OP='INSERT' THEN v_ids:=ARRAY[NEW.invoice_id];
   ELSIF TG_OP='DELETE' THEN v_ids:=ARRAY[OLD.invoice_id];
   ELSE v_ids:=ARRAY[OLD.invoice_id,NEW.invoice_id]; END IF;
 END IF;
 FOR v_id IN SELECT DISTINCT unnest(v_ids) LOOP
   UPDATE public.zoho_invoices i SET balance=i.balance WHERE i.id::text=v_id;
   UPDATE public.zoho_recurring_invoices i SET balance=i.balance WHERE i.id::text=v_id;
   -- Mirror documents use the same source-scoped Zoho invoice identity, not invoice numbers.
   UPDATE public.zoho_invoices i SET balance=i.balance FROM public.zoho_recurring_invoices r WHERE r.id::text=v_id AND i.source_system=r.source_system AND i.zoho_invoice_id=r.zoho_invoice_id AND i.currency=r.currency AND i.tenant_id IS NOT DISTINCT FROM r.tenant_id;
   UPDATE public.zoho_recurring_invoices r SET balance=r.balance FROM public.zoho_invoices i WHERE i.id::text=v_id AND i.source_system=r.source_system AND i.zoho_invoice_id=r.zoho_invoice_id AND i.currency=r.currency AND i.tenant_id IS NOT DISTINCT FROM r.tenant_id;
 END LOOP;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bank_invoice_refresh_allocated_balance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_bank_tx_invoice_balance AFTER UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.bank_invoice_refresh_allocated_balance();
CREATE TRIGGER zz_bank_alloc_invoice_balance AFTER INSERT OR UPDATE OR DELETE ON public.bank_transaction_allocations FOR EACH ROW EXECUTE FUNCTION public.bank_invoice_refresh_allocated_balance();

DO $$ BEGIN
 IF public.bank_invoice_balance_ceiling(348.33,348.33,348.33)<>0 THEN RAISE EXCEPTION 'INV-12314 full payment regression'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,100)<>248.33 THEN RAISE EXCEPTION 'Partial payment regression'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,248.33,100)<>248.33 THEN RAISE EXCEPTION 'Repeated reconciliation double deduction'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,0,348.33)<>0 THEN RAISE EXCEPTION 'Already paid regression'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,348.33-348.33)<>348.33 THEN RAISE EXCEPTION 'Reversed payment regression'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,348.33-100)<>100 THEN RAISE EXCEPTION 'Partial reversal regression'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,100,100)<>100 THEN RAISE EXCEPTION 'Remote and local payments double deduction'; END IF;
END $$;

UPDATE public.zoho_invoices i SET balance=i.balance FROM LATERAL (SELECT 1) x WHERE lower(coalesce(i.status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled') AND EXISTS (SELECT 1 FROM public.bank_invoice_booked_evidence(i.id,i.source_system,i.zoho_invoice_id,i.currency,i.tenant_id) e WHERE e.net_paid>0 AND (i.balance>public.bank_invoice_balance_ceiling(i.total,i.balance,e.net_paid)+0.009 OR i.last_payment_date IS NULL));
UPDATE public.zoho_recurring_invoices i SET balance=i.balance WHERE lower(coalesce(i.status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled') AND EXISTS (SELECT 1 FROM public.bank_invoice_booked_evidence(i.id,i.source_system,i.zoho_invoice_id,i.currency,i.tenant_id) e WHERE e.net_paid>0 AND (i.balance>public.bank_invoice_balance_ceiling(i.total,i.balance,e.net_paid)+0.009 OR i.last_payment_date IS NULL));