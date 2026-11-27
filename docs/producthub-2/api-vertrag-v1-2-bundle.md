# PRODUCT HUB API – Vertrag v1.2 (Bulk, abwärtskompatibel)

Neu: `GET /functions/v1/product-hub-api/bundle?channel=<de|com|at|dubai|usa>[&locale=de|en|…][&content_channel=website]`
Header: `x-api-key: PRODUCT_HUB_API_KEY` (unverändert).

Antwort 200:
```json
{
  "contract": "1.2", "channel": "de", "locale": "de", "generated_at": "ISO",
  "sync_scope": { "governed": true, "mode": "blocked|pilot|full", "emergency_stopped": true, "pilot_product_id": "Apex|null" },
  "products": [ { "...alle Felder wie /products/{id}": "…",
    "sync_allowed": false,
    "media": [ {"url","kind","media_type","title","alt_text","channels","sort_order","is_primary"} ],
    "documents": [ {"title","doc_type","visibility","language","version","url","channels"} ],
    "content": { "channel","version","published_at","content_hash","content" } | null } ]
}
```
- Sichtbarkeit identisch zu `/products?channel=…`: `status=published` UND Kanalflag aktiv. Preise wie bisher reduziert.
- Ersetzt Liste + je Gerät Detail/Media/Documents/Content (~19 Abrufe) durch **einen** Abruf.
- `sync_allowed` (DE/COM): nur `true`, wenn kein Notstopp und Modus `full` oder Modus `pilot` mit genau diesem Gerät. Für andere Kanäle `null` (nicht gesteuert).
- **Öffentliches Lesen ≠ produktive Übertragung:** Geräteseiten rendern weiter alle gelieferten Geräte. Der automatische 300-s-Abgleich darf Datenänderungen/Cache-Invalidierung nur für `sync_allowed === true` anwenden.
- Alle bestehenden Routen (`/products`, `/products/{id}`, `/media`, `/documents`, `/content`, `/images/{id}`, `protocol=2`) bleiben unverändert.
- Fehler: 400 `channel_required`, 401 `unauthorized`, 500 `{error}`.
