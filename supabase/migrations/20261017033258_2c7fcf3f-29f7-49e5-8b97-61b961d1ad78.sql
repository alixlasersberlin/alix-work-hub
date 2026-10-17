DO $$
DECLARE
  entry_count integer;
BEGIN
  LOCK TABLE public.commission_entries, public.commission_payment_items, public.commission_statements IN EXCLUSIVE MODE;
  SELECT count(*) INTO entry_count FROM public.commission_entries;
  IF entry_count <> 426 THEN
    RAISE EXCEPTION 'Provisionsbestand hat sich geändert: % statt 426. Erneute Prüfung erforderlich.', entry_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.commission_entries WHERE COALESCE(paid_amount,0) <> 0 OR status IN ('paid','partially_paid','closed','reclaimed'))
     OR EXISTS (SELECT 1 FROM public.commission_payment_items)
     OR EXISTS (SELECT 1 FROM public.commission_statements) THEN
    RAISE EXCEPTION 'Auszahlungen oder Abrechnungen vorhanden; Zurücksetzen abgebrochen.';
  END IF;
  INSERT INTO public.commission_audit_logs (action,object_type,object_id,entry_id,order_id,employee_id,old_value,new_value,reason)
  SELECT 'Berechnete Provision zurückgesetzt','commission_entry',e.id,e.id,e.order_id,e.employee_id,
    jsonb_build_object('entry',to_jsonb(e),
      'conditions',(SELECT COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM public.commission_conditions c WHERE c.entry_id=e.id),
      'approvals',(SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM public.commission_approvals a WHERE a.entry_id=e.id),
      'status_history',(SELECT COALESCE(jsonb_agg(to_jsonb(h)),'[]'::jsonb) FROM public.commission_status_history h WHERE h.entry_id=e.id)),
    jsonb_build_object('reset',true,'paid_amount',0),
    'Auf ausdrücklichen Kundenwunsch: berechnete Provisionen zurücksetzen; Regeln und Mitarbeiterzuordnungen unverändert.'
  FROM public.commission_entries e;
  DELETE FROM public.commission_entries WHERE paid_amount=0 AND status IN ('blocked','condition_open','pending_approval');
  IF EXISTS (SELECT 1 FROM public.commission_entries) THEN
    RAISE EXCEPTION 'Zurücksetzen unvollständig; Änderungen werden zurückgerollt.';
  END IF;
END $$;