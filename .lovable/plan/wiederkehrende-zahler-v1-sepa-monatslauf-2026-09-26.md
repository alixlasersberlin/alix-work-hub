# Wiederkehrende Zahler V1 – SEPA-Monatslauf

## Ziel
Jeden Monat wird automatisch ein Monatslauf als **Vorschau** vorbereitet. Rechnungen, Vorabinformationen und Lastschriften entstehen erst nach ausdrücklicher Freigabe. Ein Bankeinzug wird **nie** automatisch ausgelöst.

## Vorab zu klären (blockiert nur die Freigabe, nicht den Aufbau)
- **Gläubiger-ID:** Eingegeben wurde „DE02ZZZOOOO26O5O62". Darin stehen vermutlich Buchstaben „O" statt Nullen, gemeint ist wohl **DE02ZZZ00002605062**. Ich speichere den Wert als Einstellung. Eine Freigabe ist erst möglich, wenn Sie ihn bestätigt haben.
- **Vorlaufzeit der Vorabinformation:** Standard sind 14 Tage. Den Wert können Sie in den Einstellungen ändern.
- **Zoho:** Weil AlixWork die Rechnungen selbst erstellt, muss ein Zahler in Zoho gestoppt werden, sobald er hier übernommen ist. Sonst entstehen doppelte Rechnungen. Die Übersicht warnt bei jedem Zahler, der in Zoho noch aktiv ist.

## Menü (Finance → Wiederkehrende Zahler)
Übersicht (die bestehende Seite bleibt) · Aktive Zahler · Monatsläufe · SEPA-Mandate · Vorabinformationen · Rücklastschriften · Einstellungen · Protokoll

## Funktionen
1. **Dashboard:** Kennzahlen, der nächste Monatslauf mit Status, Summe, Anzahl bereit und fehlerhaft sowie Knöpfe. Der Freigabe-Knopf ist gesperrt, solange es Blocker gibt.
2. **Zahlungspläne:** Kunde, Vertrag, Leistung, netto/MwSt./brutto, Intervall, Start/Ende, Fälligkeitstag, Mandat, Benachrichtigungsart und Status (aktiv/pausiert/beendet/Fehler). Beim ersten Start übernehme ich optional die bestehenden Zoho-Profile als Entwurf, nur lesend.
3. **Monatslauf-Vorschau:** Tabelle mit allen Spalten aus Ihrer Vorgabe und maskierter IBAN (DE••••1234). Tabs: Alle, Bereit, Warnungen, Blocker, Ausgesetzt, Benachrichtigungen, Zahlungen, Audit.
4. **Prüfung:** alle 19 Prüfungen, eingestuft als BLOCKER, WARNUNG oder HINWEIS.
5. **Massenbearbeitung:** aus dem Lauf entfernen, diesen Monat aussetzen, Fälligkeit ändern, Betrag einmalig ändern, neu prüfen. Original- und neuer Wert bleiben im Protokoll erhalten.
6. **Freigabe in 4 Schritten** mit Zusammenfassung und Bestätigungstext.
7. **Rechnungserzeugung:** über die bestehende Rechnungslogik mit Nummernkreis, GoBD-Schutz und Periodensperre. Jede Rechnung wird mit dem Lauf verknüpft.
8. **Vorabinformation:** per E-Mail, SMS oder beidem. Vorlagen sind bearbeitbar, Sie sehen vorher eine Vorschau. Der Status gilt ehrlich als „übergeben", nicht als „zugestellt". Versand über alixwork.de und Twilio. Erneutes Senden geht nur ausdrücklich über einen eigenen Knopf.
9. **Status bis „Bereit für Einzug":** Die SEPA-Datei (pain.008) kommt in Stufe 2. Die Struktur dafür wird jetzt schon angelegt.
10. **Bank & Zuordnung:** Wird eine Zahlung eindeutig zugeordnet, gelten die Position und die Rechnung als bezahlt. Ist die Zuordnung nicht eindeutig, wird nichts automatisch zugeordnet.
11. **Rücklastschriften:** Liste mit den Aktionen aus Ihrer Vorgabe. Ein erneuter Einzug erfolgt nie automatisch.
12. **Pausieren:** „Diesen Monat aussetzen" und „Plan pausieren" sind getrennte Funktionen.
13. **Rechte:** separate Rechte für Ansehen, Bankdaten, Bearbeiten, Freigabe, Versand und Protokoll. Die volle IBAN sehen nur Super Admin, Admin und Finance.

## Technische Details
- Neue Tabellen: `rp_payment_plans`, `rp_mandates`, `rp_billing_runs`, `rp_billing_run_items`, `rp_period_skips`, `rp_prenotifications`, `rp_notification_deliveries`, `rp_direct_debit_runs`/`_items`, `rp_return_debits`, `rp_audit_log` (unveränderbar, per Trigger), `rp_settings`. Alle mit GRANTs, RLS und `has_role`. Vorhandene Tabellen werden nicht verändert.
- Die volle IBAN ist nur über eine RPC mit Rollenprüfung abrufbar. Listen zeigen sie maskiert.
- Eindeutiger Index auf (customer_id, contract_id, plan_id, billing_period) für finale Positionen. Freigabe als Security-Definer-RPC mit `FOR UPDATE` auf den Lauf, Statusprüfung und Idempotenzschlüssel. Die Beträge berechnet der Server neu, Werte aus dem Browser werden ignoriert.
- Rechnungen entstehen per Insert in `zoho_invoices` (source alixwork) plus `assign_invoice_number` innerhalb derselben Transaktion.
- Monatlicher Cron (1. des Monats, 03:30 UTC) über eine Edge Function `rp-prepare-run`. Er erzeugt nur Vorschauen und ist idempotent je Periode.
- Edge Functions `rp-send-prenotifications` (E-Mail/SMS) und `rp-prepare-run`.
- Tests: die 20 geforderten Fälle als transaktionale SQL-Tests mit Rollback, dazu die Abnahme mit 20 Test-Zahlern in einer Rollback-Transaktion. Es bleiben keine Testdaten zurück, und produktive Daten werden nicht verändert.
- Abnahmebericht `docs/wiederkehrende-zahler/v1-abnahme.md`. Nicht getestete Punkte werden ausdrücklich als offen markiert, zum Beispiel der Bildschirmtest mit echter Anmeldung.

## Nicht in V1
SEPA-XML-Datei, Bankeinreichung, automatische Rücklastschriften, vollständige Bankabstimmung (Stufe 2).
