# PRODUCT HUB – Release Control v1.1: Abschluss und Grenzen

## Implementiert

- Release Control v1.0 und Bundle v1.3/v1.2 unverändert erhalten; zusätzliche Zeilen für Kommunikation, Apex-Dry-Run und Sicherheitsprüfung.
- Je DE/COM: **Kommunikationsnachweis erstellen** und **Apex Pilot simulieren**.
- Kommunikation verwendet denselben signierten inhaltsfreien `connection.test`-Ablauf wie der bisherige vollständige Verbindungstest. Erreichbarkeit, unsignierte 401-Rückweisung, signierte Antwort, passende signierte Test-ID-Rückmeldung, Antwortzeit und Bundle-Kompatibilität werden geprüft. Wiederholung benutzt dieselbe Test-ID; HTTP-Erfolg allein gilt nicht als Schutzbeweis.
- Apex-Dry-Run liest den echten geschützten Bundle-Abruf und die lokale eindeutige Apex-Kennung, prüft Kanal/Identität/Notstopp und zeigt eine **Vorschau ohne Übernahme**. Andere Geräte werden als ausgeschlossen aufgeführt. Keine Produktnachricht an DE/COM und keine Produktdatenänderung.
- Alle Testergebnisse werden in der bestehenden geschützten Protokollablage gespeichert; Status aktualisiert sich nach Tests und regelmäßig. Vollständige Protokolle sind aufklappbar, auch nach erneutem Laden.
- Serverseitige Freigabematrix: aktuelle Vollsicherung, echte isolierte Wiederherstellung, Bundle-/Abwärtskompatibilität, Verbindung samt Signatur/Rückmeldung, kanalbezogene Kommunikation, bestätigter Apex-Dry-Run und vollständige Sicherheitsprüfung. Nachweise nach 24 Stunden oder nach erfassten relevanten Tabellen-/Konfigurationsänderungen ungültig. Neue Prüfaktionen verlangen exakte **aktive** Super-Admin-Rolle, keine Rollenvererbung.
- Bereits vorhandener reservierter `ph2_*`-Nachweisschutz wird wiederverwendet. Der alte interne Moduspfad ist für normale Caller nicht separat aufrufbar.
- Isoliertes lokales Restore-Werkzeug und genaue Einrichtungsanleitung; historische Manifest-/Zeilenprüfung ergänzt, Arbeitsspeichervergleich bleibt nur Vorprüfung.
- Alle 493 Datenbankhinweise einzeln und vorläufig klassifiziert; zusätzliche Tiefenprüfung separat dokumentiert. Keine bestehenden Sicherheitsrichtlinien bereinigt oder Scannerbefunde ignoriert.

## Nicht vollständig / blockiert

1. **Isolierter Restore:** Administrator bestätigt fehlendes Testprojekt. Kein tatsächlicher Restore gegen eine echte isolierte Zielumgebung durchgeführt. Schema-Nachweis und tatsächliche Datei-Prüfsummen fehlen im bisherigen Sicherungsmanifest. Keine erfolgreiche Abnahme simuliert.
2. **Signierter Empfängernachweis:** Der unveränderte `connection_test`-Rückmeldevertrag liefert nur Test-ID, Kanal und Zeitpunkt. Er liefert keinen bestätigten Apex-Scope, geplanten Daten-Diff, persistenten Empfängerstand oder Notstopp-Nachweis. Daher können Kommunikation und Apex-Dry-Run derzeit bewusst **nicht vollständig bestehen**. Ohne gesondert freigegebenen Empfängernachweis werden diese Aussagen nicht erfunden.
3. **Apex-Dateien / Zielzustand:** Vorschau zeigt Produktverweise; reale File-/Receiver-Prüfung und die tatsächlich vorgesehenen Webseitenänderungen sind noch nicht vollständig nachgewiesen. Die Änderungsliste bleibt ausdrücklich unbekannt, nicht fälschlich „keine Änderungen“.
4. **Sicherheit:** Bestätigte Super-Admin-Vererbungsabweichung und Quellcodebefunde beim Product-Hub-Import blockieren. Die 493er-Sichtung ist nicht mit einer vollständigen manuellen Einzelabnahme gleichzusetzen. Die zusätzliche Tiefenprüfung ist laut Scanner unvollständig; alte COM-Wege sind aktuell durch den vorhandenen Modusguard blockiert.
5. **Echte Admin-Bedienung:** Externe Supabase-Anmeldung wird dem Testwerkzeug nicht bereitgestellt. Die angemeldete Ausführung der vier neuen DE/COM-Aktionen ist nicht end-to-end abgenommen; unangemeldete Requests wurden mit 401 zurückgewiesen.
6. **Secret-Konfigurationsänderungen:** Keine Schlüssel geändert. Tabellenkontext erkennt Secret-Rotationen außerhalb der Datenbank nicht automatisch; danach müssen neue Nachweise ausdrücklich erstellt werden. Kein vollständiger automatischer Konfigurationsänderungsnachweis behauptet.

## Tests

- Alle bestehenden Frontend-Regressionen abschließend: 56 Testdateien / 266 Tests bestanden.
- Shared-Server-/Bundle-/Release-Control-Regressionen: 93 Tests bestanden.
- Isolationswerkzeug: fünf Sicherheits-/Vergleichstests bestanden; kein echter Produktiv-/Restore-Import durchgeführt.
- Datenbank: bisherige zehn Betriebsmoduschecks und zusätzliche Matrix-/Kanal-/Frische-/Identitäts-/Fälschungstests vollständig zurückgenommen. Ein erster Test scheiterte an einer zu engen erwarteten Fehlermeldung; der bestehende Schutz hatte bereits korrekt blockiert. Mit korrekter Erwartung bestanden.
- Drei zusätzliche echte Rollenprüfungen bestanden: Admin ohne Super Admin abgewiesen, aktiver exakter Super Admin zugelassen, unbekanntes Konto abgewiesen; keine Rollenänderungen.
- Browser: echte geschützte Seite führt ohne Sitzung zur Anmeldung; isolierte Desktop-/Mobilprüfung bestätigt je zwei Kommunikations-/Apex-Schaltflächen und eine angeklickte Vorschau ohne Übernahme, keine Laufzeitfehler. Das ist ausdrücklich keine angemeldete Ende-zu-Ende-Abnahme.
- Funktionen geprüft und bereitgestellt; Build-Protokoll ohne Fehler.

## Entscheidung

**DE und COM sind nicht zur Pilot- oder Produktivfreigabe abgenommen.** Beide Modi bleiben gesperrt, kein Pilotgerät gewählt, Notstopp aktiv. Alle 44 Geräte und bestehenden API-Schlüssel bleiben unverändert. Erst nach Bereitstellung der isolierten Umgebung, vertrauenswürdigen Empfängernachweisen und gesondert freigegebener Sicherheitskorrektur ist eine erneute Abnahme möglich.

Die separat beauftragte neue Vollsicherung vom 28.11.2026 wurde um 02:58:32 UTC erfolgreich abgeschlossen: 312 Tabellen, 2.742 von 2.742 Teilen mit SHA-256, 1.963 Speicherdateien indexiert, 1.447,8 MB. Dies ist ein Sicherungsstatus, **kein** vollständiger isolierter Restore- oder Hetzner-Integritätsnachweis.