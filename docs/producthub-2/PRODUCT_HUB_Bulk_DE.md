# Integrationsprompt DE (alix-lasers.de) – PRODUCT HUB Bulk v1.2

Füge diesen Text im Projekt für alix-lasers.de ein:

> 1. Lade Gerätedaten serverseitig mit **einem** Abruf: `GET {SUPABASE_URL}/functions/v1/product-hub-api/bundle?channel=de` mit Header `x-api-key: PRODUCT_HUB_API_KEY` (bestehendes Secret, nicht ändern). Ersetze damit die bisherigen Einzelabrufe (Liste, Detail, media, documents, content). Fallback bei Fehler: bisherige Routen unverändert weiterverwenden.
> 2. Öffentliche Geräteseiten: Liste und Detail rendern genau die Geräte aus `products` (fehlendes Gerät = 404, wie bisher). Keine Preise ausser `prices`.
> 3. **Pilot-Schutz im 300-Sekunden-Abgleich:** Eigene gespeicherte Gerätedaten, Caches oder Produktversionen nur für Einträge mit `sync_allowed === true` überschreiben oder invalidieren. Bei `sync_allowed === false` den zuletzt angewendeten Stand unverändert lassen, keine positive Produkt-Empfangsbestätigung senden. `sync_scope.mode = "blocked"` oder `emergency_stopped = true` ⇒ keine produktive Übernahme.
> 4. Im Pilotmodus ist ausschliesslich `sync_scope.pilot_product_id` (vorgesehen: `Apex`, Slug `alix-apex`) übertragbar. Prüfe die Gerätekennung exakt.
> 5. Signierte Signale (`connection.test`, `product.changed`) und Rückmeldungen bleiben wie im Vertrag v1.1. Schlüssel nicht ändern.
> 6. Teste: ein Abruf liefert alle Geräte; nicht freigegebenes Gerät mit geändertem Inhalt wird beim Abgleich nicht übernommen; Seiten bleiben sichtbar.
