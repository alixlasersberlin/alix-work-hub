# Protokollprüfung und geschützte Beweissicherung

Stand: 28.11.2026, Abfragen ab ca. 04:53 UTC. Ausschließlich lesend, keine Angriffs- oder Geschäftsaktionen. Zeitfilter sieben Tage; tatsächlich gelieferte Serverlog-Abdeckung deutlich kürzer. Keine vollständige Forensikabnahme.

## Tatsächlich geprüfte Quellen

| Quelle | Prüfung / tatsächlich verfügbare Stichprobe | Grenze |
|---|---|---|
| Supabase function_edge_logs | Gesamtquelle 158 Einträge, 04:43:58.392–04:53:50.713 UTC; gefilterte Endpunktmetadaten | Keine verifizierte Aufruferidentität, kein vollständiger Sieben-Tage-Export |
| Supabase auth_logs | 8 Einträge, 04:45:34–04:52:54 UTC; darunter ein Status 403 | Ein abgewiesener Aufruf allein beweist keinen Angriff; Claims/Personen nicht exportiert |
| Supabase postgres_logs | Gesamtquelle 94 Einträge, 04:44:00.002–04:52:54.323 UTC; Fehlerfilter liefert 2 ERROR-Einträge um 04:52:54 | Nur Metadaten und serverseitige SHA-256 des Nachrichtenfelds gelesen, keine Fehler-Payload veröffentlicht |
| Supabase edge_logs | 1.528 Einträge in der Abdeckungsabfrage, 04:43:56.537–04:53:50.501 UTC | Keine vollständige inhaltliche Einzelprüfung dieser HTTP-Logs |
| auth.audit_log_entries | Zeitgefilterte Auswahl: keine Zeilen | Keine Aussage, dass keine Anmeldungen oder Änderungen stattgefunden haben |
| public.alix_security_events | Zeitgefilterte Auswahl: keine Zeilen | Protokollierungs-/Abdeckungsnachweis offen |
| public.audit_logs | Letzte 300 passende Zeilen: 297 PAYMENT_ASSIGNED für bank_transaction_matches, 3 INSERT für bank_financing_requests | Begrenzter, selektiver Ausschnitt vom 26.–27.11.; kein positiver Nachweis legitimer Aufrufer |
| public.finance_automation_runs | Zeitgefilterte letzte 100: keine Zeilen | POST/200 kann bei keiner aktiven Regel ohne Run-Zeile enden; keine Unbedenklichkeitsaussage |
| public.bank_audit_log | Zeitgefilterte letzte 100: keine Zeilen | Ausgewählte Auditquelle ist nicht gleich allen Bankoperationen |
| public.integration_logs | Zeit-/Quellen-/Ereignisfilter: keine Zeilen | Keine Aussage über fehlende externe Provideraktivität |
| Resend, bestehende Verbindung Alix Lasers Voice | Lesender GET /emails, HTTP 200, erste 20 Versandmetadaten; weitere Seite vorhanden | Nicht alle E-Mails, keine Betreiber-/Aufruferidentitätsabnahme |
| Twilio, bestehende Verbindung Twilio | Lesender GET /Messages.json, HTTP 200, erste 20 Nachrichten im Zeitfilter; weitere Seite vorhanden | Kein vollständiger Versand-/API-Auditexport, keine Kontosperre oder Rotation |

Der erste Twilio-Leseversuch verwendete einen bereits präfixierten Pfad und erhielt 404; nach Verwendung des dokumentierten relativen /Messages.json-Pfads war die Abfrage erfolgreich. Dies war ein Diagnosefehler der Abfrage, keine Störung des Produktivsenders. Keine Verbindungseinstellungen geändert.

## Aktuelle Erreichbarkeit und Einordnung

`finance-automations-engine`: POST `/functions/v1/finance-automations-engine`, HTTP 200 am 28.11.2026 04:45:03.327 UTC. Der existierende aktive Job 33 (`finance-automations-engine-15min`, `*/15 * * * *`) und UI `src/pages/Finance/Automations.tsx:88` sind bekannte Aufrufer. Der Zeitstempel passt zum Zeitplan; aus Status und Zeitpunkt allein folgt weder, dass der Aufruf autorisiert war, noch dass Missbrauch vorlag. Der Quellhandler prüft die Identität vor privilegiertem Regelzugriff nicht. Die ID `lov_finding_8d76058b0444465c` wurde deshalb zusätzlich in A0 aufgenommen.

Für die anderen priorisierten A0-Funktionen liegt in dieser begrenzten Stichprobe kein aktueller Live-Erreichbarkeitsnachweis vor. Das ist keine Entwarnung. Handler mit Passwort-/Finanz-/Versandwirkungen wurden absichtlich nicht aktiv aufgerufen; auch ein GET oder leerer Request kann bei einigen Altpfaden Auswirkungen haben.

Ein unveränderter Hash einer Datenbankzeile erlaubt späteren Vergleich, ersetzt aber keinen vollständigen Originalexport. Status 200, 403, leere Auditlisten oder vorhandene Providerlieferungen reichen nicht aus, um eine vergangene missbräuchliche Nutzung zu bestätigen oder auszuschließen. Vollständige historische Zugriffsdaten, Egress-Ziele des Importers und autorisierte Kunden-/Mitarbeiterbezüge sind noch abzugleichen.

## Unveränderte, geschützte Sicherung

Zwei vollständige Werkzeugantworten mit ausgewählten Server-/Anwendungsmetadaten wurden bytegleich in private Projektmetadaten gesichert und mit SHA-256 nachkontrolliert. Zwei erste Providerseiten wurden als unveränderte Werkzeugantworten mit AES-256-GCM verschlüsselt gesichert; die Entschlüsselungsgleichheit zu den ursprünglichen Bytes wurde geprüft. Schlüssel liegen separat in privaten Metadaten, nie in Quellcode, Berichten oder öffentlichen Dateianhängen; geschützte Dateien mit restriktiven Dateirechten.

Es wurden keine Nachrichten, OTPs, Kennwörter, Empfängeradressen oder API-Schlüssel in diese öffentlich herunterladbaren Prüfunterlagen übernommen. Private Beweisarchive sind keine gewöhnlichen Files-Anhänge. Diese Sicherung konserviert die gelesenen Werkzeugantworten, nicht sämtliche Originalprotokolle und nicht eine manipulationssichere externe Archivierung. Logretention, Rollen, Speicher oder produktive Originaldateien wurden nicht geändert.

## Zusätzlich erforderlich vor belastbarer Vorfallsabnahme

- Zuständigen Administrator autorisieren, vollständige vorhandene Original-Auth-, Zugriff-, Datenbank- und Providerprotokolle des erforderlichen Zeitraums in eine unabhängig geschützte, unveränderliche Beweisablage zu exportieren; Zugangscodes/Schlüssel nur verschlüsselt, keinerlei offene Schlüsseldateien.
- Originalbytes, Exportfenster, Zeilenzahlen, Reihenfolge, Vollständigkeit, Exportidentität und SHA-256 dokumentieren; dieses Paket enthält nur den engeren vorstehend benannten Ausschnitt.
- Finanzoperationen und Kundenkommunikation mit bestehenden Autorisierungs-/Auftrags-/Zahlungsevidenzen abgleichen, nicht automatisch rückbuchen oder erneut versenden.
- Kontopasswort-/Sitzungs-/OAuth-Änderungen und Import-Egress-/Provider-Schlüsselnutzung gezielt überprüfen. Verdächtige Ziele/Schlüssel nicht in öffentlich lesbare Berichte aufnehmen.
- Bei belastbaren Kompromittierungshinweisen getrennte Konto-/Sitzungssperre oder genau zugeordnete Schlüsselrotation vorlegen; keine durch diese Analyse ausgelöste Sperre oder Rotation.

## Bestandsschutz, erneut gelesen

44 Produkte: Fingerprint `936dc6209c4afc91c1d54dad8e28d773`.

102 Cron-Jobs: Fingerprint `cd3e3d31e6c55af14d5966f710aa90fa`.

Beide Fingerprints entsprechen dem Vorbericht. DE/COM blocked, keine Pilot-ID, Notstopp aktiv, enabled=false, revision=0. Keine Finanzoperation, kein Testversand und keine Veröffentlichung durch diesen Auftrag.

## Hashnachweise der gesicherten Werkzeugantworten

- edge-metadata.tool-output: `f64876ae386095298fede0aa5344fbd7451a3e4205349deed04da59b85cbbbe4` (Originalantwort).
- audit-metadata.tool-output: `e4fcf8d9410c8fe5232bf1acc85bdd1ac54530bf46f5a2d4c6e876b6fe0ef4fe` (Originalantwort).
- resend-response.enc: `30de701ff71348b06869d2fb3220188e57cd41548e49b6fefe7b73f26878bb55` (Originalantwort).
- twilio-response.enc: `30b795c6f77cde1e7f992b7448f2003d9e96f89e05c59bc6c771fc22415f26a4` (Originalantwort).
