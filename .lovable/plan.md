## Ziel
Neue Sektion **"Artikel"** unter **Verkauf** anlegen und alle Artikel (Items) aus **Zoho Books** importieren – inkl. aller verfügbaren Felder (raw_data komplett gespeichert).

## Schritte

### 1. Datenbank: Neue Tabelle `zoho_items`
Speichert alle Artikel aus Zoho Books mit allen Standardfeldern + komplettem `raw_data` JSON für nicht abgebildete Felder.

Felder (Auszug):
- `zoho_item_id` (unique), `source_system`
- `name`, `sku`, `description`, `unit`
- `rate`, `purchase_rate`, `currency_code`
- `status` (active/inactive), `product_type`, `item_type`
- `tax_id`, `tax_name`, `tax_percentage`
- `stock_on_hand`, `available_stock`, `actual_available_stock`
- `category_name`, `brand`, `manufacturer`
- `image_name`, `image_type`
- `created_time`, `last_modified_time`
- `raw_data` (jsonb – komplettes Zoho-Objekt)
- `synced_at`, `created_at`, `updated_at`

RLS:
- Lesen: Admin + Auftragsverwaltung + Finance (`can_access_orders()`)
- Insert/Update/Delete: nur Admins (Sync läuft als Service Role über Edge Function)

### 2. Edge Function: `sync-zoho-items`
- Holt alle Items aus Zoho Books API (`/items?organization_id=…`)
- Paginiert (200/Seite) bis alle Items geladen
- Upsert in `zoho_items` per `zoho_item_id`
- Nutzt vorhandene Zoho-Secrets (`ZOHO_EU_1_*`)
- JWT-Validierung; nur Admin darf triggern
- Liefert Statistik: imported, updated, total

### 3. UI: Neue Seite `src/pages/Artikel.tsx`
- Route `/verkauf/artikel`
- Tabelle mit: Name, SKU, Einheit, Preis, Bestand, Status, Kategorie
- Suche (Name/SKU/Beschreibung)
- Button **"Aus Zoho synchronisieren"** (ruft Edge Function)
- Detail-Drawer/Dialog zeigt alle Zoho-Felder inkl. raw_data
- Premium Black/Gold Styling konsistent zu anderen Seiten
- Letzte Sync-Zeit anzeigen

### 4. Navigation
In `AppLayout.tsx` unter Gruppe **VERKAUF** neuen Child-Eintrag hinzufügen:
- `{ path: '/verkauf/artikel', label: 'Artikel', icon: Package, roles: ['Admin','Super Admin','Auftragsverwaltung','Finance'] }`

Route in `App.tsx` registrieren.

### 5. Erster Sync
Nach Deployment: Button in der UI klicken, um initial alle Artikel zu importieren.

## Technische Details
- Tabelle hat keinen FK auf `auth.users`
- Edge function verwendet `verify_jwt = false` Pattern (in-code JWT check + Admin-Rolle prüfen)
- Pagination via `page` + `per_page=200`, Loop bis `page_context.has_more_page === false`
- Region: EU (`https://www.zohoapis.eu/books/v3/items`)
