---
name: ALIX PRODUCT MASTER (Artikel & Produkte)
description: Zentrales Artikel- & Produktmanagement unter /artikel, baut additiv auf den Product-Hub-Tabellen ph_* auf
type: feature
---

Zentrales Artikel- & Produktmanagement für alixwork.de – Master für Website, Angebote, Kataloge und Service.

- Routen: `/artikel` (Dashboard/Datenqualität), `/artikel/liste`, `/artikel/neu`, `/artikel/attribute`, `/artikel/:id` (Produktakte)
- Menü: Hauptgruppe **ARTIKEL & PRODUKTE** (navItems.ts), getrennt vom bestehenden PRODUCT HUB
- Tabellen additiv zu `ph_products`: `ph_attributes`, `ph_attribute_values`, `ph_variants`, `ph_scope_items`, `ph_prices`, `ph_price_history`, `ph_compliance`, `ph_marketing`, `ph_seo`, `ph_workflow_steps`
- Produktakte-Tabs: Übersicht, Stammdaten, Technik (inkl. dynamischer Attribut-Engine), Varianten, Anwendungen, Preise, Lieferumfang, Medien, Dokumente, Compliance, Marketing, SEO, Website, Service, Historie
- Datenqualität: `pmQuality()` je Bereich + Gesamtscore in %, `pmPublishChecks()` als Veröffentlichungs-Gate, `pmWarnings()`
- Compliance-Regel: CE/MDR/Medizinprodukt/ISO 13485/„Made in Germany"/UDI-Aussagen dürfen nur nach Freigabe durch QM/Compliance veröffentlicht werden; Änderung technischer Kernfelder setzt Status auf `recheck_required`
- Einkaufspreise & Herstellkosten nur für Super Admin/Admin sichtbar und nie über die Website-API
- Bestehende Katalog-/Zoho-Daten und die Product-Hub-Sync-APIs bleiben unverändert
