# ALIX CONTENT HUB — Ein Datensatz, alle Kanäle

## Prinzip
EDIT ONCE · CHECK ONCE · APPROVE ONCE · PUBLISH EVERYWHERE.

Der bestehende Product Master (`ph_products` + `ph_prices`, `ph_compliance`, `ph_seo`, `ph_marketing`, `ph_variants`, `ph_media`, `ph_documents`) bleibt die einzige Quelle der Wahrheit. Der Content Hub ist die Schicht darüber, die aus genau diesem Datensatz alle Ausgaben erzeugt — keine zweite Datenhaltung, keine parallelen Texte.

## Was neu entsteht

### 1. Content Hub Cockpit (`/content-hub`)
- Übersicht je Produkt: Datenqualität, Compliance-Status, welche Kanäle aktuell sind, welche veraltet („stale") sind.
- Ampel pro Kanal: Website · Angebot · Datenblatt · Vergleich · Kundenportal · Social.
- Sammelaktion „Alles neu veröffentlichen" für ausgewählte Produkte.

### 2. Freigabekette
`ENTWURF → VORSCHAU → COMPLIANCE-CHECK → FREIGEBEN → VERÖFFENTLICHEN → SYNC alix-lasers.de`

- Vorschau rendert **alle** Kanalausgaben nebeneinander aus demselben Datensatz.
- Compliance-Gate: Bei CE/MDR/Laserklasse/Zweckbestimmung/„Made in Germany"/UDI ist Freigabe durch QM/Regulatory Pflicht.
- Freigabe wird versioniert protokolliert (wer, wann, welcher Datenstand-Hash) — revisionsfähig, nichts wird überschrieben.
- Änderung eines regulatorisch relevanten Feldes nach Freigabe setzt automatisch „erneute Prüfung erforderlich" und stoppt weitere Veröffentlichungen.

### 3. Kanal-Renderer (alle aus einem Datensatz)
- **Produktseite** → bestehende `product-hub-api` (nur freigegebene, öffentliche Felder).
- **Angebot** → Positionstexte, Technikblock und Lieferumfang für Angebote/Aufträge.
- **Datenblatt-PDF** → A4, Corporate-Layout, technische Daten, Compliance-Hinweise, Stand-Datum.
- **Produktvergleich** → Tabelle über 2–3 Produkte, generiert aus den Attributwerten.
- **AlixSmart-Kundenportal** → reduzierter Kundenblick (Nutzung, Anwendungen, Garantie, Dokumente).
- **Social Media** → KI-Textbausteine je Plattform, gespeist aus Marketing/USP-Feldern, an das bestehende Social-Modul übergeben.

### 4. Konsistenzwächter
Leistung, Wellenlängen, Pulsdauer, Laserklasse, Garantie & Preis werden nie pro Kanal gepflegt, sondern nur aus dem Master gelesen. Ein Prüflauf meldet jede Stelle, an der ein veröffentlichter Kanal von der aktuellen Masterversion abweicht.

## Technisch
- Neue Tabellen: `ch_releases` (Freigabe-Snapshots inkl. Datenstand-Hash, WORM), `ch_channel_state` (Produkt × Kanal: veröffentlicht am, Version, stale-Flag), `ch_render_cache`.
- Neue Edge Functions: `content-hub-render` (Kanalausgabe erzeugen), `content-hub-publish` (Freigabe → Kanäle → Sync-Log).
- Wiederverwendet: `ph_field_history`, `ph_publish_queue`, `ph_validation_runs`, `product-hub-api`, `ph_roles`.
- RLS/Grants analog zu den bestehenden `ph_*`-Policies; Einkaufspreise, Herstellkosten und nicht freigegebene Compliance-Daten sind aus jeder öffentlichen Ausgabe ausgeschlossen.
- Menü: Untergruppe **CONTENT HUB** innerhalb von „ARTIKEL & PRODUKTE".

## Reihenfolge
1. Fundament: Tabellen, Freigabekette, Cockpit mit Kanal-Ampeln.
2. Renderer Website + Angebot + Datenblatt-PDF.
3. Vergleich + AlixSmart-Portal-Ansicht.
4. Social-Media-Ausspielung und Konsistenz-Prüflauf.

Bestehende Daten, Seiten und die Sync-API bleiben unverändert funktionsfähig.
