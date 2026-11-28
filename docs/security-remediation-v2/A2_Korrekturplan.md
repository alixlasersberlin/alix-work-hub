# A2 – Mandanten- und Objektberechtigungen

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 7; bestätigt kritisch 3; ungeklärt 4; Fehlkonfigurationen 0; Doppelmeldungen 0; im Code geschützt 0.

Abhängigkeiten: A1, A5.

Explizite user_tenant_access-Zuweisungen als Menge auswerten: ein aktiver DE+AT-Mitarbeiter darf beide zugewiesenen Gesellschaften entsprechend seiner Fachrolle sehen; DE-only nie AT, keine Zuweisung nie global. Bestehende Österreich-Only-Regel und unabhängige Notizerstellung erhalten. Objektbeziehung plus Mandant prüfen, nicht nur ein frei mitgegebenes source_system. Keine historische Massenfreigabe automatisch auf neue Mitarbeiter übertragen.

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

### lov_finding_aaa4d2aa58de11e4_56f4ee5a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.delivery-route-calc`; Abhängigkeiten A1, A5.
- Funktionen: `delivery-route-calc`.
- Belege: supabase/functions/delivery-route-calc/index.ts:213-253; supabase/functions/delivery-route-calc/index.ts:306-346; supabase/functions/delivery-route-calc/index.ts:408-421; src/pages/Dispatch/Touren.tsx:124.
- Ursache/Prüfgrenze: Claims werden geprüft, nicht die Berechtigung für tour_id. Der privilegierte Pfad lädt Tour und Stopps und verändert anschließend Termine, Reihenfolgen und Tourberechnungen.
- Geplante konkrete Änderung: Aktive Dispositionsberechtigung für Tour und Mandant vor Daten- und Routingzugriff verlangen.
- Betriebsfolgen: Unberechtigte Routenänderungen; Offenlegung von Liefer- und Kundendaten; Externe Routingkosten.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Tour ohne Geocoding, Routingaufruf oder Datenmutation abweisen..
- Sicherer Wiederherstellungsplan: Neuberechnung sperren; letzte freigegebene Tourstände erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_aaa4d2aa58de11e4_c6e24d62

- Bewertung: ungeklärt; Korrekturgruppe `CG.delivery-route-calc.recalculate-tour-unresolved`; Abhängigkeiten A1, A5.
- Funktionen: `delivery-route-calc`.
- Belege: supabase/functions/delivery-route-calc/index.ts:210-253; supabase/functions/delivery-route-calc/index.ts:379-421.
- Ursache/Prüfgrenze: Identitätsprüfung und privilegierte Tourenänderungen wurden lokalisiert. Der vollständige Kontrollfluss zwischen Claimsprüfung, Tourauswahl und Updates wurde jedoch nicht abschließend gelesen; eine konkrete Zuordnungsprüfung darf deshalb weder angenommen noch ausgeschlossen werden.
- Geplante konkrete Änderung: Tourenrolle, Mandant und Tourzuordnung entlang des vollständigen Berechnungspfads prüfen.
- Betriebsfolgen: Potenzielle Änderung fremder Touren und Stopps.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Tour trotz gültiger Identität ablehnen; keinerlei Teilupdates..
- Sicherer Wiederherstellungsplan: Neuberechnung sperren; letzte freigegebene Tourplanung wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e82b9976fc58ba0b

- Bewertung: ungeklärt; Korrekturgruppe `CG.delivery-route-calc.route-stop-update-unresolved`; Abhängigkeiten A1, A5.
- Funktionen: `delivery-route-calc`.
- Belege: supabase/functions/delivery-route-calc/index.ts:210-253; supabase/functions/delivery-route-calc/index.ts:336-421.
- Ursache/Prüfgrenze: Claimsprüfung und privilegierte Updates von Touren und Stopps wurden lokalisiert, aber der vollständige Auswahl- und Autorisierungspfad nicht gelesen. Eine Zusammenlegung mit dem anderen Tourenbefund wird ohne Nachweis derselben konkreten Operation nicht vorgenommen.
- Geplante konkrete Änderung: Konkrete Tourauswahl, Mitarbeiterzuordnung und Mandantenscope vor allen Teilupdates vollständig prüfen.
- Betriebsfolgen: Potenzielle unberechtigte Tourenänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Tour, fremde Stopps und unberechtigten Benutzer ohne Teilupdates ablehnen..
- Sicherer Wiederherstellungsplan: Tourenneuberechnung sperren; vorherige freigegebene Planung zurückspielen.
- Doppelmeldungsreferenz: keine.

### lov_finding_04b7323c4231ec65

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.import-all-orders-ch`; Abhängigkeiten A1, A5.
- Funktionen: `import-all-orders-ch`, `runImport`.
- Belege: supabase/functions/import-all-orders-ch/index.ts:64-89; supabase/functions/import-all-orders-ch/index.ts:219-230; src/pages/ImportManagement.tsx:210.
- Ursache/Prüfgrenze: Der Handler prüft nur, ob nach Bearer-Entfernung ein nichtleerer String übrig bleibt; eine Identitäts- oder Importberechtigungsprüfung fehlt. Danach werden mit Service-Rechten Kunden, Aufträge und Positionen verändert. Der Frontendaufruf ersetzt diese serverseitige Prüfung nicht. Anonyme Erreichbarkeit hängt zusätzlich vom nicht verifizierten Deployment-Gateway ab.
- Geplante konkrete Änderung: Verifizierte Benutzeridentität und explizite Importberechtigung beziehungsweise verifizierte interne Jobidentität vor Importstart erzwingen.
- Betriebsfolgen: Unberechtigte Importläufe; Änderung von Auftrags- und Kundendaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1774b4ac1795267a

- Bewertung: ungeklärt; Korrekturgruppe `CG.pdf-order-commit.create-order-customer-link`; Abhängigkeiten A1, A5.
- Funktionen: `pdf-order-commit:Auftrag`.
- Belege: supabase/functions/pdf-order-commit/index.ts:67-93; supabase/functions/pdf-order-commit/index.ts:223-246; src/pages/PdfOrderImport/Review.tsx:293.
- Ursache/Prüfgrenze: Identität und Zugriff auf den Import werden geprüft, nicht jedoch die separat übergebene bestehende Kunden-ID; diese fließt direkt in einen Service-Insert auf orders. Eine vollständige Prüfung aller aktuellen Order-Trigger und ihrer Autorisierungswirkung wurde nicht abgeschlossen. Deshalb ist die Handlerlücke belegt, die endgültige Datenbankwirkung bleibt offen.
- Geplante konkrete Änderung: Kunden-ID mit benutzerspezifischem Client und erforderlicher Anlegeberechtigung validieren; zuvor verbleibende Triggerabhängigkeiten schließen.
- Betriebsfolgen: Mögliche kundenscopeübergreifende Auftragserstellung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_2989a7a085c7a5ca_bfcf4258

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.dispatch-eta-sms`; Abhängigkeiten A1, A5.
- Funktionen: `dispatch-eta-sms`.
- Belege: supabase/functions/dispatch-eta-sms/index.ts:42-69; supabase/functions/dispatch-eta-sms/index.ts:100-116; src/pages/Mobile/Einsatz.tsx:150.
- Ursache/Prüfgrenze: getUser validiert die Identität, danach erfolgen Route- und Auftragszugriffe sowie ETA-Update mit dem Service-Client. Eine Zuordnung der route_plan_id zum Aufrufer oder eine Dispositionsberechtigung ist nicht vorgeschaltet. Der mobile Aufrufer ist keine serverseitige Objektprüfung.
- Geplante konkrete Änderung: Route gegen Aufruferzuordnung und erforderliche Dispositionsrechte prüfen, bevor Kommunikation oder ETA-Änderung erfolgt.
- Betriebsfolgen: Fremde ETA-Änderungen; Unberechtigte Kundenkommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_8b2f741253363b3f

- Bewertung: ungeklärt; Korrekturgruppe `CG.pdf-order-commit.create-offer-customer-link`; Abhängigkeiten A1, A5.
- Funktionen: `pdf-order-commit:Angebot`.
- Belege: supabase/functions/pdf-order-commit/index.ts:67-93; supabase/functions/pdf-order-commit/index.ts:188-215; supabase/migrations/20261102185015_3b8dcad5-5d36-49a4-98f9-91191d4239ee.sql:10.
- Ursache/Prüfgrenze: Der Handler prüft Benutzer und Import, übernimmt aber eine bestehende Kunden-ID ungeprüft in das mit Service-Rechten angelegte Angebot. Aktuelle Angebotstrigger und deren vollständige Wechselwirkung wurden nicht abschließend aufgelöst. Nicht identisch mit der Auftragserstellung.
- Geplante konkrete Änderung: Kundenzugriff und Angebotserstellungsrecht explizit prüfen; Angebotstrigger vollständig einbeziehen.
- Betriebsfolgen: Mögliche unberechtigte Angebotszuordnung zu fremden Kunden.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

