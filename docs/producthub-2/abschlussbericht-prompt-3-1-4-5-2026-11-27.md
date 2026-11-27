# PRODUCT HUB 2.0 – Prompt 3.1, 4 und 5 (Vorbereitung), Stand 27.11.2026

Keine produktiven Signale, keine Produktänderungen, keine Abschaltung bestehender Schnittstellen.

## Fertiggestellt
- Signierter Signalversand an die festen DE/COM/Dubai-Empfänger, gesperrt durch `PH_SIGNAL_LIVE_ENABLED=false` und zusätzlich durch eine geschützte Abnahmesperre (Sicherung, Wiederherstellung, Kommunikation, Freigeber).
- Dauerhafte Warteschlange im bestehenden Übertragungsprotokoll mit Ereignis-ID, Produkt, Webseite, Version, Status, Zeitpunkt, Versuchen, nächstem Versuch, letztem Fehler und Bestätigung.
- Änderungen an Produkt, Texten, Artikelnummer, Technik, Bildern/Videos, Dokumenten, Kategorien, Übersetzungen, SEO, Garantie/zentralen Preisen, Freigabe und Sperren erzeugen Ereignisse. Webseiten rufen danach den zentralen Stand ab; lokale Preisregeln werden nicht überschrieben.
- Erstversuch plus fünf Wiederholungen. Danach bleibt der Fehler sichtbar; nur aktive Super Admins können das aktuelle Ereignis erneut vormerken. Veraltete Ereignisse werden nicht ausgeführt.
- Nur signierte Rückmeldungen mit gleicher Ereignis-ID, Webseite, Produkt und Version bestätigen den Status.
- Neue Testansicht „PRODUCT HUB 2.0 · Test“ mit Geräte, Webseiten und Protokoll. Schalter, Sammelaktionen und neu hinzugefügte Webseiten wirken nur lokal in der Sitzung.
- Neuer Abrufmodus für Webseiten ist vorbereitet, aber bis zur Aktivierung mit 503 gesperrt. Der bestehende Abruf bleibt unverändert.

## Tests
- 41 Deno-Regeln plus isolierter HTTP-Ablauf: 42 bestanden.
- Zurückgerollte Datenbanktests: Neustart/abgelaufene Reservierung, doppelte Reservierung, alte Rückmeldung, unversendete Rückmeldung, frühe Rückmeldung, Duplikat, Livesperre.
- Zusätzliche Rechteprüfung: Kontoverknüpfung korrigiert; Konten ohne exakte Super-Admin-Rolle und unbekannte Konten werden abgewiesen. Angenommene Einladung und abgeschlossene Passwortänderung werden serverseitig verlangt.
- 14 Oberflächen-/Navigationstests bestanden. Browser: 100 Testgeräte × 20 Testwebseiten, Desktop und Mobil, fixierte Gerätespalte, 0 Schreibversuche, keine Laufzeitfehler.
- Isolierte Übertragung (letzter Messlauf, 10 Läufe, lokale Testempfänger): Mittel 9,12 ms, minimal 2,86 ms, maximal 46,85 ms. Das ist keine Messung der echten Webseiten.

## Schattenvergleich
44 Geräte, 190 Webseitenzuordnungen, 264 Gerät-Webseiten-Prüfungen, 49 Abweichungen. Vollständige Liste: `schattenvergleich-2026-11-27.csv`.
- Nexus KI: COM/DE heute AN, neu AUS, weil das Hauptbild ein privater signierter Link ist. Dubai bleibt gesperrt.
- Hybrid Red: COM/DE heute AN, neu AUS wegen privatem Hauptbild. Dubai bleibt gesperrt.
- Fusion Red: COM/DE/Dubai heute AN, neu AUS wegen privatem Hauptbild.
- Fusion Red und Hybrid Red waren zuvor öffentlich ausgeblendet; diese Entscheidung wurde nicht aufgehoben.
- Dubai: alte Schreibweisen werden auf `dubai` abgebildet; 14 Abweichungen. Keine Sperre wurde aufgehoben.

## Noch offen
- Echte DE/COM-Empfangsmodule müssen in den Webseitenprojekten gebaut und geprüft werden.
- Pro Webseite sind `PH_NOTIFY_SECRET_<KANAL>` und `PH_STATUS_SECRET_<KANAL>` in AlixWork erforderlich; noch nicht angelegt.
- Vollsicherung, Hetzner-Kopie und Wiederherstellungstest sind nicht nachgewiesen.
- Privates Hauptbild bei Nexus, Fusion und Hybrid muss fachlich geklärt werden.
- Echte Übertragungszeit kann erst nach Bereitstellung der Webseitenempfänger gemessen werden.
- Die geschützte Testansicht `/product-hub/v2` konnte nicht mit einer echten Anmeldung geprüft werden: für das externe Supabase-Projekt ist hier keine Sitzung verfügbar. Der Browsernachweis betrifft ausschließlich isolierte Testdaten; der echte Zugang ohne Anmeldung führt korrekt zur Anmeldeseite.
- 493 ältere Datenbanksicherheitshinweise bleiben unverändert; die zunächst neue Warnung der Wiederholungsfunktion wurde durch eine private geschützte Fassade beseitigt.

## Grenzen der Vorbereitung
- Das Hinzufügen einer Webseite in der Testansicht ist nur eine lokale Vorschau, keine produktive Verbindung. Neue produktive Webseiten benötigen separat bestätigte Empfänger und Zugangsdaten.
- Vollständige Liste vergleicht alte und neue AlixWork-Regeln, nicht den tatsächlich öffentlich sichtbaren Webseitenzustand. Zwei US-Abweichungen sind nur der Vergleich mit dem Ausschluss; US wurde nicht verändert.
- Längere Wiederholungen verwenden einen nur bei offenen Vorgängen eingerichteten Wiederanlauf. Der Mindestabstand kann nach Neustart um bis zu 60 Sekunden überschritten werden; derzeit ist kein solcher Auftrag aktiv.
- Der API-Vertrag wurde auf v1.1 aktualisiert, ohne Geheimniswerte. Empfänger und Aktivierung sind nicht Teil der hier bestätigten Live-Abnahme.
- Zentrale Freigaben und das Aufheben bestehender Sperren erhalten für den später aktivierten Betrieb einen exakten serverseitigen Super-Admin-Schutz. Dieser wurde strukturell eingerichtet; echte Freigabe-/Sperränderungen wurden nicht zum Testen ausgeführt.
- Abschließende Datenprüfung: weiterhin 44 Geräte; kein Produkt seit Beginn dieses Auftrags verändert, keine produktiven Warteschlangenereignisse und kein aktiver Wiederanlaufauftrag.