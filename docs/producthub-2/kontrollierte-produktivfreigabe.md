# Kontrollierte Produktivfreigabe – 27.11.2026

## Zustand

Die gespeicherten vollständigen Verbindungstests vom 27.11.2026 um 19:03 UTC bestätigen DE und COM: GET 405, unsigniert 401, signiert 202, passende signierte Testrückmeldung. Dies ist kein Produkt-, Bild-, Cache- oder Darstellungsnachweis.

`ph2_activation` bleibt deaktiviert. Beide Modi sind `blocked`, der Notstopp ist gesetzt. Die bestehenden Nachweise `backup_verified`, `restore_verified`, `communication_verified` bleiben unverändert false. Es wurden keine produktiven Signale, Produktänderungen, Preisänderungen oder Schlüsseländerungen ausgelöst.

## Empfängerprüfung vor Implementierung

Gelesener Stand: Alix Lasers Global, Commit 569036bb, `src/lib/product-hub-notify.server.ts`, `product-hub-notify.ts`. Der Host-Router kennt COM und DE; Detailpfad DE `/produkte/{slug}`, COM `/devices/{slug}`. Die getrennte DE-Projektzuordnung ließ sich nicht abschließend verifizieren; deshalb muss der DE-Prompt im tatsächlich auf alix-lasers.de veröffentlichten Projekt angewendet werden.

Vorhanden: Signaturen, Kanalprüfung, Ereignis-Deduplizierung, monotone Versionen, Inhalteabruf, signierte Rückmeldung sowie ein gemeinsamer Cache-Marker für einzelne Geräte. Nicht vorhanden: explizite Einzelgeräte-Pilot-Allowlist im Empfänger. `PH_RECEIVER_MODE=live` ist nur ein allgemeiner Empfängermodus, kein Pilotnachweis. Cache-Invalidierungsfehler werden im gelesenen Code unterdrückt; eine positive Rückmeldung kann deshalb nicht die Aktualisierung aller Serverinstanzen beweisen.

Separate Empfänger-Prompts: `PRODUCT_HUB_2_Pilot_COM.md` und `PRODUCT_HUB_2_Pilot_DE.md`. Keine Erweiterung des Signal-/Rückmeldungsvertrags, keine Schlüsseländerung.

## Bedienung in AlixWork

PRODUCT HUB → Webseiten → Kontrollierte Produktivfreigabe:

1. Empfänger-Prompt im passenden Webseitenprojekt umsetzen und veröffentlichen. Prüfung der Einzelgeräte-Sperre und aller Instanzen als konkreten Nachweis erfassen, Prüfschritt „Empfänger unterstützt Einzelgeräte-Pilot“. Dieser Eintrag ist eine ausdrücklich manuelle technische Attestierung, keine automatisch festgestellte Fähigkeit.
2. Vollsicherung und Wiederherstellungstest nachweisen. Die bisherigen Freigaben werden weder automatisch gesetzt noch durch den Verbindungstest ersetzt. Die vorhandene übergeordnete Umgebungsfreigabe bleibt zusätzlich erforderlich und wurde nicht verändert.
3. Super Admin wählt je Webseite „Pilotbetrieb“ und genau ein vorhandenes Gerät. Bestätigung exakt `FREIGABE DE PILOT` bzw. `FREIGABE COM PILOT`. Ohne alle bisherigen Voraussetzungen weist der Server die Freigabe zurück. Dieser Auftrag aktiviert nichts.
4. Änderungen am gewählten Gerät erfolgen später über den vorhandenen Editor. Nur neue Änderungen nach der ausdrücklichen Freigabe gelangen in die bestehende signierte Warteschlange. Andere Geräte bleiben ausgeschlossen; alte Schattenereignisse werden niemals nachgesendet. Preise werden nicht durch die Signale übertragen.
5. Gerätedaten, Bilder, technische Daten, OFFLINE, ONLINE, Cache aller Instanzen und echte Darstellung prüfen. Konkrete URL, Zeitpunkt, beobachtete Inhalte bzw. Servernachweise erfassen und eine passende bestätigte Übertragung auswählen. Erfolgreiche Produktprüfungen benötigen eine geräte-, kanal- und versionsgleiche signierte Empfangsbestätigung. Eine Empfangsbestätigung allein beweist die inhaltliche und visuelle Richtigkeit nicht.
6. Erst nach vollständigen Pilotnachweisen kann ein Super Admin Vollbetrieb separat mit `FREIGABE DE FULL` / `FREIGABE COM FULL` bestätigen. Keine automatische Erweiterung auf weitere Geräte, auch nicht durch vollständige technische Abnahme.

## Notstopp

„Produktivbetrieb sofort stoppen“ ist ein eigener, unmittelbar ausgeführter Super-Admin-Befehl. Er sperrt beide Webseiten und hebt weitere Warteschlangenübernahmen auf. Schon versendete Anfragen lassen sich nicht zurückrufen. Deren signierte Rückmeldungen bleiben protokollierbar; der Stopp ist keine behauptete Offline-Schaltung. Ein späterer Neustart holt alte Vorgänge nicht nach.

Alte DE-/COM-Direkt-, Übersetzungs- und Registry-Sender bleiben vorhanden, ihre Übertragungen sind bei kontrollierter Freigabe gesperrt, damit weder Pilotgrenze noch Notstopp umgangen werden. Unabhängige nur-lesende Kartenprüfungen und die anderen Webseiten bleiben bestehen.

## Umsetzung und Protokoll

Keine neuen Tabellen. Bestehende `ph_settings` / `ph_sync_log`. Geschützte öffentliche Invoker-Fassaden: `ph2_set_operating_mode`, `ph2_stop_production`, `ph2_record_pilot_check`; private Implementierungen prüfen den exakten aktiven Super Admin (keine Rollenvererbung).

Capture, Claim, Prepare und letzter Check vor dem externen Versand erzwingen den Kanal-/Gerätebereich. Betriebsrevisionen verhindern Wiederaufnahme alter Ereignisse nach Moduswechsel oder Notstopp. Die bestehende Event-ID, Version, HMAC-Prüfung und Callback-Verarbeitung bleiben unverändert.

Das paginierte Übertragungsprotokoll zeigt Gerät, Webseite, Zeitpunkt, geänderte Quellbereiche, Sollzustand, Version, Versandversuche, signierte Antwort und Fehler. Prüfnachweise sind davon getrennte, geschützte manuelle Belege. Aufzeichnungen über alle Serverinstanzen sind ohne entsprechenden externen Nachweis ausdrücklich ausstehend.

## Verbleibende Abnahme

Kein produktiver Test wurde gestartet. Liveprüfung wartet auf Empfängeranpassungen, Vollbackup, Wiederherstellung und ausdrückliche manuelle Super-Admin-Freigabe. Die angemeldete echte Webseitenansicht ist automatisiert nicht erreichbar, weil Lovable keine Sitzung für die externe Anmeldung ausstellen kann; isolierte Oberflächenprüfung ersetzt diese nicht.

## Prüfungen dieser Umsetzung

61 gemeinsame Deno-Tests (darunter acht neue Betriebsmodus-/Revisionsprüfungen), 48 bestehende Sender-/Kartenprüfungen und acht Frontend-Regressionsprüfungen bestanden. Zehn serverseitige Freigabeprüfungen liefen mit vollständig zurückgenommenen Teständerungen; Test liegt unter `supabase/tests/ph2-operating-modes.sql`. Isolierte Browserprüfung bestätigt DE/COM-Modusbuttons, Einzelgeräte-Auswahl, erforderliche Sicherheitsbestätigung und fehlende Schreibbuttons bei Nur-Lese-Zugriff. Echte Route zeigt die Anmeldung; der angemeldete Produktionsablauf bleibt offen. Letzter Datencheck: 44 Produkte, 0 produktive Ereignisse, keine Modusänderungen oder Prüfnachweise angelegt, Revision 0, DE/COM blocked. 493 bestehende Sicherheitsbefunde unverändert; die Migrationen haben keine neuen Befunde hinzugefügt.
