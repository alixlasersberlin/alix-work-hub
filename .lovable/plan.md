# Hollywood Secret an AlixWork anbinden

## Ziel und verbindliche Grenzen

Hollywood-Secret-Bestellungen gehören zu **Alix Deutschland**. Die Anbindung nutzt AlixWorks vorhandene Kunden, Aufträge, Positionen, Rechnungen und Zahlungsinformationen. Keine neue Auftragsverwaltung und keine neuen Tabellen.

Die interne App bleibt geschützt. Nur die ausdrücklich authentifizierte Shop-Schnittstelle ist von außen erreichbar. Produktivübernahmen bleiben gesperrt, bis Sie sie ausdrücklich freigeben.

## 1. Sichere Shop-Schnittstelle

- Einen eigenen Zugang für Hollywood Secret mit getrennten Test- und Produktivrechten einrichten; Zugangsdaten ausschließlich sicher speichern, niemals im Browser, Dokument oder Protokoll.
- Kunden suchen, anlegen und zuordnen; ausschließlich shopzugeordnete Kundendaten zurückgeben. Keine globale Kundenliste oder Abfrage fremder Kunden anhand bekannter E-Mail-Adressen.
- Bestellungen übernehmen und später ihren Auftrags-, Zahlungs-, Rechnungs- und Versandstatus abrufen. Der Shop erhält nur seine eigenen Vorgänge.
- Kunden, Auftrag und Positionen vollständig in einem Vorgang speichern: Bei einem Fehler wird nichts teilweise angelegt.
- Wiederholte Übertragung derselben Shop-ID und Bestell-ID liefert denselben Auftrag. Ein veränderter Inhalt unter derselben Bestell-ID führt zu einem Konflikthinweis, nicht zu einer zweiten Bestellung.
- Artikel anhand bestätigter Zuordnungen auflösen. Preise, Steuer und Summen auf AlixWork-Seite prüfen; unbekannte Artikel oder widersprüchliche Beträge ablehnen. Fehlende Steuer- und Versandpreisregeln verhindern die Freischaltung.
- Zahlungsinformationen aus dem Shop sind kein Nachweis für eine gebuchte Zahlung. Zahlungsbuchungen bleiben im vorhandenen Buchhaltungsablauf; keine automatische Rechnungsfestschreibung oder E-Mail aus einem Test.
- Größenbegrenzungen, Eingabeprüfung, begrenzte Anfragenzahl und bereinigte Fehlerprotokolle ergänzen.

## 2. Verwaltung in AlixWork

Unter **Einstellungen → Schnittstellen → Onlineshops** eine geschützte Ansicht ergänzen:

- Hollywood Secret, zugehörige Firma und Test-/Produktivstatus.
- Zugang eingerichtet oder fehlend, Rechte und sichere Hinweise zur Verbindung; keine vollständigen Schlüssel anzeigen.
- Artikelzuordnungen und Freigabestatus der Preise/Steuern.
- Letzte erfolgreiche Übertragung, eingegangene Aufträge, Fehler und Protokolle mit abrufbaren älteren Einträgen.
- **API-VERBINDUNG TESTEN** mit tatsächlicher Prüfung von Anmeldung, Auftragserstellung, Wiederholung und erneutem Abruf im isolierten Testbereich.

Verwaltung und Freigaben nur für berechtigte Administratoren, mit serverseitiger Rollen- und Mandantenprüfung. Bestehende Navigation und Prozesse bleiben erhalten.

## 3. Isolierte Tests

- Persistente Testfälle innerhalb bestehender Integrationsprotokolle ablegen, nicht in produktiven Kunden-, Auftrags- oder Rechnungstabellen. Sie bleiben klar als Test gekennzeichnet und lösen keine Geschäftsprozesse aus.
- Test- und Produktivzugang strikt trennen; Testdaten dürfen niemals in den Produktivpfad gelangen.
- Automatisierte Prüfungen für falschen/fehlenden Zugang, fremde Shop-Daten, gesperrten Produktivmodus, Preismanipulation, ungültige Artikel, Fehler-Rücknahme, parallele Doppelübertragungen, veränderte Wiederholungen und Anfragebegrenzung erstellen.
- Ein echter Aufruf des bereitgestellten Test-Endpunkts muss die Testbestellung erneut lesbar machen. Eine lokale Simulation wird nicht als erfolgreiche externe Verbindung ausgewiesen.
- Die produktive Transaktion zusätzlich mit Testdaten und vollständiger Rücknahme prüfen, soweit die verbundenen Supabase-Werkzeuge dies sicher erlauben; sonst diesen Nachweis ausdrücklich als offen ausweisen.

## 4. Dokumentation und Übergabe

- Downloadbare API-Dokumentation mit Basisadresse, Endpunkten, Zugangsverfahren, Rechten, JSON-Beispielen, Fehlercodes, Duplikatsverhalten und Anschlussanleitung für das Shop-Projekt erstellen.
- Abschlussbericht **ALIXWORK API – HOLLYWOOD SECRET READY** mit JA/NEIN und Nachweis für: Schnittstelle implementiert, Anmeldung getestet, Auftragserstellung getestet, Duplikatsperre getestet, Test-API erreichbar und Dokumentation erstellt.
- Nicht nachgewiesene Punkte bleiben NEIN. Produktive Nutzung und echte Kunden-E-Mails erfolgen nicht im Rahmen der Tests.

## Technische Umsetzung

- React/Vite und bestehende geschützte Routen/UI-Komponenten verwenden.
- Neue serverseitige Edge Function mit versioniertem Vertrag; keine gemeinsamen Geheimnisse im Frontend. Den Endpoint zuerst bereitstellen, anschließend einen gemeinsamen Schlüssel über das sichere Formular einrichten, der im Shop ebenfalls hinterlegt wird.
- Vorhandene `integration_health` für Verbindung und nicht geheime Konfiguration sowie `integration_logs` für bereinigte Protokolle und isolierte Testdatensätze verwenden; erforderliche zusätzliche Felder und gezielte Indizes nur an bestehenden Tabellen ergänzen. Vorhandene Leserechte prüfen und neue shopbezogene Einträge auf berechtigte Administratoren begrenzen, ohne bestehende Integrationen zu beeinträchtigen.
- `api_rate_limits` für atomare Anfragebegrenzung verwenden. Neue Security-Definer-RPCs nur für den autorisierten Serverzugang freigeben, mit festem Suchpfad und erneuter Shop-/Mandantenprüfung.
- Produktive Aufträge über bestehende `orders`, `order_items` und `customers` speichern; Shop-ID und externe Bestell-ID serverseitig verankern und per Sperre/gezieltem eindeutigen Index gegen parallele Duplikate schützen. Originale Zoho-Auftragsnummern bleiben unverändert.
- Produktpreise aus freigegebenen bestehenden Katalogdaten und expliziten Artikelzuordnungen ableiten. Keine Preise aus dem Shop-Snapshot ungeprüft übernehmen.
- Der Shop-Snapshot enthält aktuell lediglich einen simulierten AlixWork-Anschluss. Der dokumentierte Vertrag wird deshalb an dessen vorhandene Adapterfunktionen angepasst; Änderungen am anderen Projekt erfolgen nicht aus diesem Chat.

## Voraussetzungen und offene Nachweise

- Alix Deutschland ist bestätigt; konkrete Artikelzuordnungen sowie freigegebene Steuer-/Versandregeln müssen vor Produktivbetrieb vorliegen.
- Ein eigener Hollywood-Secret-Zugang ist noch nicht eingerichtet; das sichere Formular folgt nach Bereitstellung der Anbindung.
- Das verbundene externe Supabase erlaubt keine automatisch bereitgestellte Mitarbeitersitzung. Die Administrationsansicht kann ohne solche Sitzung nicht vollständig angemeldet geprüft werden; externe API-Tests werden separat nachgewiesen.