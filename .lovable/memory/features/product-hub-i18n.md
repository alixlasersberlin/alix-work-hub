---
name: Product Hub Mehrsprachigkeit
description: Zentrale Sprachpflege im Product Hub (de Master, en/es/ru/ar), Tabellen ph_product_translations & ph_glossary, Edge Function ph-translate, API-Parameter locale
type: feature
---

- Deutsch (de) ist Master-/Quellsprache; Zielsprachen en, es, ru, ar. Arabisch wird im Editor RTL dargestellt.
- Eine Hub-ID = ein Gerät. Keine Sprach-Duplikate: sprachabhängige Inhalte liegen in `ph_product_translations` (unique product_id+locale).
- Sprachneutral bleiben: Hub-ID, Modell, SKU, technische Daten, Preise, Garantie, Medien, Dokumente.
- Übersetzbar: Name, Kurz-/Langbeschreibung, Highlights, Vorteile, Einsatzgebiete, Behandlungen, Funktionsbeschreibungen, Marketingtext, FAQ, Hinweise, SEO-Titel, Meta Description, Slug, Bild-Alt-Texte.
- Status je Sprache: missing · ai_draft · review · approved · published · outdated. DB-Trigger `ph_mark_translations_outdated` setzt Übersetzungen bei Änderung deutscher Mastertexte automatisch auf „outdated" (nie löschen).
- KI-Übersetzung: Edge Function `ph-translate` (Lovable AI, gpt-5.6-sol). Überschreibt geprüfte/freigegebene Übersetzungen nur nach ausdrücklicher Bestätigung (`overwrite: true`).
- Glossar `ph_glossary`: mode `protected` (nie übersetzen, z. B. ALIX LASERS, BlueIce, NEXUS, SLIM III, Aesthéra, Smart KI) oder `fixed` (verbindliche Übersetzung je Sprache). Wird von der KI berücksichtigt.
- UI: Tab „Sprachen" im Geräteeditor (`/product-hub/geraete/:id`), Übersicht + Glossar unter `/product-hub/uebersetzungen`.
- API `product-hub-api`: Parameter `locale=de|en|es|ru|ar`. Nur `approved`/`published` Übersetzungen werden ausgeliefert; Fallback auf Deutsch ist über `locale_status` (master/translated/partial/fallback), `fallback_locale` und `fallback_fields` technisch erkennbar. Slug ist nie Produktschlüssel.
- Englisch-Katalog (08.09.2026): alle 41 Geräte EN-übersetzt (KI-Entwurf, keine Auto-Freigabe), Qualitätscheck `ph_translation_qa` (39 PASS / 2 WARNING / 0 BLOCKED). Übersetzbar sind zusätzlich `intended_use` und `product_group_label`. Zahlen-/Einheitenprüfung ignoriert SEO-Felder und erlaubt technische Kontextwerte. Edge Function `ph-en-batch` (Aktionen: Batch mit offset/limit/productIds, `action:"requalify"` nur Qualitätscheck). UI: Product Hub → Übersetzungen → Tabs „Katalog-Audit" und „EN Freigabe".
- Vollkatalog ES/RU/AR (08.09.2026): alle 41 Geräte in ES, RU und AR übersetzt (KI-Entwurf, keine Auto-Freigabe). Edge Function `ph-en-batch` unterstützt jetzt `locale` (en|es|ru|ar) und `action:"requalify"` mit `locales[]`. QA zusätzlich: Zielschrift-Prüfung (Kyrillisch/Arabisch), arabisch-indische Ziffern = BLOCKED, englische Textreste = WARNING. Freigabe-UI: Product Hub → Übersetzungen → Tab „Freigabe" mit Untertabs EN | ES | RU | AR. Zielsites: EN/ES/RU → alix-lasers.com, AR → alix-lasers.ae (dort noch kein Schreibweg, /api/public/product-hub/update = 404 → kein Sync).
