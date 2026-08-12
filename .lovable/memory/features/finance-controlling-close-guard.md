---
name: Finance Controlling – Abschluss-Sperre & Auto-Rechnungsentwurf
description: Kein Auftragsabschluss ohne Rechnung (DB-Trigger), automatische Rechnungsentwürfe (fc_invoice_drafts), Audit Trail in fc_events
type: feature
---
- **Harte Sperre (DB):** `fc_block_order_close` (BEFORE UPDATE OF order_status ON orders) verhindert Status `geschlossen/abgeschlossen/closed`, solange `fc_order_invoice_gap(order_id) > 0.01`. Abschaltbar über `app_settings.key='fc_close_block'` = `off`.
- **Auto-Rechnungsentwurf:** Trigger `fc_case_autodraft` auf `fc_cases` erzeugt via `fc_create_invoice_draft()` genau einen offenen Entwurf pro Vorgang. Modus: **nur Entwurf**, kein automatischer Versand. Abschaltbar über `app_settings.key='fc_auto_draft'` = `off`.
- **Teillieferung:** Entwurf wird **anteilig** berechnet (Auftragswert − offener Betrag der Lieferung − bereits fakturiert), Fallback = kompletter offener Betrag.
- Garantie/Kulanz-Fälle erzeugen keinen Entwurf.
- Sobald eine Rechnung die Lücke schließt (`fc_refresh_order`), wird der Entwurf automatisch auf `erstellt` gesetzt.
- **Audit Trail (ISO 13485/MDR):** jede Entwurfserzeugung, Statusänderung und der endgültige Auftragsabschluss (`fc_log_order_close`) landen mit Benutzer und Zeitstempel in `fc_events`.
- Tabelle `fc_invoice_drafts`: Lesen/Anlegen/Ändern für alle angemeldeten Nutzer, Löschen nur Super Admin.
