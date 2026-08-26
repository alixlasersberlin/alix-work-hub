---
name: ALIX Premium Beratung
description: Zweite öffentliche Beratungsstrecke /beratung/premium (Pearl/Chrome) neben unveränderter /beratung
type: feature
---
- Routen: `/beratung/premium` und Alias `/beratung-alix` (öffentlich, Turnstile). Bestehende `/beratung` bleibt unverändert.
- Komponenten: `src/components/PremiumSalesWizard.tsx`, Seite `src/pages/PublicBeratungPremium.tsx`, Kategorien/Gerätemapping `src/lib/beratung-premium/categories.ts`, Bilder `src/assets/wizard-premium/`.
- Nutzt dieselbe Angebots-/Lead-Logik: Edge Function `sales-wizard-submit` → `sales_leads` → AlixWork Angebote. Keine neue Tabelle, keine Migration.
- Kennzeichnung: `source = 'ALIX Premium Beratung'`; Kategorie & alle Antworten (Empfohlene/Ausgewählte Systeme, Lieferzeitraum, Beratungsart, Interessen, Zeitpunkt) werden im `notes`-Block sowie in `additional_interests` (`Kategorie: …`, `Gerät: …`) gespeichert.
- Kapitel 2 hat exakt 4 Kategorien: Haarentfernung, Haut & Anti Aging, Körper & Abnehmen, Tattoo & Pigment.
- Steps: 01 PROFIL · 02 ANWENDUNG · 03 BEDARF · 04 SYSTEM · 05 ABSCHLUSS, mobile-first mit Sticky Zurück/Weiter.
- Schritt-Editor: `app_settings.key='beratung_layout'` (`src/lib/beratung/formLayout.ts`) steuert Reihenfolge, Sichtbarkeit und Überschriften/Hinweise beider Wizards; Pflichtschritte sind nicht ausblendbar. Bearbeitung unter OPERATIONS › Beratung (`src/pages/Operation/BeratungForms.tsx`).
- Optionen-Editor: `app_settings.key='beratung_layout'` speichert zusätzlich `options` je Liste (interests/additional/delivery/consultation) mit Reihenfolge, ausgeblendeten und eigenen Optionen.
