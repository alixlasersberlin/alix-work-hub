> Enthält keine Schlüsselwerte – nur Secret-Namen. Werte ausschließlich über die Secret-Verwaltung des jeweiligen Projekts setzen.

# Lovable-Prompt für empfangende Webseiten (DE, COM, Dubai, künftige Seiten)

> Vor Verwendung `<KANAL>` ersetzen: alix-lasers.de = `de`, alix-lasers.com = `com`, Dubai = `dubai`. Die Teile „notify“ und „status“ erst aktivieren, wenn AlixWork sie freigeschaltet hat; bis dahin nur Schritt 1–3 und 6.

---

Diese Webseite bezieht ihre Geräte ausschließlich aus ALIXWORK PRODUCT HUB. AlixWork ist die einzige Stelle, die entscheidet, ob ein Gerät online oder offline ist. Baue Folgendes:

1. **Datenquelle (nur serverseitig):** `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/product-hub-api` mit Header `x-api-key` aus dem Secret `PRODUCT_HUB_API_KEY`. Niemals im Browser.
   - Übersicht: `GET /products?channel=<KANAL>`
   - Detail: `GET /products/{alix_product_id}?channel=<KANAL>` → 200 = online, 404 = offline
   - Medien/Dokumente: `GET /products/{id}/media?channel=<KANAL>`, `/documents?channel=<KANAL>`
2. **Anzeige:** Übersicht, Detailseite, Suche und Sitemap zeigen nur Geräte aus der Antwort. Bei 404 Detailseite mit 404 beantworten und Gerät überall entfernen. Entferne alle eigenen Freigaben, Sperrlisten, Prüf-/Review-Schritte und fest eingebauten Ausblendungen.
3. **Cache:** höchstens 5 Minuten. Zusätzlich alle 5 Minuten vollständiger Abgleich als Sicherheitsnetz.
4. **Signal empfangen:** `POST /api/public/product-hub/notify`. Prüfe `X-AlixWork-Timestamp` (max. 300 s Abweichung) und `X-AlixWork-Signature` = `sha256=` + HMAC-SHA256(Secret `PRODUCT_HUB_NOTIFY_SECRET`, `timestamp + "." + rohBody`), zeitkonstanter Vergleich. Body: `{event:"product.changed", event_id, channel, product_id, version, desired, issued_at}` (`desired` nur Hinweis, maßgeblich ist der Abruf). Falscher Kanal → 400, falsche Signatur → 401. Doppelte `event_id` ignorieren. Sofort `202` antworten, dann im Hintergrund weiter.
5. **Verarbeitung:** Detail neu abrufen, Cache für Übersicht, Detail, Suche und Sitemap leeren, danach öffentliche Detail-URL selbst prüfen.
6. **Rückmeldung:** `POST https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ph-status-receipt`, gleiche Signaturart mit Secret `PRODUCT_HUB_STATUS_SECRET`. Body: `{event_id, channel, product_id, version, state:"ONLINE"|"OFFLINE"|"ERROR", public_url, error_code, error, observed_at}`; `version` exakt aus dem Signal übernehmen. Melde nur den tatsächlich beobachteten Zustand. Kein automatisches Wiederholen über 3 Versuche (Abstand 2/10/30 s).
7. Ziel: Änderung innerhalb von 5 Sekunden sichtbar. Keine Preise anzeigen, die nicht geliefert werden. Keine weiteren Schnittstellen erfinden.
