# PRODUCT HUB 2.0 – Endgültiger API-Vertrag (Stand 27.11.2026)

Nur tatsächlich implementierte Endpunkte. Keine Schlüsselwerte. Basis: `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1`
Kanäle: `de`, `com` (vorbereitet), `dubai` (Empfänger vorgesehen, nicht angebunden). US ausgenommen.

## 1. Inhalte abrufen (Webseite → AlixWork, serverseitig)
Header: `x-api-key: <PRODUCT_HUB_API_KEY>` (nur serverseitig, nie im Browser).
- `GET /product-hub-api/products?channel=de|com&locale=de|en` – Liste nur veröffentlichter, für den Kanal aktiver Geräte.
- `GET /product-hub-api/products/{alix_product_id}?channel=…` – Detail; offline → **404**.
- `GET /product-hub-api/products/{id}/media?channel=…` und `/documents?channel=…`.
- `GET /product-hub-api/images/{media_id}?channel=…` – liefert ein freigegebenes Produktbild aus dem privaten Speicher (nur Bilder veröffentlichter, kanalaktiver Geräte; sonst 404). Bucket bleibt privat. Webseite cached das Bild selbst.
- Zusatz `&protocol=2` liefert `product_version` + `publication_state`; **gesperrt (503 `product_hub_2_activation_blocked`) bis zur Freigabe.**
Cache maximal 5 Minuten.

## 2. Änderungssignal (AlixWork → Webseite) – noch gesperrt
`POST https://alix-lasers.de/api/public/product-hub/notify` bzw. `https://www.alix-lasers.com/api/public/product-hub/notify`
Header: `X-AlixWork-Timestamp: <Unix-Sekunden>`, `X-AlixWork-Signature: sha256=<hex HMAC-SHA256(PH_NOTIFY_SECRET, "<timestamp>.<rohbody>")>`
Body:
```json
{"event":"product.changed","event_id":"uuid","channel":"de","product_id":"…","version":"ISO-Zeit mit Mikrosekunden","desired":"ONLINE|OFFLINE","issued_at":"ISO"}
```
Antwort 200/202 = empfangen (kein Veröffentlichungsnachweis). Abweichung >300 s → ablehnen. Gleiche `event_id` doppelt → idempotent 200. Ältere `version` als bereits verarbeitet → ignorieren.
Signal enthält keine Inhalte: Webseite holt danach den aktuellen Stand über Abschnitt 1.
Wiederholung durch AlixWork: 2 s, 10 s, 30 s, 2 min, 10 min (mit derselben `event_id`).

## 3. Rückmeldung (Webseite → AlixWork)
`POST /ph-status-receipt` – Header wie oben, signiert mit **PH_STATUS_SECRET** (eigener Schlüssel je Kanal).
```json
{"event_id":"uuid aus Signal","channel":"de","product_id":"…","version":"aus Signal","state":"ONLINE|OFFLINE|ERROR","public_url":"https://… oder null","error_code":null,"error":null,"observed_at":"ISO"}
```
`public_url` muss auf der eigenen Domain liegen. Antworten: 202 angenommen, 200 Duplikat, 409 veraltet/unpassend, 401 Signatur, 503 Kanal nicht angebunden. Nur passende Rückmeldung bestätigt in AlixWork.

---

# Universeller Empfangsprompt (für ALIX DE / ALIX COM)

> Baue in dieser Webseite den PRODUCT HUB Empfänger. AlixWork ist die einzige Freigabestelle; entferne eigene Freigaben/Bestätigungen für Geräte.
> 1. Lege serverseitige Secrets an: `PRODUCT_HUB_API_KEY`, `PH_NOTIFY_SECRET`, `PH_STATUS_SECRET`. Nie im Browser verwenden.
> 2. Erstelle `POST /api/public/product-hub/notify`: Rohbody lesen, `X-AlixWork-Timestamp` (±300 s) und `X-AlixWork-Signature` = `sha256=` + HMAC-SHA256(PH_NOTIFY_SECRET, `timestamp + "." + rohbody`) zeitkonstant prüfen; sonst 401. Kanal muss dieser Webseite entsprechen. `event_id` merken (idempotent), ältere `version` je Produkt ignorieren. Sofort 202 antworten, Verarbeitung danach.
> 3. Verarbeitung: Gerät per `GET …/product-hub-api/products/{product_id}?channel=<kanal>` laden. 200 → Karte/Detail anzeigen bzw. aktualisieren; 404 → überall ausblenden (Übersicht, Detail, Suche, Sitemap). Cache leeren.
> 4. Bilder aus privatem Speicher über `GET …/product-hub-api/images/{media_id}?channel=<kanal>` serverseitig laden und selbst ausliefern/cachen.
> 5. Danach Rückmeldung an `POST …/ph-status-receipt` signiert mit PH_STATUS_SECRET senden (`state` ONLINE/OFFLINE/ERROR, `public_url` der Detailseite oder null).
> 6. Ohne Signal weiterhin alle 5 Minuten die Liste abrufen (Abgleich). Keine Preise anzeigen.
> 7. Antworte auf `GET /api/public/product-hub/notify` mit 405 (Erreichbarkeitstest).

---

# Checkliste ALIX DE und ALIX COM
1. `PRODUCT_HUB_API_KEY` hinterlegt (laut Nutzer erledigt).
2. Empfangsprompt umsetzen und Webseite veröffentlichen.
3. Je Webseite `PH_NOTIFY_SECRET` und `PH_STATUS_SECRET` erzeugen; dieselben Werte in AlixWork als `PH_NOTIFY_SECRET_DE/_COM` und `PH_STATUS_SECRET_DE/_COM` hinterlegen.
4. Eigene Freigabe-/Bestätigungsschalter der Webseite entfernen.
5. In AlixWork PRODUCT HUB → Webseiten: Signal-Auth und Rückmeldung = JA, Test = „Empfänger antwortet“.
6. Erst nach Vollsicherung, Restore-Test und Ende-zu-Ende-Abnahme: Produktivbetrieb freigeben (bleibt bis dahin AUS).
