# Hollywood Secret – Prüfstand

## Nachgewiesen
- 25.10.2026: ausdrückliche Zustimmung aufgenommen, echte Artikelimporte separat über article_import_enabled freigegeben. Bestellungen bleiben wegen fehlender Artikelpreis-/Versandfreigaben gesperrt. Produktivschlüssel über echten HTTP-Aufruf geprüft: Bestellungen 403 PRODUCTION_DISABLED, Artikel mit Preisfeld 400 INVALID_INPUT, keine echten Datensätze erzeugt. 14 Tests bestanden (13 bestehende plus gezielter Produktivzugangstest).
- Artikelimport unter /v1/sandbox/articles/import und /v1/production/articles/import bereitgestellt; Produktionssperre bleibt unverändert. 13 Deno-Tests bestanden einschließlich echter HTTP-Artikelübertragung, paralleler Wiederholung und atomarer Rückabwicklung bei Konflikt.
- Artikelimport-RPC ausschließlich für service_role ausführbar; anon und authenticated ohne Ausführungsrecht. Nach dem Test keine Hollywood-Secret-Artikel im echten Katalog; Testartikel ausschließlich in integration_logs. Preise und geschützte Texte bleiben unverändert.
- Versionierte Edge-Schnittstelle bereitgestellt, Produktivmodus deaktiviert.
- Zehn Deno-Tests bestanden nach letztem Deployment, darunter echte HTTP-Aufrufe für isolierte Auftragserstellung, parallele Wiederholung, erneuten Abruf, Konfliktsperre, zurückgerollte Kundenanlage bei ungültigen Artikeln, Kundensuche mit passender externer Kennung und serverseitiges 60-Anfragen-Limit.
- Ungültiger Verwaltungszugang mit HTTP 401 abgelehnt; unangemeldete Browsernavigation endet bei der Anmeldung.
- Datenbankstatus TEST_OK; keine produktiven Hollywood-Secret-Aufträge vorhanden.
- Vorschau meldet build OK. Keine Kunden-E-Mails versendet, keine Rechnungen erstellt, kein Shop-Produktivbetrieb aktiviert.

## Noch nicht nachgewiesen
- Artikelübertragung aus dem separaten Shop-Projekt und echte Produktiv-Artikelanlage; Anleitung enthält den neuen Vertrag, der Shop-Adapter muss ihn noch verwenden.
- Angemeldete Administrationsansicht und Verwaltungsaktionen: externe Anmeldung verhindert automatisierten Mitarbeiterzugriff.
- Verbindung aus dem separaten Hollywood-Secret-Shop: vorhandener Adapter ist dort noch eine Simulation; nur lesbarer Projektzugriff verfügbar.
- Produktive Artikel-, Steuer-/Versandzuordnungen, Produktionsfolgeprozesse und Rechnungszuordnung: keine echten Shop-Aufträge für Tests erzeugt.
- Rückweisung inaktiver / nicht freigegebener Mitarbeiter: vorhandene serverseitige Status-/Rollenprüfung übernommen, kein solcher Mitarbeiterzugang zum Testen genutzt.

## Sicherheit
- Shop-Schlüssel bleiben serverseitig; Test- und Produktivzugänge getrennt.
- Kundensuche ist shopbezogen und erfordert zusätzlich externe Shop-Kundenkennung plus E-Mail.
- Shop-Zahlungsmeldungen tragen ausdrücklich verification_status=unverified und authoritative=false; keine Zahlung wird daraus gebucht.
- Verwaltungsaktionen: 60 je Mitarbeiter/Minute, Selbsttests: 2 je Mitarbeiter/Minute.
- Produktivmodus hat keine Freischaltungsaktion in der neuen Verwaltungsansicht.
- Bestehende Datenbank-Prüfung meldete 497 bereits vorher vorhandene Hinweise, keine neu eingeführten Hinweise durch die letzte Absicherung; nicht im Rahmen dieser Shop-Anbindung geändert.

## Nächster Schritt
Echte Artikel im Shop-Projekt an den freigegebenen /v1/production/articles/import-Endpunkt senden und nur bestätigte draft_created-IDs übernehmen; alternativ dort CSV mit external_article_id, sku, name und optional manufacturer, brand, model exportieren und hier hochladen. Dieses Projekt kann weder die private Shop-Datenbank auslesen noch den Shop-Adapter starten. Vor echten Bestellungen Artikelpreise, Steuern und Versand sowie den Shop-Ende-zu-Ende-Nachweis prüfen.