# ALIXWORK SECURITY V6.0 – überprüfbarer Arbeitsstand

**TECHNICAL REMEDIATION COMPLETE: NEIN. SECURITY RELEASE APPROVED: NEIN.**

Dies ist ausdrücklich kein Sicherheitsabschlussbericht. Der Gesamtauftrag ist nicht abgeschlossen; weitere technisch bearbeitbare Befunde bleiben offen. Der verlangte finale `abschlussbericht.md` wird nicht als erfolgreicher Abschluss vorgetäuscht.

## P0: tatsächlicher Zoho-Vorfall

Lesend untersuchtes Zeitfenster: 28.11.2026, 13:30–14:15 UTC.

- Lauf `7012f728-a809-42ed-830f-a66cd62b6c78` begann 13:54:32.687819 UTC, `trigger_type=manual`, `created_by=null`. Er steht weiterhin auf `running`; Abschlusszeit fehlt. Seine Nullzähler sind kein Beleg für einen folgenlosen Aufruf.
- **21 neue Rechnungen** aus `zoho_eu_1`, angelegt 13:54:35.090683–13:56:42.330570 UTC; **257.446,94 EUR Rechnungsbetrag**, **255.425,04 EUR Saldo**. Die vollständigen Rechnungskennungen und Beträge sind geschützt gesichert, nicht als öffentliche App-Dateien eingebunden.
- Bei diesen 21 Rechnungen stimmen Betrag, Saldo und Quellstatus mit dem gespeicherten Zoho-Rohdatensatz überein. Das ist ein Vergleich mit dem Import-Snapshot, kein unabhängiger erneuter Zoho-Abgleich und kein historischer Änderungsbeweis.
- Keine vorhandenen Rechnungen mit einer Änderungszeit im untersuchten Fenster gefunden. Keine doppelten betroffenen Rechnungsnummern bzw. mehrfachen Quell-/Zoho-Kennungen in den abgefragten Prüfungen. Fehlende historische Änderungsbelege erlauben keine umfassende Negativbehauptung.
- Drei Forderungsfälle wurden im engsten Importfenster neu angelegt. Der Rechnungstrigger ruft die Forderungssynchronisierung auf; ohne durchgängige Korrelation ist die Verursachung einzelner Fälle nicht abschließend belegt. Null Gerätefreigaben im engsten Fenster gefunden.
- Lauf meldet `email_sent=false`; in den abgefragten allgemeinen Versand-, SMS- und Auditregistern wurden keine entsprechenden Versandeinträge gefunden. Der Handler versendet seine Abschlussmail jedoch direkt und kann vor der Protokollaktualisierung abbrechen. **Kein umfassender Ausschluss tatsächlicher Providerzustellungen.**
- Frühere unautorisierte Nutzung und Datenzugriffe bleiben ungeklärt. Die zugänglichen Analyseprotokolle begannen bei der Prüfung erst um 14:15 UTC; für den Vorfall selbst lieferte das Funktionsprotokollwerkzeug keine Einträge. Das beweist weder Löschung noch die Ursache der fehlenden Historie.
- Unveränderte verfügbare Rechnungs-/Zeitplanabfragen sind privat unter `/mnt/documents/.lovable/security-v6/evidence` mit SHA-256 gesichert. Diese Prüfsummen sichern die gesicherten Werkzeugantworten, nicht die Vollständigkeit der ursprünglichen Provider-/Gatewayprotokolle.
- Der Import akzeptiert inzwischen ausschließlich den bestehenden privaten Maschinenzugang oder aktive, ausdrücklich berechtigte Administratoren. Menschliche Anfragen prüfen die Firmenzuordnung; Datums-/Quell-/Seiteneingaben werden validiert. Ein Nur-Lese-Testlauf kann keine Testmail auslösen. Unautorisierte reale Aufrufe wurden mit 401 abgewiesen. **Keine Rechnungen gelöscht, storniert oder korrigiert; der hängende historische Lauf bleibt unverändert.**

## Korrekturpakete und Abnahmegrenzen

14 Funktionen angepasst und bereitgestellt: Zoho-Import; Ticket-KI; ALIXSMART-Ticketsynchronisierung; Sprachnotizen; Finanz-KI; Steuerexport; Vertragsanalyse; Rechnungsfreigabe; ALIX-Copilot; beide betroffenen SMS-Sender; SEPA-Vorabinformationen; ALIXSMART-Abgleich; Journey-Ausführung.

- Gemeinsamer aktiver Konto-/Rollen-/Firmenzugang; geschäftliche Ticket-/Dokumentabrufe verwenden Mitarbeiterrechte statt privater Vollzugriffe. Nachrichten bleiben an ihr Ticket gebunden.
- Copilot akzeptiert vom Browser ausschließlich Benutzer-/Assistentenverläufe, keine System-, Entwickler- oder Werkzeugrollen. Seine Datenwerkzeuge nutzen den Mitarbeiterzugang. Dies verhindert die nachgewiesene Rollenüberschreibung, ist aber **kein vollständiger Beweis gegen jede semantische Prompt Injection oder jeden bestehenden Datenbank-Rechtefehler**.
- Finanzanalysen und Steuerexporte verhindern die Auswahl fremder Firmen; Gesamtansichten bleiben ausschließlich bei tatsächlicher Zuweisung aller aktiven Firmen möglich.
- Rechnungsfreigaben prüfen Zielrechnung und Firmenidentität. Ein Datenbankauslöser verhindert manipulierte Genehmiger, Selbstfreigabe und übersprungene Vier-Augen-Schritte. Fünf tatsächliche Auslöserprüfungen mit vorübergehenden Testzeilen außerhalb der Geschäftstabellen bestanden. Das ersetzt keinen vollständigen angemeldeten Freigabeablauf und keinen atomaren Nachweis sämtlicher Folgeschreibvorgänge.
- Vertragsanalysen prüfen Dokumentzugriff auch bei zusätzlich übergebenem Text; direkte Analyseanlagen sind durch eine dokumentgebundene zusätzliche Regel geschützt.
- 19 genau zugeordnete ursprüngliche Scanner-IDs als behoben gemeldet, **keine ignoriert** (`closed-v6.csv`). Die 410 geerbten Korrekturen werden erhalten, nicht pauschal als erneut vollständig abgenommen bezeichnet. **171 ursprüngliche Befunde bleiben offen** (`remaining-original.csv`). Die neuere unvollständige Scannerbasis meldet nach den gezielten Schließungen 248 aktive IDs insgesamt; dies ist eine andere Grundgesamtheit.

## SMS

Gespeicherte Nummer als Standard; quellsichere serverseitige Vorgangs-/Kundenbindung; abweichende Nummern verlangen separate Berechtigung, echten Bestätigungswert und Pflichtgrund. Bestehende explizite Admin-/Super-Admin-Rechte oder die vorhandene granulare Berechtigung `sms.send_alternative_phone` erlauben die Abweichung. Keine neuen Rollenzuweisungen vorgenommen.

Alle bekannten Aufrufer der beiden Sender übermitteln nun den Vorgang. Sammel-Sperrhinweise prüfen jeden enthaltenen Vorgang unabhängig auf denselben Kunden. Die Vorbereitung liest die gespeicherte Nummer über denselben geschützten Sender, ohne SMS-Versand. Erneuter Kunden-SMS-Versand öffnet erneut die Prüfung statt sofort zu senden. Ein Pflichtprotokoll mit serverseitigem Mitarbeiter, Zeitpunkt, Vorgangsnummer, Grund und maskierter Nummer entsteht vor dem Versand; Ergebnisprotokolle sind getrennt. Allgemeine Providerfehler enthalten keine vollständigen Telefonnummern oder Nachrichten.

**Versandlimits offen:** Keine standardisierte Backendprimitive vorhanden; eigene Begrenzung benötigt die ausdrückliche Bestätigung des Tradeoffs. Die entsprechende einmalige Entscheidungskarte ist offen. Kein neuer Ad-hoc-Limiter eingebaut. SMS-Findings bleiben deshalb konservativ aktiv; vollständige Kunden-/Provider-Endabnahme fehlt. Die bestehende, bereits vorher fehlerhafte ALIXSMART-Erinnerung mit leerer Dokumentkennung ist nicht durch eine ungeschützte Ausnahme ersetzt worden.

## 102 Zeitpläne

Alle 102 Definitionen und Ausführungshistorien sind in zwei getrennten Registern erfasst. 95 sind aktiv. Zeit-/Aktivierungsfingerprint vorher und nachher: `752e201dcf6968bf40cf2a2fb3c58261`.

- Historischer `cron.job_run_details.status=succeeded` bedeutet bei HTTP-Aufrufen lediglich erfolgreiche Datenbankübergabe, **nicht** erfolgreiche Funktionsausführung, Zustellung oder fachliche Verarbeitung.
- Zwei 401-Antworten um 14:05 UTC sind durch erhaltene `net._http_response`-IDs `174379` und `174382` belegt. Die ausgelieferte Antwort speichert keine eindeutige Jobzuordnung; die alten Edge-Protokolle waren nicht zugänglich. **Die beiden ursprünglichen Aufrufe bleiben ungeklärt.**
- Aktuelle wiederkehrende 401 wurden dagegen eindeutig `alixsmart-match-run` (Job 60) zugeordnet: Der Aufrufer nutzte den bestehenden privaten Cron-Zugang, der Handler akzeptierte ihn nicht. Handler auf den vorhandenen zentralen Maschinen-/Mitarbeiterzugang umgestellt; kein Zeitplan verändert.
- Job 77 / `ac-journey-run` erhielt 400, weil sein vorhandenes `{source:"cron"}` durch die neue strikte Validierung abgewiesen wurde. Das erlaubte Metadatenfeld wird jetzt angenommen, ohne Autorisierung daraus abzuleiten. Ein regulärer, nicht manuell ausgelöster Aufruf um 14:40:04 UTC lieferte HTTP 200; dessen Geschäftswirkung wurde nicht als vollständig abgenommen behauptet.
- Kein produktiver Versand-/Buchhaltungslauf ausschließlich für Tests erneut ausgelöst. 401 aus eigenen expliziten Gegenproben sind keine Schedulerregression. Die vollständige fachliche Verifikation aller 102 Abläufe und möglicher Doppelwirkungen ist weiterhin offen.

## Datenbank: 317 ältere Hinweise

`database-317-ledger.csv` erfasst jeden einzelnen Hinweis mit Kategorie, Zuordnung zu Originalobjekten und offenem Prüfstatus:

| Kategorie | Anzahl | Nachweisgrenze |
|---|---:|---|
| RLS ohne Policy | 2 | Dienstorientierte, standardmäßig für Clients geschlossene Tabellen; kein Zugriff nur zur Linterbereinigung geöffnet |
| Erweiterungen im öffentlichen Schema | 3 | Abhängigkeiten noch nicht vollständig geprüft; keine blinde Verschiebung |
| Anonym ausführbare Definer | 12 | Quellenzwecke einzeln untersucht: Tokenprüfung, öffentliche Metadaten und Zugriffspredikate; keine pauschale Sperre oder Fehlalarm-Schließung |
| Angemeldet ausführbare Definer | 300 | Einzeln inventarisiert und mit Originalobjekten abgeglichen, **nicht vollständig sicherheitsabgenommen** |

Zusätzlich meldet der Linter 1.269 Leistungsbeobachtungen, ausdrücklich getrennt von den 317 Sicherheitsbeobachtungen. Die angeblich unabhängige permissive Finanz-Mandantenregel wurde live geprüft: die drei untersuchten Finanzfamilien besitzen **restriktive** Mandantenregeln. Kein spekulatives Umschreiben dieser Regeln. Website-Analytics-Funktionen sind live Invoker, ohne Anonym-Ausführungsrecht; echte Zwei-Firmen-Tests bleiben erforderlich, ihre Meldungen bleiben aktiv.

## Tiefenscan

Der Lauf auf gespeichertem Commit `86707d200c5dfedacc472494727095cb096b19f8` endete am 28.11.2026 14:39:56 UTC mit **incomplete**, Version 1.94 und 267 nativen Meldungen vor den 19 gezielten Schließungen. Obwohl das Werkzeug `up_to_date=true` ausgab, enthält der gebundene Commit **nicht die danach vorgenommenen V6-Korrekturen**. Kein aktueller Vollabnahmenachweis.

Scanner-Ausführungslogs, Ressourcenverbrauch, Timeoutursache und Konfigurationsdetails werden von den verfügbaren Werkzeugen nicht geliefert. Verfügbare Größenindikatoren: Funktionenordner etwa 6,5 MB / 717 Dateien; 926 öffentliche Datenbankfunktionen mit insgesamt 804.473 Definitionsbytes. Diese Zahlen beweisen **keinen** Ressourcen- oder Timeoutfehler. Ein neuer Tiefenscan muss den abschließend gespeicherten V6-Commit binden. Segmentierte Quellen-/Handler-/Datenbankprüfungen bleiben Ergänzungen, kein Ersatz für die Vollabnahme. Connectorprüfung des Schnellscans war mangels Konfiguration übersprungen.

## Tests und Bestandskontrolle

- Vollständiger Lauf der gemeinsamen Servertests: 570 bestanden vor der letzten ergänzten Gesamtfirmenregel; diese Regel und die betroffenen Handler anschließend separat erfolgreich geprüft. Sieben zusätzliche Import-/Freigabe-/Journey-Tests bestanden. Keine Umgehung mit `--no-check`; zwei bereits vorhandene Test-Typfehler wurden korrigiert.
- 279 Anwendungstests bestanden. Alle 14 geänderten Funktionen typgeprüft; letzte Finanzkorrekturen zusätzlich typgeprüft. Aktuelle Vorschau meldet `build OK`.
- 26 echte HTTP-401-Gegenproben (13 Endpunkte × öffentlicher bzw. ungültiger Zugang), ohne Geschäftswirkungen.
- Fünf Restore-Werkzeugtests bestanden, **kein tatsächlicher Restore**. Ein zunächst falscher Testaufruf führte null Tests aus und wird ausdrücklich nicht als Erfolg gezählt.
- 44 Produkte; Fingerprint unverändert `8b67f41d0720374a058ab09745d27073`. 102 Zeitpläne/95 aktiv und Zeitfingerprint unverändert. Product Hub `enabled=false`, Notstopp aktiv, Revision 0, DE/COM jeweils `blocked`, keine Pilotkennung. Keine Schlüsseländerung oder App-Veröffentlichung.

## Konkrete offene externe Abnahmen

1. **Mitarbeitersitzung:** `lovable auth-session --json --self` verweigert die Sitzung technisch, weil das externe Supabase seine Token selbst verwaltet. Keine Anmeldung umgangen und keine Zugangsdaten im Chat angefordert. `role-test-matrix.csv`: 43 tatsächlich vorhandene Rollen × sieben Prüffamilien, 301 angemeldete Prüffälle offen. Administrator führt diese in isolierten Testkonten mit minimalen synthetischen Firmen-/Kundenrechten aus; produktive Kundenrechte nicht pauschal übertragen.
2. **ALIXWORK RESTORE TEST:** getrennte Umgebung, autorisiertes Ziel und vollständige lokale Sicherungseingaben fehlen. Vorhandene genaue Anleitung: `docs/producthub-2/restore-v1-1-einrichtung.md`; Werkzeug `restore-isolated.py`. Produktionsziel, Netzwerkversand, Automatisierungen und produktive Secrets bleiben ausgeschlossen. Historischer Schemahash und echte Dateiprüfsummen dürfen nicht erfunden werden.
3. **Meta:** `META_APP_SECRET` ist nicht in der Namenliste vorhanden; `WHATSAPP_APP_SECRET` existiert. Ob dieselbe Meta-App verwendet wird, ist unbestätigt. Keine Ersatzschlüssel oder Signaturumgehung. Erforderlich: autorisierte Bestätigung der App-Zuordnung und originale signierte Testzustellung.
4. **Scannerdiagnose:** Betreiber muss für die benannten Scan-Tasks ausführliche Fehler-/Ressourcen-/Timeoutdiagnosen und vollständige Abdeckung bereitstellen. Ein erneuter Start allein beweist keine Ursachenbehebung.
5. **Vorfallhistorie:** ursprüngliche Provider-/Gatewayprotokolle und Zustellnachweise für 13:30–14:15 UTC über autorisierten Administratorzugang sichern; eindeutige Korrelation zu Importlauf und beiden 14:05-Abweisungen fehlt.

**Weitere 171 Originalbefunde sind nicht ausschließlich extern blockiert, sondern weiterhin fachlich/technisch zu bearbeiten.** Kein vollständiger Sicherheitsabschluss, keine Sicherheitsfreigabe und keine automatische Fortsetzung nach Ende dieser Bearbeitung behauptet.