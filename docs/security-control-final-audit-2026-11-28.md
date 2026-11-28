# ALIXWORK – SECURITY CONTROL CENTER FINAL AUDIT

Prüfstand: 2026-11-28T04:20:02.614390+00:00 · Bericht 985d16bc1bb6bdc3e3b7

## Ergebnis

**Nicht vollständig abgenommen. Kein Korrekturpaket ausgeführt. DE und COM bleiben gesperrt, Notstopp aktiv.**

Der abgeschlossene Hintergrundlauf meldet erneut `incomplete` (04:14 UTC). 474 aktuelle Scanner-IDs, darunter alle 188 früher offenen und 286 zusätzliche, wurden mit aktuellen Quelldateien abgeglichen. 493 ältere Datenbankhinweise weiterhin im aktuellen Linter; 488 Funktions-/Rollenhinweise anhand tatsächlicher Definitionen und EXECUTE-Rechte sowie 2 Tabellen- und 3 Erweiterungshinweise anhand Metadaten geprüft. 25 historisch gezielt behobene Befunde separat erhalten. 3 zusätzliche manuell bestätigte Kontrollmängel. Kein abschließend deduplizierter Schwachstellen-Gesamtwert.

995 eindeutig identifizierte **Prüfdatensätze**, nicht 995 bestätigte Schwachstellen. 260 Quelldateien gelesen; 581 aktuelle Definer-Definitionen erfasst. Alle Datensätze besitzen Ursache, Auswirkung, Empfehlung, Korrekturplan und konkreten Prüfstand. Automatische Quellmerkmalsuche dient nur der nachvollziehbaren Vorprüfung und bestätigt keine semantische Autorisierung.

## Tatsächliche Einordnung

- Bestätigtes Risiko: 8
- Historisch bereits behoben: 25
- Manuell bestätigte doppelte Befunde: 2
- Abschließend veraltete Befunde: 0
- Kein Expositionsnachweis durch RLS ohne Policy: 2
- Nicht abschließend prüfbare Datensätze: 958

Die 8 bestätigten Risikodatensätze betreffen ungeschützten Product-Hub-Import (mehrere Datenoperationen), Rollenvererbung sowie 3 Kontrollmängel; gleiche Komponenten sind nicht automatisch dieselbe Ursache. Ein zusätzliches Import-INSERT und eine Mapping-Abfrage wurden als semantische Dubletten zugeordnet, ohne Scannerbefunde zu schließen. Veraltete Befunde wurden nicht aus bloßer Scanabwesenheit abgeleitet. Die zwei RLS-ohne-Policy-Hinweise sind kein Nachweis offener Tabellen, Service-Zugriff bleibt gesondert zu bewerten.

## Priorisierte nächste Maßnahmen

1. **Paket A / Product Hub:** Importzugang und Weitergabe des Quellenzugangs an frei gewählte URLs absichern; vor Änderungen Aufrufer erfassen. Keine ausnutzende Testsendung an fremde URLs.
2. **Paket A / Rollen:** Admin→Super-Admin-Vererbung in `has_role` und deren Policy-Abhängigkeiten nach gesonderter Freigabe korrigieren; bestehende exakte Release-Fassade nicht ersetzen. Legacy-COM-Sender bleiben durch `controlled_modes` aktuell blockiert, sind vor späterer Freigabe trotzdem sicherheitsrelevant.
3. **Paket B / Systemsicherheit:** Direkte Freigabemanipulation und zu breite Sicherheitsmetadatenrechte korrigieren; aktive Kontoprüfung für ältere Verwaltungsaktionen ergänzen. Kein Eingriff bereits ausgeführt.
4. **Pakete B/C:** Alle übrigen rollen-/mandantenabhängigen Hinweise mit echten getrennten Benutzern und isolierten Datensätzen abnehmen. Providerverträge und automatische Aufrufer vor Änderungen prüfen; keine produktiven Testnachrichten.
5. **Pakete D/E:** Niedrige Risiken und Optimierungshinweise getrennt prüfen, keine Funktionsrechte blind entziehen.
6. Vollständige weitere Tiefenprüfung und semantischen Dublettenabgleich erst als abgeschlossen melden, wenn Scanner und reale Einzelabnahmen vollständig sind.
7. Veröffentlichung der bestehenden Ansicht prüfen; echte angemeldete Bedienbarkeit bleibt mangels externer Supabase-Sitzung offen. Keine Zugangsdaten anfordern oder Rechte umgehen.

## Schutzprüfungen

### Geschützter Bericht / Freigabe-Handler

Ungültiges Token tatsächlich 401; exakte Rolle und aktives Konto im Quellcode. Echte Benutzerabnahme offen.

### Client-Manipulation von Prüfergebnissen

Bericht serverseitig revisioniert; vorhandene Release-Control-Aktion berechnet Nachweise selbst. Echter manipulierter unangemeldeter Aufruf 401. Autorisierte E2E-Prüfung offen.

### Korrekturfreigaben umgehen

Nicht bestanden: SCC-FINAL-001; direkte Tabellenänderungen durch Rollenvererbung möglich.

### Protokolle nachträglich verändern

audit_logs besitzt WORM-Trigger; ph2_-Nachweise reservierten Trigger. Freigabetabelle hingegen nicht unveränderlich (SCC-FINAL-001). Kein pauschaler Erfolg.

### Schlüssel in Berichten

Keine Schlüsselwerte übernommen; Einzelnachweise enthalten nur Kennungen, Prüfmerkmale und SHA-256. Umfassende historische Protokollprüfung nicht abgeschlossen.

### Zugriff durch normale Benutzer

Menü und `/security-center` verlangen die tatsächlich zugewiesene Super-Admin-Rolle; `control_overview/control_approve` prüfen serverseitig Identität, exakte Rolle und aktives angenommenes Konto. Ungültige Live-Tokens wurden mit 401 abgewiesen. **Nicht vollständig bestanden:** Ältere Tabellen/Views sind über die Data-API breiter lesbar; `security_policy_details` gibt Katalogmetadaten ohne eigene Rollenprüfung aus. Eine Menübeschränkung ist kein vollständiger Datensicherheitsschutz.

### Protokolle und Freigaben

`audit_logs` blockiert UPDATE/DELETE durch WORM-Trigger; reservierte `ph2_`-Nachweise besitzen bestehenden Guard. `security_audit_findings` hat jedoch keinen Unveränderlichkeitsguard und erlaubt über geerbte Super-Admin-Prüfung Admin-Änderungen. Deshalb kein pauschaler erfolgreicher Manipulationsschutz.

### Product Hub

Nur relevante Risiken und explizit markierte Sicherheitsabhängigkeiten werden in Release Control gezeigt. Bestätigte P0/P1 und ungeklärte P0 blockieren die dargestellte Sicherheitsabnahme. Die vorhandene serverseitige Release-Matrix verlangt weiterhin einen frischen konfigurationsgebundenen bestandenen Sicherheitsnachweis; es wurde kein positiver Nachweis erzeugt und keine zweite Freigabelogik eingeführt.

### Quickscan

Aktueller kurzer Datenbankscan abgeschlossen, keine aktive neue Quickscan-Meldung. Ein vom Benutzer bereits ignorierter Eintrag wurde nicht erneut bearbeitet oder als offene Maßnahme übernommen. Das ist kein Ersatz für den unvollständigen Tiefenscan oder den separaten Linter.

## Grenzen

- Tiefenscan erneut incomplete: keine vollständige Sicherheitsabnahme.
- Semantische Dublettenprüfung nur für zwei manuell bestätigte Paare abgeschlossen; übrige Zuordnungen offen.
- Echte angemeldete Super-Admin-/Normalbenutzer-Ansicht mangels externer Sitzung nicht prüfbar.
- Keine Korrekturpakete ausgeführt; bestehende Scannerbefunde weder geschlossen noch ignoriert.

## Unveränderte Produktivbestände vor Prüfung

44 Produkte, Fingerprint `936dc6209c4afc91c1d54dad8e28d773`; 102 automatische Zeitpläne, Fingerprint `cd3e3d31e6c55af14d5966f710aa90fa`. DE/COM mode=blocked, revision=0, enabled=false, emergency_stopped=true. Schlüssel nicht gelesen/geändert. Nachkontrolle und Veröffentlichungsergebnis werden getrennt protokolliert.

## Einzelinventar

Begleitende CSV enthält jeden ursprünglichen Befund, Klassifikation, Paket, Product-Hub-Bezug und Hash-/Metadatennachweise. Alle Datensätze bleiben erhalten; keine Scanner-Findings als behoben oder ignoriert gemeldet.


## Nachkontrolle und Validierung

Produkt- und Cron-Fingerprints nach Abschluss exakt unverändert (44 Produkte / 102 Jobs). Vorhandener Sicherheitsnachweis weiterhin passed=false/complete=false, kein positiver Proof geschrieben. 15 Frontend- und 8 Servertests bestanden; synthetische Tests sind keine echte angemeldete Abnahme. Live-Endpunkte mit ungültigem Token: control_overview, control_approve und ph-release-control jeweils 401. Browser auf app.alixwork.de/security-center und Preview führt unangemeldet zur AlixWork-Anmeldung, keine Laufzeitfehler. Geschützte Ansicht und Bedienung mit echtem Super Admin nicht prüfbar, da keine externe Supabase-Sitzung verfügbar ist. Veröffentlichung wird angefordert; erfolgreiche Anfrage ist kein Nachweis abgeschlossener Bereitstellung.


## Veröffentlichungsanfrage

Veröffentlichung am 28.11.2026 04:23 UTC angefordert, erwartete URL https://alix-pro-hub.lovable.app. Das Werkzeug bestätigt die Planung, nicht den Abschluss der Bereitstellung. Nutzerentscheidung 04:24 UTC: ausschließlich veröffentlichen, keine Korrekturpakete ausführen. Veröffentlichung meldet 266 offene kritische Scannerbefunde; diese Zahl ist die Scannerbewertung, nicht die Anzahl manuell bestätigter Risiken. Die angemeldete Ansicht bleibt unbestätigt. Lovable-URL kann auf Wunsch umbenannt werden; vorhandene Domains und Sichtbarkeit unverändert.
