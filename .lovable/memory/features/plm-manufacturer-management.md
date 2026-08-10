---
name: Manufacturer Management (MFR)
description: Herstellerdatenbank im PLM-Modul unter /produktion/hersteller mit Zertifikaten, Audits, Dokumenten, Lieferantenverknüpfung, Dubletten-Merge und BOM-/Excel-Import
type: feature
---
Tabellen: `plm_manufacturers` (Stammdaten, ISO/CE/FDA/UL/IEC-Flags, Audit, approval_status: gesperrt|freigegeben|bedingt_freigegeben), `plm_manufacturer_documents`, `plm_manufacturer_suppliers` (Lieferzeit, MOQ, Preis, Incoterms, Bewertung), `plm_manufacturer_merges`.
`plm_parts` erweitert um `manufacturer_id`, `original_part_number`, `predecessor_part_id`, `successor_part_id` (globaler Materialstamm — jedes Bauteil nur einmal, alle Geräte greifen darauf zu).

DB-Funktionen: `plm_normalize_manufacturer(text)`, `plm_merge_manufacturers(p_target, p_source)` (SECURITY DEFINER, prüft `plm_can_write()`).

Frontend: `src/lib/plm/manufacturers.ts` (Normalisierung, Levenshtein-Dublettenerkennung, Excel-Header-Mapping), Seiten `src/pages/PLM/Hersteller.tsx`, `HerstellerKarte.tsx`, `HerstellerDubletten.tsx`, `HerstellerDashboard.tsx`, `BomImport.tsx`; Routen `/produktion/hersteller`, `/produktion/hersteller/:id`, `/produktion/hersteller-dashboard`, `/produktion/hersteller-dubletten`, `/produktion/bom-import`.
