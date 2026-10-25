# Hollywood Secret – Prüfstand

## Nachgewiesen
- Versionierte Edge-Schnittstelle bereitgestellt, Produktivmodus deaktiviert.
- Zehn Deno-Tests bestanden nach letztem Deployment, darunter echte HTTP-Aufrufe für isolierte Auftragserstellung, parallele Wiederholung, erneuten Abruf, Konfliktsperre, zurückgerollte Kundenanlage bei ungültigen Artikeln, Kundensuche mit passender externer Kennung und serverseitiges 60-Anfragen-Limit.
- Ungültiger Verwaltungszugang mit HTTP 401 abgelehnt; unangemeldete Browsernavigation endet bei der Anmeldung.
- Datenbankstatus TEST_OK; keine produktiven Hollywood-Secret-Aufträge vorhanden.
- Vorschau meldet build OK. Keine Kunden-E-Mails versendet, keine Rechnungen erstellt, kein Shop-Produktivbetrieb aktiviert.

## Noch nicht nachgewiesen
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
Anleitung über Einstellungen → Schnittstellen → Onlineshops herunterladen und den serverseitigen Adapter im separaten Shop-Projekt umstellen. Gemeinsamen Testschlüssel dort sicher hinterlegen. Erst nach Shop-Test und bestätigten Preisen, Steuern und Versandregeln eine gesonderte Produktivfreigabe durchführen.