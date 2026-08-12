---
name: RATEN PRÜFUNG (Versandstopp)
description: Verträge mit status='pruefung_hold' unter /finance/raten-pruefung – Rechnungen werden erzeugt, aber zurückgehalten und beim Zurückholen automatisch versendet
type: feature
---
- Button „PRÜFUNG" (amber) in Wiederkehrende Zahler setzt `zoho_recurring_profiles.status = 'pruefung_hold'`.
- Seite `src/pages/Finance/RatenPruefung.tsx`, Route `/finance/raten-pruefung`, Menü unter RATENZAHLER → Wiederkehrende Zahler.
- Wiederkehrende Zahler filtert `pruefung_hold` (und `legal_ended`) aus.
- `ratenplan-invoices` erzeugt für Hold-Profile weiterhin Raten, aber mit Status `zurueckgehalten` statt `offen`.
- Cron-Mails (`rz-reminder-build`, `recurring-prenotification`) greifen nur bei `status=active` → kein Kundenversand während der Prüfung.
- „Zurück & versenden" setzt Status auf `active` und ruft Edge Function `pruefung-release` auf: versendet alle `zurueckgehalten`-Rechnungen per `send-invoice-mail` und setzt sie auf `offen`.
