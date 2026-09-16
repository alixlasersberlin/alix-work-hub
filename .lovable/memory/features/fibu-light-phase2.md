---
name: FIBU LIGHT Phase 2
description: Arbeitsoberfläche /offene-posten-light mit Ampel, Schnellbuchung, Mahncenter, Klärungsfällen, Ratenvereinbarungen, Buchungsfehler-Meldung und Bank-Vorschlägen
type: feature
---

Erweiterung von „Offene Posten Light“ (Rolle FIBU LIGHT, Route `/offene-posten-light`).

Tabellen (additiv):
- `op_light_dunning_rules` — zentrale Mahnfristen (Stufe 1–4, offset_days 3/7/14/21). Nur Admin darf ändern, FIBU LIGHT nur lesen.
- `op_light_case_events` — append-only Klärungsfälle/Mahnsperren (`set`/`clear`, Grund, Notiz, `pause_until`), unveränderbar per Trigger.
- `op_light_installment_plans` + `op_light_installments` — Ratenvereinbarungen; Originalrechnung bleibt unverändert.
- `op_light_booking_issues` — gemeldete Buchungsfehler (FIBU LIGHT darf Zahlungen nie ändern/löschen).

RPCs: `fibu_light_open_items` (erweitert um case_*, plan_id, next_rate_*, next_action_level),
`fibu_light_set_clarification`, `fibu_light_clear_clarification`, `fibu_light_create_installment_plan`,
`fibu_light_report_booking_issue`, `fibu_light_bank_match_suggestions` (nur lesend, Vorbereitung Phase 3),
`fibu_light_invoice_history` (jetzt inkl. cases/installments/issues).

UI-Regeln:
- Ampel ist reine Arbeitskennzeichnung: grün nicht fällig, gelb 1–7, orange 8–14, rot >14 Tage, blau Teilzahlung, grau Klärung/Sperre.
- Drei Hauptaktionen oben: Überfällige bearbeiten, Zahlung buchen (globale Schnellbuchung mit Suche), Mahnungen bearbeiten.
- Mahncenter gruppiert nach nächster Stufe, Mehrfachauswahl nur mit Prüf-/Vorschauschritt — kein ungeprüfter Massenversand.
- Mahnsperre entfernt die Rechnung nicht aus dem offenen Saldo.
- Keine Konten/Buchungsschlüssel in FIBU LIGHT.

Phase 3 (offen): Bankumsätze direkt in FIBU LIGHT zuordnen und buchen, niemals automatisch.
