# GoBD Phase 15B – Technisches Ereignis: Datenbank-Verbindungsschicht nicht erreichbar

Status: OFFEN / WARNUNG (Phase 15 bleibt unverändert nicht bestanden)

## Ereignis

| Feld | Wert |
| --- | --- |
| Ereignisart | Verbindungsschicht (Connection Pooler) der Datenbank nicht erreichbar |
| Erstmals festgestellt | 2026-09-15 ca. 05:20 UTC |
| Weiterhin bestehend um | 2026-09-15 06:05 UTC (mehrfach geprüft: 05:32, 05:45, 05:52, 06:02 UTC) |
| Fehlerbild | `SUPABASE_POOLER_UNAVAILABLE` / `Connection terminated due to connection timeout` |
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
