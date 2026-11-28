# Ausgewählte Sicherheitsbefunde – Zwischenstand 28.11.2026

## Umfang

213 ausdrücklich ausgewählte Befunde aus `agent_security_v2`; der zugrunde liegende Tiefenscan ist **unvollständig**. Andere Scannerbefunde werden weder geändert noch ignoriert. Dies ist keine vollständige Sicherheitsabnahme.

## Sechs korrigierte Befunde

- `ac-whatsapp-send`: aktive, angenommene Mitarbeiterkonten ohne erforderlichen Passwortwechsel; bestehende Gesprächsrechte, ausdrückliche Mandantenzuordnung und Kanalmitgliedschaft vor dem Versand. Nachrichtenerstellung und private Dateifreigaben laufen mit dem angemeldeten Aufrufer statt mit privilegiertem Speicherzugriff. Antwortnachrichten und Duplikate sind auf dasselbe Gespräch begrenzt.
- `ac-send-message`: dieselben Konten-, Mandanten- und Mitgliedschaftsprüfungen; Kanalidentität wird aus dem autorisierten Gespräch übernommen. Nachrichtenerstellung unterliegt den Rechten des Aufrufers; externe Zustellstatus bleiben serverseitig.
- `ac-meeting-ai-notes`: gültige Anmeldung und aktives Konto vor Datenzugriff; Transkripte werden über die bestehenden Leserechte geladen. Nur Gastgeber oder bestehende Administratoren dürfen die Analyse veranlassen. Änderungen unterliegen den bestehenden Schreibrechten.

Die sechs zugehörigen ausgewählten Scannerbefunde wurden mit `manage_security_finding` als behoben gemeldet. Keine Befunde wurden ignoriert.

## Prüfung

- Fünf Server-Regeltests bestanden: Kontensperren, fehlende Mitgliedschaft, korrekte Kanal-/Benutzerbindung, Fehler bei Berechtigungsprüfungen und fehlende Mandantenzuordnung.
- Alle drei geänderten Einstiegspunkte mit Deno geprüft und bereitgestellt.
- Alle drei bereitgestellten Endpunkte verweigern explizit ungültige Anmeldetoken mit HTTP 401. Kein echter Kundenversand oder externe Meetinganalyse ausgelöst.
- 56 bestehende Frontend-Testdateien / 266 Tests bestanden.
- Positive angemeldete Ende-zu-Ende-Prüfung und echte Speicherzugriffsmatrix weiterhin nicht verfügbar: Das externe Supabase-Projekt stellt keine automatisierte Mitarbeitersitzung bereit.

## Noch offen: 207 ausgewählte Befunde

Die übrigen Befunde sind **nicht behoben** und bleiben aktiv. Nicht alle sind vollständig diagnostiziert. Insbesondere die Umstellung öffentlicher Aufrufe von Hintergrundjobs, Benachrichtigungen und Webhooks kann bisherige produktive Aufrufer unterbrechen; dafür müssen deren tatsächliche Aufruferverträge geprüft und gegebenenfalls gemeinsam umgestellt werden. Einschränkungen frei formulierbarer Nachrichten oder frei wählbarer Empfänger benötigen eine ausdrückliche Entscheidung, bevor erlaubte Arbeitsabläufe verändert werden.

Keine Schlüsselrotation, keine Änderungen an Produktdaten, Produkt-Hub-Betriebsmodi, Notstopp, bestehenden Datenbankrichtlinien oder Cron-Zeitplänen.

Eine erneute vollständige Sicherheitsprüfung bleibt erforderlich. Der Scanner ersetzt keine vertiefte manuelle Prüfung oder Penetrationstests.