# ALIXWORK – SECURITY CONTROL CENTER v1.0

Prüfstand: 2026-11-28T03:57:32.610572Z · Bericht 4b63d077aada8a18e9bc

## Ergebnis

Die vorhandene Systemsicherheit unter `/security-center` enthält nun ein geschütztes priorisiertes Inventar, Filter, CSV-/Prüfbericht-Export, komponentenbezogene Korrekturfreigaben und einen Link zur bestehenden Release Control. Neue Freigaben werden über `security-remediate` mit exakter aktiver Super-Admin-Prüfung in vorhandenen Audit-/Findingtabellen erfasst; keine Korrektur wird dadurch ausgeführt und kein Originalbefund geschlossen. Keine neue Tabelle oder parallele Prüf-/Freigabeschnittstelle.

## Bestände und Abgleich

- 188 offene Scannerbefunde, 25 gezielt korrigierte Befunde.
- Alle 493 älteren Datenbankhinweise anhand ihrer Objekt-/Rollenidentitäten mit dem aktuellen Linter abgeglichen: 12 anonym ausführbare, 476 angemeldet ausführbare privilegierte Funktionen, zwei Tabellen mit RLS ohne Policies, drei Erweiterungen im öffentlichen Schema.
- 706 Quell-/Verlaufsdatensätze einschließlich behobener Befunde, **kein eindeutiger Schwachstellen-Gesamtwert**. Scannerbestand und Linterhinweise werden nicht ungeprüft addiert. Exakte interne Kennungen sind eindeutig; semantischer Dublettenabgleich bleibt unvollständig.
- Bestätigte gemeinsame Ursache: `ac_web_segment_stats` findet sich sowohl im Tiefenscan als auch im Linterbestand. Zwei Ticket-Auto-Close-Befunde teilen dieselbe fehlende Aufruferprüfung. `has_role`/`offboard_user` gehören zu einer Angriffskette, Rollenvererbung und Inaktivität sind aber unterschiedliche Ursachen. `plm_can_write`, `sv_can_write`, Ticketbenachrichtigungstrigger sind nur Komponentenbeziehungen, keine bestätigten Dubletten.
- Jede Position ist einem der 14 gewünschten Bereiche und P0–P4 zugeordnet, einschließlich Komponente, Ursache, Auswirkungen, Empfehlung, Abhängigkeiten, Tests und Wiederherstellung. Nicht einzeln geprüfte Positionen heißen ausdrücklich Einzelprüfung offen. Priorisierung ist dort vorläufig.

## Bestätigte Quellcodeprioritäten

- P0: Product-Hub-Import ohne ausreichenden Aufruferschutz und Exportzugang an unbestätigte Zieladressen; CRM-Kundenintelligenz ohne Aufrufer-/Datensatzprüfung; Bankimport und DATEV-Export mit unzureichender Identitäts-/Finanzberechtigung; Rollenvererbung/inaktive Restrollen. Keine produktive Ausnutzung getestet.
- P1: privilegierte Storagekopien ohne Quellleserecht, ungeschützte Gesprächsautomatisierung, Meta-Signaturprüfung und fehlende 3CX-Konfiguration, automatische Ticketschließung und fester Ankündigungstoken.
- Mögliche Fehlalarme bleiben offen: erlaubte freie Nachrichtentexte oder nach Rollenprüfung gewählte Berichtsempfänger sind nicht automatisch ein Sicherheitsfehler. Finanzfreigaben/Sprachnotizen verwenden teilweise aufrufergebundene Clients; tatsächliche Rechte und Fehlerketten bleiben zu prüfen.
- Alte COM-Pfade werden durch controlled_modes derzeit gesperrt; ihr unsicheres Verhalten bei fehlenden Einstellungen bleibt ein Risiko, aber aktuell erfolgreicher externer Versand wird nicht behauptet.

## Product Hub Release Control

Live gelesen: 44 Produkte, DE/COM blocked, enabled=false, emergency_stopped=true. Bestehender Sicherheitsnachweis vom 28.11. 02:56 UTC: passed=false, complete=false, confirmed_critical=2, confirmed_high=1. Dieser Nachweis bleibt unverändert. Die bestehende serverseitige Nachweissperre wurde geprüft; bestätigte hohe/kritische Risiken erlauben keinen erfolgreichen Sicherheitsnachweis. Die Oberfläche verknüpft die neue Übersicht mit Release Control v1.1 und zeigt bestätigte Product-Hub-Risiken als blockierend. Keine neue parallele Pilotfreigaberegel.

**Client proof injection accepted:** Im aktuellen Stand nicht bestätigt: Live-Datenbankprüfung verweigert anon/authenticated den Nachweisaufruf und authenticated die reservierte Protokolleinfügung. Der tatsächliche Release-Control-Handler ignoriert manipulierte Erfolgs-, Kontext- und Akteursfelder im isolierten Test und speichert ausschließlich serverseitig berechnete negative Ergebnisse. Kein Produkt oder Freigabenachweis wurde durch diese Tests angelegt.

## Verifikation

- 17 Server-Regel-/Handler-Tests bestanden: Berichtsinventar und revisionsgebundene Freigaben; exakte aktive Rolle; Freigabe speichern und lesen ohne Ausführung; tatsächlicher Release-Control-Handler mit manipulierten Clientfeldern; neun tatsächliche automatische Handler mit vollständig simuliertem Netzwerk und Daten; gültige synthetische Twilio-/Mail-Signaturen.
- Zwölf tatsächlich bereitgestellte Eingänge mit öffentlichen/falschen Zugangsdaten erneut geprüft: jeweils HTTP 401. Keine echten E-Mails, WhatsApp, Benachrichtigungen oder produktiven Synchronisationen ausgelöst.
- Berechtigte Automatiken: neun tatsächliche Handler im isolierten Test HTTP 200, drei Provider-Signaturwege mit synthetischen Signaturen. Diese Tests sind kein Nachweis sämtlicher produktiver Zeitplan-/Providerkonfigurationen.
- Live-Datenbank-Regelprüfungen: anon/authenticated können den Proof-RPC nicht ausführen; authenticated kann keinen reservierten Proof-Logeintrag anlegen; erfolgreiche Sicherheitsnachweise mit jeweils einem kritischen/hohen Risiko werden abgewiesen. Alle Schreibversuche verweigert; kein Prüfnachweis gespeichert.
- 17 Frontendtests bestanden; Desktop-/Mobilansicht und CSV mit 706 Datensätzen, Filter, Dialog, simulierte Freigabe und Readback geprüft. Tests in isolierter Ansichtsprüfung, keine produktive Freigabe.
- Echter angemeldeter Mitarbeiterzugriff und produktive Freigabe-Readback nicht verifiziert: extern verwaltetes Supabase stellt keine automatisierbare Sitzung bereit. Keine Anmeldedaten verlangt.
- Anwendungsprüfung build OK; Berichtsfunktion bereitgestellt. UI noch nicht veröffentlicht.

## Weiterhin offen

Die vollständige individuelle Sicherheitsabnahme der 188/493 Bestände und der vollständige semantische Dublettenabgleich sind **nicht abgeschlossen**. Ein neuer Tiefenscan wurde am 28.11. 03:52 UTC gestartet; sein Ergebnis wird asynchron zugestellt und ist in dieser Version noch nicht enthalten. Der letzte vollständige Tiefenscan ist nicht nachgewiesen, deshalb kein erfundenes Datum. Der Bericht zeigt den letzten erfolgreichen **begrenzten** Regressionstest, keine vollständige Sicherheitsfreigabe.

Weitere Korrekturen erfolgen ausschließlich nach ausdrücklicher Einzel-/Paketfreigabe. 3CX-/Meta-Providerkonfiguration, isolierte Benutzer-/Mandanten-/Storage-Matrix und historische Client-proof-Testartefakte fehlen noch. Keine Geräte-/Produkt-/Schlüssel-/Zeitplan-/API-Vertragsänderung, keine Aufhebung des Notstopps, keine automatische Pilot- oder Produktivfreigabe.

## Vollständiges priorisiertes Einzelinventar

Das CSV `security-control-center-v1-inventar-2026-11-28.csv` und der geschützte UI-Prüfbericht enthalten alle 706 Quell-/Verlaufseinträge mit ihrer jeweiligen Bestätigung und den konkreten Empfehlungen.
