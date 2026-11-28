# A5 – Generische API-/Maschinenautomatisierung

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 3; bestätigt kritisch 2; ungeklärt 1; Fehlkonfigurationen 0; Doppelmeldungen 0; im Code geschützt 0.

Abhängigkeiten: A1, A2.

Bestehende job-auth/provider-auth wiederverwenden, genaue private Maschinenidentitäten und Raw-Body-/Timestamp-Signaturen; keine zweite Schnittstelle, kein neuer Schlüssel. Authentifizierte aktive manuelle Fachrolle und Maschinenpfad getrennt. Gemeinsam genutzte A5-Abhängigkeiten der anderen Pakete bleiben in deren Primärzahlen; Zeitpläne nicht entfernen oder ändern.

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

### lov_finding_3f184b5b3878e895

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-webhook-dispatch`; Abhängigkeiten A1, A2.
- Funktionen: `ac-webhook-dispatch`.
- Belege: supabase/functions/ac-webhook-dispatch/index.ts:10-28; supabase/functions/ac-webhook-dispatch/index.ts:33-82.
- Ursache/Prüfgrenze: Der Handler verzweigt ohne Aufruferprüfung in privilegiertes Einreihen beziehungsweise Abarbeiten gespeicherter Webhook-Abonnements. Gespeicherte Zieladressen verhindern nicht das unberechtigte Auslösen.
- Geplante konkrete Änderung: Einreihen und Dispatch getrennt autorisieren; Dispatch nur verifizierten Jobs, Einreihen nur berechtigten mandantengebundenen Produzenten erlauben.
- Betriebsfolgen: Unberechtigtes Auslösen externer Integrationen; Manipulation der Event-Warteschlange.
- Geplante Regressionstests, noch nicht ausgeführt: Beide Aktionspfade ohne gültige Berechtigung ohne Queue- oder Netzwerk-Nebenwirkung ablehnen..
- Sicherer Wiederherstellungsplan: Dispatcher und Produzentenpfad pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_baa5414ce6fda013

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.orders-inbox-process`; Abhängigkeiten A1, A2.
- Funktionen: `orders-inbox-process`.
- Belege: supabase/functions/orders-inbox-process/index.ts:267-310; supabase/functions/orders-inbox-process/index.ts:171-257; supabase/functions/orders-inbox/index.ts:96.
- Ursache/Prüfgrenze: Der Verarbeitungsendpunkt lädt Inbox-Einträge ohne eigene Aufruferprüfung und führt privilegierte Kunden-, Bestell- und Positionsänderungen aus. Ein legitimer vorgeschalteter Importaufrufer schützt direkte Aufrufe nicht; verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Verifizierten internen Verarbeitungsjob verlangen; Einträge an erlaubte Quelle und Mandant binden.
- Betriebsfolgen: Unberechtigte Bestell- und Kundenänderungen; Unberechtigte Verarbeitung wartender Importe.
- Geplante Regressionstests, noch nicht ausgeführt: Direkten unberechtigten Aufruf mit und ohne onlyId ohne Verarbeitung oder Statusänderung ablehnen..
- Sicherer Wiederherstellungsplan: Inbox-Verarbeitung pausieren, Eingänge unverändert aufbewahren.
- Doppelmeldungsreferenz: keine.

### lov_finding_597a547a91b6cb80

- Bewertung: ungeklärt; Korrekturgruppe `CG.orders-inbox-process`; Abhängigkeiten A1, A2.
- Funktionen: `orders-inbox-process`, `orders-inbox`.
- Belege: supabase/functions/orders-inbox-process/index.ts:267-272; supabase/functions/orders-inbox-process/index.ts:189-190; supabase/functions/orders-inbox/index.ts:96; supabase/config.toml:35-36.
- Ursache/Prüfgrenze: Der Prozesshandler startet mit Service-Rechten ohne sichtbare eigene Aufruferprüfung. orders-inbox ruft ihn intern auf; dessen vollständige Autorisierung und die komplette Prozesskette einschließlich Datenbanknebenwirkungen wurden nicht abgeschlossen. Der interne Aufrufer allein schützt den separaten HTTP-Einstieg nicht.
- Geplante konkrete Änderung: Prozesshandler auf verifizierte interne Aufrufe begrenzen; Inbox-Autorisierung und Verarbeitung vollständig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Verarbeitung eingehender Kundenaufträge.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

