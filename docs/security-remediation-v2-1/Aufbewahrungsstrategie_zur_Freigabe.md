# Sicherheitsprotokollierung – Aufbewahrungsstrategie zur separaten Freigabe

**Vorschlag, nicht eingerichtet oder freigegeben.** Keine Änderung der bestehenden 102 Zeitpläne, Tabellen, Berechtigungen oder Löschfristen. Keine Aussage über rechtliche Belegfristen; diese bleiben unverändert und sind getrennt fachlich zu prüfen.

## Bestehende Möglichkeiten und Grenzen

- `audit_logs`: Benutzerreferenz, Aktion, Modul, Objekt, Zeitpunkt, Details und optionale Netzwerk-/Clientdaten.
- `audit_changes`: Änderungen mit Objekt-/Feld-/Benutzerreferenz; Alt-/Neuwertfelder dürfen keine Passwörter oder Tokens als Sicherheitsprotokoll übernehmen.
- `audit_access_log`: vorhandene Zugriffsmetadaten und IP-Hash; komplette E-Mail-Adressen/Filter nur bei belegtem Zweck, nicht als Standard-Sicherheitsdaten duplizieren.
- `alix_security_events`: Auth-/Sicherheitsereignisse mit Ereignisart, Ergebnis, Schwere, Organisation und Geräte-/Sitzungsbezug; keine Session-Tokens speichern.
- `security_audit_findings`: bestehende Korrektur-/Freigabenachweise; Freigabe-, Ausführungs- und Scannerzustände getrennt halten.
- Bereits vorhandene Jobs: 84 audit-retention-purge (03:30 täglich), 85 audit-alert-digest-hourly (stündlich), 95 housekeeping-purge-logs (Sonntag 03:30); daneben bestehende Sicherheitsprüf-/Benachrichtigungsjobs. Keiner geändert. Ihre tatsächlich wirksamen Löschregeln und Legal-Hold-Unterstützung sind vor Einführung einer Frist zuerst zu verifizieren.
- Die verfügbaren Serverlogdaten zeigten nur ca. zehn Minuten; daraus folgt keine bewiesene allgemeine Supabase-Aufbewahrungsfrist. Sichtbarkeit, Projektplan, Abrufebene und tatsächliche Retention getrennt klären.
- Ein administrativ eingerichteter EU-Logexport/Log-Drain beziehungsweise private unveränderliche Archivablage wäre möglich, sofern der Supabase-/Providerplan und ein geeigneter Auftragsverarbeitungsvertrag dies unterstützen. Verfügbarkeit und Kosten nicht verifiziert, keine Verbindung angelegt.

## Vorgeschlagene Fristen

| Datenklasse | Vorschlag | Zweck / Begrenzung |
|---|---|---|
| Fehlgeschlagene Zugriffsversuche und technische API-Metadaten | 30 Tage unmittelbar auswertbar | Fehler-/Angriffskorrelation; nur Methode, erlaubter Pfad, Ergebnis, Zeit und pseudonyme Ereignis-/Akteurreferenz |
| Auth-Ereignisse, Rollenänderungen, privilegierte administrative Aktionen | 90 Tage unmittelbar auswertbar, insgesamt höchstens 365 Tage geschützt archiviert | Nachvollziehbarkeit privilegierter Eingriffe; konkrete rechtliche Grundlage, Erforderlichkeit und Zugriffsberechtigung vor Freigabe bestätigen |
| Finanzaktionen, Dokumentexporte, Änderungen an Sicherheitsfreigaben | Sicherheitsmetadaten 365 Tage | Nur Objekt-/Mandantenreferenz, Autorisierungsergebnis, Aktion, Revision und Ergebnishash; keine Beleg-/Dokumentinhalte. Rechtliche Originalbelegaufbewahrung getrennt |
| Bestätigte Vorfallbeweise | Individueller dokumentierter Hold, alle 90 Tage überprüfen | Umfang, Verantwortlicher, Rechtsgrundlage und Freigabe zur Aufhebung; kein unbegrenzter pauschaler Hold |
| Diagnostische Zusatzdaten wie vollständige IP/User-Agent | Standardmäßig nicht erheben; begründete Ausnahme maximal 7 Tage | Wenn erforderlich, danach entfernen oder zweckgebunden pseudonymisieren; keine stabile neue Personentracking-ID erzeugen |

Die Zahlen sind Vorschläge, keine bestehenden oder gesetzlich festgelegten Fristen. Datenschutzverantwortlicher und Super Admin müssen Datenklassen, Zwecke, Rechtsgrundlage, Empfänger, Kosten und Lösch-/Hold-Verhalten separat freigeben. Die Archivphase verlängert die jeweilige Gesamtdauer nicht automatisch darüber hinaus.

## Zu protokollierende Felder

UTC-Zeit, eindeutige Ereignis-ID, Aktion, Schwere, Erfolg/Ablehnungsgrund als kontrollierter Code, berechtigte Akteurreferenz beziehungsweise Maschinenklasse, Mandanten-/Objektreferenz, Funktions-/Codeversion, korrelierbare Request-ID und Freigabe-/Änderungsrevision. Keine freien Request-/Response-Payloads.

**Nie:** Passwörter, OTPs, vollständige Tokens, Refresh-/Session-/OAuth-Tokens, API-Schlüssel, vollständige Header oder Signing-Secrets. Keine Nachrichtentexte, Signatur-PDFs, Konto-/Kartennummern oder unnötige Empfänger-/Mitarbeiterdaten. Ablehnungen nur anhand sicherer Fehlercodes protokollieren.

## Schutz und spätere Abnahme

- Bestehende Sicherheitsverwaltung verwenden; keine neue Tabelle oder zweite Freigabeverwaltung.
- Exakte aktive Super-Admin-Berechtigung für Sicherheitsansicht, eng begrenzte schreibende Maschinenidentität, keine privilegierten Rollen aus editierbaren Profilfeldern.
- Append-only-Ereignisse und unabhängige unveränderliche Exportversionen mit SHA-256 und dokumentierter Vollständigkeit. Eine Prüfsumme allein verhindert keine Löschung oder Manipulation durch denselben Administrator.
- Zukünftige Löschung nur anhand separat freigegebener Fristen und Holds, mit Löschbeleg, ohne Geschäftsdaten anzutasten. Vorhandene Purge-Rechte/Regeln erst prüfen; keine unsicheren Berechtigungen als Rücknahme wiederherstellen.
- Isolierte Tests für Payload-Redaktion, rollen-/mandantenbegrenztes Lesen, manipulierte Freigabe, überschrittene Aufbewahrung, Hold, Exportgleichheit und Wiederherstellung. Keine produktiven Logs löschen oder verändern, um einen Test zu erzeugen.
