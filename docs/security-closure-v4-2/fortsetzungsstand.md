# FINAL SECURITY CLOSURE v4.2 — tatsächlich bereitgestellte Korrekturen

28.11.2026. Keine finale Sicherheitsabnahme, keine Veröffentlichung der Anwendung.

## Ausgeführt und geprüft

- Elf vorhandene Funktionen korrigiert und bereitgestellt: Einkaufsversand, Reparatur-Kostenvoranschlag, Tourenberechnung, eigener Kalenderabgleich, Auftragsbestätigung, Katalogversand, Signatur-Auftragsumwandlung, Rechnungsversand, Angebotsanalyse, Techniker-Ankunftsnachricht und Zahlungserinnerungen.
- Aktive Konten, exakt zugewiesene Fachrollen, persönliche Elternobjektrechte und Firmenzuordnung vor sensiblen Aktionen. Persönliche Datenbankrechte für Mitarbeiter; bestehende private Maschinenzugänge für Rechnungs-/Erinnerungsjobs erhalten. Keine Kundenaktionen in Live-Tests.
- Kalenderabgleich liest nur die eigenen Verbindungen und persönlich autorisierte, zugewiesene Firmentermine; fremde Benutzerkennungen werden abgelehnt.
- Auftragsbestätigungen prüfen Kunden-/Firmen-/Nummernzuordnung zwischen Signatur und Auftrag; Umwandlungen erhalten unveränderte kanonische Nummern und Dublettenlogik. Angebotsanalyse ignoriert modellgenerierte fremde Kennungen.
- Einsatznachrichten prüfen Technikerzuweisung oder vorhandene Planungsrechte sowie Kunde/Auftrag/Firma; Empfänger stammen aus dem Einsatz. Rechnungsversand für Mitarbeiter nur an zugängliche gespeicherte Kunden, Kopien auf bestehende interne Adressen begrenzt. Private vorhandene Job-Aufrufe bleiben möglich.
- Direkte öffentliche/Mitarbeiter-Ausführungsrechte auf alixsmart_emit(text,jsonb) und backup_watchdog_mark_stuck() entzogen; Systemzugang und bestehende privilegierte Trigger-/Wartungsaufrufer erhalten. Keine Retention-, Zeitplan- oder Datenänderung.
- 313 neue/bestehende Serverregressionen bestanden. Alle elf geänderten Funktionen erfolgreich isoliert typgeprüft. Zusätzlich gezielte Edge-Testausführung erfolgreich. Elf reale Endpunkte mit ungültiger Kennung und elf mit echtem öffentlichem Projektschlüssel jeweils 401. PostgREST-Grants durch zwei fehlschlagfähige lesende SQL-Assertions geprüft.
- Genau 67 native Scanner-IDs (43 kritisch, 24 Warnungen) über manage_security_finding erfolgreich als behoben gemeldet; keine Ignorierungen. Vollständige Zuordnung: native-closed.csv.

## Scan-/Datenbankbilanz ohne falsche Abnahme

Die Tiefenprüfung auf a8e2e18b96174f30720ad35f9ab48e018dd2ecf8 ist fehlgeschlagen. Ihre Ergebnisantwort enthält weiterhin die geerbte 667-ID-Basis, keinen abgeschlossenen Scan des neuen Codes. Nach den 67 gezielten Schließungen meldet die Verwaltung 600 aktive native Befunde (304 kritisch/296 Warnungen); diese müssen individuell mit tatsächlichem Quell-/Bereitstellungsstand abgeglichen werden. Keine Gleichsetzung aller historischen Meldungen mit aktuellen bestätigten Lücken. Restliste verlustfrei in remaining-native.csv/remaining-native-ids.txt.

Der Linter sank durch die zwei gezielten Rechtekorrekturen von 321 auf 319: zwei absichtlich geschützte Tabellen ohne öffentliche Richtlinien, drei Erweiterungshinweise, zwölf öffentliche und 302 Mitarbeiter-Definer-Hinweise. Keine pauschale Entwarnung: vollständige Definitions-/Aufrufer-/Policy-Abnahme bleibt offen. Die Tabellen ohne Richtlinien dürfen nicht zur Befundbereinigung geöffnet werden.

## Bestandsschutz

Vor-/Nachprüfung identisch: 44 Produkte, Produktfingerprint 936dc6209c4afc91c1d54dad8e28d773; 102 Jobs, Zeitplan-/Befehlsfingerprint 4f66f92123bf2664a2d520d43bce8325. Product Hub enabled=false, emergency_stopped=true, Revision 0; DE/COM blocked, kein Pilotgerät. Keine Produkt-/Geschäftsdatenänderung, keine Schlüsselrotation, keine API-Vertrags-/Produktivfreigabe. Neue Schutzprüfungen verändern Berechtigungsentscheidungen, nicht bestehende Schnittstellenfelder.

## Weiterhin offen

600 gespeicherte native IDs, 319 Datenbankhinweise und historische Korrekturen individuell abgleichen; verbleibende sicher lösbare Ursachen korrigieren. Ein erneuter Tiefenscan muss seinen tatsächlichen Commitbezug nachweisen; kein Nullrisiko-/Abschlussbericht vor vollständiger Prüfung.

Echte Mitarbeiter-/Provider-Abnahme ist nicht ersetzt: Sitzungswerkzeug verweigert die Token-Erstellung für das extern verwaltete Supabase-Projekt. Keine Zugangsdaten erfragt und keine Geschäftsaktionen simuliert. Isolierter Restore und koordinierte historische Zugangsrotation weiterhin extern abhängig. Außer einer separat gestarteten Tiefenprüfung läuft keine Hintergrundbereinigung.

Root AGENTS.md ist vollständig ausgelastet; keine bestehenden Nutzer-/Skillregeln verkürzt. Die Korrekturen verwenden bestehende Caller-/Process-/Job-Architektur.
