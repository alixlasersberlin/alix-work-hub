# PRODUCT HUB 2.0 – API-Vertrag v1.1 (ohne Zugangsdaten), Stand 27.11.2026

Basis: `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1`
Kanalkennungen (dauerhaft): `de`, `com`, `dubai`. Lesend akzeptierte Altformen: `Dubai`, `ae`, `uae`, `alix-lasers.ae` → `dubai`; `global` → `com`. US ausgeschlossen.

## 1. Abruf (LIVE, unverändert)
`GET /product-hub-api/products?channel=<k>&locale=<de|en|…>` · `GET /product-hub-api/products/{alix_product_id}?channel=<k>` (200 online / 404 offline) · `…/media`, `…/documents`.
Header `x-api-key` = Secret `PRODUCT_HUB_API_KEY` der Webseite (nur serverseitig).

## 2. Änderungssignal AlixWork → Webseite (Versand gebaut, produktiv gesperrt)
`POST https://<webseite>/api/public/product-hub/notify`
```json
{ "event":"product.changed", "event_id":"<uuid>", "channel":"de", "product_id":"<alix_product_id>",
  "version":"<monotone ISO-Ereignisversion mit Mikrosekunden>", "desired":"ONLINE|OFFLINE", "issued_at":"<ISO>" }
```
Header `X-AlixWork-Timestamp` (Unix-Sekunden), `X-AlixWork-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + rohBody)>`.
Geheimnis je Webseite: AlixWork `PH_NOTIFY_SECRET_DE|COM|DUBAI` = Webseite `PRODUCT_HUB_NOTIFY_SECRET`.
`desired` ist nur ein Hinweis – maßgeblich ist immer der anschließende Abruf. Antwort `202`; Duplikate per `event_id` ignorieren; ältere `version` nie über neuere anwenden; Abweichung > 300 s ablehnen.

Der Sender ist `ph-signal-dispatch`, ausschließlich intern autorisiert. Produktive Übertragung benötigt `PH_SIGNAL_LIVE_ENABLED=true` **und** die servergeschützte Einstellung `ph2_activation` mit allen Abnahmetoren und Freigeber. Aktuell ist beides gesperrt. Schattenereignisse werden niemals nachträglich produktiv abgesendet.

Nach Freigabe verwendet der Empfänger den bestehenden Abruf mit `&protocol=2`. Dieser Opt-in-Modus liefert die gemeinsame Veröffentlichungsentscheidung und `product_version`; aktuell antwortet er mit 503 `product_hub_2_activation_blocked`. Die bisherigen Abrufe ohne diesen Parameter bleiben unverändert.
Ein bestätigtes Offline-Gerät liefert in diesem Modus 404 mit `publication_state:"OFFLINE"`, `product_id` und `product_version`. 503, Timeout, 5xx und unbekannte Identitäten sind **keine Abschaltbestätigung**. Bei einer neueren Abrufversion darf der Empfänger nicht die alte Ereignisversion als umgesetzt bestätigen.

## 3. Statusrückmeldung Webseite → AlixWork (LIVE-Endpunkt, Kanäle noch nicht verbunden)
`POST /ph-status-receipt`
```json
{ "event_id":"<uuid aus Signal>", "channel":"de", "product_id":"<alix_product_id>", "version":"<aus Signal>",
  "state":"ONLINE|OFFLINE|ERROR", "public_url":"https://alix-lasers.de/…"|null,
  "error_code":null, "error":null, "observed_at":"<ISO>" }
```
Gleiche Signaturheader; Geheimnis AlixWork `PH_STATUS_SECRET_DE|COM|DUBAI` = Webseite `PRODUCT_HUB_STATUS_SECRET`.
Antworten: `202` angenommen (`status`: website_confirmed | website_mismatch | website_error), `200 duplicate`, `400` Validierung/Host, `401` missing|expired|bad_signature, `409` unknown_event|identity_mismatch|stale|not_transmitted|missing_public_url, `503` Kanal nicht verbunden.
`public_url` muss HTTPS und die Domain des Kanals verwenden; für ONLINE ist sie erforderlich. Doppelte und frühe Rückmeldungen werden atomar verarbeitet. Rückmeldungen verändern niemals Produktdaten.

## 4. Statusmodell
A gewünscht (zentrale Entscheidung) · B übermittelt (Signal + Version) · C von Webseite bestätigt (Rückmeldung gleiche Version + gleicher Zustand) · D unabhängig öffentlich geprüft (Kartenprüfung COM/DE). Ein empfangenes Signal ist kein Nachweis.

## 5. Zentrale Entscheidung (`_shared/ph-publication.ts`)
ONLINE nur wenn: Produkt `published` · Schalter des Kanals AN · keine Sperre (`ph_product_channels.hold`) · Kanal nicht ausgeschlossen · Produkt-ID, Name, Slug vorhanden · öffentliches Hauptbild (kein signierter/privater Link). Sonst OFFLINE mit Gründen.

## Warteschlange und Wiederanlauf
Transaktionale Ereignisse liegen in `ph_sync_log` (`ph2_signal`), ohne neue Tabellen. Änderungen an Bildern, Videos, Dokumenten, Übersetzungen, SEO, Garantie, zentralen Preisen und allen relevanten Produktfeldern erzeugen neue Versionen auch bei unverändertem AN/AUS. Signalinhalt enthält keine Produktpreise; länderspezifische Preis-/Textfreigaben bleiben im bestehenden Abruf erhalten.
Erstversuch plus fünf Wiederholungen nach mindestens 2/10/30/120/600 Sekunden. Fehlender Veröffentlichungsnachweis ist kein Erfolg. Reservierungen verfallen nach 90 Sekunden; veraltete Ereignisse und Reservierungen können keine neueren Zustände ersetzen.
Kurze Abstände werden nach einem Ereignis ausgelöst; die minütliche Wiederanlaufprüfung wird nur bei offenen produktiven Vorgängen eingerichtet und nach Abschluss entfernt. Nach einem Worker-Abbruch oder langen Intervall kann der nächste Versuch bis zu 60 Sekunden später als der Mindestabstand erfolgen. Keine aktive Prüfung im gesperrten Zustand; bei späterer Freigabe maximal 1.440 Prüfungen pro Tag während offener Vorgänge, mit möglichem Mehrverbrauch der Datenbank.
Aktive Super Admins dürfen ein fehlgeschlagenes, noch aktuelles Ereignis über die geschützte `ph2_retry`-Fassade erneut vormerken. Aktivierung wird hier nicht angeboten.
Nach Aktivierung prüft ein serverseitiger Schutz zentrale AN/AUS-/Statusänderungen und das Aufheben bestehender Sperren auf eine exakte aktive Super-Admin-Rolle, angenommene Einladung und abgeschlossene Passwortänderung. Geerbte Admin-Rechte reichen nicht aus; Service-Automatisierungen dürfen keine eigenständige neue Freigabe erzeugen. Solange die Aktivierung gesperrt ist, bleiben bestehende Rechte unverändert.

## 6. Alte Empfangsadressen (Stilllegung vorbereitet, nicht abgeschaltet)
| Adresse | Antwort 27.11. | Verwendet von |
|---|---|---|
| https://www.alix-lasers.com/api/public/product-hub/direct-release | 410 | ph-global-publish-device/contract.ts |
| https://alix-lasers.de/api/public/product-hub/direct-release | 410 | ph-global-publish-device/contract.ts |
| https://alix-lasers.ae/api/public/product-hub/direct-release | 404 | ph-global-publish-device/ae-contract.ts |
| https://alix-beauty.com/api/public/product-hub/release | 200 (aktiv) | beauty-release-contract.ts – bleibt |
