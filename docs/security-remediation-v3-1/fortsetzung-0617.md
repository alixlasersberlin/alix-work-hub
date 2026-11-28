# ALIXWORK – SECURITY v3.1: Fortsetzung ab 06:17 UTC

Stand: 28.11.2026. Zwischenbericht, **keine vollständige Sicherheitsabnahme**.

## Tatsächliches Ergebnis

- **18 weitere native Befunde geschlossen**: 10 kritische Befunde und 8 Warnungen; keiner ignoriert.
- **371 verbleiben offen: 192 kritisch / 179 Warnungen.** Ausgang dieser Fortsetzung: 389; gegenüber der ursprünglichen 472-ID-Basis sind jetzt 101 Korrekturen gemeldet (49 + 34 + 18).
- 492 ältere Datenbank-Linterhinweise bleiben separat und wurden nicht durch diese Änderungen eingeführt.
- 15 Funktionen bereitgestellt. Ungültige Zugangsdaten und der tatsächliche öffentliche Projektschlüssel wurden bei allen 15 mit HTTP 401 abgewiesen.
- 234 gemeinsame Servertests bestanden, darunter 64 Tests dieser Fortsetzung; 277 Anwendungstests in 58 Dateien bestanden. Der automatische Anwendungscheck meldet „build OK“.

## Gemeinsam korrigierte Ursachen

1. Journey-Verarbeitung, Webhookausführung, Liefererinnerungen und persönliche Wiedervorlagen: vorhandener privater Maschinenzugang vor geschützten Zugriffen.
2. Segmentaufnahme, Dokument-Workflow-Prüfung, Dokumenthashes und Regellernen: vorhandener gemeinsamer Prozesszugang; Mitarbeiter werden aktiv, rollen- und mandantengebunden geprüft, ihre Datenzugriffe verwenden den eigenen Zugang und bestehende Zeilenrechte. Maschinen behalten den bestehenden autorisierten Prozessumfang.
3. Wettbewerber-Snapshots: aktives Konto und Mandantenzuweisung, vorhandene Schreibberechtigungsprüfung sowie aufrufergebundene Lese- und Schreibzugriffe; ungültige Identifikatoren werden abgewiesen.
4. Fristprüfung, Fuhrparkhinweise und Konversationsautomatisierung: geprüfte Mitarbeiter- oder Maschinenzugänge. Bestehende Planungsrollen einschließlich Order/SACHBEARBEITUNG bleiben berücksichtigt; fachfremde Rollen werden abgewiesen. Konversations-/Nachrichtenidentitäten müssen zusammenpassen.
5. Konversations-QA: exakt zugewiesene Administratorrolle, eigene Lesezugriffe und explizite Mandantenfilter; fremde Gespräche werden vor KI und Schreiben abgewiesen. Der bisher falsche Projektionsname wurde auf das tatsächlich vorhandene `assigned_to` korrigiert. Der serverseitige Ergebnis-Schreibzugriff verwendet nur die so geprüfte Gesprächsidentität.

## Zusätzlich abgesichert, bewusst noch nicht abgeschlossen

- `ac-workflow-studio`: aktives Administrator- und Mandantengate, validierte Eingaben und keine privilegierte Umgehung beim Speichern. Der native Befund bleibt aktiv: Die bestehende Studio-Speicherlogik erwartet nicht vorhandene Spalten (u.a. trigger_type/conditions/actions/is_active/metadata), während die bestehende Tabelle trigger/action/action_value/active verwendet. Die isolierte positive Validierung ist bestanden; vollständiges Speichern ist **nicht** abgenommen. Keine neue Tabellenstruktur oder unkontrollierte Workflow-Konvertierung eingeführt. Bei mehreren Mandanten ist eine eindeutige autorisierte Mandantenauswahl erforderlich.
- `ai-center-chat`: aktive Konten und die bestehenden fachlichen Seitenrollen werden serverseitig geprüft; anonyme Nutzung ist abgewiesen. Der Befund bleibt aktiv, weil die bestehende generische Nachrichten-Schnittstelle weiterhin interne Systemnachrichten erlaubt. Die fachlich verwendeten Nachrichten wurden nicht stillschweigend ersetzt; die isolierte Chatprüfung ist bestanden.
- Frühere lokale Druckkorrektur bleibt weiterhin nicht als veröffentlichte Sicherheitsabnahme ausgegeben.

## Bestandsschutz und Bereitstellung

- 44 Product-Hub-Geräte unverändert; keine Produktschreiboperation und keine Produktdateiänderung.
- 102 Zeitpläne bleiben erhalten; Fingerprint der IDs/Namen/Zeiten/Aktivierung weiterhin `4f652b55630548d00306cc87dc8e8919`.
- Nur acht bestehende Cron-Aufrufheader wurden mit dem bereits vorhandenen privaten Maschinenzugang verbunden: Jobs 65/69/81 sowie 66/78/105/106/135. Keine Jobausführung, kein neuer Zeitplan, keine Änderung von Häufigkeit oder Aktivierung.
- `ph_settings.ph2_activation`: enabled=false, emergency_stopped=true, revision=0; DE/COM blocked, beide ohne Pilotgerät; Backup-/Restore-/Kommunikationsfreigaben false.
- Keine tatsächliche Finanztransaktion, kein echter Kundenversand, keine Datenlöschung, keine Schlüsselrotation, keine Änderung der Product-Hub-Verträge v1.2/v1.3.
- Edge Functions bereitgestellt; die Anwendung wurde in dieser Fortsetzung **nicht erneut veröffentlicht**.

## Grenzen der Nachweise

- Positivtests verwenden isolierte synthetische Daten und vollständig abgefangene Provideraufrufe. Das ist keine reale Mitarbeiter-, Mandanten- oder Provider-Endabnahme.
- Eine echte Anmeldung ist für das extern verwaltete Supabase-Projekt hier nicht verfügbar: Der Versuch einer eigenen Sitzung wurde ausdrücklich abgewiesen. Es wurden keine Zugangsdaten angefordert und keine Anmeldung umgangen.
- Quellstände wurden vor den drei Gruppen als getrennte Archive gesichert, Inhalte geprüft und SHA-256 dauerhaft dokumentiert; die Archive liegen in geschützter privater Metadatenablage. Das ist weder Vollbackup noch isolierter Datenbank-Restore.
- Die erste Cron-Anpassung stoppte wegen eines abweichenden vorhandenen Headerformats vollständig; nach formatbezogener Korrektur wurden die zwei Migrationen erfolgreich angewandt. Zeitpläne blieben nachweislich gleich.
- Der vorherige Tiefenscan zum Vorgängerstand `804b58e92` ist fehlgeschlagen. Er liefert keine Abnahme dieser Korrekturen. Erneuter Schnell-/Tiefenscan wird separat dokumentiert; ohne vollständiges Ergebnis keine Entwarnung.
- Die 371 offenen Befunde sind **nicht sämtlich technisch blockiert**. Weitere unabhängige Finanz-, Dokument-, Portal-, Provider-, Datenbank- und KI-Gruppen bleiben innerhalb der Gesamtfreigabe abzuarbeiten. Konkrete externe Abhängigkeiten bleiben die echte Sitzung, isolierte Restore-Umgebung und koordinierte Provider-/Zugangsrotation; keine automatische Hintergrundbereinigung läuft weiter.

## Nachweise

- `native-bilanz-0617.csv`: vollständige 472-ID-Bilanz mit erhaltenen historischen Korrekturen.
- `live-abweisungen-0617.json`: 15 reale Abweisungen mit dem öffentlichen Projektschlüssel.
- `quellsicherungen-0617.json`: SHA-256 der drei Quellarchive.
- `supabase/functions/_shared/security-v31-next_test.ts`: negative Konto-/Rollen-/Mandantentests, positive isolierte Prozess-/Snapshot-/QA-/Chatprüfungen.

## In dieser Fortsetzung abgeschlossene Scanner-IDs

- `lov_finding_02f750951452daf6` (error): Anyone can trigger processing of private journey runs
- `lov_finding_150543f5792e8bf6` (warn): Anyone can trigger document workflow scans
- `lov_finding_1a410c3cce005159` (error): Anyone can change every customer's competitor data
- `lov_finding_24579cadca97b1b6` (error): Unauthenticated requests can hash private documents
- `lov_finding_27ef54fe18b6bfc6` (error): Anyone can inspect document matching feedback preview
- `lov_finding_28cb10380cb01816` (error): Anyone can alter every competitor's social reports
- `lov_finding_2982b15a37ac400e` (warn): Anyone can enroll contacts in customer journeys
- `lov_finding_37bccb3f32dd2746` (warn): Anyone can cancel overdue delivery appointments
- `lov_finding_3f184b5b3878e895` (error): Anyone can trigger your saved webhook integrations
- `lov_finding_4bc3611a6285a5f0` (error): Anyone can send private conversations for quality review
- `lov_finding_5ef16fc648f4d05d` (warn): Anyone can resend fleet maintenance alerts
- `lov_finding_6feae31e06a64cf3` (error): Anyone can run conversation automations
- `lov_finding_a0a466e697d09e51` (error): Anyone can change document matching rules
- `lov_finding_c347b846e6b2b5a1` (warn): Anyone can trigger your staff reminders
- `lov_finding_c79ad01cbeb6bd2e` (error): Anyone can run document hash maintenance
- `lov_finding_cd056d21e44e9a75_1649b39e` (warn): Anyone can trigger document workflow scans
- `lov_finding_deaeb897a2c94b91` (warn): Anyone can trigger fleet maintenance alerts
- `lov_finding_fceaf8f0efb47bf5` (warn): Anyone can trigger SLA notifications
