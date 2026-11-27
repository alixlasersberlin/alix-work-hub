# Integrationsanleitung DE – Offline-Status aus PRODUCT HUB v1.3 (alix-lasers.de)

Bitte im Webseitenprojekt alix-lasers.de umsetzen:

1. Den bestehenden 300-Sekunden-Abgleich auf `GET …/product-hub-api/bundle?channel=de&include_offline=1` umstellen (serverseitig, Header `x-api-key` aus dem Secret `PRODUCT_HUB_API_KEY`). Kein Schlüssel im Browser.
2. `contract` prüfen: bei `"1.3"` `offline_products` auswerten; bei `"1.2"` wie bisher verfahren.
3. `products` unverändert verarbeiten (nur `sync_allowed: true` schreiben).
4. Für jeden Eintrag in `offline_products` mit `channel === "de"`:
   - `sync_allowed !== true` → nichts ändern, nur protokollieren.
   - `sync_allowed === true` und `state` `offline` oder `not_released` → Gerät aus Liste, Detailseite (404), Suche und Sitemap entfernen, Cache für Liste und Detail invalidieren. Lokale Inhalte nicht löschen, nur verbergen.
   - Nur anwenden, wenn `product_version` neuer ist als die lokal gespeicherte Version (sonst ignorieren).
5. Geräte, die lokal existieren, aber in keiner Liste stehen (`missing`), nicht automatisch löschen; als Warnung protokollieren.
6. Aus `offline_products` niemals Seiten, Karten oder Inhalte erzeugen.
7. Fehler beim Abruf: lokalen Stand unverändert lassen und Fehler sichtbar protokollieren (nicht unterdrücken).
8. Tests: Pilot mit nur Apex `sync_allowed`; anderes Offline-Gerät bleibt unverändert; Notstopp → keine Änderung; `contract 1.2` funktioniert weiter.

Keine Änderung an Schlüsseln, HMAC-Empfänger oder Rückmeldungen. Keine automatische Produktivfreigabe.
