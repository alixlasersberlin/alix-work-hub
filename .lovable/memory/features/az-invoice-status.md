---
name: Anzahlungsrechnung Status nach Versand
description: AZ-Rechnungen wechseln nach erfolgreichem E-Mail-Versand automatisch von "Entwurf" auf "Versendet / Offen"
type: feature
---
Regel gilt für alle Anzahlungsrechnungen (finance_deposits, AzInvoiceTab):

- Nach erfolgreichem E-Mail-Versand (auch Wiederversand einzelner Raten) wird der Status der Rate in `finance_deposits` von `entwurf` auf `offen` gesetzt (Label "Versendet / Offen").
- Anzeige in der Ratenliste: `entwurf` → "Entwurf", `offen` → "Versendet".
- Gilt für jede neue Rate/jeden neuen Auftrag automatisch — keine manuelle Nacharbeit.
