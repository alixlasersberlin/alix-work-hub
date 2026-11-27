# PRODUCT HUB 2.0 – API-Vertrag v1 (ohne Zugangsdaten), Stand 27.11.2026

Basis: `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1`
Kanalkennungen (dauerhaft): `de`, `com`, `dubai`. Lesend akzeptierte Altformen: `Dubai`, `ae`, `uae`, `alix-lasers.ae` → `dubai`; `global` → `com`. US ausgeschlossen.

## 1. Abruf (LIVE, unverändert)
`GET /product-hub-api/products?channel=<k>&locale=<de|en|…>` · `GET /product-hub-api/products/{alix_product_id}?channel=<k>` (200 online / 404 offline) · `…/media`, `…/documents`.
Header `x-api-key` = Secret `PRODUCT_HUB_API_KEY` der Webseite (nur serverseitig).

## 2. Änderungssignal AlixWork → Webseite (gebaut, SHADOW MODE – wird nicht gesendet)
`POST https://<webseite>/api/public/product-hub/notify`
```json
{ "event":"product.changed", "event_id":"<uuid>", "channel":"de", "product_id":"<alix_product_id>",
  "version":"<ISO updated_at>", "desired":"ONLINE|OFFLINE", "issued_at":"<ISO>" }
```
Header `X-AlixWork-Timestamp` (Unix-Sekunden), `X-AlixWork-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + rohBody)>`.
Geheimnis je Webseite: AlixWork `PH_NOTIFY_SECRET_DE|COM|DUBAI` = Webseite `PRODUCT_HUB_NOTIFY_SECRET`.
`desired` ist nur ein Hinweis – maßgeblich ist immer der anschließende Abruf. Antwort `202`; Duplikate per `event_id` ignorieren; ältere `version` nie über neuere anwenden; Abweichung > 300 s ablehnen.

## 3. Statusrückmeldung Webseite → AlixWork (LIVE-Endpunkt, Kanäle noch nicht verbunden)
`POST /ph-status-receipt`
```json
{ "event_id":"<uuid aus Signal>", "channel":"de", "product_id":"<alix_product_id>", "version":"<aus Signal>",
  "state":"ONLINE|OFFLINE|ERROR", "public_url":"https://alix-lasers.de/…"|null,
  "error_code":null, "error":null, "observed_at":"<ISO>" }
```
Gleiche Signaturheader; Geheimnis AlixWork `PH_STATUS_SECRET_DE|COM|DUBAI` = Webseite `PRODUCT_HUB_STATUS_SECRET`.
Antworten: `202` angenommen (`status`: website_confirmed | website_mismatch | website_error | stale), `200 duplicate`, `400` Validierung/Host, `401` missing|expired|bad_signature, `404` unbekanntes Produkt, `503` Kanal nicht verbunden.
`public_url` muss zur Domain des Kanals gehören.

## 4. Statusmodell
A gewünscht (zentrale Entscheidung) · B übermittelt (Signal + Version) · C von Webseite bestätigt (Rückmeldung gleiche Version + gleicher Zustand) · D unabhängig öffentlich geprüft (Kartenprüfung COM/DE). Ein empfangenes Signal ist kein Nachweis.

## 5. Zentrale Entscheidung (`_shared/ph-publication.ts`)
ONLINE nur wenn: Produkt `published` · Schalter des Kanals AN · keine Sperre (`ph_product_channels.hold`) · Kanal nicht ausgeschlossen · Produkt-ID, Name, Slug vorhanden · öffentliches Hauptbild (kein signierter/privater Link). Sonst OFFLINE mit Gründen.

## 6. Alte Empfangsadressen (Stilllegung vorbereitet, nicht abgeschaltet)
| Adresse | Antwort 27.11. | Verwendet von |
|---|---|---|
| https://www.alix-lasers.com/api/public/product-hub/direct-release | 410 | ph-global-publish-device/contract.ts |
| https://alix-lasers.de/api/public/product-hub/direct-release | 410 | ph-global-publish-device/contract.ts |
| https://alix-lasers.ae/api/public/product-hub/direct-release | 404 | ph-global-publish-device/ae-contract.ts |
| https://alix-beauty.com/api/public/product-hub/release | 200 (aktiv) | beauty-release-contract.ts – bleibt |
