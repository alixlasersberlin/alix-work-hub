---
name: Product Hub · Preislisten & Kataloge
description: Katalogmodul unter /product-hub/preislisten, Tabellen ph_catalogs/_items/_pages/_media/_versions/_templates, Online-Katalog /preisliste/:slug
type: feature
---

- Menüpunkt „Preislisten & Kataloge" unter PRODUCT HUB: Übersicht `/product-hub/preislisten`, Editor `/product-hub/preislisten/:id`.
- Product Hub bleibt einzige Datenquelle: Kataloge referenzieren nur `ph_products.id`; Geräte, Bilder, Texte und Preise werden nie dupliziert.
- Katalogpreise (`ph_catalog_items.prices`) und Preisregeln überschreiben niemals den Masterpreis in `ph_products.price_countries`.
- Tabellen: `ph_catalogs`, `ph_catalog_items`, `ph_catalog_pages`, `ph_catalog_media`, `ph_catalog_versions`, `ph_catalog_templates`; Bildspeicher-Bucket `ph-catalog-media` (privat, Signed URLs).
- Öffentlicher Online-Katalog: `/preisliste/:slug` (nur bei Status „Veröffentlicht" + aktiv), optional Passwortschutz, Ablaufdatum, standardmäßig noindex. (`/katalog` bleibt das interne Artikelmodul.)
- PDF entsteht über die Druckansicht (A4); nach Änderungen wird `pdf_stale` gesetzt, bereits ausgegebene PDFs bleiben unverändert.
- Bearbeiten nur Super Admin/Admin; alle anderen sehen die Kataloge lesend.
