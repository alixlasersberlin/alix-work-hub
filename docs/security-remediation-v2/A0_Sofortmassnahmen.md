# A0 – Sofortmaßnahmen zur gesonderten Freigabe

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

## Priorisierte Bilanz

22 konkrete IDs aus A1–A8, keine zusätzlichen Befunde. Alle 22 besitzen bestätigte Quellcodelücken; nur finance-automations-engine wurde im verfügbaren Live-Protokoll mit POST/200 beobachtet (04:45:03.327 UTC). Der Zeitpunkt passt zum vorhandenen 15-Minuten-Job; Identität und Legitimität sind damit nicht bewiesen. Die übrigen 21 besitzen keinen aktuellen Live-Erreichbarkeitsnachweis. Keine produktiven Probeaufrufe, weil schon ein GET beziehungsweise leerer Request Passwortänderungen oder Finanz-/Versandwirkungen auslösen könnte.

Empfehlung: zuerst Kontoübernahme-/Quellschlüsselrisiken und nachweislich laufende Finanzautomation entscheiden, anschließend die weiteren Finanz- und Personenoffenlegungspfade. Kein pauschales Abschalten aller 102 Jobs, keine pauschale Schlüsselrotation. Temporäre Eindämmung ist keine dauerhafte Reparatur und schließt keinen Befund. Die breite Kandidatenmenge ist in der CSV markiert; eine Priorisierung ist keine Entwarnung für übrige IDs.

## Konkrete, noch nicht erteilte Freigaben

### A0-01: lov_finding_01b05992862b294b (A1)

- Funktionen: admin-reset-jerry.
- Gefahrenpotenzial: Kontoübernahme des fest hinterlegten Kontos.
- Beleg/Ursache: Der HTTP-Handler erzeugt ohne vorgelagerte Identitäts- oder Rollenprüfung einen Service-Client, sucht ein festes Konto und setzt dessen Passwort auf einen im Quelltext festgelegten Wert. Die Gateway-Quellkonfiguration deaktiviert zusätzlich die JWT-Prüfung. Ein legitimer externer Aufrufer wurde nicht gefunden; das schützt den direkten Handler nicht.
- Belegstellen: supabase/functions/admin-reset-jerry/index.ts:8-20; supabase/config.toml:52-53.
- Konkret zur Freigabe vorzulegen: Temporären Passwortreset nach Freigabe am Gateway sperren; betroffenen Kontozugang und Sitzungen separat bewerten, Passwort nur gezielt nach Freigabe ändern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Einmal-Reset-Handler entfernen beziehungsweise sperren; betroffenes Kennwort und Sitzungen kontrolliert erneuern; administrative Wiederherstellung ausschließlich über einen autorisierten, protokollierten Prozess.
- Isolierte Tests: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-02: lov_finding_09ffea0c64262705 (A1)

- Funktionen: tmp-create-sobitsch.
- Gefahrenpotenzial: Unberechtigte Kontoanlage; Manipulation von Provisionszuordnungen.
- Beleg/Ursache: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Kontoanlage sowie Profil- und Provisionsänderungen aus. Die explizite Gateway-Einstellung ist verify_jwt=false. Fest vorgegebene Zieldaten sind keine Autorisierung.
- Belegstellen: supabase/functions/tmp-create-sobitsch/index.ts:8-19; supabase/functions/tmp-create-sobitsch/index.ts:42-74.
- Konkret zur Freigabe vorzulegen: Temporäre Konto-/Provisionsprovisionierung nach Freigabe sperren; legitimen Onboardingprozess und Provisionsläufe zuerst bestimmen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Temporären Produktionsendpunkt entfernen beziehungsweise vollständig sperren; erforderliche Migration ausschließlich kontrolliert administrativ ausführen.
- Isolierte Tests: Deployment ohne erreichbaren temporären Endpunkt prüfen; bestehende Provisionszuordnungen schreibgeschützt auf Wiederholungseffekte untersuchen..
- Sicherer Wiederherstellungsplan: Endpunkt nicht reaktivieren; fachliche Datenkorrektur separat freigeben.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-03: lov_finding_9fcacb28cc4c5d46 (A6)

- Funktionen: product-hub-import, fetchSource.
- Gefahrenpotenzial: Abfluss eines serverseitigen Quellschlüssels; Serverseitige Requests an frei gewählte Ziele; Unberechtigter Importzugriff.
- Beleg/Ursache: endpoint beziehungsweise source_url wird ohne Aufruferprüfung aus dem Body übernommen und an fetchSource gegeben. fetchSource sendet den serverseitigen Quellschlüssel als x-api-key an genau diesen Endpunkt. Vor diesem Fetch ist keine controlled_modes-Sperre vorhanden.
- Belegstellen: supabase/functions/product-hub-import/index.ts:119-143.
- Konkret zur Freigabe vorzulegen: Quell-Fetch nach Freigabe auf genehmigte Ziele beschränken oder isolieren; Quelle und Schlüsselzuordnung prüfen, gezielte Rotation nur bei Verdacht und Freigabe.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Importberechtigung verlangen; Ziel-URL serverseitig festlegen beziehungsweise streng erlaubnislisten; Redirects zu nicht erlaubten Hosts verhindern; betroffenen Schlüssel nach Absicherung rotieren.
- Isolierte Tests: Fremden Host und hostwechselnden Redirect ohne echten Schlüssel oder Netzwerkaufruf ablehnen..
- Sicherer Wiederherstellungsplan: Importer deaktivieren; Schlüsselrotation nicht rückgängig machen; nur abgesicherten Zielhost freigeben.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-04: lov_finding_607c1e0633e683f5 (A3)

- Funktionen: finance-ch-dd-export.
- Gefahrenpotenzial: Offenlegung von Bank- und Mandatsdaten; Unberechtigte Exportstatusänderungen.
- Beleg/Ursache: Die einzige Authprüfung ist startsWith('Bearer '); der Token wird nicht validiert. run_id lädt Service-Role-seitig Lastschriftlauf und Mandate einschließlich IBAN, erzeugt XML und setzt Exportstatus ohne Rollen-, Aktivitäts- oder Mandantenprüfung.
- Belegstellen: supabase/functions/finance-ch-dd-export/index.ts:9-25; supabase/functions/finance-ch-dd-export/index.ts:40-47; supabase/functions/finance-ch-dd-export/index.ts:81-92.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Token verbindlich validieren; aktive Exportrolle und Laufmandant prüfen; Exportzustandsänderung atomar durchführen.
- Isolierte Tests: Geplant: beliebiger Bearertext, fremder Lauf und falsche Rolle negativ; autorisierter XML-Export positiv..
- Sicherer Wiederherstellungsplan: Export sperren; Exportstatus anhand Auditdaten korrigieren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-05: lov_finding_c5b0e3d6a8f2e774 (A3)

- Funktionen: finance-datev-export.
- Gefahrenpotenzial: Unberechtigter Zugriff auf Finanztransaktionen und Kundenzuordnungen.
- Beleg/Ursache: Der DATEV-Export akzeptiert jede Zeichenfolge mit Bearer-Präfix. Danach liest er Finanztransaktionen und Kundennamen per Service Role, begrenzt nur durch frei gewählten Zeitraum und Region; eine Benutzer-, Rollen- oder Mandantenprüfung fehlt.
- Belegstellen: supabase/functions/finance-datev-export/index.ts:19-43.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Benutzer authentifizieren, DATEV-Exportrecht verlangen und erlaubte Mandanten serverseitig filtern.
- Isolierte Tests: Beliebigen Bearer, fachfremde Rolle und fremden Mandanten vor Abfrage ablehnen..
- Sicherer Wiederherstellungsplan: DATEV-Export deaktivieren; bereits erzeugte Dateien überprüfen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-06: lov_finding_be09aadb01290773 (A3)

- Funktionen: finance-sepa-export.
- Gefahrenpotenzial: Offenlegung fremder Lastschriftdaten; Unberechtigte Exportstatusänderung.
- Beleg/Ursache: getUser validiert den Login. Der nachfolgende separate Adminclient lädt jedoch beliebige finance_sepa_runs und Laufpositionen nach runId ohne aktive Finanzrolle oder Mandantenzuordnung und setzt anschließend Exportstatus.
- Belegstellen: supabase/functions/finance-sepa-export/index.ts:8-28; supabase/functions/finance-sepa-export/index.ts:95-101.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Aktive Lastschriftexportrolle und Zugriff auf Laufmandant vor Mandatsread und Export erzwingen.
- Isolierte Tests: Geplant: gewöhnlicher Login, deaktivierte Finanzrolle und fremder Lauf negativ; erlaubter Export positiv..
- Sicherer Wiederherstellungsplan: Export sperren; Status anhand Exporthistorie korrigieren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-07: lov_finding_c1970a6abcb44913 (A3)

- Funktionen: finance-bank-import.
- Gefahrenpotenzial: Unberechtigter Zugriff auf Bankimportmetadaten; Ungeschützter privilegierter Importpfad.
- Beleg/Ursache: finance-bank-import verifiziert keinen Benutzer, sondern nur das Bearer-Präfix. Bereits die Suche nach vorhandenem file_hash und die Rückgabe von statement_id und Zählern erfolgen mit Service Role ohne Konto- oder Mandantenberechtigung.
- Belegstellen: supabase/functions/finance-bank-import/index.ts:31-52.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Verifizierte Importidentität, Finanzrolle und Berechtigung auf Bankkonto und Mandant vor Deduplizierung und Speicherung prüfen.
- Isolierte Tests: Beliebigen Bearer vor Hashsuche ablehnen; fremden Kontomandanten ablehnen..
- Sicherer Wiederherstellungsplan: Bankimport sperren; betroffene Importsätze und Zuordnungen fachlich abgleichen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-08: lov_finding_9260563e406937fe (A3)

- Funktionen: finance-camt054-import.
- Gefahrenpotenzial: Unberechtigter Bankdatenimport; Unberechtigter Zugriff auf Importmetadaten.
- Beleg/Ursache: Die einzige Aufruferprüfung ist startsWith('Bearer '). Der Token wird nicht verifiziert. Danach werden mit Service Role vorhandene Notifications gelesen und neue Bankmeldungen einschließlich raw_xml gespeichert.
- Belegstellen: supabase/functions/finance-camt054-import/index.ts:21-57.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Token verifizieren, Bankimportrolle und Kontomandant prüfen; beliebige Bearer-Zeichenfolgen ablehnen.
- Isolierte Tests: Beliebigen Bearer und fachfremden Benutzer vor Datenzugriff ablehnen..
- Sicherer Wiederherstellungsplan: Import sperren; eingefügte Notifications und abhängige Zuordnungen abgleichen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-09: lov_finding_22d2f74a8a4d2421 (A3)

- Funktionen: bank-api-fetch.
- Gefahrenpotenzial: Unberechtigte Bankimporte; Speicher- und Providerbelastung.
- Beleg/Ursache: Der Endpoint liest Bankverbindungen und startet deren Import ohne Aufruferprüfung; connectionId ist nur ein Zielauswahlfilter. Aktivierte Verbindung und vorhandener Provider-Token sind Betriebsvoraussetzungen, keine Autorisierung.
- Belegstellen: supabase/functions/bank-api-fetch/index.ts:31-52; supabase/functions/bank-api-fetch/index.ts:66-82; supabase/config.toml:429-430.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Maschinencredential oder aktive Bankimportrolle erzwingen; Verbindungen an erlaubten Mandanten binden.
- Isolierte Tests: Geplant: anonym, falsche Rolle und fremde Verbindung ohne Provideraufruf; autorisierten Import prüfen..
- Sicherer Wiederherstellungsplan: Importverbindungen deaktivieren; neu erzeugte Importobjekte anhand des Laufprotokolls isolieren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-10: lov_finding_94ff829ba690f3f3 (A3)

- Funktionen: bank-auto-reconcile.
- Gefahrenpotenzial: Manipulierte Zahlungszuordnungen; Veränderte Finanzsalden; Mandantenübergreifender Abgleich.
- Beleg/Ursache: Der Handler beginnt ohne Aufruferprüfung mit privilegierten Bank- und Rechnungsreads. Er ersetzt Vorschläge, aktualisiert Matchscores und kann Zuweisungen sowie Rechnungs- und Banktransaktionsstände verändern. verify_jwt ist false.
- Belegstellen: supabase/functions/bank-auto-reconcile/index.ts:75-103; supabase/functions/bank-auto-reconcile/index.ts:134-181; supabase/config.toml:423-424.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Maschinencredential oder aktive Bankabgleichrolle verlangen; Buchungskreis serverseitig begrenzen und automatische Buchungen gesondert freigeben.
- Isolierte Tests: Geplant: anonym und fremder Buchungskreis ohne Änderung; Vorschau ohne Writes; autorisierter Abgleich positiv..
- Sicherer Wiederherstellungsplan: Abgleich sperren; Zuweisungen und Salden transaktionsbezogen aus Auditdaten rückführen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-11: lov_finding_4c7152ec5de2c1bc (A3)

- Funktionen: cmr-bank-automatch.
- Gefahrenpotenzial: Unberechtigte Zahlungsanlage; Verfälschte Bankzuordnungen.
- Beleg/Ursache: Bankzeilen und Dokumente werden ohne Handler-Authentifizierung privilegiert geladen und abgeglichen. Ein übergebener tenantId-Filter ist keine verifizierte Mandantenzugehörigkeit.
- Belegstellen: supabase/functions/cmr-bank-automatch/index.ts:11-24; supabase/functions/cmr-bank-automatch/index.ts:55-67; src/pages/CMR/Buchhaltung.tsx:235.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Aktive Buchhaltungsberechtigung mit serverseitig verifiziertem Mandantenscope vor Matching und Zahlungsanlage verlangen.
- Isolierte Tests: Fremden oder fehlenden Mandantenscope ohne Zahlungs- und Bankzeilenmutation ablehnen..
- Sicherer Wiederherstellungsplan: Automatching sperren; Zuordnungen nur kontrolliert fachlich rückabwickeln.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-12: lov_finding_1aac574b83b92e0b (A3)

- Funktionen: cmr-recurring-run.
- Gefahrenpotenzial: Unberechtigte Rechnungsanlage; Mandantenübergreifender Mailversand.
- Beleg/Ursache: Der Handler prüft keinen Aufrufer. tenantId ist optional und stammt aus dem Request; ohne Wert werden aktive wiederkehrende Pläne mandantenübergreifend verarbeitet, Vorankündigungen versendet und Rechnungsdokumente angelegt.
- Belegstellen: supabase/functions/cmr-recurring-run/index.ts:25-58; supabase/functions/cmr-recurring-run/index.ts:87-107; supabase/functions/cmr-recurring-run/index.ts:120-173.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Globalen Lauf ausschließlich maschinell authentifizieren; interaktive Läufe auf aktive Finanzrolle und serverseitigen Mandantenscope begrenzen.
- Isolierte Tests: Geplant: anonymer und fremdmandantiger Lauf negativ; autorisierter Job und Wiederholungsfestigkeit positiv..
- Sicherer Wiederherstellungsplan: Job stoppen; erzeugte Dokumente fachlich stornieren statt unkontrolliert löschen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-13: lov_finding_8973eaa4d23c2465 (A3)

- Funktionen: cmr-collective-run.
- Gefahrenpotenzial: Unberechtigte Rechnungserzeugung; Veränderung von Zeiteinträgen und Planausführung.
- Beleg/Ursache: Der Handler verarbeitet Sammelpläne und Zeiteinträge ohne eigene Aufruferautorisierung und erzeugt privilegiert Rechnungen. Callergewählte Plan- oder Mandantenfilter begründen keine Zugriffsberechtigung.
- Belegstellen: supabase/functions/cmr-collective-run/index.ts:21-48; supabase/functions/cmr-collective-run/index.ts:94-116; src/pages/CMR/Sammelrechnungen.tsx:110.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Verifizierte Job-Berechtigung oder aktive mandantengebundene Fakturierungsberechtigung vor Verarbeitung verlangen.
- Isolierte Tests: Fremden Plan und Mandanten ohne Dokumentnummernvergabe oder Rechnungsanlage ablehnen..
- Sicherer Wiederherstellungsplan: Sammellauf pausieren; Rechnungen nur fachlich kontrolliert stornieren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-14: lov_finding_29b6057cf3486198 (A3)

- Funktionen: bank-return-dunning-escalate.
- Gefahrenpotenzial: Erzwungene Mahnläufe; Umgehung des Abschaltschalters; Kundenbelästigung.
- Beleg/Ursache: Keine Aufruferprüfung vor dem globalen Rücklastschriftlauf. Besonders relevant: body.force setzt cfg.enabled auf true und umgeht damit eine konfigurierte Deaktivierung. Danach werden fällige Mahnfälle privilegiert verarbeitet.
- Belegstellen: supabase/functions/bank-return-dunning-escalate/index.ts:46-80; supabase/config.toml:426-427.
- Konkret zur Freigabe vorzulegen: Nach Freigabe externen Auslösepfad begrenzen; berechtigte Cron-/Maschinenaufrufer inventarisieren und Wiederholungs-/Buchungseffekte verhindern.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Maschinenauthentifizierung verlangen; force separat auf aktive privilegierte Finanzrolle begrenzen; mandantenbezogene Verarbeitung erzwingen.
- Isolierte Tests: Geplant: anonymes force und dryRun negativ; deaktivierte Konfiguration bleibt gesperrt; autorisierten Lauf prüfen..
- Sicherer Wiederherstellungsplan: Endpoint und Scheduler sperren; Mahnstände aus Laufhistorie fachlich korrigieren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-15: lov_finding_43bb2ddd0aab0e94 (A7)

- Funktionen: ac-knowledge-rag.
- Gefahrenpotenzial: Offenlegung privater Kommunikation und Dokumentinhalte; Unberechtigte KI-Verarbeitung.
- Beleg/Ursache: Die Suche liest ohne Aufruferprüfung mit privilegiertem Client Nachrichten, Tickets und Dokumentzusammenfassungen. Quellen werden in der Antwort zurückgegeben; verify_jwt=false ist explizit konfiguriert.
- Belegstellen: supabase/functions/ac-knowledge-rag/index.ts:9-21; supabase/functions/ac-knowledge-rag/index.ts:60; src/pages/AlixConnect/KnowledgeRag.tsx:19.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Aktive Suchberechtigung erzwingen und jede Quelle mit Benutzer-/Mandantenrechten filtern; RLS-fähigen Benutzerclient verwenden.
- Isolierte Tests: Anonyme Suche und fremde Quellen ausschließen; Berechtigung für jede Quellenart separat prüfen..
- Sicherer Wiederherstellungsplan: RAG-Suche sperren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-16: lov_finding_108fb37fdfeda925 (A7)

- Funktionen: ac-customer-intel.
- Gefahrenpotenzial: Unberechtigte Verarbeitung privater Kundenkommunikation; KI-Kosten; Unberechtigte Vorhersagen.
- Beleg/Ursache: Beliebige contact_id führt ohne Authentifizierung zu Service-Role-Lesezugriffen auf Kontakt, Nachrichten und Anrufe. Die Daten werden an die KI weitergegeben und Vorhersagen gespeichert; verify_jwt ist explizit false.
- Belegstellen: supabase/functions/ac-customer-intel/index.ts:10-32; supabase/functions/ac-customer-intel/index.ts:46-65; supabase/config.toml:331-332.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Aktive berechtigte Mitarbeiteridentität und kontaktbezogene Mandantenfreigabe vor allen Reads und KI-Aufrufen erzwingen.
- Isolierte Tests: Geplant: fremde Kontakt-ID und deaktiviertes Konto ohne Daten- oder KI-Zugriff; erlaubten Kontakt prüfen..
- Sicherer Wiederherstellungsplan: KI-Endpunkt deaktivieren; erzeugte Vorhersagen gezielt kennzeichnen oder entfernen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-17: lov_finding_df054ee0d6a3c45f (A7)

- Funktionen: ac-voicemail-transcribe.
- Gefahrenpotenzial: Offenlegung fremder Voicemails; Unberechtigte externe Audioverarbeitung und Kosten.
- Beleg/Ursache: call_id steuert ohne Handler-Berechtigungsprüfung den privilegierten Zugriff auf die Voicemail-URL, Audioabruf, Transkription und Rückgabe des Texts.
- Belegstellen: supabase/functions/ac-voicemail-transcribe/index.ts:5-20; supabase/functions/ac-voicemail-transcribe/index.ts:32-52; src/pages/AlixConnect/Telephony.tsx:220.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Aktive anrufbezogene Hör- und Transkriptionsberechtigung vor Metadaten-, Audio- und KI-Zugriff verlangen.
- Isolierte Tests: Fremden Anruf ohne Audioabruf, Statusupdate oder Transkriptionsaufruf abweisen..
- Sicherer Wiederherstellungsplan: Voicemail-Transkription sperren.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-18: lov_finding_43edd4e59b516cae (A7)

- Funktionen: ac-agent-assist-live.
- Gefahrenpotenzial: Verarbeitung fremder Chatnachrichten; KI-Kosten; Fremde Vorschlagseinträge.
- Beleg/Ursache: conversation_id wird ohne Identitätsprüfung angenommen. Konversation und letzte Nachrichten werden privilegiert geladen und an die KI gegeben. agent_user_id ist ebenfalls frei vorgebbar und steuert das Speichern von Vorschlägen.
- Belegstellen: supabase/functions/ac-agent-assist-live/index.ts:11-24; supabase/functions/ac-agent-assist-live/index.ts:36-66.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Konversationszugriff und Agentenrolle prüfen; agent_user_id aus der verifizierten Identität ableiten.
- Isolierte Tests: Anonyme und fremde Konversation ablehnen; Identitäts-Spoofing über agent_user_id verhindern..
- Sicherer Wiederherstellungsplan: Assistenzendpunkt sperren; fremd erzeugte Vorschläge überprüfen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-19: lov_finding_6eb5a3fe59d356e3 (A4)

- Funktionen: alixdocs-attach-from-storage.
- Gefahrenpotenzial: Unberechtigter Zugriff auf fremde Storage-Dateien.
- Beleg/Ursache: Der Benutzerzweig prüft nur getUser. Frei übergebene source_bucket und source_path werden anschließend über den Service-Storageclient geladen, ohne den Dateizugriff des Benutzers mit dessen Identität zu prüfen. Die alternative interne Schlüsselprüfung schränkt diesen Benutzerzweig nicht ein.
- Belegstellen: supabase/functions/alixdocs-attach-from-storage/index.ts:34-46; supabase/functions/alixdocs-attach-from-storage/index.ts:60-65; src/components/alixdocs/AttachToOrderDialog.tsx:79.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Quelldatei unter Benutzeridentität lesen oder den Zugriff serverseitig objektspezifisch prüfen; Buckets begrenzen und Zielobjekt separat autorisieren.
- Isolierte Tests: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-20: lov_finding_74e43b7ec94e2367_821fd4e7 (A4)

- Funktionen: alixdocs-customer-export, getTenantScope, customerInScope.
- Gefahrenpotenzial: Komplettexport fremder Kundendokumente durch Benutzer ohne Zuweisung.
- Beleg/Ursache: Eine Kunden-Scope-Prüfung existiert tatsächlich vor dem Dokumentdownload. Sie ist jedoch für Benutzer ohne Mandantenzuweisung wirkungslos: getTenantScope setzt restricted=false, und customerInScope gibt dann sofort true zurück. Anschließend werden sämtliche Kundendokumente privilegiert exportiert.
- Belegstellen: supabase/functions/alixdocs-customer-export/index.ts:25-56; supabase/functions/_shared/tenant-scope.ts:55-75; supabase/functions/_shared/tenant-scope.ts:96-103.
- Konkret zur Freigabe vorzulegen: Nach Freigabe nur den betroffenen Lese-/Exportpfad isolieren; berechtigte Nutzer, Portal- und interne Aufrufer vorab erfassen.
- Aufrufer-/Betriebsabhängigkeiten: UI, interne Functions, DB-Trigger, alle zugehörigen Zeitpläne und Provider vor Sperrung zuordnen; legitime Aufrufer separat authentifizieren. Kein pauschales JWT-Erfordernis für Providercallbacks.
- Dauerhafte Korrektur: Scope ohne Zuweisung schließen und eigenständige Kundenexportberechtigung verlangen.
- Isolierte Tests: Benutzer ohne Zuweisung darf keine fremden Kunden exportieren; zugewiesene Benutzer nur ihren Scope..
- Sicherer Wiederherstellungsplan: Kundenexport sperren; erzeugte Downloadartefakte widerrufen, soweit vorhanden.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

### A0-21: lov_finding_8d76058b0444465c (A3)

- Funktionen: finance-automations-engine.
- Gefahrenpotenzial: Unberechtigte Finanzautomationen; Manipulation von Rechnungszuständen.
- Beleg/Ursache: Finanzregeln und Belege werden ohne Handler-Authentifizierung privilegiert gelesen und verarbeitet; Ausführungsprotokolle und Belegänderungen sind erreichbar.
- Belegstellen: supabase/functions/finance-automations-engine/index.ts:10-36; supabase/functions/finance-automations-engine/index.ts:84-97; supabase/functions/finance-automations-engine/index.ts:126; src/pages/Finance/Automations.tsx:88.
- Konkret zur Freigabe vorzulegen: Vor jedem Regelabruf vorhandene private Maschinenidentität oder aktive erlaubte Finanzrolle prüfen; Cron-Auftrag 33 (*/15) unverändert erhalten und dessen bestehende Authentisierung zuerst zuordnen. Keine Regeln/Belege ausführen oder verändern.
- Aufrufer-/Betriebsabhängigkeiten: finance-automations-engine: UI Finance/Automations.tsx:88 und aktiver Job 33; alix-sign-resend: kein direkter UI-Aufruf in gezielter Suche nachgewiesen, geschützten admin-resend-sign nicht pauschal blockieren. Weitere Datenbank-/Provider-Aufrufer vor Umsetzung zuordnen.
- Dauerhafte Korrektur: Verifizierte Jobs oder aktive Finanzautomationsberechtigung mit Mandantenscope vor Regelladen verlangen.
- Isolierte Tests: Unberechtigte Ausführung ohne Regelabfrage, Belegupdate und Run-Eintrag abweisen..
- Sicherer Wiederherstellungsplan: Automationsengine pausieren.
- Aktuelle Erreichbarkeit: POST/200 im Liveprotokoll beobachtet; keine Identitätsbestätigung.

### A0-22: lov_finding_016dbf8483032e9a (A4)

- Funktionen: alix-sign-resend.
- Gefahrenpotenzial: Offenlegung signierter Unterlagen; Unberechtigter E-Mail-Versand; Storage- und Audit-Schreibzugriffe.
- Beleg/Ursache: Der Handler liest signature_id ohne Identitätsprüfung mit Service Role. Die verknüpfte Signaturanfrage wird ebenfalls privilegiert geladen. body.email überschreibt den Empfänger; die Antwort enthält zusätzlich download_url. Damit ist nicht nur erneuter Versand an den ursprünglichen Kunden möglich.
- Belegstellen: supabase/functions/alix-sign-resend/index.ts:19-44; supabase/functions/alix-sign-resend/index.ts:73-80; supabase/functions/alix-sign-resend/index.ts:110-128.
- Konkret zur Freigabe vorzulegen: Vor privilegiertem Zugriff Signatur-/Auftragsberechtigung mit aktiver Identität und Mandantenzuweisung verlangen; Empfängerübersteuerung getrennt berechtigen. Bei ungeklärten Aufrufern nur diesen Altversand nach Freigabe vorübergehend mit ablehnendem Handler sperren; keine Nachricht versenden.
- Aufrufer-/Betriebsabhängigkeiten: finance-automations-engine: UI Finance/Automations.tsx:88 und aktiver Job 33; alix-sign-resend: kein direkter UI-Aufruf in gezielter Suche nachgewiesen, geschützten admin-resend-sign nicht pauschal blockieren. Weitere Datenbank-/Provider-Aufrufer vor Umsetzung zuordnen.
- Dauerhafte Korrektur: Identität und Berechtigung auf die konkrete Signaturanfrage vor jedem privilegierten Zugriff prüfen; Empfänger aus autorisierten Stammdaten ableiten und Overrides gesondert berechtigen.
- Isolierte Tests: Anonymen Zugriff und fremde signature_id ablehnen; berechtigten Versand erlauben; fremden Empfänger ablehnen..
- Sicherer Wiederherstellungsplan: Bei Regression Versand deaktivieren; fehlende Objektprüfung nicht wieder freigeben.
- Aktuelle Erreichbarkeit: nicht aktuell live nachgewiesen; nur Quellcodeprüfung.

## Zugangsdatenverdacht – separat freizugeben

Ein fest im temporären Passwortreset hinterlegter Zugangswert gilt als exponiert im Quellbestand, nicht als hier nachgewiesen missbraucht. Keine Werte oder Ziel-E-Mail in diesem Bericht. Nach Freigabe zuerst diesen Resetpfad eng sperren, dann exakt betroffenes Konto über den bestehenden geschützten Prozess zurücksetzen und Sitzungen widerrufen; nicht den gesamten Benutzerbestand sperren.

Beim Product-Hub-Import ist ein möglicher Quellschlüsselabfluss über frei vorgegebenes Fetch-Ziel belegt. Ob tatsächlich ein fremdes Ziel mit Schlüssel aufgerufen wurde, bleibt mangels vollständiger Egress-/Providerlogs offen. Vor möglicher gezielter Rotation den Fetch-Pfad sichern, vorhandene Quelle/Keyzuordnung und Empfänger festlegen; DE/COM-Notify-/Status-Secrets nicht pauschal anfassen. Eine Rotation braucht eine zusätzliche ausdrückliche Freigabe und koordinierten Aufruferwechsel.

## Freigabevorlage

Super Admin benennt die gewünschten A0-Nummern und genauen Befund-IDs sowie Maßnahmenumfang (Eindämmung oder dauerhafte Reparatur), bestätigt Aufrufermatrix und unabhängige Wiederherstellungsnachweise, freigegebene Ausgangsrevision und Testplan. Diese Markdown-Datei erzeugt keine Freigabe in der Anwendung und führt keine Aktion aus. Nicht sicher abnehmbare Wege bleiben gesperrt, niemals unsichere Rechte zurückrollen.
