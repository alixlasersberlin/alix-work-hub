# ALIXWORK SECURITY – konsolidierter Abschlussstand

**28.11.2026 – keine vollständige Sicherheitsabnahme und keine Freigabebereitschaft.**

Der finale Abschlussauftrag ist **nicht vollständig erfüllt**: 472 native Befunde bleiben offen; nicht alle sind individuell abgearbeitet. Diese Restarbeit wird ausdrücklich nicht pauschal als externe Blockade ausgegeben. Zusätzlich fehlen ein erfolgreicher aktueller Tiefenscan, angemeldete Ende-zu-Ende-Prüfungen und eine vollständig nachgewiesene Sicherung mit tatsächlichem isoliertem Restore. Es erfolgt keine Veröffentlichung der Anwendung und keine Product-Hub-Freigabe.

## 1. Tatsächlich ausgeführte Korrekturen

Geprüfter und gespeicherter Korrekturcommit: **01fa31042**.

Sechs vorhandene Funktionen korrigiert und bereitgestellt:

| Bereich | Tatsächlicher Schutz |
|---|---|
| Mediapaket-Portal | Alle 17 Mitarbeiteraktionen verlangen aktive Konten, zugewiesene Rollen/Firmen und vorhandene Schreibrechte; Paket, Kunde und etwaiger Zielauftrag werden abgeglichen. Kundenfelder sind fest begrenzt. Datei- und Fragezugriffe sind paketgebunden. Statusmeldungen müssen dem gespeicherten Status entsprechen. Detaillierte Kunden-Diagnoseprotokolle wurden entfernt. |
| Dokumentlöschung/Wiederherstellung | Exakte Super-Admin-Rolle für Löschung; Wiederherstellung nur mit bestehender Bearbeitungs-/Eigentümerberechtigung. Firma und Elternvorgänge werden geprüft. Fremde Speicherpfade werden abgelehnt; Datenbank-Löschschutz läuft vor der Dateientfernung. |
| Rückgabe signierter Dokumente | Aktiver berechtigter Mitarbeiter oder bestehender privater Maschinenzugang; tatsächlicher abgeschlossener Signaturstatus, zugängliches Dokument und Firmen-/Elternzuordnung vor dem Download. Versionsfehler und konkurrierende Änderungen werden nicht als Erfolg ausgegeben. |
| Firmenunterschrift | Keine öffentlichen/ungültigen Zugänge; aktive berechtigte Rollen oder bestehender privater Serverzugang erforderlich. Der protokollierte Akteur stammt nicht mehr aus der Anfrage. PDF-Eingaben und leere Dokumente werden geprüft. |
| CMR-Einladung | Persönlicher Zugriff auf aktiven, nicht abgelaufenen Zugang des erlaubten Mandanten. Ausschließlich gespeicherter Empfänger; Link wird unter der festen Anwendungsadresse erzeugt. Versand ändert keine Kundenadresse. Bestehende Archivkopieregel bleibt. |
| ALIXSMART-Synchronisation | Sämtliche Zweige einschließlich Diagnose/Peek geschützt. Private Maschinenzugänge bleiben; manueller globaler Export verlangt aktive Administratoren mit ausdrücklicher Zuordnung zu jedem aktiven Mandanten. Aktionen/Tabellen validiert; fehlgeschlagene Schreibteile verhindern eine erfolgreiche Fortschrittsmarke. Zeitplan und Matchingregeln unverändert. |

**37 konkrete native IDs** nach Quellenprüfung, Tests, Bereitstellung und tatsächlicher öffentlicher Abweisung über die Befundverwaltung als behoben gemeldet: **23 kritisch, 14 Warnungen**. Keine Ignorierung. Vollständige Kennungen: `native-closed.csv`.

22 weitere bereits geschützte Quellpfade sind Kandidaten, wurden aber konservativ **nicht** geschlossen; eine gemeinsame Anmeldungssperre allein ist keine vollständige Einzelabnahme. Liste: `prior-candidates-not-closed.csv`.

## 2. Prüfnachweise und Grenzen

- **492 gemeinsame Servertests bestanden**, einschließlich **56 neuer Sicherheitsregressionen**.
- **277 Anwendungstests bestanden**; aktuelle Vorschau meldet `build OK`.
- Alle sechs geänderten Funktionen mit Deno typgeprüft.
- **22 tatsächliche HTTP-401-Abweisungen** an elf bereitgestellten Endpunkten mit öffentlichem Projektschlüssel beziehungsweise ungültigem Token; `live-denial.json`.
- Neue Tests prüfen unter anderem lesbare fremde Firmenobjekte, beliebige Kundenfelder, falsche Zielkunden, widerrufene Einladungen, umgeleitete Empfänger, fremde private Pfade und einen echten synthetischen PDF-Stempel mit unverfälschtem Akteur.
- **5 Isolationstests des bestehenden Restore-Werkzeugs bestanden. Das ist kein tatsächlicher Restore.**
- Vorübergehende Testfehler waren nachvollziehbare Testumgebungsprobleme: fehlende Paketauflösung, fehlende ausschließlich lokale Netzwerkrechte und eine nicht überschriebenene Export-URL im synthetischen Test. Nach Korrektur der Testausführung bestanden die genannten Prüfungen. Keine echten Provideraufrufe aus den synthetischen Tests.
- Die **91 v5-Korrekturen** wurden erneut über ihre vorhandenen Regressionen geprüft; die 26 damaligen Quellhashes stimmten bei der Einzelprüfung überein. Eine neue vollständige Mitarbeiter-/Provider-/Versionskonfliktabnahme aller 91 ist damit **nicht** bewiesen; `prior-91-regression.csv` trennt diese Zustände.
- Keine echten Finanzbuchungen, Kundennachrichten, WhatsApp-Nachrichten, Produktimporte oder Webseitenveröffentlichungen zu Testzwecken ausgelöst.

## 3. Verbindliche Restbilanz

| Prüfbereich | Tatsächlicher Stand |
|---|---|
| Native offene IDs | **472: 240 kritisch, 232 Warnungen** |
| Individuelle Gesamtabnahme aller 509 Ausgangs-IDs | **Nicht abgeschlossen** |
| 91 historische Korrekturen | Gemeinsame Regression bestanden, vollständige individuelle Live-Abnahme offen |
| Datenbank-Linter | **318 Hinweise**, weiterhin individuell offen |
| RLS | **942/942 öffentlichen Tabellen aktiviert**; kein Beweis vollständiger Mandantentrennung |
| Storage | **31/31 Buckets privat**; kein Beweis korrekter Einzeldatei-Berechtigungen |
| Tiefenscan auf Korrekturcommit | **Nicht erfolgreich nachgewiesen** |
| Angemeldete Mitarbeiter-/Providerprüfung | **Nicht verfügbar** |
| Vollständige Datensicherung | **Gestartet; Umfang und vollständige Integrität nicht abgenommen** |
| Tatsächlicher isolierter Restore | **Nicht durchgeführt** |
| Product Hub | **Ausgeschaltet, Notstopp aktiv, DE/COM gesperrt, kein Pilot** |

Die 472 IDs sind eine geerbte Verwaltungsbilanz, nicht 472 aktuell reproduzierte Ausnutzungen. Die vollständige Restliste bleibt erhalten; keine kosmetischen Bereinigungen.

`individual-source-inventory.csv` erfasst alle 509 Ausgangs-IDs mit verfügbaren Quellpfaden/Hashwerten und getrennten Prüfzuständen. 216 unterschiedliche Quellen zugeordnet; bei drei Befunden bleibt die Quellzuordnung unvollständig. **Ein Quellhash bedeutet nicht, dass der jeweilige Befund bereits individuell geprüft ist.**

### Besonders konkret verbleibende Ursachen

- Kampagnen, Journeys, Wissensartikel und Segmente: teilweise fehlt eine eindeutige Objekt-/Mandantenbindung; ein inline übergebener Segmentfilter darf die Prüfung des gespeicherten Segments nicht ersetzen.
- Compliance-Gesamtzahlen: persönliche Anmeldung ersetzt keine ausdrücklich nachgewiesene Firmenfilterung der Auswertung.
- Abschreibungen: Firmen-/Regionseinschränkung und sichere wiederholte Buchung nicht vollständig nachgewiesen. Kein Finanzlauf gestartet und keine Formel geändert.
- Playbooks/Journey-Ausführung: vorgelagerte Konfigurationszugriffe, Empfänger-Fallbacks und überschreibbare gespeicherte Ausführungskontexte benötigen weitere Korrekturen und nichtleere Gegenproben.
- PDF-Auftragsübernahme: Kunden-/Importzuordnung, Schreibbefugnis, Sperre und atomare Erstellung bleiben ungeklärt; keine Live-Übernahme ausgelöst.
- Öffentliche Lieferantworten: bisheriger Auftragsnummer-/PLZ-/E-Mail-Abgleich ist keine Bestätigung des Mailboxbesitzes; Änderung dieses bestehenden Kundenprozesses nicht stillschweigend vorgenommen. Fehler-/Drosselungs-/Wiederholungsfälle weiter offen.
- Mediapaket-Dateiupload: Signieradresse ist paketgebunden; **die vorhandenen Dateityp-/Größenregeln sind nicht vollständig serverseitig erzwungen**. Der Bucket hat keine entsprechenden Grenzen; die administrativen Werte sind nicht gespeichert. Befund `lov_finding_475b013930df976e` bleibt aktiv. Keine neuen Geschäftsgrenzwerte erfunden.
- Löschregel-Abweichungen in bestehenden Dokumentrelationen/Alix-Flex sowie vertrauliche Push-Titel bleiben dokumentierte, nicht stillschweigend korrigierte Regelkonflikte. Eine bestätigte Ausnahme oder die ausdrückliche Durchsetzung der allgemeinen Vorgabe ist vor einer Prozessänderung nötig.
- Historisch exponierte Zugänge: koordinierte Sperrung/Rotation und Providerabnahme fehlen. Schlüssel wurden weder geändert noch in Berichten ausgegeben.

## 4. Tiefenscan: Diagnose statt behaupteter Reparatur

Der angeforderte Schnellscan wurde abgeschlossen: keine neuen aktiven Befunde im begrenzten geprüften Bereich; Connectorprüfung mangels Konfiguration übersprungen. Bereits ignorierte Befunde wurden nicht bearbeitet.

Die zurückgelieferten Tiefenscan- und Task-Daten enthalten lediglich `completion_status=failed`, `up_to_date=false`, Zeitstempel und Teilbefunde, **keine Fehlerursache, keinen Stacktrace und keine Laufzeitdiagnose**. Auch das Auslesen des konkreten fehlgeschlagenen Tasks lieferte nur diese Scanprojektion. Daher wurde keine Ursache erfunden und keine Scannerreparatur behauptet.

Ein einzelner neuer Tiefenscan wurde auf dem bei Start gespeicherten Commit **1a1b994f1622759a047a82979e9726aaff586c4f** gestartet:

`security_scan/security-scan-13914134-4b95-4f3f-a064-71f725c7d887-1a1b994f1622759a047a82979e9726aaff586c4f-c2f5e03c`

Dieser Lauf enthält **nicht** die danach gespeicherten Korrekturen auf `01fa31042`. Es wurde nicht gepollt und keine Wiederholungsschleife gestartet. Sein späteres Ergebnis ist kein Scan des neuen Korrekturstands.

**Exakte fehlende Voraussetzung:** Ausführungsdiagnosen des extern verwalteten Scannerdienstes für die genannten Task-IDs, anschließend ein vollständiger erfolgreicher Lauf auf `01fa31042` oder einem späteren vollständigen Korrekturcommit. Die App enthält weder Scannerimplementierung noch Zugriff auf dessen interne Fehlerprotokolle; eine Änderung des AlixWork-Codes kann diese fehlenden Diagnosen nicht ersetzen.

## 5. Angemeldete Prüfungen: tatsächliche Blockade

`lovable auth-session --json --self` wurde erneut geprüft und ausdrücklich abgewiesen: **extern durch den Nutzer verwaltetes Supabase-Projekt; Lovable kann dafür keine Sitzung erzeugen**. Auch das Edge-Testwerkzeug bestätigte, dass es aus diesem externen Backend keine Vorschau-Anmeldung übernimmt. Eine vorhandene normale Benutzeranmeldung in der Vorschau ist deshalb hier nicht automatisch als wiederverwendbare Testsitzung verfügbar.

**Erforderliche Maßnahme:** kontrollierte Tests mit bereits genehmigten Konten/Sitzungen in der externen Umgebung bereitstellen oder durch autorisierte Personen durchführen, einschließlich zweier Mitarbeiter verschiedener Firmen, deaktiviertem Konto, echtem erlaubtem Dokument-/Einladungsfall und Providergegenprobe. Keine Passwörter oder Sitzungstoken im Chat; keine Ersatzidentitäten, Rollenvergaben oder Schutzumgehungen vorgenommen.

## 6. Sicherung und tatsächliche Umfangslücken

Einmalig den bestehenden `daily-full-backup`-Auftrag mit Dublettenprüfung gestartet, ohne Zeitplanänderung. Sicherungs-ID:

**2dad621c-2c25-4d21-9558-46c3fd84a249**, Start **28.11.2026 12:45:11 UTC**.

Letzte abgelesene Fortschrittsmeldung: **running**, Tabelle **250/312**, **2.025 Teile**, **1.297,0 MB**, noch **62 Tabellen und 11 Speicherbereiche**. Dies ist ein Fortschrittsstand, kein Abschluss- oder Integritätsnachweis.

Der vorhandene Sicherungsworker umfasst fest **312 Einträge** und **11 Buckets**. Abgleich mit der tatsächlichen Datenbank ergab **631 öffentliche Tabellen außerhalb dieser Liste**; ein Listeneintrag ist keine öffentliche Basistabelle. Die vollständige Ausschlussliste liegt in `backup-excluded-tables.txt`. Beispiele sind Kommunikations-, Kampagnen- und Journey-Daten. Die automatische Bezeichnung „full“ ist deshalb **kein Nachweis einer vollständigen Sicherung des gesamten Systems**.

Von 31 privaten Buckets stehen 11 in der Worker-Liste; 20 einschließlich des Sicherungsziel-Buckets sind nicht Teil dieses Workerumfangs. Separate Sicherungswege sind damit nicht widerlegt, aber auch nicht vollständig bestätigt.

Die älteren Erfolgseinträge über 312 Tabellen, SHA-256-Teile und 1.963 indexierte Storage-Dateien beweisen weder die 631 fehlenden Tabellen noch historische Strukturzuordnung, vollständige Datei-Prüfsummen oder identische Hetzner-Dateiinhalte. Der laufende Auftrag erweitert den Sicherungsumfang nicht. Zeitpläne/Automatisierungen wurden entsprechend der Schutzvorgabe nicht umgebaut.

**Erforderliche Maßnahmen:** Sicherung abschließen; alle Ausschlüsse ausdrücklich anhand der tatsächlichen Datenquelle bewerten und den genehmigten Sicherungsumfang vervollständigen; zeitgebundenes Schema mit Hash und sämtliche relevanten echten Dateien/Prüfsummen beschaffen; Hetzner-Kopie bytebezogen vergleichen. Bis dahin kein „Datensicherung verifiziert“.

## 7. ALIXWORK RESTORE TEST

Keine provisionierte, erreichbare isolierte Zielumgebung und keine vollständig nachgewiesenen Restore-Eingaben verfügbar. **Kein tatsächlicher Restore durchgeführt.** Die fünf bestandenen Werkzeugtests sind ausdrücklich nur Isolationstests.

Genaue vorhandene Einrichtung: `docs/producthub-2/restore-v1-1-einrichtung.md` und `restore-isolated.py`.

1. Eigene abgeschottete VM mit PostgreSQL-Datenbank `alixwork_restore_test` bereitstellen; alternativ separates Supabase-Projekt **ALIXWORK RESTORE TEST** mit neuer Projektkennung und eigenen Zugangsdaten. Das Produktivprojekt nicht umhängen.
2. Keine Produktionsdomains, produktiven Schlüssel, SMTP, E-Mail-/WhatsApp-Verbindungen, Webhooks, Shops, Banken oder Veröffentlichungsadapter übernehmen. Netzwerkzugriffe zu diesen Zielen sperren; Cron-/HTTP-Erweiterungen und Nutzertrigger im Restore-Ziel nicht aktivieren.
3. Originalmanifest, alle NDJSON-Teile, tatsächliche Dateien und dazugehörigen Schema-Snapshot mit zeitbezogenen SHA-256-Nachweisen über den vorhandenen geschützten Sicherungsweg bereitstellen.
4. Das bestehende streng lokale Werkzeug mit geschützter `RESTORE_DATABASE_URL` und ausdrücklicher Isolationsbestätigung ausführen; bei einem Remote-Supabase-Ziel zusätzlich eine lokale isolierte Prüfdatenbank bereitstellen. Das Werkzeug lehnt entfernte Produktionsverbindungen absichtlich ab.
5. Echte importierte Zeilen, Beziehungen, Dateiinhalte/Hashes und eine ausschließlich lokale lesende API prüfen. Kein manueller JSON-Bericht wird automatisch zur erfolgreichen Product-Hub-Freigabe.

## 8. Bestandsschutz

Vorher-/Nachher-Abgleich: **44 Produkte**, Produktfingerprint **8b67f41d0720374a058ab09745d27073** unverändert; **102 Zeitpläne**, Konfigurationsfingerprint **0ca98e3b57ae58bfc3a665238f8a6a79** unverändert.

DE und COM bleiben **blocked**, `enabled=false`, `emergency_stopped=true`, Revision **0**, kein Pilotgerät; Backup-/Restore-/Kommunikationsfreigaben bleiben unverändert. Keine API-Vertrags- oder Schlüsseländerung. Keine vollständige globale Unverändertheitsbehauptung über alle Geschäftstabellen: normale vorhandene produktive Abläufe wurden nicht angehalten, und eine vollständige historische Datenvergleichsbasis liegt nicht vor.

## 9. Nachweispaket

- `native-closed.csv`: exakt 37 über die Befundverwaltung abgeschlossene IDs.
- `remaining-native.csv` / `remaining-native-ids.txt`: alle 472 offenen IDs.
- `individual-source-inventory.csv` / `source-hashes.json`: Quellzuordnung, Hashwerte und transparente Einzelprüfzustände.
- `duplicate-evidence.json`: ein exakt identischer Beschreibungscluster; alle nativen IDs bleiben erhalten, kein ignorierter Doppelbefund.
- `prior-candidates-not-closed.csv`: 22 konservativ offen gehaltene Kandidaten.
- `prior-91-regression.csv`: damalige 91 Korrekturen mit getrenntem Regression-/E2E-Status.
- `server-tests.log`, `application-tests.log`, `typecheck.log`, `restore-tool-tests.log`, `live-denial.json`: tatsächliche Prüfresultate.
- `scan-metadata.json`, `verification-summary.json`, `backup-excluded-tables.txt`: Scan-/Restbilanz und konkrete Umfangslücken.

**Fazit: Korrekturpaket geprüft und bereitgestellt; vollständiger Sicherheitsabschluss, Nullbefunde und kontrollierte Freigabebereitschaft sind nicht erreicht.**
