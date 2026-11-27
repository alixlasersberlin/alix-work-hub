# PRODUCT HUB – API-Vertrag v1.3 (Bundle mit Offline-Status)

Stand: 27.11.2026 · abwärtskompatible Erweiterung von v1.2

## Aufruf
`GET /functions/v1/product-hub-api/bundle?channel=de|com&include_offline=1` · Header `x-api-key: PRODUCT_HUB_API_KEY`

Ohne `include_offline=1` ist die Antwort **bytegleich v1.2** (`contract: "1.2"`). Alle übrigen Routen (`/products`, Detail, Media, Documents, Content, Images) bleiben unverändert; Offline-Geräte liefern dort weiter 404.

## Antwort (zusätzliche Felder)
```json
{
  "contract": "1.3",
  "products": [ ...unverändert, nur ONLINE-Geräte... ],
  "sync_scope": { ...unverändert... },
  "catalog_complete": true,
  "offline_products": [
    { "alix_product_id": "…", "slug": "…", "channel": "de",
      "state": "offline", "online": false, "sync_allowed": false,
      "product_version": "…", "updated_at": "…" }
  ]
}
```

## Eindeutige Zustände
| Zustand | Erkennung | Bedeutung |
|---|---|---|
| online | in `products` | veröffentlicht und für den Kanal eingeschaltet |
| offline | `offline_products[].state = "offline"` | veröffentlicht, für diesen Kanal bewusst ausgeschaltet |
| not_released | `offline_products[].state = "not_released"` | nicht veröffentlicht (Entwurf/Archiv) |
| missing | in keiner Liste (bei `catalog_complete: true`) | AlixWork kennt das Gerät nicht |

## Regeln
- `offline_products` enthält **nur Statusfelder**: keine Namen, Texte, Bilder, Dokumente, Preise. Daraus darf nie eine öffentliche Seite entstehen.
- `product_version` = letzte signierte Version aus PRODUCT HUB 2.0, sonst `updated_at`.
- `sync_allowed` folgt exakt `ph2_activation`: gesperrt oder Notstopp → `false` für alle; Pilot → nur das Pilotgerät `true`; DE und COM getrennt.
- Empfänger dürfen ein Gerät **nur bei `sync_allowed: true`** ausblenden/entfernen oder Cache invalidieren. Bei `false` bleibt der lokale Stand unverändert.
- Zustand `missing` löst nie automatisch eine Löschung aus; nur protokollieren.
- Die Erweiterung schaltet nichts frei; Produktivbetrieb bleibt Super-Admin-Entscheidung.
