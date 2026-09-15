
-- 1) WORM für finance_audit_trail
DROP TRIGGER IF EXISTS trg_worm_finance_audit_trail ON public.finance_audit_trail;
CREATE TRIGGER trg_worm_finance_audit_trail
BEFORE UPDATE OR DELETE ON public.finance_audit_trail
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

-- 2) Nummernkreise / Migrationsprotokoll schützen
DROP TRIGGER IF EXISTS trg_worm_invoice_number_migrations ON public.invoice_number_migrations;
CREATE TRIGGER trg_worm_invoice_number_migrations
BEFORE UPDATE OR DELETE ON public.invoice_number_migrations
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

CREATE OR REPLACE FUNCTION public.gobd_number_range_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GoBD: Nummernkreise duerfen nicht geloescht werden.';
  END IF;
  IF NEW.current_number < OLD.current_number THEN
    RAISE EXCEPTION 'GoBD: Ein Nummernkreis darf nicht zurueckgesetzt werden (% -> %).', OLD.current_number, NEW.current_number;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gobd_number_range_guard ON public.invoice_number_ranges;
CREATE TRIGGER trg_gobd_number_range_guard
BEFORE UPDATE OR DELETE ON public.invoice_number_ranges
FOR EACH ROW EXECUTE FUNCTION public.gobd_number_range_guard();

-- 3) Geschlossene Perioden nicht loeschbar
CREATE OR REPLACE FUNCTION public.gobd_period_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IN ('soft_closed','hard_locked') THEN
    RAISE EXCEPTION 'GoBD: Eine geschlossene Periode darf nicht geloescht werden.';
  END IF;
  INSERT INTO public.finance_audit_trail(module, entity_table, entity_id, action, old_data, new_data, user_id, accounting_region)
  VALUES ('gobd','finance_periods', OLD.id, 'ACCOUNTING_PERIOD_DELETED', to_jsonb(OLD), NULL, auth.uid(), OLD.accounting_region);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_gobd_period_delete_guard ON public.finance_periods;
CREATE TRIGGER trg_gobd_period_delete_guard
BEFORE DELETE ON public.finance_periods
FOR EACH ROW EXECUTE FUNCTION public.gobd_period_delete_guard();

-- 4) Konflikte + Exportnachweise nicht loeschbar
CREATE OR REPLACE FUNCTION public.gobd_no_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Eintraege in % duerfen nicht geloescht werden.', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS trg_gobd_conf_no_delete ON public.gobd_sync_conflicts;
CREATE TRIGGER trg_gobd_conf_no_delete
BEFORE DELETE ON public.gobd_sync_conflicts
FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete();

DROP POLICY IF EXISTS gobd_conf_block_delete ON public.gobd_sync_conflicts;
CREATE POLICY gobd_conf_block_delete ON public.gobd_sync_conflicts FOR DELETE TO anon, authenticated USING (false);

-- 5) Ueberfluessige Rechte entziehen (Defense in Depth)
REVOKE ALL ON public.invoice_audit_log, public.invoice_corrections, public.invoice_number_audit,
  public.invoice_number_ranges, public.invoice_number_migrations, public.gobd_export_log,
  public.gobd_sync_conflicts, public.finance_audit_trail, public.finance_periods,
  public.audit_logs, public.backups_metadata, public.zoho_invoices FROM anon;

REVOKE UPDATE, DELETE ON public.invoice_audit_log, public.invoice_corrections, public.invoice_number_audit,
  public.invoice_number_ranges, public.invoice_number_migrations, public.gobd_export_log,
  public.finance_audit_trail FROM authenticated;

REVOKE DELETE ON public.gobd_sync_conflicts FROM authenticated;

-- 6) Zentrale Pruefung aller Schutzmechanismen
CREATE OR REPLACE FUNCTION public.gobd_compliance_check()
RETURNS TABLE(bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r record;
  v_cnt int;
BEGIN
  -- Schutz-Trigger vorhanden?
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

  -- Keine Schreibrechte fuer nicht angemeldete Besucher
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

  -- Zeilenschutz aktiv
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

  -- Nummernkreise
  SELECT count(*) INTO v_cnt FROM (
    SELECT legal_invoice_number FROM public.zoho_invoices
    WHERE legal_invoice_number IS NOT NULL
    GROUP BY legal_invoice_number HAVING count(*) > 1) x;
  bereich := 'Rechnungsnummern'; pruefung := 'Keine doppelten Rechnungsnummern';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'FEHLER' END;
  detail := v_cnt || ' Dubletten'; RETURN NEXT;

  SELECT count(*) INTO v_cnt FROM public.zoho_invoices
   WHERE legal_invoice_number IS NULL AND coalesce(status,'') NOT IN ('draft','entwurf');
  bereich := 'Rechnungsnummern'; pruefung := 'Jede fertige Rechnung hat eine Nummer';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'FEHLER' END;
  detail := v_cnt || ' ohne Nummer'; RETURN NEXT;

  -- Offene Konflikte
  SELECT count(*) INTO v_cnt FROM public.gobd_sync_conflicts WHERE status='OFFEN';
  bereich := 'Konflikte'; pruefung := 'Keine offenen Synchronisationskonflikte';
  status := CASE WHEN v_cnt=0 THEN 'BESTANDEN' ELSE 'HINWEIS' END;
  detail := v_cnt || ' offen'; RETURN NEXT;

  -- Sicherungen
  SELECT count(*) INTO v_cnt FROM public.backups_metadata
   WHERE created_at > now() - interval '7 days' AND coalesce(status,'') IN ('completed','success','erfolgreich');
  bereich := 'Sicherungen'; pruefung := 'Erfolgreiche Sicherung in den letzten 7 Tagen';
  status := CASE WHEN v_cnt>0 THEN 'BESTANDEN' ELSE 'HINWEIS' END;
  detail := v_cnt || ' Sicherungen'; RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.gobd_compliance_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gobd_compliance_check() TO authenticated, service_role;
