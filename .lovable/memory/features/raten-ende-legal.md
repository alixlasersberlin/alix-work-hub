---
name: RATEN ENDE LEGAL
description: Beendete Ratenverträge (status='legal_ended') unter /finance/raten-ende-legal, keine wiederkehrenden Rechnungen mehr
type: feature
---
- Button „BEENDEN" in Wiederkehrende Zahler (Aktionsleiste je Vertrag) setzt `zoho_recurring_profiles.status = 'legal_ended'`.
- Seite `src/pages/Finance/RatenEndeLegal.tsx`, Route `/finance/raten-ende-legal`, Menü unter RATENZAHLER → Wiederkehrende Zahler (auch im Workspace, da aus navItems abgeleitet).
- Wiederkehrende Zahler filtert `status != 'legal_ended'`.
- Edge Function `ratenplan-invoices` erzeugt für solche Profile keine Raten mehr.
- `sync-zoho-recurring-profiles` überschreibt den Status `legal_ended` nicht (kein Reaktivieren durch Zoho).
- „Zurückholen" setzt Status auf `pruefung`.
