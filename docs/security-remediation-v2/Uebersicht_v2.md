# ALIXWORK – SECURITY REMEDIATION v2.0

Ausschließlich Zuordnung und konkrete Korrekturpläne, 28.11.2026.

## Paketbilanz

| Paket | Gesamt | Kritisch bestätigt | Ungeklärt | Fehlkonfiguration | Dubletten | Im Code geschützt |
|---|---:|---:|---:|---:|---:|---:|
| A1 | 5 | 4 | 0 | 0 | 1 | 0 |
| A2 | 7 | 3 | 4 | 0 | 0 | 0 |
| A3 | 69 | 45 | 20 | 1 | 3 | 0 |
| A4 | 30 | 19 | 10 | 0 | 1 | 0 |
| A5 | 3 | 2 | 1 | 0 | 0 | 0 |
| A6 | 17 | 12 | 5 | 0 | 0 | 0 |
| A7 | 134 | 102 | 24 | 3 | 4 | 1 |
| A8 | 1 | 0 | 1 | 0 | 0 | 0 |
| **Summe** | **266** | **187** | **65** | **4** | **9** | **1** |

A0 priorisiert 22 dieser IDs; kein Addieren zu 266. 178 Korrekturgruppen, neun bekannte Doppelmeldungen mit unverlorener Haupt-/Neben-ID. Paketzuordnung bezeichnet die Geschäftsdomäne, nicht jede gemeinsame Authschwäche. A1/A2/A5/A8 sind Querschnittsabhängigkeiten der anderen Pakete.

## Verbindliche Ausführungsgrenzen

Dies ist ausschließlich ein Korrekturplan, keine Korrekturfreigabe und keine Ausführung. Die Klassifikationen stammen aus der statischen 266-ID-Prüfung; sie beweisen keine erfolgreiche Live-Ausnutzung. Ungeklärte Befunde bleiben ungeklärt. Die Teilpakete werden anhand der Geschäftsdomäne zugeordnet; eine gemeinsame Auth-Ursache wandert dadurch nicht pauschal aus Finanz- oder Dokumentpfaden heraus. A0 ist eine priorisierte Überlagerung, kein neuntes disjunktes Paket.

44 Produkte und 102 Zeitpläne bleiben unverändert. DE/COM bleiben blocked, emergency_stopped=true, enabled=false, revision=0. API-Verträge 1.2/1.3 unverändert; keine Schlüsselrotation, Finanzoperation, Geschäftsdatensatzlöschung, Testnachricht, Migration, Bereitstellung oder Veröffentlichung. Scannerbefunde werden weder geschlossen noch ignoriert.

## Vor jeder einzeln freizugebenden Änderung

1. Freigabe bindet konkrete IDs, Funktionen, Diff, Ausgangsrevision und Testergebnisse; nur exakter aktiver, angenommener Super Admin, keine vererbte Adminberechtigung. Nicht durch diese Unterlagen erteilt.
2. Wiederherstellbaren Codecommit und unabhängige geschützte Sicherung des freigegebenen Quellzustands sichern. Aktueller Referenzcommit: `ada1682bfd32bbdf823ad29efcf1de8e95648f7e`. Das ist ein Wiederherstellungspunkt, kein hier neu erstelltes Vollbackup.
3. Aktuelle Tabellen-, Funktions-, Policy-, Trigger-, Grant- und Schedulerdefinitionen der tatsächlich betroffenen Objekte geschützt exportieren, Prüfsummen und Restore-Möglichkeit nachweisen. Bestehende Backups nicht überschreiben, keine neuen Tabellen. Vollständige Definitionsexporte und isolierter Restore sind hier noch nicht durchgeführt.
4. Aufrufermatrix: UI, abhängige Funktionen, Trigger/RPCs, Cron, Provider; vorhandene private Maschinenidentitäten erhalten. Kein blindes verify_jwt=true als Ersatz für Objekt-/Aktivitäts-/Rollenprüfungen, keine Sperre legitimer signierter Webhooks.
5. Isolierte Testdaten: zwei aktive zugewiesene Mitarbeiter (einer mit DE+AT), ein Mitarbeiter mit nur DE, ein Konto ohne Zuweisung, inaktives/nicht angenommenes Konto und gesperrtes Gerät; eigene/fremde DE/AT-Objekte. Diese Fixtures sind geplant, nicht erzeugt oder als erfolgreich getestet dargestellt. Provider/Finanzadapter vollständig mocken.
6. Erst isolierte Tests, dann konkreten Diff und Betriebsfolgen erneut zur ID-bezogenen Freigabe vorlegen. Keine unsicheren Rechte als Rollback wiederherstellen.

## Abnahme nach einer späteren Korrektur

Positive erlaubte Fälle und negative fremde/inaktive/unzugewiesene Fälle; Zuweisung zu mehreren Gesellschaften bleibt nutzbar, fehlende Zuweisung verleiht keine globale Sicht. Serverseitige Rollen-/Tenantprüfungen möglichst einmal pro Statement auswerten, keine teuren per-row-Prüfschleifen. Öffentliche Kundencapabilities bleiben eng objektgebunden, keine Mitarbeiterrechte daraus ableiten. Bestehende Regeln und Geschäftsvorgänge unverändert.

Bereitgestellte Revision/Hash nachweisen, ungefährliche autorisierte Lesewege und Ablehnungen prüfen. Reale Versand-/Finanzwirkungen nur nach separater Freigabe, nicht im Test. Scanner gezielt erneut ausführen und nur konkret bestätigte Reparaturen im bestehenden Security Control Center mit Revision, Nachweis und Freigabe dokumentieren; eine Freigabe schließt keinen Befund. Bei Regression betroffenen Pfad eng sperren oder auf nachweislich sichere Version zurücksetzen, nie ungeschützte Altversion aktivieren.

## Ergebnisse der Protokollprüfung

Siehe `Protokollpruefung.md`: Lesende Stichproben von Server-, Auth-, Datenbank-, Anwendungs- und Providerlogs; unveränderte Metadatenantworten sowie verschlüsselte erste Providerseiten privat gesichert, SHA-256 und Entschlüsselungsgleichheit verifiziert. Keine Roh-Payloads, Kennwörter, OTPs, Empfängeradressen oder Schlüssel in öffentlichen Berichten. Das ist keine vollständige Original-Log-/Forensiksicherung.

Missbrauch weder bestätigt noch ausgeschlossen. Serverlogs decken nur ca. zehn Minuten ab; Providerlisten nur jeweils erste 20 Nachrichten mit weiterer Seite. Der bestehende Finanzautomations-Aufruf POST/200 ist ein Reachabilitynachweis, keine Täter- oder Berechtigungszuordnung. Keine tatsächliche Schlüsselkompromittierung nachgewiesen. Vollständige historische Logs und geschützte Originalexporte durch den zuständigen Administrator sowie isolierte Testumgebung sind noch erforderlich.

## Freigabefolge

A0 separat entscheiden; A1/A2/A5-Querschnittsregeln vor beziehungsweise zusammen mit den abhängigen Fachpfaden abnehmen. A3/A4/A6/A7/A8 einzeln anhand ID, Diff und Testergebnis freigeben. Vererbte Rollenprüfung nicht durch pauschales Entziehen legitimer Konzernrollen ersetzen. Der ausgewählte 266-ID-Snapshot deckt nicht alle späteren Scanner-/Datenbankbefunde ab; neue Befunde nicht stillschweigend in diesen Auftrag aufnehmen.

Diese Unterlagen ändern das bestehende Security Control Center nicht und erstellen dort keine fingierte Freigabe oder erfolgreiche Prüfung. Nach späterer tatsächlicher Korrektur ist die bestehende geschützte Dokumentation mit Nachweis und Revision zu aktualisieren.
