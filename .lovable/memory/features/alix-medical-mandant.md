---
name: Mandant Alix Medical (MED)
description: Eigenständiger Belegkreis für Alix Medical unter /med mit Artikeln, Belegen, Buchhaltung, MDR/CE/ISO-13485-Dokumentation und Nummernkreisen
type: feature
---
Phase 3 des Multi-Mandanten-Systems, rein additiv (bestehende Module unverändert).

Tabellen: `med_item_categories`, `med_items` (inkl. udi_di, mdr_class, ce_number), `med_documents`, `med_document_items`, `med_payments`, `med_number_ranges`, `med_compliance_docs`.
RLS: Lesen bei `has_tenant_access(tenant_id)`, Schreiben zusätzlich `med_can_write()` (Super Admin, Admin, Geschäftsführung, Medical), Löschen nur Super Admin.

Frontend:
- `src/hooks/useMedTenant.ts` — Tenant MED + Schreibrecht, Belegarten/Status/Compliance-Arten, `medMoney`.
- `src/pages/MED/` — Dashboard, Artikel, Belege, Buchhaltung, Compliance, Einstellungen (Nummernkreise).
- Routen `/med`, `/med/artikel`, `/med/belege`, `/med/buchhaltung`, `/med/compliance`, `/med/einstellungen`; Sidebar-Gruppe „Alix Medical".

Belegnummern: Präfixe MED-AN/AB/RE/GS/LS/SV/WA, Format `PREFIX-JAHR-0001`, Zähler in `med_number_ranges`.
