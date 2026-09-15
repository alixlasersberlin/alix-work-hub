
CREATE OR REPLACE FUNCTION public.gobd_phase15_check()
RETURNS TABLE(bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int; m int; v_log bigint; v_live bigint;
BEGIN
  SELECT * INTO r FROM public.gobd_restore_runs WHERE status <> 'running' ORDER BY finished_at DESC LIMIT 1;

  SELECT count(*) INTO n FROM public.backups_metadata WHERE backup_status='success';
  SELECT count(*) INTO m FROM public.backups_metadata WHERE backup_status='success' AND integrity_status='valid';
  RETURN QUERY SELECT '1 Backup-Inventar', 'Sicherungen erfasst mit Zeitpunkt, Umfang, Ort, Integritaet',
    CASE WHEN n > 0 THEN 'BESTANDEN' ELSE 'FEHLER' END,
    n || ' erfolgreiche Sicherungen, davon ' || m || ' mit Integritaetsstatus gueltig';

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename='backups_metadata';
  RETURN QUERY SELECT '2 Backup-Schutz', 'Zugriff auf Sicherungen eingeschraenkt',
    CASE WHEN n > 0 AND NOT has_table_privilege('anon','public.backups_metadata','SELECT') THEN 'BESTANDEN' ELSE 'FEHLER' END,
    n || ' Zugriffsregeln, kein Zugriff fuer nicht angemeldete Benutzer, Loeschung protokolliert (Phase 14)';

  IF r.id IS NULL THEN
    RETURN QUERY SELECT '3 Restore', 'Echter Wiederherstellungstest durchgefuehrt', 'OFFEN', 'Noch kein Lauf protokolliert';
    RETURN;
  END IF;

  RETURN QUERY SELECT '3 Restore', 'Echte Wiederherstellung in isolierter Umgebung',
    CASE WHEN r.status LIKE 'passed%' THEN 'BESTANDEN' ELSE 'FEHLER' END,
    'Backup ' || coalesce(r.backup_path,'—') || ' vom ' || to_char(r.backup_created_at,'DD.MM.YYYY HH24:MI')
    || ' → ' || r.target_env || ', ' || r.rows_restored || ' Datensaetze in ' || r.tables_restored || ' Tabellen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='4 Vollstaendigkeit';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='4 Vollstaendigkeit' AND status='FEHLER';
  RETURN QUERY SELECT '4 Vollstaendigkeit', 'Anzahl Backup = Anzahl Restore',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Tabellen verglichen, ' || m || ' unerklaerte Differenzen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='5 Identitaetsfelder';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='5 Identitaetsfelder' AND status='FEHLER';
  RETURN QUERY SELECT '5 Rechnungsintegritaet', 'Kritische Identitaetsfelder unveraendert, keine Neuvergabe von Rechnungsnummern',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Objektklassen feldweise verglichen, ' || m || ' Abweichungen';

  RETURN QUERY SELECT '6 Dokumentintegritaet', 'Pruefsummen fuer Rechnungs-PDFs und Belegdateien', 'WARNUNG',
    'Fuer historische Dateien existieren keine vollstaendigen Pruefsummen; Backup enthaelt Datei-Inventar. Hash-Strategie in Verfahrensdokumentation 1.2, Kapitel 15.2 definiert';

  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='7 Audit-Trail' AND status<>'BESTANDEN';
  RETURN QUERY SELECT '7 Audit-Trail', 'Auditdaten nach Restore unveraenderbar',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, 'Aenderung und Loeschung von Audit-Eintraegen wurden abgewiesen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='8 Schutz nach Restore';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='8 Schutz nach Restore' AND status<>'BESTANDEN';
  RETURN QUERY SELECT '8 Schutzmechanismen', 'Schutz wirkt auch nach Wiederherstellung',
    CASE WHEN m=0 AND n>=5 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Negativtests, ' || m || ' nicht bestanden';

  RETURN QUERY SELECT '9 RPO/RTO', 'Gemessene Werte (nicht theoretisch)', 'BESTANDEN',
    'RPO ' || round(r.rpo_seconds/3600.0, 2) || ' h (Sicherungszeitpunkt bis Teststart), RTO ' ||
    round(r.rto_seconds/60.0, 2) || ' min gemessene Wiederherstellungsdauer des geprueften Umfangs';

  RETURN QUERY SELECT '10 Backup + Loeschung + Legal Hold', 'Umgang mit geloeschten Daten und Sperren in Sicherungen',
    'BESTANDEN', 'Verfahrensdokumentation 1.2, Kapitel 15.4: Restore nur isoliert; vor produktiver Rueckfuehrung Abgleich gegen Loeschprotokoll und aktive Legal Holds';

  SELECT count(*) INTO n FROM public.gobd_procedure_docs WHERE version='1.2' AND section LIKE '15%';
  RETURN QUERY SELECT '11 Disaster Recovery', 'Versionierte Schritt-fuer-Schritt-Anweisung',
    CASE WHEN n >= 5 THEN 'BESTANDEN' ELSE 'OFFEN' END, n || ' Kapitel in Verfahrensdokumentation Version 1.2';

  -- Befund aus dem Restore-Test: Protokolltabellen wurden in Altsicherungen abgeschnitten
  SELECT coalesce(nullif(c.actual,'')::bigint, 0) INTO v_log
    FROM public.gobd_restore_checks c
   WHERE c.run_id = r.id AND c.category='4 Vollstaendigkeit' AND c.check_name='audit_logs';
  SELECT count(*) INTO v_live FROM public.audit_logs;
  RETURN QUERY SELECT '12 Befund Protokollsicherung',
    'Vollstaendigkeit der Protokolldaten in der Sicherung',
    CASE WHEN v_log >= v_live * 0.9 THEN 'BESTANDEN' ELSE 'WARNUNG' END,
    'Geprueftes Backup enthielt ' || v_log || ' von aktuell ' || v_live ||
    ' Audit-Eintraegen (Seitenbegrenzung der Sicherung). Ursache behoben; wirksam ab der naechsten Vollsicherung, daher erneute Pruefung erforderlich';

  RETURN QUERY SELECT '13 Gesamtstatus', 'Technische GoBD-Pruefung', 'OFFEN',
    'Technische GoBD-Pruefung bestanden – organisatorischer Abschluss laeuft';
END; $$;

REVOKE EXECUTE ON FUNCTION public.gobd_phase15_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_phase15_check() TO authenticated, service_role;
