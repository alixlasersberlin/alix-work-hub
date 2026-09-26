# ALIXWORK – WIEDERKEHRENDE ZAHLER V1 – Abnahmebericht (26.09.2026)

Status: **technisch umgesetzt, Datenbanktests 27/27 bestanden – Produktionsfreigabe NEIN** (offene Punkte unten).

## Implementierte Funktionen
- Seite `/finance/sepa-monatslauf` (Menü Finance → Ratenzahler → Wiederkehrende Zahler): Übersicht, Aktive Zahler, Monatsläufe mit Preview, SEPA-Mandate, Vorabinformationen, Rücklastschriften, Einstellungen, Protokoll.
- Monatslauf-Preview mit allen geforderten Spalten, maskierter IBAN, Tabs (Alle/Bereit/Warnungen/Blocker/Ausgesetzt/Benachrichtigungen/Zahlungen), Suche, CSV-Export, Detailansicht mit berechtigter IBAN-Anzeige.
- 19 Prüfungen, BLOCKER/WARNUNG/HINWEIS; Zusatzwarnung wenn Profil in Zoho noch aktiv.
- Massenaktionen: entfernen, Monat aussetzen, wiederherstellen, Fälligkeit/Betrag einmalig ändern, neu prüfen.
- Freigabe in 4 Schritten mit Pflicht-Bestätigungstext; Rechnungen über bestehende Nummernvergabe (`assign_invoice_number`, GoBD-Schutz).
- Vorabinformation per E-Mail/SMS (Edge Function `rp-send-prenotifications`), Status „übergeben" statt „zugestellt", erneutes Senden nur ausdrücklich und protokolliert.
- „Einzug vorbereiten" → Status BEREIT FÜR EINZUG; es wird **kein** Bankeinzug ausgelöst (SEPA-XML = Stufe 2).
- Zahlungsabgleich: Position → bezahlt nur, wenn die Rechnung in Bank & Zuordnung vollständig ausgeglichen wurde.
- Monatlicher Cron `rp-prepare-run-monthly` (1. des Monats, 03:30 UTC), erzeugt nur Vorschau für den Folgemonat.

## Datenbankänderungen (nur additiv)
Neue Tabellen `rp_settings, rp_mandates, rp_payment_plans, rp_billing_runs, rp_billing_run_items, rp_period_skips, rp_prenotifications, rp_notification_deliveries, rp_direct_debit_runs, rp_direct_debit_items, rp_return_debits, rp_audit_log`; RPCs `rp_prepare_run, rp_validate_run, rp_item_action, rp_approve_run, rp_log_delivery, rp_prepare_direct_debit, rp_sync_payments, rp_return_debit_action, rp_confirm_creditor, rp_list_mandates, rp_get_mandate_iban`.

## Sicherheitsmaßnahmen
RLS auf allen Tabellen; Läufe/Positionen nur über Security-Definer-RPCs änderbar; volle IBAN nur Super Admin/Admin/Finance (Abruf wird protokolliert); Beträge serverseitig neu berechnet und revalidiert; `FOR UPDATE`-Sperre bei Freigabe; eindeutiger Index (Kunde, Vertrag, Plan, Periode) für finale Positionen; deterministische Rechnungs-ID `rp-<position>`; Audit-Log per Trigger unveränderbar; Löschen nur Super Admin.

## Testergebnisse (SQL, eine Transaktion, vollständig zurückgerollt)
20 Testzahler (15 gültig, 2 ohne Mandat, 1 pausiert, 1 ausgesetzt, 1 beendet). Alle 27 Prüfpunkte BESTANDEN:
A1 15 bereit/2 Blocker · T01/T15 erneutes Vorbereiten ohne Duplikate · T02 ohne Mandat · T03 inaktives Mandat · T04 fehlende IBAN · T05 fehlende Mandatsreferenz · T06 fehlende Gläubiger-ID · T07/T08 pausiert/beendet · T09 ausgesetzt · T10 Betragsänderung inkl. Original im Audit · T11 Fälligkeitsänderung · T12/T13 Doppel-Freigabe / erneuter Aufruf (weiterhin 15 Rechnungen) · T14 unberechtigte Freigabe · T14b unberechtigter IBAN-Abruf · T16 unberechtigte Betragsänderung · T17 fremdes Mandat (manipulierte mandate_id) · T18 Rücklastschrift · T19 Rechnung bereits vorhanden (DB-Sperre) · T20 Vorabinfo versendet + Resend protokolliert · T21 Bankzahlung → bezahlt · F1 Blocker sperrt Freigabe · F2 ohne Bestätigung gesperrt · F3 Änderung nach Freigabe gesperrt · F4 Audit unveränderbar · A2 15 Rechnungen mit gesetzlicher Nummer · A3 15 Vorabinformationen · D1 produktiver Rechnungsbestand unverändert (7.762).
Testskript: `docs/wiederkehrende-zahler/v1-tests.sql`.

## Gefundene und behobene Fehler
- **Vorhandener Fehler (produktiv relevant):** Die GoBD-Schutzregel `gobd_number_range_guard` prüfte die nicht existierende Spalte `current_number`, dadurch scheiterte jede neue Rechnungsnummernvergabe. Korrigiert auf `last_value`; der Schutz (kein Zurücksetzen, kein Löschen) bleibt unverändert.
- Migrationsfehler durch `%`-Operator → `mod()`.

## Offen / nicht getestet
- Gläubiger-ID ist **nicht bestätigt**: Eingabe „DE02ZZZOOOO26O5O62" enthält Buchstaben O. Bis zur Bestätigung in den Einstellungen ist jede Freigabe gesperrt.
- Manipulierte customer_id über die API: nur durch RLS abgesichert (keine Update-Rechte auf Positionen), nicht mit echter Benutzersitzung getestet.
- Kein Bildschirm-/Browsertest mit echter Anmeldung; kein realer E-Mail-/SMS-Versand der Vorabinformation getestet.
- Rechnungs-PDF wird nicht automatisch an die Vorabinformation angehängt (Text verweist auf Kundenbereich).
- Zoho-Profile werden nicht automatisch übernommen; Zahler müssen angelegt und in Zoho gestoppt werden.

## Nicht in V1
SEPA-XML (pain.008), Bankeinreichung, Rücklastschrift-Automatik, vollständige Bankabstimmung.
