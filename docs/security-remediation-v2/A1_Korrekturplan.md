# A1 – Identität/Admin/Konten/Rollen

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 5; bestätigt kritisch 4; ungeklärt 0; Fehlkonfigurationen 0; Doppelmeldungen 1; im Code geschützt 0.

Abhängigkeiten: A3, A5, A7.

Aktive/angenommene Konten und erforderlichen Passwortwechsel serverseitig prüfen. Exakte Super-Admin-Rolle unabhängig von has_role-Vererbung; Rollen weiterhin in user_roles, nicht im Profil. Bekannte allgemeine Rollenvererbungs-/Policy-Eskalationsrisiken aus dem Vorbericht sind Querschnittsabhängigkeiten, keine zusätzlich erfundenen IDs dieser 266-ID-Bilanz. Kontosperre muss bestehende Sitzungen erfassen; Rotation/Widerruf bleiben gesondert freizugeben.

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

### lov_finding_59b7e25453966dd1

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-calendar-oauth`; Abhängigkeiten A5, A7.
- Funktionen: `esc-calendar-oauth`.
- Belege: supabase/functions/esc-calendar-oauth/index.ts:24-31; supabase/functions/esc-calendar-oauth/index.ts:35-75; supabase/config.toml:257-258.
- Ursache/Prüfgrenze: Der OAuth-Callback übernimmt state direkt als user_id. Nach erfolgreichem Provider-Codeaustausch werden Tokens privilegiert für diese frei gewählte ID gespeichert. Es fehlt eine serverseitig gespeicherte, einmalige State-Bindung an die initiierende Sitzung.
- Geplante konkrete Änderung: Zufälligen einmaligen State mit Nutzer-, Provider-, Redirect- und Ablaufbindung speichern; vor Tokenpersistierung atomar verbrauchen, PKCE ergänzen.
- Betriebsfolgen: Fremdverknüpfung von Kalenderkonten; Verletzung der OAuth-Sitzungsintegrität.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremde user_id, manipuliertes State, Replay und abgelaufenes State negativ; legitimer Callback positiv..
- Sicherer Wiederherstellungsplan: OAuth-Verknüpfung sperren; verdächtige Verbindungen widerrufen und neu autorisieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_09ffea0c64262705

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.tmp-create-sobitsch`; Abhängigkeiten A5, A3.
- Funktionen: `tmp-create-sobitsch`.
- Belege: supabase/functions/tmp-create-sobitsch/index.ts:8-19; supabase/functions/tmp-create-sobitsch/index.ts:42-74.
- Ursache/Prüfgrenze: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Kontoanlage sowie Profil- und Provisionsänderungen aus. Die explizite Gateway-Einstellung ist verify_jwt=false. Fest vorgegebene Zieldaten sind keine Autorisierung.
- Geplante konkrete Änderung: Temporären Produktionsendpunkt entfernen beziehungsweise vollständig sperren; erforderliche Migration ausschließlich kontrolliert administrativ ausführen.
- Betriebsfolgen: Unberechtigte Kontoanlage; Manipulation von Provisionszuordnungen.
- Geplante Regressionstests, noch nicht ausgeführt: Deployment ohne erreichbaren temporären Endpunkt prüfen; bestehende Provisionszuordnungen schreibgeschützt auf Wiederholungseffekte untersuchen..
- Sicherer Wiederherstellungsplan: Endpunkt nicht reaktivieren; fachliche Datenkorrektur separat freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_3e5d7e5d17036bf2

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.tmp-create-sobitsch`; Abhängigkeiten A5, A3.
- Funktionen: `tmp-create-sobitsch`.
- Belege: supabase/functions/tmp-create-sobitsch/index.ts:8-24; supabase/functions/tmp-create-sobitsch/index.ts:42-74.
- Ursache/Prüfgrenze: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Provisionierung, Profil-Upsert, Aktivierung der Provisionszuordnung und Provisionszuweisungen aus. Das Konto wird zwar gesperrt beziehungsweise inaktiv angelegt; dies verhindert die übrigen unberechtigten Änderungen nicht.
- Geplante konkrete Änderung: Temporären Provisionierungsendpunkt entfernen oder ausschließlich als explizit berechtigten, nicht öffentlichen Wartungsjob betreiben.
- Betriebsfolgen: Unberechtigte Kontoprovisionierung; Unberechtigte Provisionsänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Öffentlichen Aufruf ausschließen; kontrollierten Wartungslauf auf Idempotenz und Änderungsumfang prüfen..
- Sicherer Wiederherstellungsplan: Deployment des Endpunkts deaktivieren; Provisionszuweisungen anhand eines Vorherstands korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_718ef6275274a96d

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.tmp-create-sobitsch`; Abhängigkeiten A5, A3.
- Funktionen: `tmp-create-sobitsch`.
- Belege: supabase/functions/tmp-create-sobitsch/index.ts:8-24; supabase/functions/tmp-create-sobitsch/index.ts:42-74.
- Ursache/Prüfgrenze: Derselbe ungeschützte Einstieg führt dieselbe feste Benutzerprovisionierung und dieselben Provisions-Upserts aus wie der referenzierte Befund.
- Geplante konkrete Änderung: Gemeinsam mit dem Primärbefund den temporären Provisionierungsendpunkt entfernen oder streng als Wartungsjob schützen.
- Betriebsfolgen: Dieselben Konto- und Provisionsänderungen wie beim Primärbefund.
- Geplante Regressionstests, noch nicht ausgeführt: Gemeinsame Negativtests für öffentlichen Zugriff und unberechtigte Provisionierung..
- Sicherer Wiederherstellungsplan: Endpunkt deaktivieren; Änderungen gezielt abgleichen.
- Doppelmeldungsreferenz: lov_finding_3e5d7e5d17036bf2.

### lov_finding_01b05992862b294b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.admin-reset-jerry`; Abhängigkeiten A5.
- Funktionen: `admin-reset-jerry`.
- Belege: supabase/functions/admin-reset-jerry/index.ts:8-20; supabase/config.toml:52-53.
- Ursache/Prüfgrenze: Der HTTP-Handler erzeugt ohne vorgelagerte Identitäts- oder Rollenprüfung einen Service-Client, sucht ein festes Konto und setzt dessen Passwort auf einen im Quelltext festgelegten Wert. Die Gateway-Quellkonfiguration deaktiviert zusätzlich die JWT-Prüfung. Ein legitimer externer Aufrufer wurde nicht gefunden; das schützt den direkten Handler nicht.
- Geplante konkrete Änderung: Einmal-Reset-Handler entfernen beziehungsweise sperren; betroffenes Kennwort und Sitzungen kontrolliert erneuern; administrative Wiederherstellung ausschließlich über einen autorisierten, protokollierten Prozess.
- Betriebsfolgen: Kontoübernahme des fest hinterlegten Kontos.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

