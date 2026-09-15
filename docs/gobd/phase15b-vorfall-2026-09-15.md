# GoBD Phase 15B – Technisches Ereignis: Datenbank-Verbindungsschicht nicht erreichbar

Status: OFFEN / WARNUNG (Phase 15 bleibt unverändert nicht bestanden)

## Ereignis

| Feld | Wert |
| --- | --- |
| Ereignisart | Verbindungsschicht (Connection Pooler) der Datenbank nicht erreichbar |
| Erstmals festgestellt | 2026-09-15 ca. 05:20 UTC |
| Weiterhin bestehend um | 2026-09-15 07:42 UTC (mehrfach geprüft: 05:32, 05:45, 05:52, 06:02, 07:07, 07:08–07:13, 07:34–07:37 und 07:38–07:42 UTC) |
| Zwischenbefund 07:34–07:37 UTC | Schnittstellen-Endpunkt antwortet (HTTP 401 ohne Datenzugriff), echte Datenabfragen weiterhin HTTP 522; Datenbankschicht unverändert nicht erreichbar |
| Fehlerbild | `SUPABASE_POOLER_UNAVAILABLE` / `Connection terminated due to connection timeout`; über die Daten-Schnittstelle zusätzlich HTTP 522 (Zeitüberschreitung zum Ursprungsserver) |
| Auswirkung | Keine Lese- oder Schreibvorgänge auf der Datenbank möglich |
| Maßnahme | Bewusst keine weiteren Restore-, Reparatur- oder Schreibversuche erzwungen |
| Datenverlust | Keiner. Produktive Rechnungen, Zahlungen, Buchungen, Nummernkreise, Perioden und Audit-Daten unverändert |

## Stand Phase 15B zum Ereigniszeitpunkt

- Vollsicherung nach Backup-Korrektur: `45c73608-7651-4ebf-8820-02d4b31afac3`, abgeschlossen 2026-09-15 04:07:58 UTC, 1.570 Dateien, ca. 1,10 GB
- Isolierter Restore-Lauf: `749ac5d6-5438-405f-81b4-c3c606129bf6`
- Wiederhergestellte Datensätze: 80.217
- Protokolleinträge (`audit_logs`) im Restore: 55.338 = Sollwert zum Sicherungszeitpunkt
- Bisherige Tabellenvergleiche: 0 Identitätsabweichungen
- Historische Läufe unverändert erhalten: `b065a4a0-…` (passed_with_warnings), `63b9bdc0-…` (failed), `37c6b2ba-…` (abgebrochen)

## Offene Restpunkte (nach Wiederherstellung der Erreichbarkeit)

1. Inhaltlicher Audit-Vollvergleich über Datensatz-Hashes – Ziel 0 Abweichungen
2. Schutztests in der Restore-Umgebung: finalisierte Rechnung ändern/löschen, Audit ändern/löschen, Nummernkreis zurücksetzen/löschen, geschlossene Periode umgehen, Legal Hold umgehen – jeder Versuch muss abgewiesen werden
3. Finaler, unveränderbarer Phase-15B-Nachweis im Audit-Trail (Backup-ID, Zeitpunkt, Datensatzzahlen, Vergleichsergebnisse, Schutztests, gemessene RPO/RTO)

Erst danach: Phase 15 = BESTANDEN und Schließen der Sicherungs-WARNUNG aus Phase 14
(alte Warnung bleibt erhalten und wird als historisch behobener Befund gekennzeichnet).

Dieses Ereignis ist zusätzlich als Eintrag im GoBD-Änderungs-/Audit-Protokoll zu erfassen,
sobald die Datenbank wieder schreibbar ist.

## Notfall-Umbau am 2026-09-15 (ohne Datenbankzugriff umgesetzt)

- Verarbeitung auf max. 250 Datensätze je Paket begrenzt (vorher 100er-Pakete ohne Pause und ohne Zwischenstand je Paket)
- Checkpoint nach **jedem** Paket; Fortsetzung exakt an der letzten erfolgreichen Stelle, nie wieder ab Datensatz 1
- Cursor-Verarbeitung entlang der Sicherungsdatei, keine OFFSET-Pagination
- Pause von 350 ms zwischen den Paketen als Lastbremse
- Exponentielles Backoff (1/2/4/8/16/30 s, max. 6 Versuche) bei Zeitüberschreitung oder Ressourcenfehlern; danach automatisch PAUSIERT statt Wiederholungsschleife
- Health-Gate: vor Start/Fortsetzung wird die Datenbank leicht angetippt; bei Störung wird nicht gestartet
- Vergleich der Protokolleinträge weiterhin ausschließlich tabellenweise, nie als eine Vollabfrage
- Adminseite „GoBD · Datensicherung & Wiederherstellung": Fortschritt, aktuelles Paket, letzter Checkpoint, Fehler, Laufzeit, Status sowie PAUSIEREN / FORTSETZEN / SICHER ABBRECHEN
- Kein Restore, keine Migration, keine Änderung an Rechnungen, Zahlungen, Nummernkreisen oder Protokolldaten

Offen bleibt zusätzlich: nach der Stabilisierung die verursachende Abfrage/Funktion identifizieren
(fehlender Index, Trigger je Datensatz, N+1-Abfrage oder wiederholter Volltabellenscan) statt dauerhaft Compute zu erhöhen.
