# FIBU LIGHT – Anwalt / internes Inkasso

Stand: 16.09.2026

## Einordnung

Separate Erweiterung von „Offene Posten Light“ (Markierung einzelner oder mehrerer
offener Posten, Massenübergabe an Anwalt oder internes Inkasso, Rückholung, Protokoll).

**Nicht** Bestandteil von FIBU LIGHT Phase 3 – Bank & Zuordnung.
**Nicht** durch den Phase-3-Abnahmebericht vom 16.09.2026 geprüft oder freigegeben.
Die 20 Phase-3-Testfälle decken diese Funktion nicht ab.

## Aktueller Status

- Entwicklungsstand: umgesetzt
- Funktionstest / Abnahme: **NICHT DURCHGEFÜHRT**
- Bildschirmnachweise: **KEINE**
- Rollen-/Sicherheitstest: **NICHT DURCHGEFÜHRT**
- Produktionsfreigabe: **NEIN**

## Umfang der Erweiterung

- Tabelle `op_light_escalations` (unveränderbar, nur Anhängen; UPDATE/DELETE gesperrt)
- `fibu_light_set_escalation(uuid[], text, text)` – Einzel- und Massenübergabe,
  Stufen `anwalt` und `inkasso_intern`, setzt automatisch eine Mahnsperre,
  protokolliert Benutzer, Zeitpunkt, Rechnung, Kunde, offenen Betrag und Notiz
- `fibu_light_clear_escalation(uuid, text)` – Rückholung als neuer Vorgang,
  löscht oder überschreibt keine Historie
- `fibu_light_open_items()` additiv um `escalation_stage`, `escalation_at`,
  `escalation_note` erweitert
- Oberfläche: Auswahlfelder, Massenaktionsleiste, Bestätigungsdialog mit
  Forderungsliste und Notiz, Kennzeichnung in der Liste, Filter „Beim Anwalt“ und
  „Internes Inkasso“, Einzelaktionen und Rückholung in der Detailkarte

Rechnungen, Rechnungsnummern, Zahlungen und historische Daten werden nicht verändert.

## Offen für eine Freigabe

1. Eigener Testkatalog (Markierung, Massenübergabe, Mahnsperre, Rückholung,
   Unveränderbarkeit des Protokolls, Rollen- und Serverzugriffstest, Audit-Nachweis)
2. Bildschirmnachweise
3. Ausdrückliche Freigabeentscheidung mit Datum und freigebender Person
