# PRODUCT HUB 2.0 – Testrückmeldung für alix-lasers.com (Webseiten-ID `com`)

Ergänzung zum bestehenden Empfangsmodul. Keine Änderung an API-Struktur, Webseiten-ID oder Schlüsselnamen.

## Prompt zum Einfügen im Webseitenprojekt

> Erweitere den bestehenden Endpunkt `POST /api/public/product-hub/notify` um ein Testsignal:
>
> 1. Prüfe wie bisher zuerst die Signatur (`X-AlixWork-Timestamp`, `X-AlixWork-Signature`, HMAC-SHA256 über `<timestamp>.<rohbody>` mit `PH_NOTIFY_SECRET`, max. 5 Minuten alt). Ungültig → HTTP 401. Diese Reihenfolge ist Pflicht.
> 2. Ist die Signatur gültig und `event == "connection.test"` (Body: `{"event":"connection.test","event_id":"uuid","test_id":"uuid","channel":"com","issued_at":"ISO","test":true}`), dann:
>    - `channel` muss `com` sein, sonst HTTP 400.
>    - Keine Produktdaten lesen, ändern, cachen oder veröffentlichen; keinen Cache invalidieren.
>    - Sofort HTTP 202 `{"accepted":true,"test":true}` antworten.
>    - Danach (asynchron, einmalig, ohne Wiederholung) eine Rückmeldung an `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ph-status-receipt` senden:
>      Body `{"kind":"connection_test","test_id":"<test_id aus Signal>","channel":"com","observed_at":"<ISO jetzt>"}`,
>      Header `Content-Type: application/json`, `X-AlixWork-Timestamp: <unix sekunden>`, `X-AlixWork-Signature: sha256=<hex HMAC-SHA256 über "<timestamp>.<rohbody>" mit PH_STATUS_SECRET>`.
> 3. Andere unbekannte Events weiterhin mit HTTP 400 ablehnen. `product.changed` bleibt unverändert.
> 4. Schlüsselwerte nie loggen oder ausgeben.

## Abnahme
AlixWork → PRODUCT HUB → Webseiten → „Vollständiger Verbindungstest“ für `com`. Erwartet: GET 405 · unsigniert 401 · signiert 202, „Rückmeldung erfolgreich empfangen“, Ergebnis „Technische Abnahme erfolgreich“.
