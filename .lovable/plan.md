
## Zielbild

Ein zusätzliches, klar getrenntes Modul **Katalogverwaltung** unter `/katalog`. Es lebt neben der bestehenden Artikelverwaltung, ersetzt nichts, ändert keine bestehende Tabelle, Route, Rolle oder Komponente. Freigegebene Katalogartikel werden per Snapshot in Angebote/Aufträge übernommen.

Wegen des Umfangs (36 Kapitel, ~24 neue Tabellen, Import + Export + Versand + Angebots-/Auftragsintegration) baue ich das Modul **schrittweise in Phasen**. Diese Plan-Antwort deckt **Phase 1 (Analyse) + Phase 2 (Fundament) + Phase 3 (Katalog-UI, MVP)** ab. Weitere Phasen (Import, Export, Versand, Angebots-/Auftrags-Snapshots) folgen jeweils in eigenen, ebenfalls freigabepflichtigen Schritten.

## Was ich in dieser ersten Iteration liefere

### 1. Analyse (kein Code)
Ich lese vorher gezielt:
- bestehende Artikel-/Angebot-/Auftrag-Tabellen und Seiten
- Rollenmodell (`user_roles`, `has_role`, Delete-Restriktion Super Admin)
- Storage-Buckets (für Bild-Vorlage)
- Mail-/WhatsApp-/SMS-Infrastruktur (nur inventarisieren, nicht anfassen)
- App.tsx Routing + Sidebar-Struktur

Ergebnis fließt als Kommentare in Migration + Code.

### 2. Datenfundament (Migration, additiv)
Neue Tabellen im `public`-Schema, alle mit `catalog_`-Präfix, alle mit GRANTs + RLS + `has_role`-basierten Policies. Kein Eingriff in bestehende Tabellen.

MVP-Tabellen dieser Phase:
- `catalog_branches` – Niederlassungen (Name, Land, Währung, Sprache, Logo, Footer, Bank)
- `catalog_countries` – Länder (ISO, Währung, Steuersatz, Sprache)
- `catalog_currencies` – Währungen (Code, Symbol, Rundungsregel)
- `catalog_categories` – Baum (parent_id, sort, name-JSON für Sprachen)
- `catalog_items` – Stammdaten (SKU unique, name, brand, model, status, notes_internal)
- `catalog_item_descriptions` – lange Texte pro Sprache (short, long, technical, warranty, scope, legal, angebot, pdf) + `translation_status`
- `catalog_item_images` – bis N Bilder, is_primary, alt/title pro Sprache, sort_order, Storage-Pfad
- `catalog_item_prices` – Länderpreise (item, country, branch, currency, uvp_net, uvp_gross, sale_net, sale_gross, promo, valid_from/to, tax_rate, price_status)
- `catalog_price_rules` – UVP-basiert (mode: minus_pct | plus_pct | factor | fixed | rounding), Sichtbarkeit rollen-gescoped
- `catalog_change_log` – wer/wann/altwert/neuwert/quelle
- Enum-Typen: `catalog_item_status`, `catalog_price_status`, `catalog_translation_status`

Storage-Bucket **`catalog-media`** (privat) für Produktbilder und Datenblätter, mit RLS-Policies auf `storage.objects`.

Rollen-Policies:
- Lesen freigegeben: alle authentifizierten Rollen
- Bearbeiten Stammdaten: `Super Admin`, `Admin`, neue Rolle **`Katalog`**
- Preise sehen/ändern/freigeben: `Super Admin`, `Admin`, `Katalog Preise`
- Löschen: nur `Super Admin` (bestehende Kernregel)

Keine Einkaufspreis-Spalten. Import verwirft solche Felder und protokolliert das.

### 3. Katalog-UI (MVP, additiv)
Neue Route `/katalog` + Sidebar-Eintrag unter „OPERATIONS", nur sichtbar bei entsprechender Rolle. Vollständig im bestehenden AlixWork-Design (`Card`, `Table`, `Button`, Dark/Gold), keine neuen Design-Tokens.

Seiten:
- `/katalog` – Dashboard-Kacheln (aktive Artikel, ohne Bild, ohne Übersetzung, Preise offen)
- `/katalog/artikel` – Tabellen- und Kartenansicht mit Filtern (SKU, Kategorie, Marke, Status, Land, Sprachvollständigkeit, fehlende Bilder)
- `/katalog/artikel/:id` – Detail mit Tabs: Stammdaten · Beschreibungen · Bilder · Länderpreise · Sprachen · Verwendung · Änderungsverlauf
- `/katalog/kategorien` – Baumverwaltung
- `/katalog/laender`, `/katalog/waehrungen`, `/katalog/niederlassungen`, `/katalog/preisregeln` – Stammdaten
- `/katalog/protokolle` – Änderungslog

Bulk-Aktivieren/Archivieren, Sicherheitsabfrage vor Löschen, alles rollengeprüft (Frontend **und** RLS).

### 4. Bildupload
Direkt in Bucket `catalog-media`, signierte URLs zum Anzeigen. Sortierung, Hauptbild-Flag, mehrsprachige Alt-Texte, 4-Bild-Slots + optional weitere. Dateityp-/Größen-Check clientseitig, harte Prüfung serverseitig via Storage-Policies.

### 5. Feste Absicherungen von Anfang an
- Snapshot-Tabellen (`catalog_item_snapshots`) werden im Schema vorbereitet, aber Angebots-/Auftragsintegration folgt in Phase 7/8.
- RLS auf jeder Tabelle. `service_role` bekommt `ALL` (für Edge Functions in Folgephasen).
- Keine Sichtbarkeit von Einkaufs-/Margenfeldern – Spalten existieren nicht.
- Alle neuen Enums, Trigger, `updated_at`-Trigger.

## Was in dieser Iteration **noch nicht** kommt (bewusst)

Damit dieser Schritt sauber prüfbar bleibt:
- Airtable-Import, alix-lasers.com-Import, Excel/CSV-Import (Phase 4, eigener Prompt)
- Excel- + PDF-Export mit Bildern und Vorlagen (Phase 5)
- Versand E-Mail/WhatsApp/SMS + sichere `alixwork.de/catalog/share/...`-Links (Phase 6)
- „Aus Katalog hinzufügen" in Angebot + Auftrag inkl. Snapshot-Übernahme (Phase 7 + 8)
- Vier-Augen-Freigabe-Workflow (Phase 6/7)

Jede dieser Phasen bekommt einen eigenen Plan, sobald das Fundament abgenommen ist.

## Rollout-Reihenfolge in dieser Iteration

1. Analyse-Reads (bestehende Struktur, keine Änderungen)
2. **Ein** Migrationslauf mit allen Katalog-Tabellen + Enums + RLS + GRANTs
3. Storage-Bucket `catalog-media` + Policies
4. Neue Rolle `Katalog` in Rollenliste ergänzen (rein additiv im bestehenden `roles`/`user_roles`-System)
5. Route + Sidebar-Eintrag + Seiten unter `src/pages/Katalog/`
6. Wiring an bestehende `useAuth`/`has_role`-Hooks
7. Kurzer Regressionscheck: bestehende Kernrouten laden, keine Typefehler

## Technische Details

**Namensraum**: Alles `catalog_*` in DB, `src/pages/Katalog/*` und `src/components/catalog/*` im Code. Keine Kollision mit vorhandenem `alixsmart_products`, `zoho_items`, `order_items`.

**Übersetzungen**: statt Wide-Tables ein Zeilenpro-Sprache-Modell (`catalog_item_descriptions.language_code`). Sprachen konfigurierbar in `catalog_languages` (nicht hardcoded).

**Preisintegrität**: `catalog_item_prices` mit `UNIQUE(item_id, country_id, branch_id, price_status='approved', valid_from)` damit pro Land/Niederlassung nur ein aktiver freigegebener Preis gilt.

**RLS-Muster** (verhindert Rekursion): SECURITY DEFINER Helper `public.catalog_can_see_prices(uuid)` – prüft Rolle über bestehendes `has_role`.

**Frontend-Guards**: Preis-Spalten werden serverseitig gar nicht selektiert, wenn Rolle keinen Zugriff hat – nicht nur ausgeblendet.

**Links**: Alle künftigen Share-Links laufen über `alixwork.de/catalog/share/:token`, Edge Function löst Token gegen `catalog_share_links` auf. In dieser Phase noch nicht implementiert, aber Tabelle vorbereitet.

## Was danach passiert

Nach deinem OK für diesen Plan:
1. lese ich die relevanten bestehenden Dateien,
2. lege die Migration vor (du bekommst sie zur Freigabe),
3. baue anschließend Storage-Bucket, Routen und Katalog-MVP-Seiten,
4. melde mich mit einer kurzen Ergebnis-Checkliste zurück und liste Phase 4 als nächstes.

Bestätige bitte, dass ich mit **Phase 1–3 (Fundament + MVP-UI ohne Import/Export/Versand)** starten soll – dann geht's los.
