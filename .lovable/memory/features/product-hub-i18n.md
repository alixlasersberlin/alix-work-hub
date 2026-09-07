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
