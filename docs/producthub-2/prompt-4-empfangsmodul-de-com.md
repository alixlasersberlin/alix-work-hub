# Prompt 4 – ALIX PRODUCT RECEIVER 2.0

Separat in ALIX DE und ALIX COM verwenden. `<KANAL>` = `de` oder `com`. Zusätzlich `docs/producthub-2-api-vertrag-v1.md` beifügen. Keine Zugangsdaten in diesen Prompt kopieren.

Baue ein deaktiviertes Empfangsmodul. Bestehende öffentliche Produktseiten, Produktabruf und Freigaben bleiben unverändert, bis AlixWork die Aktivierung ausdrücklich freigibt.

1. Empfänger: `POST /api/public/product-hub/notify`. Prüfe HMAC-SHA256 über `timestamp + "." + rohBody`, maximal 300 Sekunden Abweichung, Webseiten-ID `<KANAL>`, UUID-Ereignis, Produkt-ID und Version. Duplikate ignorieren; ältere Versionen nie über neuere anwenden.
2. Nach gültigem Signal immer neu abrufen: `GET /product-hub-api/products/{id}?channel=<KANAL>&protocol=2`. 200 = veröffentlicht; 404 mit `publication_state:"OFFLINE"` = bestätigt deaktiviert. 503/Timeout/5xx sind Verbindungsfehler und dürfen kein Gerät deaktivieren.
3. Bei Bestätigung Übersicht, Kategorien, Detailseite, Suche, Sitemap und weitere öffentliche Darstellungen aktualisieren. Deaktivierte Detailseiten müssen 404 liefern, Daten werden nicht gelöscht.
4. Danach `POST /ph-status-receipt` signiert zurückmelden: Ereignis, Kanal, Produkt, exakte Version, tatsächlicher Status, öffentliche URL, Zeitpunkt und Fehler. Empfang allein ist kein Erfolg.
5. Fünf-Minuten-Abgleich als Rückfall; nur bestätigte Zustände anwenden.
6. Secrets nur serverseitig: `PRODUCT_HUB_API_KEY`, `PRODUCT_HUB_NOTIFY_SECRET`, `PRODUCT_HUB_STATUS_SECRET`; niemals protokollieren.
7. Geschützte Seite „ALIXWORK VERBINDUNG“: Webseiten-ID, Receiver-Version, Status, letztes Signal, letzte Synchronisierung, letzte Rückmeldung und Fehler.
8. Ausgabe: tatsächliche Receiver-URL, Secret-Namen, Webseiten-ID, Version, Tests und Blocker. Danach auf Freigabe warten.