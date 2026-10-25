export const hollywoodSecretDocumentation = `# ALIXWORK API – HOLLYWOOD SECRET

Version 1 · Alix Deutschland · Produktivbetrieb gesperrt

Basisadresse: https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/hollywood-secret-api

## Zugang
Aufrufe ausschließlich vom Server des Shops, niemals aus dem Browser.
Header: Content-Type: application/json und X-Shop-Key: <sicher gespeicherter Schlüssel>.
Testschlüssel: HOLLYWOOD_SECRET_TEST_KEY in beiden Projekten über den sicheren Geheimnis-Eintrag hinterlegen.
Produktivschlüssel ist separat; noch nicht eingerichtet. Keine Produktivfreischaltung durch diese Dokumentation.
Shop-ID stets hollywood-secret. Test- und Produktivschlüssel sind nicht austauschbar.

## Endpunkte (alle POST)
/v1/sandbox/health – {"shop_id":"hollywood-secret"}
/v1/sandbox/customers/find – {"shop_id":"hollywood-secret","external_customer_id":"test-customer-001","email":"test@example.invalid"}
/v1/sandbox/customers – {"shop_id":"hollywood-secret","customer":{...}}
/v1/sandbox/orders – vollständige Bestellung, Beispiel unten
/v1/sandbox/orders/read – {"shop_id":"hollywood-secret","external_order_id":"test-001"}
Produktivpfade ersetzen sandbox durch production; derzeit gesperrt.

## Artikelimport
POST /v1/sandbox/articles/import – isolierter Testimport, keine echten Katalogartikel.
POST /v1/production/articles/import – weiterhin gesperrt, solange der Produktivbetrieb nicht separat freigegeben ist.
Zugang und Anfragegrenzen wie oben; kein zusätzlicher Idempotency-Key nötig.

{"shop_id":"hollywood-secret","articles":[{"external_article_id":"test-article-001","sku":"HS-IMPORT-001","name":"Isolierter Testartikel","brand":"Hollywood Secret"}]}

Pflichtfelder je Artikel: external_article_id, sku, name. Optional: manufacturer, brand, model (je höchstens 200 Zeichen).
Maximal 100 Artikel je Anfrage, eindeutige Kennungen/SKUs; größere Listen in Pakete aufteilen (weiterhin maximal 64 KiB je Anfrage).
Antwort: created, replayed, skipped und articles mit external_article_id, sku, article_id, status, replayed.
Sandbox-IDs sind nur Testkennungen, keine echten Katalog-IDs und keine freigegebenen Bestellartikel.
Identische Artikel wiederholen sich ohne Duplikate, geänderte Daten unter derselben Kennung führen zu 409 ARTICLE_CONFLICT; die gesamte Anfrage wird dann zurückgerollt.
Produktiv würden neue Artikel ausschließlich als Entwurf im bestehenden Katalog angelegt. Vorhandene SKUs werden als skipped_existing gemeldet, ohne interne IDs fremder Artikel preiszugeben.
Keine Preise, Steuern, Bestände, Beschreibungen oder Freigaben importieren; solche Angaben werden abgewiesen. Preisfreigabe und Shop-SKU-Zuordnung bleiben separate Mitarbeiteraktionen.
Ein Artikel-Testimport beweist noch keinen Anschluss des Shop-Projekts; dessen Adapter muss diesen Endpunkt aufrufen und das Ergebnis speichern.

## Bestellung
Zusätzlicher Header: Idempotency-Key: hollywood-secret:test-001

{
  "shop_id":"hollywood-secret",
  "external_order_id":"test-001",
  "currency":"EUR",
  "customer":{
    "external_customer_id":"test-customer-001",
    "name":"Testkunde",
    "email":"test@example.invalid",
    "billing_address":{"street":"Teststraße 1","postal_code":"10115","city":"Berlin","country":"DE"},
    "shipping_address":{"street":"Teststraße 1","postal_code":"10115","city":"Berlin","country":"DE"}
  },
  "items":[{"sku":"HS-TEST-10","quantity":2,"unit_price_cents":1000}],
  "shipping_cents":0,
  "total_cents":2000
}

Optionale Kundenfelder: company, phone.
Optional payment_report: {"method":"bank_transfer","reported_status":"pending","provider_reference":"shop-reference"}.
Zahlungsmethoden: bank_transfer, invoice, card; gemeldeter Status: pending, paid, failed.
Zahlungsmeldungen werden nur als unbestätigte Information gespeichert, niemals als gebuchter Zahlungseingang.

## Antwort
201 für eine neue Bestellung; 200 für identische Wiederholung.
{"shop_id":"hollywood-secret","mode":"sandbox","external_order_id":"test-001","order_id":"<UUID>","order_number":"HS-TEST-test-001","status":"test_created","currency":"EUR","total_cents":2000,"payment":{"status":"unverified"},"invoices":[],"shipping":{"status":"not_shipped"},"replayed":false,"request_id":"<UUID>"}
Die Bestellung kann über orders/read erneut gelesen werden. invoices enthält nur eindeutig zugeordnete bestehende Rechnungen; keine öffentlichen PDF-Links. Versandstatus entspricht dem AlixWork-Auftragsstatus mit geplantem Versanddatum, soweit vorhanden.

## Duplikatsperre und Rechte
Die Kombination aus Shop und externer Bestell-ID ist eindeutig. Identische Wiederholungen und parallele Übertragungen liefern denselben Auftrag. Geänderter Inhalt unter derselben ID führt zu 409. Bei unklarem Ergebnis stets dieselbe ID und denselben Inhalt erneut verwenden, niemals eine neue ID erzeugen.
Kundensuche benötigt die externe Shop-Kundenkennung und die dazu passende E-Mail und findet ausschließlich bereits diesem Shop zugeordnete Kunden. Kein globaler Abgleich, keine Änderung fremder Kunden und keine vom Shop frei gewählte interne Kunden-ID.
Neue Kunden werden anhand der externen Shop-Kunden-ID zugeordnet. Widersprüchliche E-Mail führt zu 409; vorhandene Stammdaten werden nicht ungeprüft überschrieben.

## Preise, Steuern und Grenzen
Produktiv: nur explizit zugeordnete, freigegebene AlixWork-Katalogpreise; keine Shop-Rabatte oder frei eingegebenen Preise. EUR und deutsche Lieferadressen; weitere Länder benötigen eigene geprüfte Steuer-/Versandregeln.
Testartikel HS-TEST-10: künstlicher Testpreis 1000 Cent brutto, künstliche Teststeuer 19 %, Versand 0 Cent. Keine reale Preisliste und keine realen Kunden verwenden.
Maximal 100 unterschiedliche Artikel, je 1–1000 Einheiten, 64 KiB Anfrage und 60 authentifizierte Anfragen je Modus/Minute.
Tests werden nur als isolierte Integrationsdatensätze gespeichert. Keine produktiven Kunden, Aufträge, Rechnungen oder E-Mails entstehen.

## Fehler
Format: {"error":{"code":"...","message":"..."},"request_id":"..."}
400 INVALID_INPUT / INVALID_IDEMPOTENCY_KEY
401 UNAUTHORIZED
403 FORBIDDEN / PRODUCTION_DISABLED / TEST_DISABLED
404 NOT_FOUND
409 IDEMPOTENCY_CONFLICT / CUSTOMER_CONFLICT
413 BODY_TOO_LARGE
422 UNKNOWN_ARTICLE / PRICE_NOT_APPROVED / PRICE_MISMATCH / SHIPPING_NOT_APPROVED
429 RATE_LIMIT – nach einer Minute mit identischem Inhalt wiederholen
503 SETUP_REQUIRED
500 INTERNAL_ERROR – anhand request_id prüfen; keine neue Bestell-ID verwenden

## Anschluss im Shop-Projekt
1. Den kopierten gemeinsamen Testschlüssel sicher als HOLLYWOOD_SECRET_TEST_KEY hinterlegen, nie in Quellcode oder Chat.
2. Vorhandenen AlixWork-Adapter serverseitig auf diese Endpunkte umstellen; Simulation nicht als echte Verbindung ausweisen.
3. Für Shop-Testorders is_test=true nur sandbox verwenden. SKU HS-TEST-10 ist ausschließlich für den isolierten Verbindungstest.
4. createOrder: Shop-ID, unveränderliche Bestell-ID, Kunde, Positionen und Centbeträge übergeben. Erhaltene order_id als alixwork_order_id speichern.
5. findCustomer/createCustomer nutzen die externe Shop-Kunden-ID; mapArticle benötigt vorher eine freigegebene AlixWork-Preiszuordnung je Shop-SKU.
6. receiveInvoice und synchronizeShipping lesen orders/read; transferPayment darf keine Zahlung eigenständig buchen.
7. Testauftrag erstellen, identisch wiederholen und erneut abrufen; danach Ergebnis und IDs prüfen.
8. Vor Produktivbetrieb Artikel-, Steuer-/Versandfreigaben, getrennten Zugang und ausdrückliche Freigabe einholen.

## Verwaltung und Nachweise
AlixWork: Einstellungen → Schnittstellen → Onlineshops.
API-VERBINDUNG TESTEN prüft echten HTTP-Aufruf, ungültigen Zugang, isolierte Auftragserstellung, Wiederholung, Konflikt und erneuten Abruf.
Die administrativen Endpunkte benötigen einen aktiven, berechtigten Mitarbeiterzugang; Shop-Schlüssel berechtigen niemals zur Verwaltung.
Ein bestandener AlixWork-Test beweist noch keinen Anschluss des separaten Shop-Projekts. Produktive Auftragserstellung bleibt bis zum gesonderten Nachweis unbestätigt.
`;