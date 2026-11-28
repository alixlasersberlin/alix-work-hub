# Sicherheitsbereinigung v3.0 – tatsächlicher Zwischenstand

Kein Gesamtabschluss und keine Sicherheitsfreigabe. Auftrag v3.0 ist weiterhin offen.

## Nachgewiesene Umsetzung

- 49 native Tiefenscan-Befunde technisch korrigiert und mit dem Befundverwaltungswerkzeug als behoben gemeldet: 46 kritische und drei Warnungen. Keine pauschalen Ignorierungen oder neu behaupteten Fehlalarme.
- Ausgang des zuletzt verfügbaren, fehlgeschlagenen Tiefenscans: 472 aktive native Befunde (264 kritisch, 208 Warnungen). Nach gezielter Meldung verbleiben 423 (218 kritisch, 205 Warnungen). Dies ist keine Vollständigkeitsgarantie des Scanners.
- Exakte direkt zugewiesene Rollen statt Admin-zu-Super-Admin-Vererbung; aktive, angenommene Konten ohne ausstehenden Passwortwechsel sind erforderlich. Explizite aktive Mandantenzuweisungen ersetzen die globale Freigabe bei fehlenden Zuweisungen.
- Fünf verifizierte Tabellen erhalten verpflichtende, nicht rechtserteilende Mandantenbeschränkungen. Die vorhandenen fachlichen Rechte gelten zusätzlich. Regionszugehörigkeit verleiht Finanztransaktionen keine allgemeinen Schreib-/Löschrechte mehr.
- Gemeinsame interaktive Mitarbeiterprüfung und getrennte private Maschinenprüfung; Bank-, Lastschrift-, DATEV-, CMR-, Finanzautomations-, Dokument-, Signatur-, Such-, Assistenz- und Transkriptionswege abgesichert.
- Sieben bestehende Finanz-/CMR-Zeitpläne verwenden den vorhandenen privaten Maschinenzugang, ohne Änderung seiner Werte oder der Ausführungszeiten. Keine Aufgaben neu gestartet.
- Produktimport: schreibender Altimport gezielt isoliert; geschützte Vorschau bleibt vorhanden. Quellschlüssel sind an den bestehenden exakten Exportendpunkt gebunden; Weiterleitungen werden nicht verfolgt.
- CAMT.054-Zuordnung prüft Bankkonto, Mandant, Kundenquelle, Währung und Eindeutigkeit; kein echter Import zur Prüfung ausgeführt.
- HTML-Bereinigung in Suchauszügen, Vorlagen, PDF-Vorschau, Versionsvergleich und Mahnvorschau verwendet den vorhandenen gemeinsamen Schutz.
- 34 betroffene bzw. von der gemeinsamen Mandantenprüfung abhängige Funktionen bereitgestellt; letzte RAG-Ergänzung erneut bereitgestellt. Anwendung nicht neu veröffentlicht.

## Tests und Nachweise

- 142 Server-/Berechtigungs-/Provider-/Product-Hub-Regressionstests bestanden; letzte Endpunktänderung mit 30 erneut bestandenen Tests geprüft.
- 275 Anwendungstests bestanden. Aktuelles Vorschauprotokoll: build OK.
- Tatsächlich bereitgestellte 25 Eingänge: 24 öffentliche Aufrufe mit 401 abgewiesen; 3CX mit 503 bewusst isoliert, weil die Providerprüfung noch nicht konfiguriert ist.
- SQL-Prüfungen unter `authenticated`: gewöhnlicher aktiver Admin ohne Super-Admin-Rechte, tatsächlicher berechtigter Kontaktzugriff, ausdrücklich zugewiesener DE/AT-Zugriff; unzugewiesene Identität sieht in allen fünf Tabellen null Datensätze. Keine Finanzschreibzugriffe.
- Positive automatische/manuelle Endpunktprüfungen liefen mit isolierten leeren Datensätzen und gemockten Diensten; sie ersetzen keine vollständige reale Benutzer-/Providerabnahme.
- Verschlüsselter Quellbestand mit SHA-256 und erfolgreicher Entschlüsselungs-Gleichheitsprüfung privat gesichert; betroffene Berechtigungsdefinitionen geschützt dokumentiert. Kein vollständiger isolierter Datenbank-Restore behauptet.
- Unverändert geprüft: 44 Produktdatensätze, Fingerprint `8b67f41d0720374a058ab09745d27073`; 102 Zeitpläne einschließlich Namen/Aktivierung/Zeiten, Fingerprint `4f652b55630548d00306cc87dc8e8919`. Product Hub: `enabled=false`, `emergency_stopped=true`, `controlled_modes=true`. Verträge v1.2/v1.3 unverändert.

## Verbleibende Arbeiten und echte Blocker

- 423 aktuelle native Befunde und die übrigen A1–A8-Ursachen sind nicht abgeschlossen; die Bilanz-CSV bewahrt jede offene Identität. Kein vollständiger Korrekturabschluss.
- Von 493 älteren Datenbankhinweisen entfällt einer nach Einschränkung des Trigger-Aufrufrechts; 492 Hinweise verlangen weitere semantische Einzelprüfung. Ausführbare Definer sind nicht pauschal Fehlalarme oder pauschal erfolgreiche Korrekturen.
- Echte angemeldete Oberfläche, vollständige Mitarbeiter-/Mandanten-/Provider-Erfolgsfälle: hier keine externe Supabase-Sitzung verfügbar. Keine Zugangsdaten vom Benutzer angefordert und kein Login umgangen.
- Isolierter Restore: getrennte Testumgebung und vollständige Wiederherstellungsnachweise fehlen weiterhin.
- 3CX: bestehender privater Providerzugang muss koordiniert im Anbieter und AlixWork eingerichtet werden; ohne diesen bleibt genau der Eingang isoliert. Abweichende 3CX-Medienhosts sind nicht stillschweigend freigegeben.
- Bank-API: keine aktive Verbindung in der geprüften Konfiguration; künftig verwendete Providerhosts müssen vor credentialführenden Abrufen explizit bestätigt werden. Kein Testkontakt mit einer Bank.
- Legacy-Signaturen/Bankkonten ohne eindeutige Kunden-/Mandantenzuordnung bleiben im betroffenen Vorgang gesperrt, statt Zugehörigkeit zu erfinden. Die vollständige atomare Lastschriftexport-Zustandsabnahme steht aus.
- Koordinierte Rotation historisch exponierter Zugänge bleibt eine notwendige separate Durchführung mit den externen Systemen; keine Schlüsselwerte verändert oder offengelegt.
- Der vorherige Tiefenscan ist fehlgeschlagen. Ein erneuter Tiefenscan muss den gespeicherten Korrekturstand prüfen; sein Ergebnis ist noch keine Abnahme.

## Sichere Rücknahme

Keine ungeschützte Altversion, Rollenvererbung oder globale Freigabe bei fehlenden Zuweisungen wiederherstellen. Bei einer Regression den konkreten Ausführungsweg isolieren, seine legitime Aufrufer-/Objektzuordnung prüfen und ausschließlich eine nachweislich sichere Variante bereitstellen. Geschäftsdaten, Produktverweise und Zeitpläne nicht zur Fehlerbehebung umschreiben.