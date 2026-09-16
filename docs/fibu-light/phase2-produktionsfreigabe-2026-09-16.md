# FIBU LIGHT Phase 2 – Produktionsfreigabe

**Status:** PRODUKTIONSFREIGABE: JA
**Freigabedatum:** 16.09.2026
**Freigabe durch:** Ronny D. Eitner
**Grundlage:** Abnahmetest `docs/fibu-light/phase2-abnahmetest-2026-09-16.md` (14/15 bestanden)

## Geltungsbereich

Freigegeben ist ausschließlich FIBU LIGHT Phase 2 (Seite „Offene Posten Light“,
Dashboard, Schnellbuchung, Mahncenter mit Vorschau, Klärungsfälle/Mahnsperren,
Ratenvereinbarungen, Buchungsfehlermeldung, lesende Bankvorschläge).

## Ausdrücklich nicht freigegeben

- **Phase 3 – Bankumsätze & Zahlungszuordnung**: nicht freigegeben. Erfordert einen
  separaten Entwicklungs- und Testschritt sowie eine eigene Freigabe.

## Offene Nachweise (durch diese Freigabe NICHT als bestanden gewertet)

1. 15 Bildschirmnachweise (Prüfpunkt 15 des Abnahmetests) – weiterhin OFFEN.
2. Realer Mahnversand per E-Mail an einen echten Empfänger – weiterhin OFFEN.
3. Vier-Augen-Nachprüfung der Abnahme – weiterhin OFFEN.

Der technische Vorabtest bleibt unverändert mit 14/15 dokumentiert. Dieses
Freigabedokument überschreibt den Testbericht nicht; spätere Änderungen erzeugen
eine neue Version statt einer Überschreibung.

## Maßnahme Testkonto

Das Testkonto **FIBU LIGHT TEST** (`fibu-light-test@alix-operation.de`,
ID `ceebcae5-7c1c-44b3-b8d1-b22fdd0b7a8d`) wurde am 16.09.2026 deaktiviert:

- `is_active = false`, `account_status = 'disabled'`
- `password_reset_required = true` (im Chat genanntes Kennwort damit unbrauchbar)
- Rollenzuordnung `FIBU LIGHT` entzogen

Eine erneute Nutzung erfordert eine ausdrückliche Reaktivierung durch einen
Super Admin inklusive neuem Kennwort.

## Historische Daten

Es wurden keine Rechnungen, Zahlungen, Rechnungsnummern, PDFs oder
GoBD-/Audit-Protokolle verändert.
