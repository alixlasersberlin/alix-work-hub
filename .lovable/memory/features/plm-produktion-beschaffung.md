---
name: Produktion & Beschaffung (PLM/MDR/ISO 13485)
description: PLM-Modul unter /produktion mit Geräten, Baugruppen, Einzelteilen, BOM, Explosionszeichnungen, Lieferanten, Wareneingang, Prüfplänen, Produktionsaufträgen, ECR/ECO und technischer Doku
type: feature
---
Tabellen mit Präfix `plm_`: devices, assemblies (hierarchisch via parent_id), parts, suppliers, part_suppliers, bom_items, documents, drawings, drawing_positions, changes (ECR/ECO), inspection_plans, inspection_items, goods_receipts, production_orders, work_instructions, audit_log.

Schreibrechte über DB-Funktion `plm_can_write()`: Super Admin, Admin, Geschäftsführung, Medical, Produktion, QM. Löschen nur Super Admin.

Frontend:
- `src/lib/plm/config.ts` — Statuslisten und Feldtypen.
- `src/components/plm/PlmCrudPage.tsx` — generische Liste/Formular/CRUD-Komponente (schreibt zusätzlich `plm_audit_log`).
- `src/pages/PLM/*` — Dashboard, Geräte, Baugruppen, Einzelteile, Stückliste, Explosionszeichnungen (klickbare Positionsnummern mit x/y in Prozent), Lieferanten, Wareneingang, Prüfpläne, Prüfmerkmale, Produktionsaufträge, Arbeitsanweisungen, Änderungen, Dokumente.
- Routen `/produktion/*`, Sidebar-Gruppe „PRODUKTION & BESCHAFFUNG“.
