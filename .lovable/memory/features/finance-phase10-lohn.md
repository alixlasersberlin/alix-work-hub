---
name: Finance Phase 10 Lohnbuchhaltung & Sozialversicherungen
description: Lohnläufe, Lohnjournal, Lohnarten und SV-Sätze (CH AHV/ALV/BVG, EU RV/KV/PV/AV) unter /finance/lohnbuchhaltung
type: feature
---
- Tabellen: `finance_wage_types` (Lohnarten je Region, kind earning|deduction|employer_contribution), `finance_social_rates` (AN-/AG-Satz, Gültigkeit), `finance_payroll_runs` (Periode + Region, Status entwurf|freigegeben|verbucht, Summen), `finance_payroll_lines` (Mitarbeiter, Lohnart, Betrag, Konto, Kostenstelle).
- Trigger `trg_fin_payroll_recalc` aggregiert Brutto/Abzüge/Netto/AG-Kosten/MA-Anzahl automatisch auf den Lauf.
- RLS über `can_manage_payroll()` (Admin, Super Admin, GF, Finance, Buchhaltung Admin/EU/CH); DELETE nur Super Admin.
- Seite `/finance/lohnbuchhaltung` (Menü STATISTIK): Tabs Lohnläufe | Lohnjournal | Lohnarten | SV-Sätze, CSV-Import (Name;Personalnr;Lohnart;Betrag;Konto;KST) und Exporte Journal + Buchungssätze.
- Regionsabhängig via `useAccountingRegion()`: EUR/EU bzw. CHF/CH.
