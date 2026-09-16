# FIBU LIGHT Phase 3 – Bank & Zuordnung – Produktionsfreigabe

**Status:** PRODUKTIONSFREIGABE: JA
**Freigabedatum:** 16.09.2026
**Freigabe durch:** Ronny D. Eitner
**Grundlage:** Abnahmebericht `docs/fibu-light/phase3-abnahmetest-2026-09-16.md`

## Geltungsbereich

Freigegeben ist ausschließlich **FIBU LIGHT Phase 3 – Bank & Zuordnung**
(Seite „Bank & Zuordnung“ `/fibu-light/bank`, Matching-Vorschläge, Bestätigung,
Teil-/Sammel-/Über-/Unterzahlung, Klärfälle, Zuordnungsprotokoll).

## Freigabegrundlage

- Tests: **20/20 BESTANDEN**
- Datenintegrität: **BESTANDEN** (0,00 € Abweichung)
- Rollen-/Sicherheitstest: **BESTANDEN**
- Doppelbuchungsschutz: **BESTANDEN**
- Offene Fehler: **0**

## Unveränderte Einschränkungen

Diese Punkte werden durch die Freigabe **nicht** nachträglich als anders getestet dargestellt:

1. **Bildschirmnachweise: UNVOLLSTÄNDIG.**
2. **Paralleltest (Test 13)** erfolgte mit zwei Benutzeridentitäten gegen denselben
   Umsatz mit serverseitiger Datensatzsperre (`FOR UPDATE`), nicht mit zwei realen
   parallelen Browser-Sitzungen.

## Ausdrücklich nicht freigegeben

- **Anwalt / internes Inkasso** (Markierung, Massenübergabe, `op_light_escalations`,
  `fibu_light_set_escalation`, `fibu_light_clear_escalation`):
  **PRODUKTIONSFREIGABE: NEIN**, bis der eigene Testkatalog abgeschlossen und
  separat freigegeben ist (siehe `docs/fibu-light/anwalt-inkasso-status.md`).

## Historische Daten

Es wurden keine Rechnungen, Rechnungsnummern, Zahlungen, PDFs oder
GoBD-/Audit-Protokolle verändert. Der Abnahmebericht bleibt unverändert;
spätere Änderungen erzeugen eine neue Version statt einer Überschreibung.
