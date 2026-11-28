# A3 – Finanzen

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 69; bestätigt kritisch 45; ungeklärt 20; Fehlkonfigurationen 1; Doppelmeldungen 3; im Code geschützt 0.

Abhängigkeiten: A1, A2, A5, A8.

Bestehende Buchungs-/Saldo-/Währungsregeln, GoBD-Sperren, Zahlungsbeweise, idempotente RPCs und optimistische Sperren erhalten. Parser-Tests nur synthetische CAMT/MT940/SEPA-Daten. Kein Bankabruf, Mahnversand, Zahlplanlauf oder Belegfreigabe als Test; Finanzrollen und zugewiesene Gesellschaften positiv testen. Schedulerzeiten und aktive Zustände unverändert.

## Verbindliche Ausführungsgrenzen

Dies ist ausschließlich ein Korrekturplan, keine Korrekturfreigabe und keine Ausführung. Die Klassifikationen stammen aus der statischen 266-ID-Prüfung; sie beweisen keine erfolgreiche Live-Ausnutzung. Ungeklärte Befunde bleiben ungeklärt. Die Teilpakete werden anhand der Geschäftsdomäne zugeordnet; eine gemeinsame Auth-Ursache wandert dadurch nicht pauschal aus Finanz- oder Dokumentpfaden heraus. A0 ist eine priorisierte Überlagerung, kein neuntes disjunktes Paket.

44 Produkte und 102 Zeitpläne bleiben unverändert. DE/COM bleiben blocked, emergency_stopped=true, enabled=false, revision=0. API-Verträge 1.2/1.3 unverändert; keine Schlüsselrotation, Finanzoperation, Geschäftsdatensatzlöschung, Testnachricht, Migration, Bereitstellung oder Veröffentlichung. Scannerbefunde werden weder geschlossen noch ignoriert.

## Vor jeder einzeln freizugebenden Änderung

1. Freigabe bindet konkrete IDs, Funktionen, Diff, Ausgangsrevision und Testergebnisse; nur exakter aktiver, angenommener Super Admin, keine vererbte Adminberechtigung. Nicht durch diese Unterlagen erteilt.
2. Wiederherstellbaren Codecommit und unabhängige geschützte Sicherung des freigegebenen Quellzustands sichern. Aktueller Referenzcommit: `ada1682bfd32bbdf823ad29efcf1de8e95648f7e`. Das ist ein Wiederherstellungspunkt, kein hier neu erstelltes Vollbackup.
3. Aktuelle Tabellen-, Funktions-, Policy-, Trigger-, Grant- und Schedulerdefinitionen der tatsächlich betroffenen Objekte geschützt exportieren, Prüfsummen und Restore-Möglichkeit nachweisen. Bestehende Backups nicht überschreiben, keine neuen Tabellen. Vollständige Definitionsexporte und isolierter Restore sind hier noch nicht durchgeführt.
4. Aufrufermatrix: UI, abhängige Funktionen, Trigger/RPCs, Cron, Provider; vorhandene private Maschinenidentitäten erhalten. Kein blindes verify_jwt=true als Ersatz für Objekt-/Aktivitäts-/Rollenprüfungen, keine Sperre legitimer signierter Webhooks.
5. Isolierte Testdaten: zwei aktive zugewiesene Mitarbeiter (einer mit DE+AT), ein Mitarbeiter mit nur DE, ein Konto ohne Zuweisung, inaktives/nicht angenommenes Konto und gesperrtes Gerät; eigene/fremde DE/AT-Objekte. Diese Fixtures sind geplant, nicht erzeugt oder als erfolgreich getestet dargestellt. Provider/Finanzadapter vollständig mocken.
6. Erst isolierte Tests, dann konkreten Diff und Betriebsfolgen erneut zur ID-bezogenen Freigabe vorlegen. Keine unsicheren Rechte als Rollback wiederherstellen.

## Abnahme nach einer späteren Korrektur

Positive erlaubte Fälle und negative fremde/inaktive/unzugewiesene Fälle; Zuweisung zu mehreren Gesellschaften bleibt nutzbar, fehlende Zuweisung verleiht keine globale Sicht. Serverseitige Rollen-/Tenantprüfungen möglichst einmal pro Statement auswerten, keine teuren per-row-Prüfschleifen. Öffentliche Kundencapabilities bleiben eng objektgebunden, keine Mitarbeiterrechte daraus ableiten. Bestehende Regeln und Geschäftsvorgänge unverändert.

Bereitgestellte Revision/Hash nachweisen, ungefährliche autorisierte Lesewege und Ablehnungen prüfen. Reale Versand-/Finanzwirkungen nur nach separater Freigabe, nicht im Test. Scanner gezielt erneut ausführen und nur konkret bestätigte Reparaturen im bestehenden Security Control Center mit Revision, Nachweis und Freigabe dokumentieren; eine Freigabe schließt keinen Befund. Bei Regression betroffenen Pfad eng sperren oder auf nachweislich sichere Version zurücksetzen, nie ungeschützte Altversion aktivieren.

## Paketbezogene Betriebsfolgen

Strengere Rechte können bisher implizit globale Benutzer, Jobs und interne Aufrufer blockieren. Berechtigte Mehrgesellschaftszugriffe explizit erhalten; fehlende Mandantenzuweisung ist kein globales Recht.

## Konkrete Befund- und Korrekturpläne

### lov_finding_1aac574b83b92e0b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-recurring-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-recurring-run`.
- Belege: supabase/functions/cmr-recurring-run/index.ts:25-58; supabase/functions/cmr-recurring-run/index.ts:87-107; supabase/functions/cmr-recurring-run/index.ts:120-173.
- Ursache/Prüfgrenze: Der Handler prüft keinen Aufrufer. tenantId ist optional und stammt aus dem Request; ohne Wert werden aktive wiederkehrende Pläne mandantenübergreifend verarbeitet, Vorankündigungen versendet und Rechnungsdokumente angelegt.
- Geplante konkrete Änderung: Globalen Lauf ausschließlich maschinell authentifizieren; interaktive Läufe auf aktive Finanzrolle und serverseitigen Mandantenscope begrenzen.
- Betriebsfolgen: Unberechtigte Rechnungsanlage; Mandantenübergreifender Mailversand.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonymer und fremdmandantiger Lauf negativ; autorisierter Job und Wiederholungsfestigkeit positiv..
- Sicherer Wiederherstellungsplan: Job stoppen; erzeugte Dokumente fachlich stornieren statt unkontrolliert löschen.
- Doppelmeldungsreferenz: keine.

### lov_finding_22d2f74a8a4d2421

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.bank-api-fetch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `bank-api-fetch`.
- Belege: supabase/functions/bank-api-fetch/index.ts:31-52; supabase/functions/bank-api-fetch/index.ts:66-82; supabase/config.toml:429-430.
- Ursache/Prüfgrenze: Der Endpoint liest Bankverbindungen und startet deren Import ohne Aufruferprüfung; connectionId ist nur ein Zielauswahlfilter. Aktivierte Verbindung und vorhandener Provider-Token sind Betriebsvoraussetzungen, keine Autorisierung.
- Geplante konkrete Änderung: Maschinencredential oder aktive Bankimportrolle erzwingen; Verbindungen an erlaubten Mandanten binden.
- Betriebsfolgen: Unberechtigte Bankimporte; Speicher- und Providerbelastung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, falsche Rolle und fremde Verbindung ohne Provideraufruf; autorisierten Import prüfen..
- Sicherer Wiederherstellungsplan: Importverbindungen deaktivieren; neu erzeugte Importobjekte anhand des Laufprotokolls isolieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_29b6057cf3486198

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.bank-return-dunning-escalate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `bank-return-dunning-escalate`.
- Belege: supabase/functions/bank-return-dunning-escalate/index.ts:46-80; supabase/config.toml:426-427.
- Ursache/Prüfgrenze: Keine Aufruferprüfung vor dem globalen Rücklastschriftlauf. Besonders relevant: body.force setzt cfg.enabled auf true und umgeht damit eine konfigurierte Deaktivierung. Danach werden fällige Mahnfälle privilegiert verarbeitet.
- Geplante konkrete Änderung: Maschinenauthentifizierung verlangen; force separat auf aktive privilegierte Finanzrolle begrenzen; mandantenbezogene Verarbeitung erzwingen.
- Betriebsfolgen: Erzwungene Mahnläufe; Umgehung des Abschaltschalters; Kundenbelästigung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonymes force und dryRun negativ; deaktivierte Konfiguration bleibt gesperrt; autorisierten Lauf prüfen..
- Sicherer Wiederherstellungsplan: Endpoint und Scheduler sperren; Mahnstände aus Laufhistorie fachlich korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_607c1e0633e683f5

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-ch-dd-export.debit-run-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-ch-dd-export`.
- Belege: supabase/functions/finance-ch-dd-export/index.ts:9-25; supabase/functions/finance-ch-dd-export/index.ts:40-47; supabase/functions/finance-ch-dd-export/index.ts:81-92.
- Ursache/Prüfgrenze: Die einzige Authprüfung ist startsWith('Bearer '); der Token wird nicht validiert. run_id lädt Service-Role-seitig Lastschriftlauf und Mandate einschließlich IBAN, erzeugt XML und setzt Exportstatus ohne Rollen-, Aktivitäts- oder Mandantenprüfung.
- Geplante konkrete Änderung: Token verbindlich validieren; aktive Exportrolle und Laufmandant prüfen; Exportzustandsänderung atomar durchführen.
- Betriebsfolgen: Offenlegung von Bank- und Mandatsdaten; Unberechtigte Exportstatusänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: beliebiger Bearertext, fremder Lauf und falsche Rolle negativ; autorisierter XML-Export positiv..
- Sicherer Wiederherstellungsplan: Export sperren; Exportstatus anhand Auditdaten korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_676a76c192d1c5c0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-qr-generate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-qr-generate`.
- Belege: supabase/functions/finance-qr-generate/index.ts:62-70; supabase/functions/finance-qr-generate/index.ts:83-98.
- Ursache/Prüfgrenze: Ein beliebiger Bearer-Präfix genügt. Ohne Tokenvalidierung lädt der Adminclient body.id und generiert bei fehlender QRR-Referenz einen vom reference_seed beeinflussten Wert; anschließend werden Referenz und gegebenenfalls Status gespeichert. Bestehende Referenzen werden nicht beliebig überschrieben.
- Geplante konkrete Änderung: Aktives Finanzkonto mit Rechnungs-/Mandantenscope verlangen; Referenz ausschließlich serverseitig und atomar initialisieren.
- Betriebsfolgen: Unberechtigte Referenzinitialisierung; Offenlegung von QR-Zahlungsdaten; Statusänderung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: ungültiger Bearer und fremde Rechnung negativ; bestehende Referenz unverändert; zulässige Initialisierung positiv..
- Sicherer Wiederherstellungsplan: Persistierenden QR-Pfad sperren; Referenzänderungen nur nach Zahlungsabgleich zurücknehmen.
- Doppelmeldungsreferenz: keine.

### lov_finding_80f949ebfeee1886

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-reminder-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-reminder-engine`, `getTenantScope`.
- Belege: supabase/functions/_shared/tenant-scope.ts:31-78; supabase/functions/finance-reminder-engine/index.ts:24-40.
- Ursache/Prüfgrenze: getTenantScope weist Nutzer ohne user_tenant_access-Einträge ausdrücklich allen aktiven Mandanten zu: restricted wird ids.size > 0. Die Engine setzt dann scopedIds auf null. Es fehlt zusätzlich eine aktive Finanzrollenprüfung; der globale Zugriff ist somit nicht nur eine UI-Frage.
- Geplante konkrete Änderung: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Rechte explizit modellieren und aktive Finanzrolle verlangen.
- Betriebsfolgen: Mandantenübergreifende Mahnentwürfe; Umgehung expliziter Mandantenzuweisung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Nutzer ohne Zuweisung negativ; einzelner Mandant isoliert; explizite globale Finanzrolle positiv..
- Sicherer Wiederherstellungsplan: Engine sperren; gemeinsame Scopeänderung kontrolliert ausrollen und bei Problemen fail-closed halten.
- Doppelmeldungsreferenz: keine.

### lov_finding_86d3d8b71cfd055f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.collect-payment-link`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-payment-link`.
- Belege: supabase/functions/collect-payment-link/index.ts:21-51; supabase/functions/collect-payment-link/index.ts:104-114.
- Ursache/Prüfgrenze: Identität und eine erlaubte Finanzrolle werden geprüft. Der folgende collect_cases-Read erfolgt jedoch ausschließlich über caseId mit Adminclient; keine Mandanten- oder Fallzuordnung begrenzt die Anlage und Rückgabe eines Zahlungstokens.
- Geplante konkrete Änderung: Aktiven Kontostatus und Fallmandant gegen verifizierten Nutzerscope prüfen, bevor Link oder Token erzeugt wird.
- Betriebsfolgen: Zahlungslinks für fremde Mandanten; Unberechtigte Fallkommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: erlaubte Finanzrolle mit fremdem caseId negativ; deaktiviertes Konto negativ; eigener Fall positiv..
- Sicherer Wiederherstellungsplan: Linkanlage sperren; unberechtigt erzeugte Tokens widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_88ebf49df7bfdf53

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.rz-reminder-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `rz-reminder-send`.
- Belege: supabase/functions/rz-reminder-send/index.ts:174-201; supabase/functions/rz-reminder-send/index.ts:203-230; supabase/functions/rz-reminder-send/index.ts:273-322.
- Ursache/Prüfgrenze: Nicht-Cron-Aufrufer werden authentifiziert, benötigen im Normalpfad aber keine Rolle. Nur body.override löst eine Super-Admin-Prüfung aus. reminder_ids werden anschließend über privilegierte REST-Requests ohne Mandantenscope geladen und verarbeitet.
- Geplante konkrete Änderung: Auch Normalversand an aktive Finanzrolle und Reminder-/Mandantenscope binden; Cronzugang strikt getrennt halten.
- Betriebsfolgen: Unberechtigte Kundenmahnungen; Mandantenübergreifender Versand.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: normaler Login ohne override negativ; fremde Reminder-ID negativ; berechtigter Versand und Cron positiv..
- Sicherer Wiederherstellungsplan: Versand stoppen; Reminderzustände über Versandprotokoll abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_89e0261f504376eb

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.finance-qr-generate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-qr-generate`.
- Belege: supabase/functions/finance-qr-generate/index.ts:62-98.
- Ursache/Prüfgrenze: Verifiziert derselbe Nicht-Preview-Pfad wie beim Referenzbefund: body.id lädt finance_qr_invoices privilegiert, erzeugt Payload und schreibt Referenz/Status. Offenlegung und Änderung sind Auswirkungen derselben Operation.
- Geplante konkrete Änderung: Gemeinsam mit dem Referenzbefund beheben; aktive Finanzautorisierung und Rechnungsscope vor Read und Update.
- Betriebsfolgen: Fremde QR-Zahlungsdaten; Unberechtigte Referenz-/Statusänderung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Tests des Referenzbefunds einschließlich Datenrückgabe übernehmen..
- Sicherer Wiederherstellungsplan: Wie Referenzbefund; persistierenden Pfad sperren.
- Doppelmeldungsreferenz: lov_finding_676a76c192d1c5c0.

### lov_finding_94ff829ba690f3f3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.bank-auto-reconcile`; Abhängigkeiten A1, A2, A5.
- Funktionen: `bank-auto-reconcile`.
- Belege: supabase/functions/bank-auto-reconcile/index.ts:75-103; supabase/functions/bank-auto-reconcile/index.ts:134-181; supabase/config.toml:423-424.
- Ursache/Prüfgrenze: Der Handler beginnt ohne Aufruferprüfung mit privilegierten Bank- und Rechnungsreads. Er ersetzt Vorschläge, aktualisiert Matchscores und kann Zuweisungen sowie Rechnungs- und Banktransaktionsstände verändern. verify_jwt ist false.
- Geplante konkrete Änderung: Maschinencredential oder aktive Bankabgleichrolle verlangen; Buchungskreis serverseitig begrenzen und automatische Buchungen gesondert freigeben.
- Betriebsfolgen: Manipulierte Zahlungszuordnungen; Veränderte Finanzsalden; Mandantenübergreifender Abgleich.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremder Buchungskreis ohne Änderung; Vorschau ohne Writes; autorisierter Abgleich positiv..
- Sicherer Wiederherstellungsplan: Abgleich sperren; Zuweisungen und Salden transaktionsbezogen aus Auditdaten rückführen.
- Doppelmeldungsreferenz: keine.

### lov_finding_98d1a9730f1bf438_c0935e03

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-dunning-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-dunning-run`.
- Belege: supabase/functions/cmr-dunning-run/index.ts:34-67; supabase/functions/cmr-dunning-run/index.ts:114-159; supabase/functions/cmr-dunning-run/index.ts:164-197; supabase/config.toml:420-421.
- Ursache/Prüfgrenze: Der Mahnlauf prüft keine Identität. tenantId ist optionaler Requestfilter; ohne ihn werden fällige Dokumente mandantenübergreifend selektiert, Mahndokumente angelegt und gegebenenfalls Mails versendet.
- Geplante konkrete Änderung: Globalen Job maschinell authentifizieren; interaktive Läufe nur für aktive Finanzrolle innerhalb erlaubter Mandanten.
- Betriebsfolgen: Unberechtigte Mahndokumente; Kundenmails; Veränderte Mahnstände.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremde tenantId negativ; autorisierter Lauf und Replayfestigkeit positiv..
- Sicherer Wiederherstellungsplan: Mahnlauf stoppen; Dokumente fachlich stornieren und Mahnstände abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b25fdd69f8b74481

- Bewertung: ungeklärt; Korrekturgruppe `CG.finance-approval-action`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-approval-action`, `public.finance_approvals`, `public.finance_incoming_invoices`.
- Belege: supabase/functions/finance-approval-action/index.ts:13-20; supabase/functions/finance-approval-action/index.ts:35-91; supabase/migrations/20260719143705_2820fec9-d902-4cd1-b273-ea0db8112696.sql:26-40; src/pages/Finance/Freigaben.tsx:47.
- Ursache/Prüfgrenze: Der Client übernimmt den Nutzer-Authorization-Header; Service-Key allein belegt hier keinen RLS-Bypass. Die gelesene approvals-Policy verlangt Finanz-/Geschäftsführungsrechte, Mandantenzugriff und verhindert bestimmte Selbstfreigaben. Der Handler ignoriert jedoch Updatefehler und kann danach die Zielrechnung ändern; effektive Zieltabellen-RLS und alle späteren Policytransformationen sind nicht abschließend aufgelöst.
- Geplante konkrete Änderung: Gesamte Freigabe atomar mit expliziter aktiver Genehmiger-, Mandanten- und Vieraugenprüfung durchführen; jeden Datenbankfehler verbindlich behandeln.
- Betriebsfolgen: Mögliche inkonsistente Freigabe-/Rechnungszustände; Mögliche Umgehung der Genehmigungskette.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gewöhnlicher Nutzer, Antragsteller, falscher Mandant und fehlgeschlagenes Approvalupdate; keine nachgelagerte Rechnungsänderung..
- Sicherer Wiederherstellungsplan: Freigabeaktion sperren; inkonsistente Rechnungs- und Approvalstände abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_be09aadb01290773

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-sepa-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-sepa-export`.
- Belege: supabase/functions/finance-sepa-export/index.ts:8-28; supabase/functions/finance-sepa-export/index.ts:95-101.
- Ursache/Prüfgrenze: getUser validiert den Login. Der nachfolgende separate Adminclient lädt jedoch beliebige finance_sepa_runs und Laufpositionen nach runId ohne aktive Finanzrolle oder Mandantenzuordnung und setzt anschließend Exportstatus.
- Geplante konkrete Änderung: Aktive Lastschriftexportrolle und Zugriff auf Laufmandant vor Mandatsread und Export erzwingen.
- Betriebsfolgen: Offenlegung fremder Lastschriftdaten; Unberechtigte Exportstatusänderung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gewöhnlicher Login, deaktivierte Finanzrolle und fremder Lauf negativ; erlaubter Export positiv..
- Sicherer Wiederherstellungsplan: Export sperren; Status anhand Exporthistorie korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_d599eb858f23ab35_e1c9b149

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.finance-sepa-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-sepa-export`.
- Belege: supabase/functions/finance-sepa-export/index.ts:12-28; supabase/functions/finance-sepa-export/index.ts:95-101.
- Ursache/Prüfgrenze: Verifiziert derselbe runId-basierte Adminread und SEPA-Export wie beim Referenzbefund. Die andere Mandantenbeschreibung benennt keinen separaten Operationspfad.
- Geplante konkrete Änderung: Mit Referenzbefund beheben; aktive Exportrolle und Laufmandant prüfen.
- Betriebsfolgen: Fremde Lastschriftdaten; Exportstatusänderung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: mandantenübergreifenden Negativtest des Referenzbefunds übernehmen..
- Sicherer Wiederherstellungsplan: Wie Referenzbefund: Export sperren und Status abgleichen.
- Doppelmeldungsreferenz: lov_finding_be09aadb01290773.

### lov_finding_eb3640852bce3732

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.anzahlung-mahn-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `anzahlung-mahn-engine`.
- Belege: supabase/functions/anzahlung-mahn-engine/index.ts:48-70; supabase/functions/anzahlung-mahn-engine/index.ts:75-85; supabase/config.toml:489-490.
- Ursache/Prüfgrenze: Der Handler liest Request und Mahnkonfiguration ohne Aufruferprüfung. Bei aktivierten Stufen und auto_enabled ungleich false verarbeitet er offene Anzahlungen privilegiert. dry_run sowie Konfigurationsschalter sind Betriebssteuerung, keine Authentifizierung; verify_jwt ist false.
- Geplante konkrete Änderung: Maschinenauthentifizierung oder aktive Finanzrolle mit Mandantenscope vor Konfigurations- und Finanzdatenzugriff verlangen.
- Betriebsfolgen: Unberechtigte Anzahlungsmahnläufe; Kundenkommunikationsmissbrauch.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremder Mandant negativ; deaktivierte Automatik bleibt wirkungslos; autorisierter Lauf positiv..
- Sicherer Wiederherstellungsplan: Automatik und Endpoint sperren; Kommunikations- und Mahnstände abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_f257ec154dcb5f8f

- Bewertung: ungeklärt; Korrekturgruppe `CG.zoho-invoices-auto-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `zoho-invoices-auto-import`.
- Belege: supabase/functions/zoho-invoices-auto-import/index.ts:10-25; supabase/functions/zoho-invoices-auto-import/index.ts:229-256; supabase/functions/zoho-invoices-auto-import/index.ts:409-444.
- Ursache/Prüfgrenze: Der aktuelle Code enthält entgegen der pauschalen Befundbeschreibung einen Authentifizierungszweig mit getUser und Admin-/Super-Admin-Prüfung. Dessen vollständige Verzweigung und möglicher Maschinen-/Leercredentialpfad wurden nicht abschließend gelesen; deshalb weder globale Anonymität noch ausreichende dauerhafte Autorisierung bestätigt. Payload erlaubt zudem Quellen- und Empfängerüberschreibungen.
- Geplante konkrete Änderung: Authzweig vollständig auf exakte Maschinencredentials, fail-closed Verhalten, aktive Adminrolle und Quellmandanten prüfen; Empfängerüberschreibung separat autorisieren.
- Betriebsfolgen: Mögliche Offenlegung importierter Rechnungsdetails; Mögliche mandantenübergreifende Imports und Berichtsmails.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: leerer/ungültiger Header, öffentliche Projektcredentials, gewöhnlicher Nutzer, deaktivierter Admin, fremde Quelle und Empfängeroverride..
- Sicherer Wiederherstellungsplan: Autoimport und Berichtsmails bis zur Klärung sperren; Importzustände anhand Laufhistorie sichern.
- Doppelmeldungsreferenz: keine.

### lov_finding_fddb348892872591

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.bank-return-dunning-escalate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `bank-return-dunning-escalate`.
- Belege: supabase/functions/bank-return-dunning-escalate/index.ts:46-80; supabase/config.toml:426-427.
- Ursache/Prüfgrenze: Verifiziert derselbe unautorisierte Rücklastschrift-Mahnlauf wie beim Referenzbefund. body.force aktiviert denselben cfg.enabled-Schalter vor derselben globalen Fallselektion; kein separater Operationspfad.
- Geplante konkrete Änderung: Mit Referenzbefund beheben; Jobcredential und separat berechtigtes force erzwingen.
- Betriebsfolgen: Erzwungene Mahnungen; Umgehung der Deaktivierung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonymer force-Request und deaktivierte Konfiguration wie beim Referenzbefund prüfen..
- Sicherer Wiederherstellungsplan: Wie Referenzbefund: Endpoint und Scheduler sperren, Mahnstände abgleichen.
- Doppelmeldungsreferenz: lov_finding_29b6057cf3486198.

### lov_finding_01689a0ccfff4e89

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.rz-reminder-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `rz-reminder-send`.
- Belege: supabase/functions/rz-reminder-send/index.ts:181-187; supabase/functions/rz-reminder-send/index.ts:212-228; supabase/functions/rz-reminder-send/index.ts:332; src/pages/Finance/WiederkehrendeZahlerErinnerungen.tsx:144.
- Ursache/Prüfgrenze: Der Benutzerpfad prüft lediglich die Anmeldung. Die Rollenprüfung betrifft nur override, nicht das normale Laden frei gewählter reminder_ids mit Service Role. Vorschau und Versand bleiben ohne Ressourcenberechtigung erreichbar.
- Geplante konkrete Änderung: Aktives Finanzkonto und Berechtigung für jede Erinnerung vor Service-Role-Abfragen prüfen; Maschinenpfad separat absichern.
- Betriebsfolgen: Unberechtigter Zugriff auf Erinnerungsdaten; Unberechtigter Versand und Statusänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Erinnerungs-ID und inaktives Konto müssen vor Datenabfrage und Versand abgewiesen werden; berechtigte Vorschau positiv prüfen..
- Sicherer Wiederherstellungsplan: Bei Fehlern Versand sperren; Autorisierungsprüfung nicht entfernen.
- Doppelmeldungsreferenz: keine.

### lov_finding_2c6eeae643a145a5

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.pruefung-release`; Abhängigkeiten A1, A2, A5.
- Funktionen: `pruefung-release`.
- Belege: supabase/functions/pruefung-release/index.ts:31-37; supabase/functions/pruefung-release/index.ts:51-67; supabase/functions/pruefung-release/index.ts:108-122; src/pages/Finance/RatenPruefung.tsx:88.
- Ursache/Prüfgrenze: Die Anmeldung wird validiert, anschließend bestimmt profile_id jedoch ohne Vertrags- oder Finanzberechtigung den privilegierten Zugriff auf zurückgehaltene Rechnungen und deren Freigabeversand.
- Geplante konkrete Änderung: Aktive Freigabeberechtigung für Vertrag und Rechnungen vor dem Laden und Versenden prüfen.
- Betriebsfolgen: Unberechtigte Rechnungsfreigabe; Offenlegung von Vertrags- und Rechnungsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte Vertrags-ID und inaktives Finanzkonto ohne Versand oder Statusänderung ablehnen..
- Sicherer Wiederherstellungsplan: Freigabeendpunkt sperren; bereits ausgelöste Freigaben separat fachlich prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_312fcf7bf6edca18_3be70c29

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-invoice-mail`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-invoice-mail`.
- Belege: supabase/functions/send-invoice-mail/index.ts:25-39; supabase/functions/send-invoice-mail/index.ts:83-120; supabase/functions/collect-send-dunning/index.ts:118.
- Ursache/Prüfgrenze: Der Handler prüft nur das Präfix Bearer, nicht die Gültigkeit einer Identität oder Versandberechtigung. Empfänger, Betreff und Inhalt kommen vom Aufrufer. verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Echte aktive Benutzer- beziehungsweise Maschinenberechtigung erzwingen; Versand an autorisierten Geschäftsvorgang binden.
- Betriebsfolgen: Missbrauch geschäftlicher Absender; Phishing, Spam und Versandkosten.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen Bearer-Text, öffentliche Schlüssel und unberechtigte Benutzer ohne Provider-Aufruf ablehnen..
- Sicherer Wiederherstellungsplan: Versandendpunkt sperren; keine Rückkehr zur Präfixprüfung.
- Doppelmeldungsreferenz: keine.

### lov_finding_4c7152ec5de2c1bc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-bank-automatch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-bank-automatch`.
- Belege: supabase/functions/cmr-bank-automatch/index.ts:11-24; supabase/functions/cmr-bank-automatch/index.ts:55-67; src/pages/CMR/Buchhaltung.tsx:235.
- Ursache/Prüfgrenze: Bankzeilen und Dokumente werden ohne Handler-Authentifizierung privilegiert geladen und abgeglichen. Ein übergebener tenantId-Filter ist keine verifizierte Mandantenzugehörigkeit.
- Geplante konkrete Änderung: Aktive Buchhaltungsberechtigung mit serverseitig verifiziertem Mandantenscope vor Matching und Zahlungsanlage verlangen.
- Betriebsfolgen: Unberechtigte Zahlungsanlage; Verfälschte Bankzuordnungen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden oder fehlenden Mandantenscope ohne Zahlungs- und Bankzeilenmutation ablehnen..
- Sicherer Wiederherstellungsplan: Automatching sperren; Zuordnungen nur kontrolliert fachlich rückabwickeln.
- Doppelmeldungsreferenz: keine.

### lov_finding_58c64b182fdc8abb_138f6013

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-asset-depreciation-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-asset-depreciation-run`.
- Belege: supabase/functions/finance-asset-depreciation-run/index.ts:14-38; supabase/functions/finance-asset-depreciation-run/index.ts:86-110; src/pages/Finance/AfaLauf.tsx:30.
- Ursache/Prüfgrenze: Der angelegte userClient wird nicht zur Identitäts- oder Berechtigungsprüfung verwendet. Der Admin-Client lädt alle aktiven Anlagen und kann Abschreibungen sowie Anlagenstände verändern.
- Geplante konkrete Änderung: Verifizierten Job oder aktiven berechtigten Finanzbenutzer mit Anlagenscope vor jedem Zugriff prüfen.
- Betriebsfolgen: Unberechtigte Abschreibungsbuchungen; Manipulation von Anlagenwerten.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten dry_run und schreibenden Lauf vor Datenabfrage ablehnen; erlaubten Periodenlauf mit Datenbank-Mocks prüfen..
- Sicherer Wiederherstellungsplan: Abschreibungslauf sperren; Buchungskorrektur getrennt freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_5e865420cc71ba0c

- Bewertung: Fehlkonfiguration; Korrekturgruppe `CG.collect-send-sms`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-send-sms`.
- Belege: supabase/functions/collect-send-sms/index.ts:35-53; supabase/functions/collect-send-sms/index.ts:58-72; src/components/collect/CollectCaseActions.tsx:235.
- Ursache/Prüfgrenze: Der Benutzerpfad verlangt eine gültige Identität und erlaubte Rolle; dies ist kein anonymer SMS-Relay. Frei wählbare Zielnummer und Nachricht sind vorhanden. Aktiver Kontostatus und konkrete Fall-/Mandantenberechtigung werden aber vor dem Service-Role-Lesen nicht geprüft.
- Geplante konkrete Änderung: Aktive Fall- und Versandberechtigung ergänzen; Nummernübersteuerung ausdrücklich berechtigen und protokollieren.
- Betriebsfolgen: Rollenintern zu weitreichender Versand; Möglicher Versand fremder Falldaten.
- Geplante Regressionstests, noch nicht ausgeführt: Inaktives Finanzkonto, fremden Fall und unberechtigte Nummernübersteuerung abweisen; erlaubten Fall positiv prüfen..
- Sicherer Wiederherstellungsplan: Nummernübersteuerung beziehungsweise SMS-Versand sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_74e13969233e5319

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.recurring-prenotification`; Abhängigkeiten A1, A2, A5.
- Funktionen: `recurring-prenotification`.
- Belege: supabase/functions/recurring-prenotification/index.ts:92-120; src/pages/Finance/WiederkehrendeZahler.tsx:554.
- Ursache/Prüfgrenze: Der Benutzerpfad authentifiziert den Aufrufer, bindet die nachfolgende privilegierte Zahlungsankündigung aber nicht an eine aktive Finanz- oder Kundenberechtigung. Die reguläre UI-Anfrage ist keine serverseitige Zugriffskontrolle.
- Geplante konkrete Änderung: Aktive Finanzversandberechtigung und erlaubten Kundenscope verlangen; Maschinenzugriff explizit trennen.
- Betriebsfolgen: Unberechtigter Versand von Zahlungsankündigungen.
- Geplante Regressionstests, noch nicht ausgeführt: Angemeldeten Benutzer ohne Finanzrecht und inaktives Konto vor Kundenverarbeitung und Versand abweisen..
- Sicherer Wiederherstellungsplan: Manuelle Zahlungsankündigungen sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_8973eaa4d23c2465

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-collective-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-collective-run`.
- Belege: supabase/functions/cmr-collective-run/index.ts:21-48; supabase/functions/cmr-collective-run/index.ts:94-116; src/pages/CMR/Sammelrechnungen.tsx:110.
- Ursache/Prüfgrenze: Der Handler verarbeitet Sammelpläne und Zeiteinträge ohne eigene Aufruferautorisierung und erzeugt privilegiert Rechnungen. Callergewählte Plan- oder Mandantenfilter begründen keine Zugriffsberechtigung.
- Geplante konkrete Änderung: Verifizierte Job-Berechtigung oder aktive mandantengebundene Fakturierungsberechtigung vor Verarbeitung verlangen.
- Betriebsfolgen: Unberechtigte Rechnungserzeugung; Veränderung von Zeiteinträgen und Planausführung.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Plan und Mandanten ohne Dokumentnummernvergabe oder Rechnungsanlage ablehnen..
- Sicherer Wiederherstellungsplan: Sammellauf pausieren; Rechnungen nur fachlich kontrolliert stornieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_8d76058b0444465c

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-automations-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-automations-engine`.
- Belege: supabase/functions/finance-automations-engine/index.ts:10-36; supabase/functions/finance-automations-engine/index.ts:84-97; supabase/functions/finance-automations-engine/index.ts:126; src/pages/Finance/Automations.tsx:88.
- Ursache/Prüfgrenze: Finanzregeln und Belege werden ohne Handler-Authentifizierung privilegiert gelesen und verarbeitet; Ausführungsprotokolle und Belegänderungen sind erreichbar.
- Geplante konkrete Änderung: Verifizierte Jobs oder aktive Finanzautomationsberechtigung mit Mandantenscope vor Regelladen verlangen.
- Betriebsfolgen: Unberechtigte Finanzautomationen; Manipulation von Rechnungszuständen.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte Ausführung ohne Regelabfrage, Belegupdate und Run-Eintrag abweisen..
- Sicherer Wiederherstellungsplan: Automationsengine pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_98d1a9730f1bf438_c6ddf1e8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-dunning-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-dunning-run`.
- Belege: supabase/functions/cmr-dunning-run/index.ts:34-62; supabase/functions/cmr-dunning-run/index.ts:114-159; supabase/functions/cmr-dunning-run/index.ts:173-197; src/pages/CMR/Mahnwesen.tsx:46.
- Ursache/Prüfgrenze: Der Mahnlauf besitzt keine Handler-Authentifizierung, liest Einstellungen und Dokumente privilegiert und erzeugt Mahndokumente. Optionaler E-Mail-Versand und Ausgangsbelegänderungen sind erreichbar; verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Aktive mandantengebundene Mahnberechtigung oder verifizierten Job vor dem Lauf erzwingen.
- Betriebsfolgen: Unberechtigte Mahnungserzeugung und Kundenkommunikation; Veränderung von Forderungszuständen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Mandanten und unberechtigten Lauf ohne Nummernvergabe, Dokumente und Versand abweisen..
- Sicherer Wiederherstellungsplan: Mahnlauf sperren; erzeugte Dokumente separat fachlich behandeln.
- Doppelmeldungsreferenz: keine.

### lov_finding_c26f3c6f2ff20f41

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-datev-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-datev-export`.
- Belege: supabase/functions/finance-datev-export/index.ts:19-38; supabase/functions/finance-datev-export/index.ts:96; src/pages/Finance/DatevExport.tsx:26.
- Ursache/Prüfgrenze: Vor dem privilegierten DATEV-Export wird nur das Vorhandensein eines Authorization-Headers geprüft. Eine gültige Identität, ein aktives Konto und eine Finanzexportberechtigung werden nicht nachgewiesen.
- Geplante konkrete Änderung: Aktive Finanzexportberechtigung und verifizierten Buchungs-/Mandantenscope vor jeder Transaktionsabfrage verlangen.
- Betriebsfolgen: Unberechtigter Export privater Buchungsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen nichtleeren Header und angemeldeten Benutzer ohne Exportrecht ohne CSV-Erzeugung ablehnen..
- Sicherer Wiederherstellungsplan: DATEV-Export sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_cac3d0218bcb0bbb

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sync-finance-deposits`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sync-finance-deposits`.
- Belege: supabase/functions/sync-finance-deposits/index.ts:6-56; supabase/functions/sync-finance-deposits/index.ts:119-125; supabase/functions/sync-finance-deposits/index.ts:169-175; src/pages/Finance/OffeneAnzahlungen.tsx:151.
- Ursache/Prüfgrenze: Ohne Handler-Authentifizierung werden Rechnungen, Bestellungen und Anzahlungen privilegiert gelesen, finance_deposits geschrieben und Neuberechnungs-RPCs ausgelöst.
- Geplante konkrete Änderung: Verifizierten Synchronisationsjob oder aktive Finanzberechtigung vor Datenzugriff verlangen; Datenumfang serverseitig begrenzen.
- Betriebsfolgen: Unberechtigte Änderung privater Anzahlungsdaten; Veränderung berechneter Finanzstände.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten Sync ohne Upsert und Neuberechnungs-RPC abweisen..
- Sicherer Wiederherstellungsplan: Synchronisation pausieren; Finanzkorrekturen nur kontrolliert durchführen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d76d8adca9d2e204

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-management-pack`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-management-pack`.
- Belege: supabase/functions/finance-management-pack/index.ts:4-26; src/pages/Finance/ManagementPack.tsx:73.
- Ursache/Prüfgrenze: pack_id und action steuern ohne Handler-Authentifizierung privilegierte Änderungen an Managementberichten. Der send-Pfad markiert Berichte als versendet; tatsächlicher E-Mail-Versand ist dadurch nicht belegt.
- Geplante konkrete Änderung: Aktive berichtsbezogene Finanzberechtigung vor generate und send prüfen; Versandstatus nur an belegten Versand knüpfen.
- Betriebsfolgen: Unberechtigte Manipulation von Berichts- und Versandzuständen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde pack_id für beide Aktionen ohne Update abweisen; bloße Statusänderung nicht als echten Mailversand testen..
- Sicherer Wiederherstellungsplan: Berichtsaktionen sperren; Statuskorrekturen separat auditieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_d9dbde1372d10aa0_2fd2e69b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.credit-score-calculate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `credit-score-calculate`.
- Belege: supabase/functions/credit-score-calculate/index.ts:6-28; supabase/functions/credit-score-calculate/index.ts:200-214; src/pages/Credit/New.tsx:99.
- Ursache/Prüfgrenze: assessment_id bestimmt ohne Aufruferberechtigung privilegierte Bonitäts-, Bestell- und Finanzabfragen. Faktoren und Bewertung werden verändert; Antwort enthält Score und Entscheidungsergebnisse, nicht zwingend sämtliche Rohdaten.
- Geplante konkrete Änderung: Aktive Bonitätsbearbeitungsberechtigung für Bewertung und Kunde vor jeder Abfrage und Neuberechnung verlangen.
- Betriebsfolgen: Offenlegung privater Bonitätsergebnisse; Unberechtigte Veränderung von Kreditentscheidungsgrundlagen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Bewertung ohne Rohdatenzugriff, Faktorenlöschung und Entscheidungsupdate abweisen..
- Sicherer Wiederherstellungsplan: Neuberechnungsendpunkt sperren; Bewertungsstände historisch sichern.
- Doppelmeldungsreferenz: keine.

### lov_finding_113966ca22401a64

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sync-zoho-to-finance`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sync-zoho-to-finance`.
- Belege: supabase/functions/sync-zoho-to-finance/index.ts:27-58.
- Ursache/Prüfgrenze: Zwischen OPTIONS-Behandlung und mandantenübergreifenden Service-Role-Abfragen liegt keine Aufruferprüfung. Kundenmapping und Zoho-Rechnungen werden direkt für den Finanzsync geladen.
- Geplante konkrete Änderung: Verifizierte Jobidentität oder explizite administrative Finanzsync-Berechtigung vor jeglichem Datenzugriff verlangen.
- Betriebsfolgen: Unberechtigte Auslösung des Finanzabgleichs; Mandantenübergreifende Verarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Fehlende und ungültige Jobidentität ablehnen; autorisierten Job zulassen; wiederholten Lauf auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Job deaktivieren; durch den Lauf verursachte Finanzänderungen anhand von Referenzen abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1c06d10916b40cbc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-tax-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-tax-export`.
- Belege: supabase/functions/finance-tax-export/index.ts:73-96; supabase/functions/finance-tax-export/index.ts:104-110.
- Ursache/Prüfgrenze: Die Finance-Rollenprüfung ist vorhanden. tenant_id stammt jedoch aus dem Request und wird nur als optionaler Abfragefilter verwendet; eine Zuordnung dieses Mandanten zum Benutzer fehlt. Ohne tenant_id werden alle passenden Finanztransaktionen der Region gelesen.
- Geplante konkrete Änderung: Exportmandanten serverseitig aus Benutzerberechtigungen bestimmen; fremde und unzulässige leere Mandantenauswahl ablehnen.
- Betriebsfolgen: Mandantenübergreifender Zugriff auf Finanzdaten; Unberechtigte Steuerexportverarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Finance-Benutzer aus Mandant A darf B und ungefilterten Gesamtexport nicht abrufen..
- Sicherer Wiederherstellungsplan: Steuerexport vorübergehend sperren; bereits erzeugte Exporte überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_23a279b4a5efc05a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.collect-analytics`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-analytics`.
- Belege: supabase/functions/collect-analytics/index.ts:19-48.
- Ursache/Prüfgrenze: Der Analytics-Handler erstellt ohne Aufruferprüfung einen Service-Role-Client und lädt Inkassofälle, Kunden, Kreditlimits und Rechnungen mandantenübergreifend. Schon der geschützte Datenzugriff ist unmittelbar unautorisiert; der vollständige spätere Schreibpfad wurde nicht abschließend gelesen.
- Geplante konkrete Änderung: Verifizierte administrative Jobberechtigung vor sämtliche Datenzugriffe setzen und Verarbeitung auf autorisierte Mandanten begrenzen.
- Betriebsfolgen: Unberechtigte Verarbeitung geschützter Inkasso- und Kreditdaten; Behauptete Kreditlimitänderungen zusätzlich nachprüfen.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten Start vor dem ersten Datenzugriff ablehnen; berechtigten Lauf mandantenscharf prüfen..
- Sicherer Wiederherstellungsplan: Analyticsjob deaktivieren; Kreditlimitänderungen separat abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_28ad318b9fbc4915

- Bewertung: ungeklärt; Korrekturgruppe `CG.finance-approval-action`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-approval-action`.
- Belege: supabase/functions/finance-approval-action/index.ts:80.
- Ursache/Prüfgrenze: Der aktuelle finance-approval-action-Handler und die Autorisierung des konkret gewählten Genehmigungsschritts wurden nicht vollständig gelesen. Eine Bestätigung anhand der gelieferten Fundstelle allein wäre nicht belastbar.
- Geplante konkrete Änderung: Aktuellen Handler, Genehmigerzuordnung und Mandantengrenze prüfen; gegebenenfalls transaktionale Genehmigungsprüfung ergänzen.
- Betriebsfolgen: Potenzielle unberechtigte Rechnungsfreigabe.
- Geplante Regressionstests, noch nicht ausgeführt: Nicht zugewiesener Benutzer und fremder Mandant dürfen approval_id nicht entscheiden..
- Sicherer Wiederherstellungsplan: Freigabeoperation sperren, falls fehlende Berechtigung bestätigt wird.
- Doppelmeldungsreferenz: keine.

### lov_finding_321b0bea0163279e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.collect-document-generate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-document-generate`.
- Belege: supabase/functions/collect-document-generate/index.ts:69-99.
- Ursache/Prüfgrenze: Die Finanzrolle wird geprüft, nicht jedoch die Berechtigung auf den gewählten collect_cases-Datensatz. Fall und Rechnungspositionen werden ausschließlich über case_id mit Service Role geladen.
- Geplante konkrete Änderung: Fallmandant und Kundenberechtigung vor Dokumenterstellung, Storagezugriff und optionalem Versand prüfen.
- Betriebsfolgen: Mandantenfremde Verarbeitung von Forderungsdaten; Unberechtigte Schriftverkehrserstellung.
- Geplante Regressionstests, noch nicht ausgeführt: Finance-Benutzer aus A darf Fall aus B weder erzeugen noch versenden..
- Sicherer Wiederherstellungsplan: Generator sperren; unberechtigt erzeugte Dokumente gezielt widerrufen oder kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_38dc846b77303b8b

- Bewertung: ungeklärt; Korrekturgruppe `CG.finance-bank-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-bank-import`.
- Belege: supabase/functions/finance-bank-import/index.ts:31-50.
- Ursache/Prüfgrenze: Der Bankimport besitzt nachweislich nur eine Bearer-Präfixprüfung vor Service-Role-Zugriffen. Der für diesen Befund maßgebliche spätere QR-Rechnungsstatus-Updatepfad und dessen Datensatzbindung wurden jedoch nicht abschließend gelesen.
- Geplante konkrete Änderung: Authentifizierung und Finanzimportrolle vorziehen; QR-Matching einschließlich Mandant, Konto, Betrag und Statusübergang vollständig prüfen.
- Betriebsfolgen: Bestätigter ungeschützter privilegierter Einstieg; Behauptetes unberechtigtes Bezahltsetzen noch offen.
- Geplante Regressionstests, noch nicht ausgeführt: Ungültigen Bearer vor Datenzugriff ablehnen; manipulierte und mandantenfremde QR-Zuordnung prüfen..
- Sicherer Wiederherstellungsplan: Import sperren; Zahlungsstatusänderungen anhand importierter Statements abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_48c15e5c018def20

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-reminder-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-reminder-engine`, `getTenantScope`.
- Belege: supabase/functions/_shared/tenant-scope.ts:55-75; supabase/functions/finance-reminder-engine/index.ts:24-32.
- Ursache/Prüfgrenze: getTenantScope setzt bei einem authentifizierten Benutzer ohne user_tenant_access-Einträge restricted auf false und erlaubt alle aktiven Mandanten. Der Mahnlauf übernimmt diesen Wert und setzt scopedIds auf null. Die Ablehnung leerer eingeschränkter Scopes verhindert diese Fail-open-Konstellation nicht.
- Geplante konkrete Änderung: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Berechtigung explizit über eine privilegierte Rolle abbilden.
- Betriebsfolgen: Mandantenübergreifender Mahnlauf durch Benutzer ohne Zuweisung.
- Geplante Regressionstests, noch nicht ausgeführt: Benutzer ohne Zuweisung, mit einem Mandanten und mit expliziter globaler Rolle getrennt prüfen..
- Sicherer Wiederherstellungsplan: Mahnlauf deaktivieren; Scope-Korrektur nicht durch Wiederherstellung des Fail-open-Verhaltens zurückrollen.
- Doppelmeldungsreferenz: keine.

### lov_finding_58c64b182fdc8abb_baa3b4af

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-asset-depreciation-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-asset-depreciation-run`.
- Belege: supabase/functions/finance-asset-depreciation-run/index.ts:17-38; supabase/functions/finance-asset-depreciation-run/index.ts:83-90.
- Ursache/Prüfgrenze: userClient wird lediglich erzeugt, aber nicht zur Identitätsprüfung verwendet. Alle aktiven Anlagen werden mit Service Role geladen; dry_run ist standardmäßig false und der Code schreibt Abschreibungen.
- Geplante konkrete Änderung: Verifizierte Finanzbuchungs- oder Jobberechtigung und Anlagenmandantenscope vor Lesen und Buchen verlangen.
- Betriebsfolgen: Unberechtigte Anlagenverarbeitung; Unberechtigte Abschreibungsbuchungen.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Lauf einschließlich dry_run ablehnen; fremden Mandanten ablehnen; berechtigten Lauf idempotent prüfen..
- Sicherer Wiederherstellungsplan: Abschreibungslauf sperren; Buchungen fachlich stornieren und Buchwerte abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5bcfc333ec4f9bc9

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-asset-depreciation-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-asset-depreciation-run`.
- Belege: supabase/functions/finance-asset-depreciation-run/index.ts:22-29; supabase/functions/finance-asset-depreciation-run/index.ts:83-90.
- Ursache/Prüfgrenze: Vor dem Abschreibungs-Upsert findet keine wirksame Authentifizierung statt. Der angelegte userClient wird nicht abgefragt; der Schreibpfad verwendet admin und wird ohne dry_run explizit ausgeführt.
- Geplante konkrete Änderung: Buchungsrolle, Mandant und Periodenberechtigung vor dem Abschreibungs-Upsert prüfen.
- Betriebsfolgen: Unberechtigte Abschreibungsbuchung.
- Geplante Regressionstests, noch nicht ausgeführt: Nicht authentifizierten und fachfremden Benutzer vor Upsert ablehnen..
- Sicherer Wiederherstellungsplan: Lauf sperren; fehlerhafte Buchungen durch dokumentierte Stornos korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_6708a45359831172

- Bewertung: ungeklärt; Korrekturgruppe `CG.collect-send-dunning`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-send-dunning`, `send-invoice-mail`.
- Belege: supabase/functions/collect-send-dunning/index.ts:22-26; supabase/functions/send-invoice-mail/index.ts:120-138.
- Ursache/Prüfgrenze: Der Einstieg besitzt eine Benutzerprüfung. Fallautorisierung, zulässige Empfängerabweichungen und die gesamte Weitergabe an send-invoice-mail wurden nicht vollständig gelesen. Freie Empfänger bei berechtigten Finanzmitarbeitern sind ohne diese Prüfung nicht automatisch kritisch.
- Geplante konkrete Änderung: Fall-, Mandanten- und Empfängerberechtigung entlang des internen Aufrufs prüfen; erforderliche Overrides explizit berechtigen.
- Betriebsfolgen: Potenzieller unberechtigter Mahnversand.
- Geplante Regressionstests, noch nicht ausgeführt: Fremder Fall, abweichender Empfänger und legitimer Vertreterkontakt..
- Sicherer Wiederherstellungsplan: Betroffenen Mahnversand sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_689b0326e896c2b9

- Bewertung: ungeklärt; Korrekturgruppe `CG.collect-morning-report`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-morning-report`.
- Belege: supabase/functions/collect-morning-report/index.ts:1-94.
- Ursache/Prüfgrenze: Die vollständige Ausgabe des aktuellen Morgenberichts wurde nicht abschließend ausgewertet; Datenumfang, Antwort und mögliche Aufruferprüfung sind daher nicht ausreichend belegt.
- Geplante konkrete Änderung: Berichtseinstieg, Finanzrolle, Mandantenfilter und Rückgabedaten vollständig prüfen.
- Betriebsfolgen: Potenzielle Offenlegung von Inkassoberichten.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymer, fachfremder und mandantenfremder Abruf..
- Sicherer Wiederherstellungsplan: Berichtsausgabe sperren, falls fehlende Autorisierung bestätigt wird.
- Doppelmeldungsreferenz: keine.

### lov_finding_7663c8dfc8cfd611_1e2b5c22

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-recurring-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-recurring-run`.
- Belege: supabase/functions/cmr-recurring-run/index.ts:25-41.
- Ursache/Prüfgrenze: Der Abrechnungslauf liest frei gewählte planId und tenantId ohne Aufruferprüfung und selektiert wiederkehrende Pläne per Service Role. planId umgeht zudem die Fälligkeitsauswahl; eine Berechtigung auf den Plan fehlt.
- Geplante konkrete Änderung: Verifizierte Jobidentität oder berechtigte CMR-Abrechnungsrolle mit konkretem Mandantenscope verlangen; manuelle Planläufe gesondert autorisieren.
- Betriebsfolgen: Unberechtigte Auslösung der wiederkehrenden Abrechnung.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Lauf und fremde planId ablehnen; vorzeitigen manuellen Lauf nur explizit berechtigt zulassen..
- Sicherer Wiederherstellungsplan: Abrechnungslauf stoppen; erzeugte Belege fachlich stornieren statt löschen.
- Doppelmeldungsreferenz: keine.

### lov_finding_86a979bd8688c2a0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-send-document`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-send-document`.
- Belege: supabase/functions/cmr-send-document/index.ts:26-71; supabase/functions/cmr-send-document/index.ts:85-90.
- Ursache/Prüfgrenze: CMR-Rolle wird geprüft, aber documentId wird danach ohne Benutzer-Mandantenabgleich per Service Role gelesen. Empfänger, Betreff, Nachricht und PDF-Inhalt stammen aus dem Request; das Versandprotokoll wird dem gewählten fremden Beleg zugeordnet.
- Geplante konkrete Änderung: Belegmandant und Versandrecht prüfen; PDF serverseitig aus dem autorisierten Beleg erzeugen und Empfängeroverrides gesondert berechtigen.
- Betriebsfolgen: Mandantenfremder Belegversand; Fremde Versandprotokolle; Missbrauch der Unternehmensidentität.
- Geplante Regressionstests, noch nicht ausgeführt: CMR-Benutzer mit fremdem documentId und manipuliertem PDF ablehnen..
- Sicherer Wiederherstellungsplan: Belegversand sperren; fehlerhafte Protokolle kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_9260563e406937fe

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-camt054-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-camt054-import`.
- Belege: supabase/functions/finance-camt054-import/index.ts:21-57.
- Ursache/Prüfgrenze: Die einzige Aufruferprüfung ist startsWith('Bearer '). Der Token wird nicht verifiziert. Danach werden mit Service Role vorhandene Notifications gelesen und neue Bankmeldungen einschließlich raw_xml gespeichert.
- Geplante konkrete Änderung: Token verifizieren, Bankimportrolle und Kontomandant prüfen; beliebige Bearer-Zeichenfolgen ablehnen.
- Betriebsfolgen: Unberechtigter Bankdatenimport; Unberechtigter Zugriff auf Importmetadaten.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen Bearer und fachfremden Benutzer vor Datenzugriff ablehnen..
- Sicherer Wiederherstellungsplan: Import sperren; eingefügte Notifications und abhängige Zuordnungen abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_a42c392d5c8dd1fd

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-ch-reconcile`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-ch-reconcile`.
- Belege: supabase/functions/finance-ch-reconcile/index.ts:33-57.
- Ursache/Prüfgrenze: Der CH-Abgleich prüft nur das Bearer-Präfix. Ohne Tokenverifizierung oder Finanzrolle werden offene Schweizer Bankzeilen mit Service Role geladen und für QR-Matching verarbeitet.
- Geplante konkrete Änderung: Verifizierte Finanzabgleichs- oder Jobberechtigung und Kontomandantenscope vor Verarbeitung verlangen.
- Betriebsfolgen: Unberechtigte Zahlungsabgleichsverarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen Bearer, fachfremden Benutzer und fremden Kontomandanten ablehnen..
- Sicherer Wiederherstellungsplan: Abgleich stoppen; erzeugte Zahlungszuordnungen fachlich prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b0851d9805f11435

- Bewertung: ungeklärt; Korrekturgruppe `CG.azinvoicetab.sendbyemail`; Abhängigkeiten A1, A2, A5.
- Funktionen: `AzInvoiceTab.sendByEmail`, `od-download`.
- Belege: src/components/AzInvoiceTab.tsx:891.
- Ursache/Prüfgrenze: Die aktuelle Token-Erzeugung, spätere mögliche Korrekturen und der od-download-Prüfpfad einschließlich Ablauf, Rate-Limits und Zugriffskontrolle wurden nicht vollständig gelesen. Der gelieferte Hinweis auf 40 Bit allein reicht nicht für eine aktuelle Kritikalitätsbestätigung.
- Geplante konkrete Änderung: Alle Tokenproduzenten und den Downloadkonsumenten prüfen; bei bestätigter Kürzung mindestens 128 Bit zufällige Tokens mit Ablauf und Widerruf einsetzen.
- Betriebsfolgen: Potenzielle Erratbarkeit privater Rechnungslinks.
- Geplante Regressionstests, noch nicht ausgeführt: Tokenentropie, Alt-Tokens, Ablauf, Widerruf und Begrenzung erfolgloser Abrufe prüfen..
- Sicherer Wiederherstellungsplan: Betroffene öffentliche Downloads sperren; schwache Alt-Tokens nicht wieder aktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_b4dbe8c9ecfd794e_659534c3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-camt054-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-camt054-import`.
- Belege: supabase/functions/finance-camt054-import/index.ts:21-30; supabase/functions/finance-camt054-import/index.ts:47-57.
- Ursache/Prüfgrenze: Beliebige Bearer-Zeichenfolgen bestehen die einzige Prüfung. Anschließend wird über den privilegierten Client eine finance_camt054_notifications-Zeile mit vom Aufrufer geliefertem XML angelegt.
- Geplante konkrete Änderung: Authentifizierung, Bankimportrolle und Kontomandant prüfen; unberechtigte Eingaben vor dem Insert ablehnen.
- Betriebsfolgen: Unberechtigte dauerhafte Bankmeldungen.
- Geplante Regressionstests, noch nicht ausgeführt: Ungültiger Bearer darf keine Notification erzeugen; berechtigter Import bleibt idempotent..
- Sicherer Wiederherstellungsplan: Import stoppen; manipulierte Notifications und Folgezuordnungen gezielt zurücknehmen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b740221af1bd20a5

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-sepa-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-sepa-export`.
- Belege: supabase/functions/finance-sepa-export/index.ts:12-31.
- Ursache/Prüfgrenze: getUser prüft die Identität. Danach wird jedoch ein separater uneingeschränkter admin-Client erstellt, der run_id sowie zugehörige Positionen einschließlich Mandaten ohne Rollen- oder Mandantenprüfung lädt.
- Geplante konkrete Änderung: SEPA-Exportrecht und Berechtigung auf den konkreten Laufmandanten prüfen, bevor Mandats- und Bankdaten geladen werden.
- Betriebsfolgen: Unberechtigte Verarbeitung von Lastschrift- und Mandatsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Fachfremden Benutzer und fremde run_id ablehnen; autorisierten Export zulassen..
- Sicherer Wiederherstellungsplan: SEPA-Export sperren; erzeugte Exportartefakte überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c1970a6abcb44913

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-bank-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-bank-import`.
- Belege: supabase/functions/finance-bank-import/index.ts:31-52.
- Ursache/Prüfgrenze: finance-bank-import verifiziert keinen Benutzer, sondern nur das Bearer-Präfix. Bereits die Suche nach vorhandenem file_hash und die Rückgabe von statement_id und Zählern erfolgen mit Service Role ohne Konto- oder Mandantenberechtigung.
- Geplante konkrete Änderung: Verifizierte Importidentität, Finanzrolle und Berechtigung auf Bankkonto und Mandant vor Deduplizierung und Speicherung prüfen.
- Betriebsfolgen: Unberechtigter Zugriff auf Bankimportmetadaten; Ungeschützter privilegierter Importpfad.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen Bearer vor Hashsuche ablehnen; fremden Kontomandanten ablehnen..
- Sicherer Wiederherstellungsplan: Bankimport sperren; betroffene Importsätze und Zuordnungen fachlich abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c5b0e3d6a8f2e774

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-datev-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-datev-export`.
- Belege: supabase/functions/finance-datev-export/index.ts:19-43.
- Ursache/Prüfgrenze: Der DATEV-Export akzeptiert jede Zeichenfolge mit Bearer-Präfix. Danach liest er Finanztransaktionen und Kundennamen per Service Role, begrenzt nur durch frei gewählten Zeitraum und Region; eine Benutzer-, Rollen- oder Mandantenprüfung fehlt.
- Geplante konkrete Änderung: Benutzer authentifizieren, DATEV-Exportrecht verlangen und erlaubte Mandanten serverseitig filtern.
- Betriebsfolgen: Unberechtigter Zugriff auf Finanztransaktionen und Kundenzuordnungen.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebigen Bearer, fachfremde Rolle und fremden Mandanten vor Abfrage ablehnen..
- Sicherer Wiederherstellungsplan: DATEV-Export deaktivieren; bereits erzeugte Dateien überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d9dbde1372d10aa0_da1f1b29

- Bewertung: ungeklärt; Korrekturgruppe `CG.credit-score-calculate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `credit-score-calculate`.
- Belege: supabase/functions/credit-score-calculate/index.ts:1-223.
- Ursache/Prüfgrenze: Der aktuelle Kreditscoring-Einstieg, die Auswahl der betroffenen Bonitätsakte und sämtliche Schreibpfade wurden nicht abschließend gelesen.
- Geplante konkrete Änderung: Bonitätsrolle, konkrete Kunden-/Aktenberechtigung und Mandantenscope entlang aller Modi prüfen.
- Betriebsfolgen: Potenzielle unberechtigte Neuberechnung privater Bonitätsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymer, fachfremder und mandantenfremder Scoringaufruf..
- Sicherer Wiederherstellungsplan: Neuberechnung sperren; betroffene Scores aus fachlich validierten Daten neu erzeugen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e9b23515a9652ef7

- Bewertung: ungeklärt; Korrekturgruppe `CG.collect-ai-score`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-ai-score`.
- Belege: supabase/functions/collect-ai-score/index.ts:1-114.
- Ursache/Prüfgrenze: Der aktuelle collect-ai-score-Einstieg und die Auswahl der geschützten Inkassofälle wurden nicht abschließend ausgewertet. Fehlende Authentifizierung wird nicht allein aus dem Befundtext übernommen.
- Geplante konkrete Änderung: Identität, Inkassorolle und Berechtigung auf jeden ausgewählten Fall vor KI-Aufruf und Scoreänderung prüfen.
- Betriebsfolgen: Potenzielle unberechtigte Verarbeitung von Inkassofällen; Potenzielle KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymer, fachfremder und mandantenfremder Fallzugriff; gemischte Stapel..
- Sicherer Wiederherstellungsplan: Scoring sperren; betroffene Scores anhand fachlich validierter Daten erneuern.
- Doppelmeldungsreferenz: keine.

### lov_finding_3e6f3a3c10a40230

- Bewertung: ungeklärt; Korrekturgruppe `CG.pruefung-release`; Abhängigkeiten A1, A2, A5.
- Funktionen: `pruefung-release`, `send-invoice-mail`.
- Belege: supabase/functions/pruefung-release/index.ts:31-67; supabase/functions/pruefung-release/index.ts:107-109; src/pages/Finance/RatenPruefung.tsx:88.
- Ursache/Prüfgrenze: Der Handler prüft lediglich eine gültige Benutzeridentität und liest anschließend frei ausgewählte Profile sowie zurückgehaltene Rechnungen mit Service-Rechten. Eine Freigaberolle fehlt im gelesenen Pfad. Die vollständige Wirkung des nachgelagerten send-invoice-mail und verbleibender Schreiboperationen ist nicht abschließend geprüft.
- Geplante konkrete Änderung: Explizite Freigabeberechtigung und profilspezifischen Zugriff vor Service-Lesen erzwingen; Mail- und Statuskette vollständig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Rechnungsfreigabe und Kommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_44ddf2563f3b0bce

- Bewertung: ungeklärt; Korrekturgruppe `CG.cmr-send-document`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-send-document`, `cmr-collective-run`.
- Belege: supabase/functions/cmr-send-document/index.ts:26-55; supabase/functions/cmr-collective-run/index.ts:123; src/pages/CMR/Dokumente.tsx:379.
- Ursache/Prüfgrenze: Identität und eine erlaubte globale Rolle werden geprüft. Anschließend wird das Dokument ausschließlich per documentId mit Service-Rechten gelesen; eine Mandantenbindung fehlt. Ob die Rolle CMR fachlich mandantenübergreifend berechtigt sein soll und wie interne Aufrufer autorisiert werden, ist nicht abschließend belegt.
- Geplante konkrete Änderung: Verbindliches CMR-Berechtigungsmodell klären und gegebenenfalls Dokument-/Mandantenprüfung vor Service-Lesen und Versand ergänzen.
- Betriebsfolgen: Möglicher mandantenübergreifender Dokumentversand.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5c7be8cb8b467dc0

- Bewertung: ungeklärt; Korrekturgruppe `CG.collect-document-generate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-document-generate`.
- Belege: supabase/functions/collect-document-generate/index.ts:69-95; supabase/functions/collect-document-generate/index.ts:210-234; src/components/collect/CollectCaseActions.tsx:64.
- Ursache/Prüfgrenze: Benutzeridentität und erlaubte Rollen werden geprüft. Der Fall wird anschließend mit Service-Rechten geladen und ein Dokument erzeugt; ein Versandpfad existiert. Ob freie Empfänger für diese Finanzrollen bewusst zulässig sind und ob ein engerer Fallscope gefordert ist, ist fachlich und entlang des gesamten Empfängerpfads nicht abgeschlossen.
- Geplante konkrete Änderung: Fall- und Empfängerberechtigungsmodell festlegen; nur danach erforderliche Scope- und Übersteuerungsprüfungen implementieren.
- Betriebsfolgen: Mögliche Weitergabe von Inkassodokumenten an unberechtigte Empfänger.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_72ade965d435cb87

- Bewertung: ungeklärt; Korrekturgruppe `CG.credit-score-calculate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `credit-score-calculate`.
- Belege: supabase/functions/credit-score-calculate/index.ts:6-12; src/pages/Credit/Detail.tsx:52; src/pages/Credit/New.tsx:99.
- Ursache/Prüfgrenze: Der Handler akzeptiert eine assessment_id und erzeugt unmittelbar einen Service-Client ohne sichtbare Identitätsprüfung. Die gesamte Berechnungs-, Dokument- und Schreibkette wurde nicht vollständig gelesen; deren konkrete Endwirkung bleibt daher unresolved.
- Geplante konkrete Änderung: Kreditprüfberechtigung und Assessment-Scope vor Service-Zugriffen prüfen; verbleibende Berechnungsabhängigkeiten vollständig auditieren.
- Betriebsfolgen: Mögliche unberechtigte Kreditbewertung und Verarbeitung sensibler Unterlagen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_752434abd9742e22

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-ai-forecast`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-ai-forecast`.
- Belege: supabase/functions/finance-ai-forecast/index.ts:13-24; supabase/functions/finance-ai-forecast/index.ts:41-48; supabase/functions/finance-ai-forecast/index.ts:66-72; src/pages/Finance/Forecast.tsx:30.
- Ursache/Prüfgrenze: Der Handler übernimmt tenant_id aus dem Body, liest Finanztransaktionen mit Service-Rechten, ruft die KI auf und upsertet finance_forecasts ohne Aufrufer- oder Finanzberechtigungsprüfung.
- Geplante konkrete Änderung: Finanzprognoserecht und autorisierten Mandanten serverseitig bestimmen; KI- und Schreibzugriffe erst danach ausführen.
- Betriebsfolgen: Unberechtigte Finanzdatenverarbeitung; Prognosemanipulation; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_7663c8dfc8cfd611_f8f951cf

- Bewertung: ungeklärt; Korrekturgruppe `CG.cmr-recurring-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-recurring-run`, `cmr_next_document_number`.
- Belege: supabase/functions/cmr-recurring-run/index.ts:25-39; supabase/functions/cmr-recurring-run/index.ts:87-107; supabase/functions/cmr-recurring-run/index.ts:120-147; src/pages/CMR/Abos.tsx:136.
- Ursache/Prüfgrenze: Der Einstieg prüft keine Identität; tenantId ist optional und ohne diese Eingabe werden aktive Pläne mandantenübergreifend ausgewählt. Service-Schreib- und Versandpfade sind vorhanden. Nummern-RPC, vollständige Aboregeln und Jobauthentifizierung sind nicht abschließend aufgelöst.
- Geplante konkrete Änderung: Verifizierte Jobidentität oder explizite Abolaufberechtigung erzwingen; Mandantenscope, Idempotenz und Nummernvergabe vollständig prüfen.
- Betriebsfolgen: Mögliche mandantenübergreifende Rechnungsanlage und Vorabmitteilungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_86d0bf0477028299

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-ch-dd-export.read-debit-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-ch-dd-export:Lesen`.
- Belege: supabase/functions/finance-ch-dd-export/index.ts:9-22; src/pages/Finance/ChLastschriften.tsx:61.
- Ursache/Prüfgrenze: Es wird nur das Präfix Bearer geprüft, nicht die Identität. Danach werden der frei gewählte Lastschriftlauf und dessen Detaildaten mit Service-Rechten gelesen. Ein gegebenenfalls vorgeschaltetes Gateway ersetzt keine Finanz- und Laufberechtigung. Der separate Statusupdatebefund ist keine identische Operation.
- Geplante konkrete Änderung: Identität validieren und Exportrecht sowie Lauf-/Mandantenscope vor Datenabruf erzwingen.
- Betriebsfolgen: Unberechtigter Zugriff auf Lastschrift- und Zahlungsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_87a129784e09ef5c

- Bewertung: ungeklärt; Korrekturgruppe `CG.zoho-invoice-pdf`; Abhängigkeiten A1, A2, A5.
- Funktionen: `zoho-invoice-pdf`, `getTenantScope`, `sourceInScope`.
- Belege: supabase/functions/zoho-invoice-pdf/index.ts:98; supabase/functions/_shared/tenant-scope.ts:49-67; src/components/finance/InvoicePdfDialog.tsx:35.
- Ursache/Prüfgrenze: zoho-invoice-pdf verwendet getTenantScope. Der Helper behandelt einen gültigen Benutzer ohne user_tenant_access-Einträge ausdrücklich als uneingeschränkt. Ob dies für die betroffenen Kontotypen beabsichtigte globale Berechtigung oder ein Fehler ist, erfordert das verbindliche Mandantenmodell. Die gesamte Remote-PDF-Kette wurde nicht abschließend geprüft.
- Geplante konkrete Änderung: Globale Berechtigung explizit modellieren; fehlende Zuweisung nicht ohne dokumentierte Ausnahme als Vollzugriff behandeln.
- Betriebsfolgen: Möglicher mandantenübergreifender Rechnungsdownload.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_9b6babee6e0739e2

- Bewertung: ungeklärt; Korrekturgruppe `CG.rz-reminder-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `rz-reminder-send`, `send-invoice-mail`.
- Belege: supabase/functions/rz-reminder-send/index.ts:174-186; supabase/functions/rz-reminder-send/index.ts:209-230; supabase/functions/rz-reminder-send/index.ts:273-275; src/pages/Finance/WiederkehrendeZahlerErinnerungen.tsx:144.
- Ursache/Prüfgrenze: Normale Aufrufer werden authentifiziert; die Super-Admin-Prüfung gilt aber nur für Inhaltsübersteuerungen. Die übergebenen reminder_ids werden anschließend mit Service-Rechten ohne Benutzer-/Mandantenfilter gelesen. Der nachgelagerte send-invoice-mail-Pfad wurde nicht vollständig abgeschlossen.
- Geplante konkrete Änderung: Erinnerungsversandrecht und Datensatzscope unabhängig von Override-Rechten prüfen; Mailkette vollständig auditieren.
- Betriebsfolgen: Möglicher unberechtigter Erinnerungsversand; Fremde Erinnerungsvorschauen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b4dbe8c9ecfd794e_7e264ad8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-camt054-import`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-camt054-import`.
- Belege: supabase/functions/finance-camt054-import/index.ts:21-25; supabase/functions/finance-camt054-import/index.ts:48-81; src/pages/Finance/Camt054.tsx:37.
- Ursache/Prüfgrenze: Nur das Bearer-Präfix wird geprüft. Anschließend werden eingereichte Bankmeldungen mit Service-Rechten in finance_camt054_notifications und finance_camt054_entries gespeichert. Eine validierte Identität und Bankimportrolle fehlen.
- Geplante konkrete Änderung: Benutzer validieren und Bankimportberechtigung sowie Konten-/Mandantenscope vor Verarbeitung erzwingen.
- Betriebsfolgen: Unberechtigte Anlage von Bankmeldungen und Buchungsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c3d615c0a49c15fb

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-ch-dd-export.mark-run-exported`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-ch-dd-export:Statusänderung`.
- Belege: supabase/functions/finance-ch-dd-export/index.ts:9-18; supabase/functions/finance-ch-dd-export/index.ts:81-85; src/pages/Finance/ChLastschriften.tsx:61.
- Ursache/Prüfgrenze: Nach einer bloßen Bearer-Präfixprüfung werden der gewählte Lastschriftlauf und seine Positionen mit Service-Rechten als exportiert markiert. Es fehlt eine validierte Identität und Laufberechtigung. Diese Mutation ist nicht identisch mit dem separaten Lesebefund.
- Geplante konkrete Änderung: Exportrolle und Lauf-/Mandantenscope prüfen; Status erst nach autorisiertem, konsistentem Export ändern.
- Betriebsfolgen: Unberechtigte Änderung finanzieller Exportzustände.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d599eb858f23ab35_c16d2b6f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.finance-sepa-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-sepa-export`.
- Belege: supabase/functions/finance-sepa-export/index.ts:12-23; src/pages/Finance/Sepa.tsx:144.
- Ursache/Prüfgrenze: Der erste Client validiert den Benutzer. Anschließend wird jedoch ein neuer Service-Client ohne Benutzerheader erzeugt und für den frei übergebenen run_id verwendet. Eine Exportrolle oder objektbezogene Laufberechtigung ist vor diesem Übergang nicht vorhanden.
- Geplante konkrete Änderung: SEPA-Exportrecht sowie Lauf-/Mandantenscope vor privilegiertem Datenzugriff prüfen.
- Betriebsfolgen: Unberechtigter Zugriff auf Lastschriftexportdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d827e70493abbc17

- Bewertung: ungeklärt; Korrekturgruppe `CG.finance-compliance-report`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `finance-compliance-report`.
- Belege: supabase/functions/finance-compliance-report/index.ts:13-23; supabase/functions/finance-compliance-report/index.ts:36-43; src/pages/Finance/Compliance.tsx:47.
- Ursache/Prüfgrenze: Anders als bei einem uneingeschränkten Service-Client setzt dieser Handler den Authorization-Header des Aufrufers auf demselben Client, mit dem audit_logs gelesen wird. Nach getUser bleibt daher eine benutzerspezifische Datenbankautorisierung relevant. Ohne vollständige aktuelle audit_logs-Policies und Grants ist weder der behauptete RLS-Bypass noch eine ausreichende Zugriffsbeschränkung belegt.
- Geplante konkrete Änderung: Aktuelle audit_logs-RLS vollständig auflösen; gegebenenfalls explizites Compliance-Exportrecht ergänzen, ohne einen nicht belegten Service-Bypass zu unterstellen.
- Betriebsfolgen: Mögliche Auditdatenoffenlegung abhängig von RLS.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_de727ed9fb3a3be4

- Bewertung: ungeklärt; Korrekturgruppe `CG.cmr-bank-automatch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-bank-automatch`.
- Belege: supabase/functions/cmr-bank-automatch/index.ts:11-25; supabase/functions/cmr-bank-automatch/index.ts:40-56.
- Ursache/Prüfgrenze: Der Handler startet ohne sichtbare Identitätsprüfung mit einem Service-Client; tenantId ist optional. Bankzeilen und offene Dokumente werden dadurch potenziell global ausgewählt. Die vollständige Matching- und Buchungswirkung wurde nicht abschließend verfolgt.
- Geplante konkrete Änderung: Bankmatchingrecht beziehungsweise Jobidentität prüfen; Mandantenscope und sämtliche Buchungsfolgen vollständig auditieren.
- Betriebsfolgen: Mögliche unberechtigte Zahlungszuordnung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e9bbf4a68ab93184

- Bewertung: ungeklärt; Korrekturgruppe `CG.finance-tax-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `finance-tax-export`.
- Belege: supabase/functions/finance-tax-export/index.ts:64-96; supabase/functions/finance-tax-export/index.ts:106-109; supabase/functions/finance-tax-export/index.ts:248-254.
- Ursache/Prüfgrenze: Benutzeridentität und eine erlaubte Rolle werden geprüft. tenant_id stammt dennoch aus der Eingabe und filtert Service-Abfragen; bei fehlender ID entfällt der Filter. Ob die zugelassenen Steuer-/Finanzrollen bewusst globale Berechtigung besitzen, ist nicht belegt; vollständige Filing- und Datenbankabhängigkeiten bleiben offen.
- Geplante konkrete Änderung: Verbindliche globale beziehungsweise mandantenbezogene Steuerexportrechte festlegen und tenant_id daraus ableiten.
- Betriebsfolgen: Möglicher mandantenübergreifender Steuerdatenexport und Filing-Änderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_fa76ad0c8151f87b

- Bewertung: ungeklärt; Korrekturgruppe `CG.collect-send-dunning`; Abhängigkeiten A1, A2, A5.
- Funktionen: `collect-send-dunning`.
- Belege: supabase/functions/collect-send-dunning/index.ts:21-49.
- Ursache/Prüfgrenze: Identität und eine erlaubte Finanzrolle werden geprüft. Der Fall und seine Positionen werden danach nur über case_id mit Service-Rechten gelesen; ein Benutzer-/Mandantenfilter fehlt. Ob die zugelassenen Rollen fachlich globale Fallrechte besitzen und welche Empfängerübersteuerung erlaubt ist, bleibt offen.
- Geplante konkrete Änderung: Fallzugriff und Empfängerübersteuerung anhand eines verbindlichen Finanzberechtigungsmodells explizit prüfen; nachgelagerte Versandkette abschließen.
- Betriebsfolgen: Möglicher unberechtigter Mahnversand für fremde Fälle.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

