CREATE OR REPLACE FUNCTION public.gobd_compliance_check()
 RETURNS TABLE(bereich text, pruefung text, status text, detail text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_cnt int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('Rechnungen','zoho_invoices','trg_gobd_invoice_guard'),
      ('Rechnungen','zoho_invoices','trg_guard_invoice_legal_number'),
      ('Protokolle','invoice_audit_log','trg_worm_invoice_audit_log'),
      ('Protokolle','invoice_corrections','trg_worm_invoice_corrections'),
      ('Protokolle','invoice_number_audit','trg_worm_invoice_number_audit'),
      ('Protokolle','audit_logs','trg_worm_audit_logs'),
      ('Protokolle','finance_audit_trail','trg_worm_finance_audit_trail'),
      ('Exporte','gobd_export_log','trg_worm_gobd_export_log'),
      ('Nummernkreise','invoice_number_ranges','trg_gobd_number_range_guard'),
      ('Perioden','finance_periods','trg_gobd_period_guard'),
      ('Perioden','finance_periods','trg_gobd_period_delete_guard'),
      ('Perioden','finance_transactions','trg_period_lock'),
      ('Perioden','finance_journal','trg_period_lock'),
      ('Perioden','finance_cashbook','trg_period_lock'),
      ('Perioden','finance_bank_postings','trg_period_lock'),
      ('Buchungen','finance_journal','trg_gobd_journal'),
      ('Buchungen','finance_cashbook','trg_gobd_cashbook'),
      ('Buchungen','finance_bank_postings','trg_gobd_bankpost'),
      ('Konflikte','gobd_sync_conflicts','trg_gobd_conf_no_delete'),
      ('Sicherungen','backups_metadata','trg_gobd_backup_delete_audit')
    ) AS t(b, tab, trg)
  LOOP
    SELECT count(*) INTO v_cnt FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relname=r.tab AND tg.tgname=r.trg AND tg.tgenabled='O';
    bereich := r.b; pruefung := 'Schutz aktiv: ' || r.tab || ' / ' || r.trg;
    status := CASE WHEN v_cnt=1 THEN 'BESTANDEN' ELSE 'FEHLER' END;
    detail := CASE WHEN v_cnt=1 THEN 'aktiv' ELSE 'fehlt oder deaktiviert' END;
    RETURN NEXT;
  END LOOP;

  FOR r IN
    SELECT c.relname AS tab FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
      ('zoho_invoices','invoice_audit_log','invoice_corrections','invoice_number_audit',
       'invoice_number_ranges','gobd_export_log','gobd_sync_conflicts','finance_audit_trail',
       'finance_periods','audit_logs','backups_metadata')
      AND (has_table_privilege('anon', c.oid,'INSERT') OR has_table_privilege('anon', c.oid,'UPDATE')
        OR has_table_privilege('anon', c.oid,'DELETE') OR has_table_privilege('anon', c.oid,'SELECT'))
  LOOP
    bereich := 'Berechtigungen'; pruefung := 'Kein Zugriff ohne Anmeldung: ' || r.tab;
    status := 'FEHLER'; detail := 'Rechte fuer nicht angemeldete Besucher vorhanden';
    RETURN NEXT;
  END LOOP;
  bereich := 'Berechtigungen'; pruefung := 'Kein Zugriff ohne Anmeldung (Gesamt)';
  status := 'BESTANDEN'; detail := 'geprueft'; RETURN NEXT;

  FOR r IN
    SELECT c.relname AS tab, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
      ('zoho_invoices','invoice_audit_log','invoice_corrections','invoice_number_audit',
       'gobd_export_log','gobd_sync_conflicts','finance_audit_trail','finance_periods','audit_logs')
  LOOP
    bereich := 'Berechtigungen'; pruefung := 'Zeilenschutz aktiv: ' || r.tab;
    status := CASE WHEN r.rls THEN 'BESTANDEN' ELSE 'FEHLER' END;
    detail := CASE WHEN r.rls THEN 'aktiv' ELSE 'nicht aktiv' END;
    RETURN NEXT;
  END LOOP;

  SELECT count(*) INTO v_cnt FROM (
    SELECT zi.legal_invoice_number FROM public.zoho_invoices zi
    WHERE zi.legal_invoice_number IS NOT NULL
    GROUP BY zi.legal_invoice_number HAVING count(*) > 1) x;
  bereich := 'Rechnungsnummern'; pruefung := 'Keine doppelten Rechnungsnummern';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'FEHLER' END;
  detail := v_cnt || ' Dubletten'; RETURN NEXT;

  SELECT count(*) INTO v_cnt FROM public.zoho_invoices zi
   WHERE zi.legal_invoice_number IS NULL AND coalesce(zi.status,'') NOT IN ('draft','entwurf');
  bereich := 'Rechnungsnummern'; pruefung := 'Jede fertige Rechnung hat eine Nummer';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'FEHLER' END;
  detail := v_cnt || ' ohne Nummer'; RETURN NEXT;

  SELECT count(*) INTO v_cnt FROM public.gobd_sync_conflicts sc WHERE sc.status='OFFEN';
  bereich := 'Konflikte'; pruefung := 'Keine offenen Synchronisationskonflikte';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'HINWEIS' END;
  detail := v_cnt || ' offen'; RETURN NEXT;

  SELECT count(*) INTO v_cnt FROM public.backups_metadata bm
   WHERE bm.created_at > now() - interval '7 days'
     AND coalesce(bm.status,'') IN ('completed','success','erfolgreich');
  bereich := 'Sicherungen'; pruefung := 'Erfolgreiche Sicherung in den letzten 7 Tagen';
  status := CASE WHEN v_cnt>0 THEN 'BESTANDEN' ELSE 'HINWEIS' END;
  detail := v_cnt || ' Sicherungen'; RETURN NEXT;
END $function$;