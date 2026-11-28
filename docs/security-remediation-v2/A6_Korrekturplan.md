# A6 – Product Hub und Produktkatalog

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 17; bestätigt kritisch 12; ungeklärt 5; Fehlkonfigurationen 0; Doppelmeldungen 0; im Code geschützt 0.

Abhängigkeiten: A1, A2, A5, A8.

Import-/Validierungs-/Übersetzungsberechtigung vor Source-Fetch oder Änderung, genehmigte feste Hosts für Schlüsseltragende Requests. Bestehende Bundle-Verträge v1.2/v1.3, Pilotgrenzen, Kanalfreigaben, Notstopp und Release-Proofs erhalten. Tests mit synthetischem Katalog; keine Änderung der 44 Produkte. Keine erfolgreiche technische Prüfung als Betriebsfreigabe umdeuten.

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

### lov_finding_1794cebaf2967832

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.plm-changes-qm-approval-fields`; Abhängigkeiten A1, A2, A5.
- Funktionen: `public.plm_can_write`, `public.plm_changes`, `public.plm_touch_updated_at`.
- Belege: supabase/migrations/20260806155709_88726754-0a4b-4848-b094-20020221ff74.sql:2-11; supabase/migrations/20260806155709_88726754-0a4b-4848-b094-20020221ff74.sql:338-369.
- Ursache/Prüfgrenze: plm_can_write erlaubt Produktion ausdrücklich. Die UPDATE-Policy schützt nur die Zeile über denselben breiten Helfer, nicht QM-Felder. qm_approved_by und qm_approved_at liegen in derselben Tabelle; der vorhandene Update-Trigger aktualisiert lediglich den Zeitstempel.
- Geplante konkrete Änderung: QM-Freigaben über atomare rollenbeschränkte Operation mit aktivem QM-Konto und Vieraugenprüfung führen; direkte Änderungen geschützter Felder verhindern.
- Betriebsfolgen: Umgehung der QM-Freigabe; Verlust der Funktionstrennung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Produktion darf Fachfelder, aber keine QM-Felder ändern; Selbstfreigabe negativ; unabhängige QM-Freigabe positiv..
- Sicherer Wiederherstellungsplan: QM-Änderungen sperren; Freigabestatus aus revisionssicherer Historie rekonstruieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_55eebf6531b0d797

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.catalog-import-firecrawl`; Abhängigkeiten A1, A2, A5.
- Funktionen: `catalog-import-firecrawl`.
- Belege: supabase/functions/catalog-import-firecrawl/index.ts:9-38; supabase/functions/catalog-import-firecrawl/index.ts:58-82.
- Ursache/Prüfgrenze: Requestparameter steuern Mapping und Scraping ohne Aufruferprüfung. Scrapeergebnisse werden anhand SKU in catalog_items eingefügt oder aktualisiert; Importjobs und Quellenstatus werden privilegiert verändert.
- Geplante konkrete Änderung: Aktive Katalogimportrolle verlangen; Quellen erlaubnislistenbasiert beschränken, Vorschau von Freigabe trennen und Schreibscope prüfen.
- Betriebsfolgen: Katalogmanipulation; Scrapingkosten; Unberechtigte Produktimporte.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, unerlaubte Quelle und fremder Katalog negativ; freigegebener Import positiv..
- Sicherer Wiederherstellungsplan: Import deaktivieren; betroffene SKU-Versionen aus Vorbestand wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_6bdc45abf053d23e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.product-hub-import.catalog-import-dispatch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `product-hub-import`.
- Belege: supabase/functions/product-hub-import/index.ts:129-145; supabase/functions/product-hub-import/index.ts:178-230; supabase/functions/product-hub-import/index.ts:263-347.
- Ursache/Prüfgrenze: Der Importhandler prüft keinen Aufrufer. Er verarbeitet Request-/Quelldaten privilegiert und erstellt oder aktualisiert ph_products samt Kanal-, Medien- und Dokumentdaten. body.user_id dient als Attribution, nicht als verifizierte Identität.
- Geplante konkrete Änderung: Aktive Product-Hub-Importrolle und geprüfte Quelle erzwingen; importedBy aus verifizierter Identität ableiten; Vorschau und Schreibfreigabe trennen.
- Betriebsfolgen: Unberechtigte Produktanlage und -änderung; Manipulierte Herkunftszuordnung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, gefälschte user_id und unzulässige Quelle negativ; erlaubter Import mit korrekter Attribution positiv..
- Sicherer Wiederherstellungsplan: Import sperren; Produkte und Kinddaten anhand Importlauf und Vorversionen zurücksetzen.
- Doppelmeldungsreferenz: keine.

### lov_finding_cd621b68583af549

- Bewertung: ungeklärt; Korrekturgruppe `CG.ph-com-lang-push`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `ph-com-lang-push`, `pushOne`.
- Belege: supabase/functions/ph-com-lang-push/index.ts:134-152; supabase/functions/ph-com-lang-push/index.ts:51-72; supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:4.
- Ursache/Prüfgrenze: Vor Requestverarbeitung und Versand prüft der Handler ph2_activation: bei Lesefehler oder controlled_modes === true wird abgebrochen. Die Migration initialisiert kontrollierte Modi. Dauerhafte Aufrufer-, Aktivitäts- und Rollenautorisierung fehlt weiterhin; bei fehlender oder aufgehobener Modussperre wäre der alte Versandpfad zugänglich. Aktuelle externe Ausführung wird nicht behauptet.
- Geplante konkrete Änderung: controlled_modes-Sperre beibehalten; zusätzlich dauerhafte aktive Product-Hub-Publikationsrolle oder enges Maschinencredential und Freigabeprüfung einbauen.
- Betriebsfolgen: Latenter unberechtigter externer Produktcontent-Push; Freigaberisiko bei Moduswechsel.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: controlled_modes true ohne externe Calls; fehlende Konfiguration fail-closed; deaktivierte Sperre darf Auth nicht umgehen..
- Sicherer Wiederherstellungsplan: controlled_modes und Notstopp aktiviert halten; Legacyversand nicht freischalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_dee2f25deaa8bfd7

- Bewertung: ungeklärt; Korrekturgruppe `CG.ph-com-registry-push`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `ph-com-registry-push`, `discover`, `call`.
- Belege: supabase/functions/ph-com-registry-push/index.ts:49-57; supabase/functions/ph-com-registry-push/index.ts:146-174; supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:4.
- Ursache/Prüfgrenze: Der Handler bricht bei controlled_modes === true oder Konfigurationslesefehler vor Bodyverarbeitung und externen Registryoperationen ab. Eine dauerhafte Aufruferautorisierung fehlt. Nach Aufhebung der Sperre steuern endpoint/method den Discoverypfad bis zu Dryrun und Registrierung. Die aktuelle Sperre ist kein dauerhafter Authfix.
- Geplante konkrete Änderung: Legacy-Modussperre erhalten; aktive Publikationsrolle oder dediziertes Maschinencredential erzwingen und API-Pfade/-Methoden strikt erlaubnislistenbasiert beschränken.
- Betriebsfolgen: Latenter Missbrauch des serverseitigen COM-Credentials; Unberechtigte externe Registryoperationen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: kontrollierter Modus ohne externe Calls; fehlende Settings fail-closed; unberechtigter Request auch bei freigegebenem Modus negativ..
- Sicherer Wiederherstellungsplan: controlled_modes und Notstopp beibehalten; Legacyregistry nicht freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_10fba61adf821212

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ph-en-batch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ph-en-batch`, `runBatch`, `requalify`.
- Belege: supabase/functions/ph-en-batch/index.ts:130-148; supabase/functions/ph-en-batch/index.ts:178-182; supabase/functions/ph-en-batch/index.ts:195-216.
- Ursache/Prüfgrenze: Der Handler startet Übersetzungs- und Requalifizierungsläufe ohne Aufruferberechtigung. overwrite beeinflusst bestehende Übersetzungen; Service-Role-Upserts sind erreichbar. ai_draft verhindert die unberechtigte Änderung gespeicherter Inhalte nicht. Keine controlled_modes-Voroperationssperre vorhanden.
- Geplante konkrete Änderung: Aktive Product-Hub-Bearbeitungsberechtigung beziehungsweise verifizierten Batch-Aufrufer vor Datenzugriff verlangen; Überschreiben separat berechtigen.
- Betriebsfolgen: Manipulation von Produktübersetzungen und Qualitätsständen; Unberechtigte KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte Batch-, overwrite-, Requalifizierungs- und Hintergrundaufrufe ohne Upsert und KI-Aufruf ablehnen..
- Sicherer Wiederherstellungsplan: Batchfunktion sperren; Übersetzungen nur aus geprüfter Historie wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_47008b040e014166_817a2c19

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.catalog-share-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `catalog-share-send`.
- Belege: supabase/functions/catalog-share-send/index.ts:63-95; supabase/functions/catalog-share-send/index.ts:115-149; src/pages/Katalog/Versand.tsx:146.
- Ursache/Prüfgrenze: Nach gültiger Anmeldung lädt der Admin-Client den gewählten Freigabelink ohne Besitzer- oder Mandantenabgleich. Ablauf und Widerruf werden geprüft, nicht die Versandberechtigung des Aufrufers.
- Geplante konkrete Änderung: Aktive Freigabe- und Versandberechtigung für link_id vor dem privilegierten Laden prüfen.
- Betriebsfolgen: Unberechtigter E-Mail-, SMS- oder WhatsApp-Versand; Manipulation von Kommunikationsprotokollen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden gültigen Link und inaktiven Benutzer ohne Kanalaufruf ablehnen..
- Sicherer Wiederherstellungsplan: Freigabelink-Versand sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_60a9985b359fcaaf

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.catalog-import-airtable`; Abhängigkeiten A1, A2, A5.
- Funktionen: `catalog-import-airtable`.
- Belege: supabase/functions/catalog-import-airtable/index.ts:11-43; src/pages/Katalog/ImportManaged.tsx:54.
- Ursache/Prüfgrenze: Der Handler besitzt keine eigene Aufruferprüfung vor dem Zugriff auf die verbundene Airtable-Integration. list_bases, Tabellen- und Datensatzaktionen liefern angebundene Daten zurück. Eine mögliche Gateway-JWT-Prüfung stellt keine Integrationsberechtigung her.
- Geplante konkrete Änderung: Aktive Integrations- und Katalogberechtigung vor jedem Aktionszweig erzwingen; Zugriff auf erlaubte Datenquellen begrenzen.
- Betriebsfolgen: Unberechtigtes Lesen verbundener Airtable-Daten.
- Geplante Regressionstests, noch nicht ausgeführt: Alle Leseaktionen ohne Integrationsberechtigung ohne externen Aufruf ablehnen..
- Sicherer Wiederherstellungsplan: Airtable-Endpunkt sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_7596267ca3ddaaea

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.product-hub-import.catalog-import-dispatch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `product-hub-import`.
- Belege: supabase/functions/product-hub-import/index.ts:1-11; supabase/functions/product-hub-import/index.ts:314-347; supabase/functions/product-hub-import/index.ts:358-377.
- Ursache/Prüfgrenze: Der Importhandler besitzt keine ausreichende Aufruferautorisierung für privilegierte Product-Hub-Lese- und Schreiboperationen. Additives Importieren und Dublettenprüfung sind keine Zugriffskontrolle. Eine controlled_modes-Sperre der anderen Push-Handler schützt diesen Import nicht.
- Geplante konkrete Änderung: Aktive Product-Hub-Importberechtigung vor Vorschau, Quellzugriff und Import verlangen; Quellen und importierten Scope serverseitig begrenzen.
- Betriebsfolgen: Unberechtigter Katalogzugriff; Unberechtigte Produkt-, Medien- und Dokumentänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: test, preview und import ohne passende Berechtigung vor Quellen- und Datenzugriff ablehnen; kontrollierte Modi separat prüfen..
- Sicherer Wiederherstellungsplan: Importendpunkt sperren; Importe nur anhand geprüfter Historie rückabwickeln.
- Doppelmeldungsreferenz: keine.

### lov_finding_db88ec831c2a1cc7

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.katalogpdftemplates`; Abhängigkeiten A1, A2, A5.
- Funktionen: `KatalogPdfTemplates`, `save`, `HTML-Vorschau`.
- Belege: src/pages/Katalog/PdfTemplates.tsx:27-32; src/pages/Katalog/PdfTemplates.tsx:43-52; src/pages/Katalog/PdfTemplates.tsx:153; supabase/migrations/20260715014026_f7187fd4-af74-4729-b2e6-0d6020a10724.sql:84-85.
- Ursache/Prüfgrenze: Gespeicherte HTML-Felder werden unverändert mit dangerouslySetInnerHTML in die Anwendung eingebettet. Die Katalogrolle darf Templates schreiben. Damit besteht ein gespeicherter XSS-Pfad über aktive HTML-Inhalte; eine erfolgreiche Browserausführung wurde nicht live getestet.
- Geplante konkrete Änderung: HTML vor DOM-Einbettung mit geeigneter Allowlist sanitieren oder Vorschau in strikt isoliertem Sandbox-Kontext rendern; alle weiteren Template-Sinks prüfen.
- Betriebsfolgen: Gespeicherte Skriptausführung im Anwendungskontext; Aktionen mit den Rechten betrachtender Mitarbeiter.
- Geplante Regressionstests, noch nicht ausgeführt: Ereignisattribute, SVG-/URL-basierte aktive Inhalte und ungefährliche Formatierung in isolierten Renderingtests prüfen..
- Sicherer Wiederherstellungsplan: HTML-Vorschau deaktivieren oder als Text anzeigen; keine Rückkehr zu unsanitiertem DOM-HTML.
- Doppelmeldungsreferenz: keine.

### lov_finding_f4bd1fd6bf1a9511

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.catalog-import-airtable`; Abhängigkeiten A1, A2, A5.
- Funktionen: `catalog-import-airtable`.
- Belege: supabase/functions/catalog-import-airtable/index.ts:11-12; supabase/functions/catalog-import-airtable/index.ts:50-79; supabase/functions/catalog-import-airtable/index.ts:96-104.
- Ursache/Prüfgrenze: Neben den ungeschützten Airtable-Leseaktionen besitzt der Import einen eigenständigen privilegierten Schreibpfad: callerbeeinflusste Produktdaten werden anhand SKU auf vorhandene catalog_items angewendet. Die Datenlese- und Schreibwirkungen werden deshalb nicht ungeprüft zusammengelegt.
- Geplante konkrete Änderung: Aktive Katalogimportberechtigung, erlaubte Quelle und Änderungsumfang vor Jobanlage und Produkt-Upsert prüfen.
- Betriebsfolgen: Unberechtigte Änderung vorhandener Katalogprodukte; Unberechtigte Medien- und Importjobänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Bekannte fremde SKU und unberechtigte Quelle ohne Jobanlage, Produktupdate und Medienupload abweisen..
- Sicherer Wiederherstellungsplan: Schreibenden Import sperren; Änderungen anhand Importhistorie kontrolliert korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_040f79f8da123789

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.import-alix-lasers-de`; Abhängigkeiten A1, A2, A5.
- Funktionen: `import-alix-lasers-de`.
- Belege: supabase/functions/import-alix-lasers-de/index.ts:18-35.
- Ursache/Prüfgrenze: getClaims bestätigt lediglich eine Identität. Danach wird unmittelbar ein Service-Role-Client für den gemeinsamen Katalog erstellt; eine administrative Importberechtigung fehlt vor dem Import.
- Geplante konkrete Änderung: Serverseitige Product-Hub-Importberechtigung vor Quellenabruf und sämtlichen Katalogänderungen verlangen.
- Betriebsfolgen: Unberechtigter gemeinsamer Katalogimport; Mögliche Überschreibung vorhandener Produktdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Normalen Benutzer ablehnen; autorisierten Katalogadministrator zulassen; bei Ablehnung keinerlei Importzugriffe..
- Sicherer Wiederherstellungsplan: Import sperren und betroffene Katalogänderungen aus gesichertem Stand gezielt wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_9a2e7a4d1dc3c9a6

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.product-hub-validate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `product-hub-validate`.
- Belege: supabase/functions/product-hub-validate/index.ts:76-103.
- Ursache/Prüfgrenze: Der Validierungseinstieg besitzt vor den Service-Role-Abfragen keine Identitäts- oder Katalogberechtigungsprüfung. Produkte, Medien, Dokumente und Konflikte werden global geladen. In diesem gelesenen Einstieg liegt keine controlled_modes-Sperre vor der Operation.
- Geplante konkrete Änderung: Product-Hub-Prüfberechtigung vor sämtlichen Katalog- und URL-Zugriffen erzwingen; Berichte nach Berechtigung begrenzen.
- Betriebsfolgen: Unberechtigte Katalog- und Konfliktverarbeitung; Serverseitige URL-Prüfungen.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und fachfremden Benutzer vor erster Abfrage ablehnen; erlaubten Prüfer zulassen..
- Sicherer Wiederherstellungsplan: Validierungsendpunkt sperren; Betriebsmodus-Sperren gegebenenfalls zusätzlich beibehalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_9fcacb28cc4c5d46

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.product-hub-import.fetch-source-with-server-key`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `product-hub-import`, `fetchSource`.
- Belege: supabase/functions/product-hub-import/index.ts:119-143.
- Ursache/Prüfgrenze: endpoint beziehungsweise source_url wird ohne Aufruferprüfung aus dem Body übernommen und an fetchSource gegeben. fetchSource sendet den serverseitigen Quellschlüssel als x-api-key an genau diesen Endpunkt. Vor diesem Fetch ist keine controlled_modes-Sperre vorhanden.
- Geplante konkrete Änderung: Importberechtigung verlangen; Ziel-URL serverseitig festlegen beziehungsweise streng erlaubnislisten; Redirects zu nicht erlaubten Hosts verhindern; betroffenen Schlüssel nach Absicherung rotieren.
- Betriebsfolgen: Abfluss eines serverseitigen Quellschlüssels; Serverseitige Requests an frei gewählte Ziele; Unberechtigter Importzugriff.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Host und hostwechselnden Redirect ohne echten Schlüssel oder Netzwerkaufruf ablehnen..
- Sicherer Wiederherstellungsplan: Importer deaktivieren; Schlüsselrotation nicht rückgängig machen; nur abgesicherten Zielhost freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_209ac9df0e293f49

- Bewertung: ungeklärt; Korrekturgruppe `CG.ph-com-lang-push`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `ph-com-lang-push:probe`, `comFetch`.
- Belege: supabase/functions/ph-com-lang-push/index.ts:134-145; supabase/functions/ph-com-lang-push/index.ts:34.
- Ursache/Prüfgrenze: Der probe-Zweig reicht frei übergebene Payloads an comFetch weiter, ohne Aufruferprüfung. Davor sperrt jedoch ein datenabhängiger controlled_modes-Schalter den gesamten Altversand. Ob dieser Schalter im relevanten Betriebsmodus zwingend aktiv ist und welcher Gatewaypfad deployt wurde, ist nicht nachgewiesen.
- Geplante konkrete Änderung: Altpfad dauerhaft entfernen oder unabhängig vom Betriebsmodus autorisieren; freien Probe-Payload nicht als öffentlichen Versandpfad erhalten.
- Betriebsfolgen: Bedingt unberechtigte Remote-API-Aufrufe.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_a75e27ec4d54559d

- Bewertung: ungeklärt; Korrekturgruppe `CG.product-hub-import.update-existing-product`; Abhängigkeiten A1, A2, A5.
- Funktionen: `product-hub-import:Update`.
- Belege: supabase/functions/product-hub-import/index.ts:129-140; supabase/functions/product-hub-import/index.ts:263; supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:5.
- Ursache/Prüfgrenze: Der Importhandler akzeptiert Produktdaten ohne Aufruferprüfung und aktualisiert passende ph_products mit Service-Rechten. Aktuelle Product-Hub-Trigger und Betriebsmodusregeln existieren; ihre vollständige Wirkung auf diesen Altimport wurde nicht geschlossen. Nicht identisch mit dem Insert neuer Produkte.
- Geplante konkrete Änderung: Altimport deaktivieren oder mit explizitem Product-Hub-Importrecht und erlaubtem Feldsatz schützen; Betriebsmodus- und Triggerabhängigkeiten vollständig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Änderung bestehender Produktdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_bdfe7bcb586d9539

- Bewertung: ungeklärt; Korrekturgruppe `CG.product-hub-import.insert-new-product`; Abhängigkeiten A1, A2, A5.
- Funktionen: `product-hub-import:Insert`.
- Belege: supabase/functions/product-hub-import/index.ts:129-140; supabase/functions/product-hub-import/index.ts:267-268.
- Ursache/Prüfgrenze: Produktdaten werden ohne Aufruferprüfung angenommen und bei fehlendem Match mit Service-Rechten in ph_products eingefügt. Die vollständige Wirkung aktueller Product-Hub-Trigger und Betriebsmodi auf diesen Insertpfad ist noch nicht aufgelöst. Der Updatebefund betrifft eine andere Operation.
- Geplante konkrete Änderung: Importrecht, Herkunft und zulässigen Entwurfsstatus serverseitig prüfen; aktuelle Datenbankguards vollständig nachvollziehen.
- Betriebsfolgen: Mögliche unberechtigte Produktanlage.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

