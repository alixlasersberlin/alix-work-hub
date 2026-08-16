---
name: Product Hub (Master für alix-lasers.com / .de)
description: Zentraler ALIX Gerätestamm unter /product-hub, Tabellen ph_*, Edge Functions product-hub-api & product-hub-import, Migrationsphasen A/B/C
type: feature
---

AlixWork ist künftig das Master-System für alle ALIX Produktdaten; die Webseiten sind reine Veröffentlichungskanäle.

- Route: `/product-hub` (Übersicht, Geräte, Freigaben, Konflikte, Medien, Dokumente, Webseiten, Änderungsverlauf, Sync Health, Einstellungen)
- Tabellen (additiv, nichts Bestehendes verändert): `ph_products` (Master), `ph_channels`, `ph_product_channels`, `ph_media`, `ph_documents`, `ph_field_history` (WORM, nie löschen), `ph_conflicts`, `ph_sync_log`, `ph_roles`, `ph_settings`
- Kritische Felder (Wellenlängen, Leistung, Fluence, Pulsdauer, Frequenz, Spotgröße, Kühlung, Laserklasse, Zweckbestimmung, Hersteller, MDR/CE/ISO, Normen) werden per DB-Trigger `ph_log_product_changes` protokolliert und in der UI markiert.
- Freigabe-Workflow: draft → review → approved → published.
- Product-Hub-Rollen (`ph_roles`): Product Admin, Regulatory, Marketing, Sales, Service, Admin — zusätzlich zu bestehenden AlixWork-Rollen, diese bleiben unverändert.
- Sync API: Edge Function `product-hub-api` (nur GET, Auth via Header `x-api-key` = Secret `PRODUCT_HUB_API_KEY`, verify_jwt=false). Import: `product-hub-import` (JSON oder Quell-URL, Mapping über alix_product_id/source_product_id/SKU/Slug/Modell/normalisierten Namen, keine Dubletten, kein Löschen).
- **Migrationsphase in `ph_settings.migration_phase`: aktuell Phase A — der bestehende COM→DE Sync bleibt aktiv und darf erst nach Validierung (Phase C) abgeschaltet werden.**
