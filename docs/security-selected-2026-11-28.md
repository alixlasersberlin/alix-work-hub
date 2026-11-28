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

## Fortsetzung nach Freigabe: 19 weitere korrigierte Befunde

Die am 28.11. erteilte Zustimmung zur Umstellung automatischer Aufrufer und Webhooks wurde umgesetzt. Insgesamt sind jetzt **25 von 213 ausgewählten Befunden** korrigiert; **188 bleiben offen**. Es wurde kein Befund ignoriert.

### Automatische und interne Aufrufe

- `scheduled-customer-sync`, `scheduled-order-sync`, `rz-reminder-build`, `portal-contract-reminders`, `survey-auto-reminders`, `survey-automation`, `system-health-scan`, `sig-webhook-dispatch` und `alixsmart-emit` nutzen die gemeinsame Prüfung `job-auth`.
- Öffentliche Projektschlüssel, bloß dekodierte Rollenbehauptungen und beliebige `x-cron-secret`-Header gewähren keinen Zugriff mehr. Verifiziert werden ausschließlich die bereits vorhandenen privaten Maschinenzugänge oder, wo bisher manuelle Bedienung vorgesehen ist, gültige Mitarbeiteridentität, aktive/angenommene Konten und zugewiesene Fachrollen. Der Systemprüfungsweg verlangt die exakte zugewiesene Rolle Super Admin, unabhängig vom gelieferten Auslöser.
- Bestehende Datenbankzeitpläne für diese Funktionen wurden auf den bereits für erfolgreiche Sicherungen verwendeten Vault-Eintrag `CRON_SECRET` umgestellt. Zeitpunkte, Aktivzustände und Nutzdaten blieben unverändert. Keine Schlüssel erzeugt oder rotiert, keine neuen Tabellen.
- Die Signaturdispatch-Kette aus `sig-submit` und die bestehenden serverinternen Zoho-Aufrufe verwenden bereits private Maschinenzugänge und bleiben kompatibel. Frei formulierte Versandtexte wurden nicht eingeschränkt.

### Provider-Eingänge

- `ac-webhook-twilio` und `whatsapp-webhook` prüfen vor Datenzugriff die Twilio-Providersignatur mit dem offiziellen Validator, dem vorhandenen `TWILIO_AUTH_TOKEN` und der festen öffentlichen Supabase-Endpunktadresse einschließlich Querystring. Caller-Host und Forwarded-Header werden nicht als Signaturbasis akzeptiert. JSON-Einspeisung ohne den Twilio-Formularvertrag wird abgewiesen.
- `inbound-mail` prüft Standard-Webhooks-Signaturen über den unveränderten Rohtext mit dem vorhandenen `RESEND_WEBHOOK_SECRET`, einschließlich Zeitfenster. Eine erkannte Ticketnummer allein erlaubt keine Antwort mehr: Der normalisierte Absender muss mit `tickets.customer_email` übereinstimmen. Ohne bestätigte Übereinstimmung entsteht höchstens ein eigenes neues Ticket, kein Schreibzugriff auf das fremde Ticket.
- Nicht als live abgenommen behauptet: tatsächliche Provider-Neuzustellung und Zuordnung des bei Resend für diesen Eingang konfigurierten Signaturschlüssels; zusätzliche/anders konfigurierte Weiterleitungseingänge benötigen einen passenden signierten Providervertrag. Keine echten Kundennachrichten als Test verschickt.

### Verifikation

- Acht neue Servertests bestanden: öffentliche/gefälschte Schlüssel, fehlende/falsche Geheimnisse, bestehende private Zugänge, verifizierte aktive Mitarbeiter und zugewiesene Rollen, Schreibzugriffssperre vor Datenabruf, Twilio-Rohdaten/Host-Manipulation, signierte unveränderte/frische Mail und Ticketabsenderbindung.
- Alle zwölf geänderten Funktionen mit Deno geprüft und tatsächlich bereitgestellt. Alle zwölf Live-Endpunkte lehnen den öffentlichen Projektschlüssel plus falschen Cron-Header mit HTTP 401 ab.
- **Positiver Live-Nachweis des vorhandenen Maschinenzugangs:** einmaliger Datenbankaufruf gegen die bereitgestellte `survey-automation` mit `dry_run=true` und nachweislich nicht existierender Regel; Antwort HTTP 200, `created=0`, `skipped=0`, `details={}`. Keine Umfrageregel, Kundenakte oder Mail verändert. Der Test setzt keinen zusätzlichen Zeitplan auf.
- Fünf aktive betroffene Zeitpläne erneut gelesen: Vertragsreminder stündlich Minute 25, Umfrageerinnerungen 08:15, Umfrageautomatisierung 07:45, Systemprüfung 03:00, RZ-Erinnerungserstellung 06:20; Zeiten und Aktivzustände unverändert, strukturierte neue Header vorhanden.
- Acht vorhandene Product-Hub-Abnahme-/Release-Regeltests bestanden; Anwendungsprüfung `build OK`. Keine Produktivfreigabe oder Geräteänderung.
- Angemeldete manuelle Bedienung und echte Provider-Neuzustellung weiterhin nicht Ende-zu-Ende verifiziert. Der positive Live-Test belegt den automatischen Maschinenweg, nicht sämtliche Mitarbeiter- oder Providerfälle.

Die 19 zusätzlich erledigten Befunde werden in `docs/security-selected-open-2026-11-28.csv` nicht mehr als offen geführt und wurden ausschließlich über `manage_security_finding` als behoben gemeldet.

## Noch offen: 188 ausgewählte Befunde

Die übrigen Befunde sind **nicht behoben** und bleiben aktiv; die Umstellungsfreigabe liegt inzwischen vor. Es gibt weitere noch nicht vollständig diagnostizierte automatische Abläufe und datensatzbezogene Zugriffslücken. Die vollständige verbleibende Auswahl ist mit Kennungen in `docs/security-selected-open-2026-11-28.csv` festgehalten. Insbesondere für `ac-3cx-webhook` fehlt das bisher vorgesehene `PBX_3CX_WEBHOOK_SECRET`, für `ac-webhook-meta` fehlen bestätigte Meta-App-Signatur-/Verifikationseinstellungen; es wurden keine Ersatzschlüssel erfunden und diese Befunde nicht geschlossen. Einschränkungen frei formulierbarer Nachrichten oder frei wählbarer Empfänger sind nicht durch pauschale Entfernung bestehender Funktionen umgesetzt.

Keine Schlüsselrotation, keine Änderungen an Produktdaten, Produkt-Hub-Betriebsmodi, Notstopp oder bestehenden Datenbankrichtlinien; ausschließlich die oben beschriebenen Zeitplan-Header wurden abgesichert, nicht ihre Zeiten oder Aktivzustände. Die 493 älteren Datenbankhinweise außerhalb dieser Auswahl bleiben unverändert.

Eine erneute vollständige Sicherheitsprüfung bleibt erforderlich. Der Scanner ersetzt keine vertiefte manuelle Prüfung oder Penetrationstests.