---
name: Finance Controlling – keine Verrechnungen
description: Jeder Finance-Controlling-Vorgang ist eigenständig; keine Gegenrechnung zwischen Reparatur/Lieferung/Schlussrechnung, keine negativen Beträge
type: feature
---
- Reparatur-Vorgänge (`fc_cases.case_type='REPARATUR'`) nutzen ausschließlich den Reparaturbetrag bzw. den freigegebenen Kostenvoranschlag — niemals die Finanzen des verknüpften Verkaufsauftrags.
- `fc_refresh_order` aktualisiert keine REPARATUR-Fälle.
- `open_to_invoice` / `open_to_pay` werden nie negativ (keine Verrechnung/Gutschrift-Effekte).
- Neue Auslöser erzeugen immer eigene Vorgänge (Unique auf source_table/source_id/trigger_event).
