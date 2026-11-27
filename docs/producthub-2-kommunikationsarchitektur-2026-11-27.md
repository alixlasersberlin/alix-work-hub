# PRODUCT HUB 2.0 – Kommunikationsarchitektur (Entwurf, 27.11.2026)

Status: Konzept. Keine produktive Umstellung, bevor Vollsicherung und isolierter Wiederherstellungstest bestanden sind.
Markierung: **[LIVE]** = existiert heute und ist geprüft · **[NEU]** = muss noch gebaut werden.

## A. Empfohlene Architektur

```text
 Super Admin klickt AN/AUS (Geräteübersicht)
            │
            ▼
 AlixWork: ph_products.<kanal>_active  ← einzige Wahrheit
            │  (DB-Trigger) [NEU]
            ▼
 Änderungssignal  POST https://<webseite>/api/public/product-hub/notify   (nur "etwas hat sich geändert", keine Inhalte)
            │
            ▼
 Webseite ruft ab: GET product-hub-api/products/{id}?channel=<kanal>  [LIVE]
   200 → online anzeigen, Cache für diese Seite leeren
   404 → offline: Karte, Detailseite, Suche, Sitemap entfernen
            │
            ▼
 Rückmeldung  POST product-hub-api/status  [NEU]  { tatsächlicher Status, öffentliche URL }
            │
            ▼
 AlixWork zeigt: ausstehend → bestätigt online / bestätigt offline / Fehler
```

Grundsatz: **Nur Abruf entscheidet.** Das Signal enthält nie Inhalte oder Befehle; geht es verloren, holt der Fünf-Minuten-Abgleich der Webseite es nach. Damit entfallen Direktversand, doppelte Befehle und widersprüchliche Regeln.

## B. Wiederverwendbare Funktionen
- `product-hub-api` [LIVE]: Liste/Detail/Medien/Dokumente je Kanal, Offline = 404, URL-Dekodierung, ohne Preise für Smart KI.
- Kanal-Aktivflags in `ph_products` und `ph_product_channels` (eigene Webseiten) [LIVE].
- Bestätigte Gerätekennungen (88 COM/DE) [LIVE].
- Öffentliche Kartenprüfung COM/DE (`/product-hub/com-abschaltpruefung`, `de-…`) [LIVE] → wird zum unabhängigen Nachweis.
- `ph_sync_log` als Protokoll [LIVE].

## C. Änderungen in AlixWork [NEU]
1. Trigger auf Aktivflags → Signal je Kanal (pg_net, Absender mit HMAC-SHA256 je Webseite).
2. Endpunkt `POST product-hub-api/status` für Rückmeldungen (HMAC-geprüft, nur bekannte Kanäle/Geräte).
3. Direktversand an COM/DE (`direct-release`, liefert HTTP 410) stilllegen; Sender nur noch für Seiten ohne Abruf (Beauty/AE bis zur Umstellung).
4. Kanalkennung einheitlich `dubai` (Alias `ae`/`uae`/`Dubai` nur lesend akzeptieren).
5. Bildvertrag: API liefert nur öffentliche Bild-URLs; private signierte Links (56 Medien, u. a. Nexus KI) einmalig in öffentlichen Produktbildspeicher kopieren, Original bleibt.
6. Erfolg nur bei Rückmeldung mit aktuellem `version`-Wert; ältere Rückmeldungen werden verworfen.
7. Fusion Red / Hybrid Red: Entscheidung zur Sperre in AlixWork abbilden (Flag AUS), nicht auf der Webseite.
8. Oberfläche später auf Geräte / Webseiten / Protokoll reduzieren; neue Webseite = Eintrag in `ph_channels` → neue Spalte.

## D. Änderungen auf den Webseiten
Signal empfangen, Gerät neu abrufen, Cache leeren, Status zurückmelden, eigene Freigaben/Sperrlisten entfernen, 5-Min-Abgleich als Sicherheitsnetz. Siehe Prompt F.

## E. Einheitlicher API-Vertrag
Basis: `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/product-hub-api`
Auth Abruf: Header `x-api-key: <PRODUCT_HUB_API_KEY>` (nur serverseitig).
Kanäle: `com`, `de`, `at`, `dubai`, `beautyco`. US ausgenommen.

| Richtung | Methode/Pfad | Status |
|---|---|---|
| Webseite → AlixWork | `GET /products?channel=<k>&locale=<l>` | LIVE |
| Webseite → AlixWork | `GET /products/{id}?channel=<k>` (200 online, 404 offline) | LIVE |
| Webseite → AlixWork | `GET /products/{id}/media`, `/documents` | LIVE |
| AlixWork → Webseite | `POST /api/public/product-hub/notify` | NEU |
| Webseite → AlixWork | `POST /status` | NEU |

Signal (AlixWork → Webseite):
```json
{ "event": "product.changed", "channel": "de", "product_id": "<alix_product_id>",
  "version": "<ISO-Zeitstempel updated_at>", "event_id": "<uuid>" }
```
Header: `X-AlixWork-Timestamp: <unix-sek>`, `X-AlixWork-Signature: sha256=<hex HMAC(secret, timestamp + "." + body)>`. Abweichung > 300 s ablehnen; `event_id` dedupliziert. Antwort sofort `202`.

Rückmeldung (Webseite → AlixWork):
```json
{ "event_id": "<uuid>", "channel": "de", "product_id": "<id>", "version": "<gleich wie Signal>",
  "state": "ONLINE" | "OFFLINE" | "ERROR", "public_url": "https://…/devices/<slug>" | null,
  "error": null, "observed_at": "<ISO>" }
```
Gleiche Signaturheader, eigenes Geheimnis je Webseite (`PRODUCT_HUB_STATUS_SECRET`).

## F. Lovable-Prompt für empfangende Webseiten
Siehe `docs/producthub-2-webseiten-prompt.md`.

## G. Migration und Rückfall
1. Gate: erfolgreiche Vollsicherung + Hetzner-Abgleich + Wiederherstellungstest.
2. AlixWork: `/status`-Endpunkt und Signal bauen, Signal zunächst **nur protokollieren** (Schattenbetrieb).
3. DE: Prompt F umsetzen, Signal mit einem Testgerät aktivieren, 5-Sekunden-Messung, Kartenprüfung.
4. COM, dann Dubai gleich.
5. Erst danach alten Direktversand für COM/DE entfernen.
Rückfall: Signal je Kanal abschalten (Kanal-Schalter) → Webseiten laufen mit 5-Min-Abruf weiter, unverändert funktionsfähig. Keine Produktdaten werden durch die Umstellung verändert.
