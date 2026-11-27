# Statusbericht Pilot Alix Apex – 27.11.2026

## 1. Warum Apex nicht über DE/COM ausgeliefert wird (Ursache, nichts geändert)
Datensatz `ph_products.id = e32852b4-0148-4e72-9930-271d70b0dc68`, `alix_product_id = Apex`, Slug `alix-apex`, `status = published`.
- `active_de = false` und `active_com = false` → die API filtert auf `published` **und** Kanalflag; Apex fällt deshalb aus Liste und Detail (404).
- Kanalzeilen `de` und `com`: `status = inactive`, `hold = true` (manuelle Sperre).
- COM hatte früher eine bestätigte ONLINE-Rückmeldung (`/devices/alix-apex`, Remote-ID `b0599cf6-…`), wurde danach deaktiviert.
- Die genannte „Interne UUID“ `13914134-…-d888` existiert in AlixWork nicht als Produkt-ID; maßgeblich für den Pilot ist `e32852b4-…`.
- Pflichtfelder/Bild sind nicht die Ursache der Nichtauslieferung (Filter greift vorher).
Freischaltung nur durch Super Admin (PRODUCT HUB → Webseiten, DE/COM aktivieren und Sperre lösen) – bewusst nicht automatisch.

## 2. Bulk-Schnittstelle
`GET product-hub-api/bundle?channel=…` (Vertrag v1.2, `api-vertrag-v1-2-bundle.md`) liefert Geräte, Medien, Dokumente, Content, Übersetzung, Compliance und Pilotstatus in einer Antwort. Bestehende Routen unverändert. Deployed.
Prompts: `PRODUCT_HUB_Bulk_DE.md`, `PRODUCT_HUB_Bulk_COM.md`.

## 3. Pilotbetrieb
- Signalversand (Capture/Claim/Prepare/Dispatch) ist bereits auf genau ein Pilotgerät je Kanal begrenzt.
- **Umgehung festgestellt:** Der 300-s-Abgleich der Webseiten nutzt die öffentliche Lese-API, die keine Pilotgrenze kennt – Änderungen anderer Geräte könnten so übernommen werden.
- Lösung: Bundle liefert `sync_scope` und je Gerät `sync_allowed`; Webseiten dürfen beim Abgleich nur `sync_allowed = true` übernehmen. Öffentliche Seiten bleiben sichtbar. Wirksam erst nach Umsetzung der Prompts in DE/COM.

## 4. Sicherheit
Keine Produkt-, Preis-, Status- oder Schlüsseländerung; Modus DE/COM `blocked`, Notstopp aktiv, Revision 0; keine automatische Freigabe.

## Tests
21 Deno-Tests (Pilot nur Apex, Notstopp, DE/COM getrennt, Kanalfilter, Routen) bestanden; Typprüfung OK. Live-Abruf mit API-Schlüssel nicht möglich (Schlüssel hier nicht verfügbar) – nur 401 ohne Schlüssel bestätigt.

## Offene Punkte
1. Super Admin: Apex für DE/COM aktivieren, Sperre lösen, Pilotgerät `Alix Apex` wählen.
2. Vollsicherung, Restore-Test, Kommunikationsnachweis (Voraussetzungen Pilotmodus).
3. DE/COM: Bulk-Prompt und Pilot-Prompt umsetzen und veröffentlichen.
4. Echter Bundle-Abruf mit Schlüssel aus einem Webseitenprojekt prüfen.
5. DE-Detailroute bestätigen; Remote-ID für DE-Apex fehlt.
