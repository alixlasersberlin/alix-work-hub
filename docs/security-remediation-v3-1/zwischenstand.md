# ALIXWORK – Sicherheitsbereinigung v3.1: tatsächlicher Zwischenstand

**Keine Gesamtabnahme und keine Produktivfreigabe.** Die Gesamtfreigabe wird umgesetzt; 389 native Befunde sind noch offen. Die verbleibenden unabhängig lösbaren Befunde sind nicht pauschal technisch blockiert, sondern in dieser Ausführung noch nicht vollständig bearbeitet.

## Bilanz

- Ausgang dieser Fortsetzung: 423 native Befunde, davon 218 kritisch und 205 Warnungen; der zugrunde liegende Tiefenscan meldete „failed“.
- 34 weitere Befunde tatsächlich korrigiert, getestet, Funktionen bereitgestellt und individuell als behoben gemeldet: 16 kritisch, 18 Warnungen.
- Zuvor 49 gezielt gemeldete Korrekturen bleiben erhalten: insgesamt damit 83 gemeldete Korrekturen gegenüber der 472-ID-Basis.
- 389 native Befunde verbleiben: 202 kritisch, 187 Warnungen. Keine pauschale Ignorierung, keine Sicherheitsfreigabe aus diesen Zahlen ableiten.
- Zusätzlich 492 ältere Datenbankhinweise unverändert; keine neuen Hinweise durch die beiden Scheduler-Migrationen.

## Tatsächliche Korrekturen

Mitarbeiterzugänge verwenden die vorhandene gemeinsame Prüfung aktiver angenommener Konten, direkt zugewiesener Rollen und ausdrücklich aktiver Mandanten. Routing, Kontaktbewertungen, Übersetzungs-/Emotionszuordnungen, Serviceanalysen und Compliance-Kontext lesen mit dem verifizierten Mitarbeiterzugriff statt privilegiertem globalem Zugriff. Nicht zugängliche Kennungen stoppen vor Analyse oder Speicherung. GitHub-Historie bleibt direkt berechtigten aktiven Superadministratoren vorbehalten.

After-Sales-Erinnerungen prüfen die konkreten Fachrollen und den Fallmandanten. SMS und E-Mail können nicht auf eine andere als die gespeicherte Kundenadresse umgeleitet werden. Bestehende berechtigte Freitextnachrichten bleiben bestehen. Der private E-Mail-Aufruf der vorhandenen Workflow-Engine bleibt separat ausführbar; Substring-Prüfungen auf Maschinenzugänge wurden entfernt. Fallempfehlungen prüfen den Fallzugriff vor privilegierter Anreicherung; Änderungen verwenden bestehende Mitarbeiterrechte.

Sieben automatische Funktionen benötigen den bestehenden privaten Maschinenzugang. Acht vorhandene Cronaufrufe erhielten lediglich dessen geschützte Bindung; Zeiten, Aktivierung, Anzahl, Aufrufkörper und Namen bleiben unverändert. Keine Jobs manuell gestartet.

## Tests und Bereitstellung

- **170 gemeinsame Deno-Servertests bestanden**, einschließlich neuer positiver/negativer Zugriffsfälle sowie bestehender v3.0-, Provider-, Konto-, Rollen-, Mandanten- und Product-Hub-Regressionen.
- **277 Anwendungstests in 58 Dateien bestanden**; darin vier HTML-Schutztests.
- 19 Funktionen über das Bereitstellungswerkzeug erfolgreich bereitgestellt; jede mit ungültigem öffentlichen Aufruf HTTP 401 geprüft. Die ersten 18 zusätzlich mit dem tatsächlichen öffentlichen Projektschlüssel HTTP 401 geprüft; der After-Sales-Workflow wurde separat mit ungültigem Token geprüft.
- Positive Tests verwenden ausschließlich isolierte synthetische Daten und gemockte Dienste. Der Mitarbeiter- und Maschinen-E-Mailpfad wurde einschließlich ursprünglicher Kundenadresse und Protokollschritten simuliert; keine echten Kundennachrichten oder Finanztransaktionen.
- Eine anfängliche Testannahme wies den gültigen privaten E-Mailzugang fälschlich als öffentlich aus; der Test wurde auf einen manipulierten Token korrigiert und die private Erfolgsstrecke separat geprüft. Abschließender Lauf ohne Fehler.
- Die Vorschau meldet build OK. **Die Anwendung selbst wurde in dieser Fortsetzung nicht neu veröffentlicht.**

## Lokal korrigiert, aber nicht geschlossen

Die unescaped Druckfelder der digitalen Akte, Rechnungsladefenster und Rollenauswertung sind im Quellstand geschützt. Der native Druckbefund `lov_finding_0dab80f3d6a7ee45` bleibt aktiv, weil die geänderte Oberfläche noch nicht veröffentlicht wurde. Die berichtigte Bewertung unterscheidet zudem den tatsächlichen Roh-HTML-Sink vom ungenauen ursprünglichen Notizfeld-Beispiel.

Die Befunde `lov_finding_4bd5ac08511c8e04` und `lov_finding_c4bcebcef88683c2` bleiben konservativ aktiv: Mitarbeiter- und Empfängerprüfung sind korrigiert; erlaubte freie SMS-/E-Mail-Inhalte und der vollständige Versandprozess verlangen weitere gesonderte Einzelabnahme. Keine dieser Meldungen wurde ignoriert.

## Bestandsschutz und echte Nachweisgrenzen

- 44 Product-Hub-Produkte vorhanden; keine produktiven Produktdaten oder Geräteflags geändert. Der aktuelle zeilenbasierte Hash wurde gelesen, ist wegen anderer Serialisierung nicht als Vergleich zum älteren anders berechneten Hash verwendet worden.
- 102 Cronjobs; unveränderter Fingerprint der IDs, Namen, Zeiten und Aktivierung: `4f652b55630548d00306cc87dc8e8919`.
- `ph2_activation`: `enabled=false`, `emergency_stopped=true`, `revision=0`; DE/COM `blocked`, beide ohne Pilotgerät. Alle Release-Gates weiterhin false.
- Product-Hub-Verträge v1.2/v1.3, API-Schlüssel und bestehende Providerzugänge unverändert. Keine neuen Tabellen, Dashboards oder Verwaltungsmodule.
- Ausgewählte Voränderungsquellen wurden als reine Quellarchive geprüft und unter privater Metadatenablage gespeichert; Prüfsummen sind separat dokumentiert. Dies ist **kein** Vollbackup oder isolierter Datenbank-Restore. Sichere Rücknahme nur über den bereits versionierten Quellstand und ohne Wiederherstellung ungeschützter Zugänge.
- Reale angemeldete Mitarbeiter-/Provider-/Mandantenabnahme ist hier nicht verfügbar: die externe Supabase-Verbindung bietet hier keine mintbare Sitzung. Keine Anmeldedaten angefordert, keine Anmeldung umgangen. Insbesondere diese Tests ersetzen keine echte Bedienung von Service-, Compliance-, After-Sales- und GitHub-Ansichten.
- Isolierte Restore-Umgebung, koordinierte historisch erforderliche Schlüsselrotation, 3CX-Providerkonfiguration und bestätigte Bankhosts bleiben konkrete externe Nachweisabhängigkeiten. Die übrigen 389 Befunde dürfen dadurch nicht als erledigt oder sämtlich blockiert gelten.

## Erneute Scans

Der Schnellscan vom 28.11.2026, 06:08 UTC ist vollständig abgeschlossen und meldet in seinem begrenzten Prüfbereich keine neu zu bearbeitenden aktiven Befunde. Eine nicht konfigurierte Connector-Prüfung wurde übersprungen. Die 492 älteren Linterhinweise und die 389 offenen Tiefenscan-Befunde bleiben davon getrennt. Ein neuer vollständiger Tiefenscan wird nach Speicherung des Korrekturstands angefordert. Bis zu dessen tatsächlichem Ergebnis ist dies kein erfolgreicher Abschlussnachweis; der Tiefenscan darf im Hintergrund laufen, weitere Korrekturen laufen nach Ende dieser Ausführung nicht automatisch weiter.

## Individuell als behoben gemeldete Befunde

| Kennung | Stufe | Ursprünglicher Befund |
|---|---|---|
| `lov_finding_006a75d168f7259a` | error | Anyone can trigger global private mail relinking |
| `lov_finding_00cdd0b3b328bc54` | warn | Anyone can change your AI reply instructions |
| `lov_finding_017d28bf009065b2` | warn | Anyone can trigger delivery approval reminders |
| `lov_finding_01c314f2b58b194b` | error | Anyone can change offer scores |
| `lov_finding_06a1757d08bfe5a6` | warn | Anyone can read the configured GitHub repository history |
| `lov_finding_08c1beda03a5ef65` | error | Anyone can view customer scores and routing details |
| `lov_finding_0c5f1761b23eafc4` | warn | Anyone can attach translations to another customer |
| `lov_finding_0cd00d4445ad701e` | error | SMS calls can create unauthorized case reminders |
| `lov_finding_0d8093ef07d6af38` | warn | Anyone can retrieve another customer's private score |
| `lov_finding_1376815e4ca5950a` | error | Ticket IDs bypass the caller's ticket access policy |
| `lov_finding_13d6e91ec712f40a_604475b4` | error | Anyone can view customer scores and routing details |
| `lov_finding_13d6e91ec712f40a_938ad76d` | warn | Anyone can see customer routing scores |
| `lov_finding_183ae0ad4cf721dc` | error | Task IDs bypass compliance-task access policies |
| `lov_finding_1a19768baf09053c` | warn | Anyone can attach AI predictions to arbitrary contacts |
| `lov_finding_232765c9fa069fde` | error | Any signed-in user can email another team's case details |
| `lov_finding_265e0876fae815a7` | warn | Anyone can use the paid translation service |
| `lov_finding_32ab3ba23bc4c3c6` | error | Anyone can trigger changes to overdue cases |
| `lov_finding_38eef2927644a86c_2da0a87d` | error | Anyone can trigger private ticket SLA updates |
| `lov_finding_38eef2927644a86c_47b6f826` | error | Anyone can change ticket SLA and escalation records |
| `lov_finding_413dd4d3641d23bd` | error | AI endpoint updates cases without a staff-role check |
| `lov_finding_46f5161d4ac3e8ad` | warn | Anyone can resend private delivery feedback |
| `lov_finding_675c4841c9be4f6b` | error | Anyone can see internal routing and staffing details |
| `lov_finding_6bf1f59bfed31c4a` | warn | Anyone can trigger ticket escalation and status updates |
| `lov_finding_8b7a66d6300430d8` | error | Any signed-in user can text another team's case details |
| `lov_finding_8f7400d5e5114123` | warn | Anyone can change ticket SLA status |
| `lov_finding_94cdd9971915518b` | warn | Case ID exposes other case context to AI |
| `lov_finding_951b00a22a7089dc` | error | Public workflow exposes privileged case processing |
| `lov_finding_bd3c66fffca55a42` | warn | Anyone can trigger delivery approval escalations and reminders |
| `lov_finding_bd8aa8e8464a8bf8_ac8609e0` | warn | Anyone can read the configured GitHub repository’s commits |
| `lov_finding_bd8aa8e8464a8bf8_b1e2f1bb` | warn | Anyone can read the configured GitHub repository history |
| `lov_finding_d788ed2671203a5e` | error | Any signed-in user can text another team's case details |
| `lov_finding_dfc8524202f9f39e_139ee84c` | warn | Anyone can trigger approval escalation messages |
| `lov_finding_dfc8524202f9f39e_e47e4661` | warn | Anyone can send delivery approval reminders |
| `lov_finding_e0ffb2301eb1c785` | warn | Anyone can send security-alert emails |

Die vollständige 472-ID-Bilanz sowie die 19 Funktionsnachweise bleiben als CSV im Projektbericht enthalten.
