---
name: Finance Phase 8 BWA + Jahresabschluss
description: BWA/GuV/Bilanz Reporting und Jahresabschluss-Cockpit mit Buchungssperre
type: feature
---
- Seiten: /finance/bwa, /finance/guv, /finance/bilanz, /finance/jahresabschluss
- BWA: aggregiert finance_transactions (income/expense via transaction_type Heuristik) + finance_incoming_invoices (category) + finance_asset_depreciations; monatlich + Jahr + Vorjahresvergleich, CSV-Export
- GuV: §275 HGB Gesamtkostenverfahren (vereinfacht): Umsatz – Wareneinsatz – sbA – AfA – Zinsen
- Bilanz (vereinfacht, stichtagsbasiert): Anlagevermögen aus finance_assets.book_value, Forderungen aus finance_accounts, Bank aus finance_bank_lines, Verbindlichkeiten aus offenen finance_incoming_invoices; Eigenkapital als Restgröße
- Jahresabschluss-Cockpit: Tabelle finance_year_end_runs (fiscal_year, status offen/in_arbeit/abgeschlossen, closing_date, closed_by/at, reopened_by/at, checklist jsonb, notes); Checkliste 8 Punkte; "Abschließen" sperrt Buchungen
- Trigger enforce_year_end_lock auf finance_transactions: blockt INSERT/UPDATE/DELETE wenn fiscal_year abgeschlossen, außer has_role('Super Admin'); Stichtag = booking_date
- RLS: Lesen Admin/Super Admin/Finance/Geschäftsführung; Schreiben Admin/Super Admin/Finance; DELETE nur Super Admin; Wiedereröffnen nur Super Admin (UI-seitig)
- Finance Cockpit erweitert um Quick-Links zu BWA/GuV/Bilanz/Jahresabschluss/Liquidität
