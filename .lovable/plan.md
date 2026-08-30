# ALIX PRODUCT MASTER – Artikel- & Produktmanagement

## Analyse (Ist-Zustand)

AlixWork hat bereits zwei Produktwelten – nichts davon wird gelöscht oder migriert:

- **Product Hub (`ph_*`, /product-hub)** – Gerätestamm, Master für alix-lasers.de/.com: `ph_products` (55 Felder inkl. Technik, Compliance-Status, SEO, Kanäle), `ph_media`, `ph_documents`, `ph_field_history` (WORM), `ph_conflicts`, `ph_publish_queue`, `ph_validation_runs`, `ph_channels`, `ph_roles`. Publishing-API `product-hub-api` liefert nur `status=published` und eine Whitelist öffentlicher Felder.
- **Katalog (`catalog_*`, /katalog)** – Verkaufsartikel, Preisgruppen, Preise, Bundles, Übersetzungen, Portal/Angebote.

Der gewünschte „Product Master“ deckt sich zu ~60 % mit dem Product Hub. Deshalb: **kein Parallelsystem**, sondern der Product Hub wird zum ALIX PRODUCT MASTER ausgebaut und bekommt die neue Menü-Oberfläche „Artikel & Produkte“. Bestehende Seiten, Routen und die Sync-API bleiben unverändert funktionsfähig.

## Was neu gebaut wird (additiv)

### Datenbank (nur neue Tabellen + neue nullable Spalten)
- `ph_attributes` / `ph_attribute_values` – Attribut-Engine (Typ Zahl/Text/Auswahl/Mehrfach, Einheit, Kategorie, Gruppe), damit Technikfelder ohne Code ergänzt werden können.
- `ph_variants` – Varianten mit eigener SKU, Preis, Bestand, Bildern, Attributwerten.
- `ph_scope_items` – Lieferumfang (Artikel, Menge, Einheit, Pflichtbestandteil).
- `ph_prices` + `ph_price_history` – EK, Herstellkosten, UVP, VK, Aktionspreis/-zeitraum, MwSt., Finanzierung/Leasing, Rate, Lieferzeit, Garantie, Inklusivleistungen; jede Änderung protokolliert (alt/neu/User/Zeit).
- `ph_compliance` – CE/MDR/Medizinprodukt/Risikoklasse/UDI/NiSV/Hersteller/EU-Rep/Importeur/Ursprungsland + Freigabestatus (nicht geprüft / in Prüfung / freigegeben / abgelehnt).
- `ph_marketing` – Headline, USP 1–6, Slogan, Zielgruppe, Claims, CTA.
- `ph_seo` – SEO-Titel, Meta, Slug, H1, Keywords, Canonical, Index/Noindex, FAQ, OpenGraph, Schema.org; Landingpage-Zuordnung.
- `ph_workflow_steps` – Freigabekette Entwurf → Technik → Compliance → Marketing → Freigegeben → Veröffentlicht (User, Datum, Kommentar, Status).
- Neue Spalten in `ph_products`: `ean`, `manufacturer_sku`, `brand`, `product_family`, `series`, `revision`, `segment` (Beauty/Medical), `lifecycle_status`, `quality_score`.
- Trigger: Änderung eines regulatorisch relevanten Feldes nach Compliance-Freigabe setzt den Status automatisch auf „erneute Prüfung erforderlich“ und schreibt `ph_field_history`.
- Grants + RLS analog zu den bestehenden `ph_*`-Policies; Rollen aus `ph_roles` (Product Admin, Regulatory/QMB, Marketing, Sales, Service, Viewer) plus Super Admin/Admin.

### UI – neuer Hauptmenüpunkt „Artikel & Produkte“
Untermenü: Dashboard · Alle Artikel · Neuen Artikel anlegen · Produktgruppen · Kategorien · Anwendungen · Varianten · Preise · Lieferumfang · Technische Daten · Medien · Dokumente · Compliance · SEO · Website-Synchronisation · Änderungshistorie. Medien/Dokumente/Website/Historie verlinken auf die bereits vorhandenen Product-Hub-Seiten (keine Dopplung).

- **Dashboard**: Kennzahlen (gesamt, aktiv, Entwürfe, in Prüfung, freigegeben, fehlende Daten/Bilder/Dokumente, Compliance-Warnungen, veröffentlicht), letzte Änderungen, Datenqualität in % je Produkt mit klickbaren Lücken.
- **Alle Artikel**: Suche (Name, SKU, Modell, EAN, Kategorie, Technologie, Anwendung, Hersteller, Status), Filterleiste, Statusbadges, Duplizieren-Dialog (Auswahl je Bereich, SEO nie kopiert, neue SKU Pflicht).
- **Produktakte** (Ausbau von `ProductEditor.tsx`): Sticky-Header mit Name, Artikelnummer, Status, Datenqualität, Compliance-, Website-Status, letzte Änderung; Tabs Übersicht · Stammdaten · Technik · Varianten · Anwendungen · Preise · Lieferumfang · Medien · Dokumente · Compliance · Marketing · SEO · Website · Service · Historie.
- **Publishing-Kontrolle**: Checkliste (Pflichtfelder, Preis, Hauptbild, Technik, SEO, Compliance, Marketing) – „Zur Veröffentlichung freigeben" erst bei erfüllten Bedingungen.
- **Produktvergleich**: A/B/C-Auswahl, automatische Vergleichstabelle.
- **Import-/Mapping-Assistent**: Abgleich aus `catalog_items` und PLM-Geräten mit Vorschau NEU / ÜBERNEHMEN / KONFLIKT / IDENTISCH, kein automatisches Überschreiben.

### API-Sicherheit
`product-hub-api` bleibt Master→Website. Neue Felder werden nur dann in die Whitelist aufgenommen, wenn sie als „public" freigegeben sind. EK, Herstellkosten, interne Notizen, interne Dokumente und nicht freigegebene Compliance-Daten sind von der öffentlichen Ausgabe ausgeschlossen.

## Umsetzung in Phasen

1. **Phase 1 – Fundament**: Migration (alle neuen Tabellen, Spalten, Trigger, RLS/Grants), Menü „Artikel & Produkte“, Dashboard, Alle Artikel mit Suche/Filter/Duplizieren.
2. **Phase 2 – Produktakte**: Tab-Struktur, Stammdaten, Technik mit Attribut-Engine, Varianten, Lieferumfang, Preise inkl. Historie.
3. **Phase 3 – Compliance, Marketing, SEO**: Compliance-Sperre und Freigaberollen, Marketing-Content, SEO mit Score, Landingpage-Zuordnung.
4. **Phase 4 – Qualität & Publishing**: Datenqualitäts-Score, Warnungen, Freigabe-Workflow, Publishing-Kontrolle, Produktvergleich, Import-/Mapping-Assistent, API-Whitelist-Erweiterung.

Bestehende Daten bleiben unangetastet; alle Änderungen sind rückwärtskompatibel.
