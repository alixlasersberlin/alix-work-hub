# Project Memory

## Core
- Internal business app "Alix Work" (Orders, Customers, Route Planning, Finance).
- Dark theme, Premium Enterprise UI (Black / Gold style). Modern and clean.
- Supabase backend. NEVER create new tables; strictly use existing schema.
- Role-Based Access Control (RBAC): Admins have full access, specialists have scoped access.
- Zoho `orders.order_number` is immutable — never overwrite in DB or sync; combine only for display.
- Production-Bestellungen (inkl. Reklamationen) müssen von Super Admin genehmigt werden, bevor PDF gesendet/heruntergeladen werden kann und bevor Lieferanten sie sehen.
- Alix Austria (`source_system='zoho_eu_2'`): UI-Suffix "-AT" für Kunden- und Auftragsnummer; bei Artikeln (item_name+sku) wird "-AT" direkt beim Sync in die DB geschrieben.
- DELETE auf allen Tabellen ist ausschließlich Super Admin erlaubt (RLS via `has_role('Super Admin')`).
- Neue Rolle **QM** existiert ausschließlich für das Bug & CAPA Modul (`/bug-capa`).

## Memories
- [Finance Phase 13 Konzern-Konsolidierung](mem://features/finance-phase13) — Monatskonsolidierung mit IC-Eliminierung + FX-Umrechnung
- [Finance Phase 14 Treasury+P2P+Meldewesen](mem://features/finance-phase14) — Bankkonten/Liquidität/Freigaben, PR→PO→Wareneingang→3-Way-Match, UStVA/ZM/OSS/Intrastat/E-Bilanz Export
