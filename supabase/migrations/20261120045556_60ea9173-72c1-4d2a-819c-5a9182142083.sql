CREATE OR REPLACE FUNCTION fibu_private.fibu_light_due_date_changes()
RETURNS TABLE(invoice_id uuid, metadata jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_use_fibu_light() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN
  RAISE EXCEPTION 'Keine Berechtigung für Zahlungsziele.' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT DISTINCT ON (a.invoice_id) a.invoice_id,
   jsonb_build_object('old_due_date',a.metadata->>'old_due_date','new_due_date',a.metadata->>'new_due_date')
 FROM public.invoice_audit_log a
 JOIN public.fibu_light_open_items() i ON i.id=a.invoice_id
 JOIN public.zoho_invoices z ON z.id=i.id
 WHERE a.action='DUE_DATE_CHANGE' AND public.tenant_scope_id_ok(z.tenant_id)
 ORDER BY a.invoice_id,a.created_at DESC,a.id DESC;
END $$;