# Sicherheitsbereinigung: Fortsetzung vom 28.11.2026, Auftrag 16:37 UTC

## Status und Abgrenzung

**Kein Sicherheitsabschlussbericht und keine Gesamtfreigabe.** Die SMS-Korrekturen wurden bereitgestellt und um Zugriffs-/Umgehungsregressionen ergänzt. Weitere klar belegte Datenbanklücken wurden korrigiert. Authentifizierter Echtversand und vollständige Rollenabnahme sind weiterhin technisch blockiert.

Die Grundgesamtheiten bleiben getrennt:

- Datenbank-Linter: **317 → 300 Hinweise**. Die verbleibenden 300 sind 283 angemeldet ausführbare Definer, 12 anonym ausführbare Definer, drei öffentliche Erweiterungen und zwei absichtlich ohne Client-Policy gesperrte Tabellen. Die Anzahl ist keine Anzahl bewiesener ausnutzbarer Lücken.
- Persistierte native Scanbasis: **234 aktive Meldungen**, davon 90 kritisch und 144 Warnungen. Die Basis ist unvollständig und nicht aktuell; sie ist keine neue vollständige Risikozahl.
- Historische ursprüngliche Restliste: **171 → 167 IDs**. Vier der in dieser Fortsetzung gezielt geschlossenen IDs gehören zu dieser historischen Restliste.
- Genau **14 native IDs** mit konkreter Quellen-/Zugriffs-/Testbegründung als behoben gemeldet; keine Meldung ignoriert. Liste: `closed-native-ids.txt`.

Alle 317 ursprünglichen Linterpositionen sind in `database-317-review.csv` nach Priorität eingeordnet. Die Priorität ist bei ungeprüften Positionen ausdrücklich heuristisch: Schreibmarker oder Definer-Ausführbarkeit allein beweisen weder eine Lücke noch einen Fehlalarm. 14 Ausführungsentzüge und drei Invoker-Korrekturen sind dort konkret belegt; 27 weitere Positionen haben eine manuelle Guard-Prüfung, aber keine vollständige authentifizierte Abnahme. Andere Rechte dürfen ohne diesen Nachweis nicht pauschal gesperrt oder als sicher erklärt werden.

## Korrekturblöcke

### Kritisch/hoch: interne Lösch-, Finanz- und Wartungsfunktionen

Direkte Client-Ausführung gesperrt für Dokument-/Auditbereinigung, Sitzungsbereinigung, Break-Glass-Ablauf, Garantie-/Wartungsaktualisierung, Forderungsmaterialisierung, Finanzfallhelfer, Gerätelebenszyklus, Administratorbenachrichtigungen, Gerätezustandsberechnung, After-Sales-Checklisten und den einzelnen Kalender-Synchronisationsworker.

Der indirekte `sys_health_autofix`-Weg zur Auditbereinigung wurde ebenfalls gesperrt. Der allgemeine `check_rate_limit` ist nur noch serverseitig aufrufbar und kann den reservierten SMS-Namensraum weiterhin nicht ändern.

Bestehende Security-Definer-Trigger und geschützte Service-Aufrufer bleiben ausführbar. Keine Bereinigungsfunktion wurde zu Testzwecken mit legitimen Geschäftsdatensätzen ausgeführt. Migrationen prüfen Rollenprivilegien und tatsächliche Abweisung unter der Datenbankrolle `authenticated`.

### Hoch: personenbezogene Abfragen und aktive Konten

- Mobile Suche und Übersicht arbeiten unter Invoker-Rechten statt als Datenbankeigentümer; vollständiger aktiver Kontostatus ersetzt den früheren alleinigen `is_active`-Check.
- Prognosen berücksichtigen vorhandene Datensatzrechte und zusätzlich ausdrücklich zugewiesene aktive Firmen. Der Prognosehorizont ist gegen Ressourcenmissbrauch auf 1–168 Stunden begrenzt; bestehender Standard 24 Stunden bleibt unverändert.
- `is_internal_staff`, `is_internal_or_supplier`, `esc_is_staff` und mobile Supervisor-Prüfung benötigen aktive Kontofreigabe, Rolle und Firmenzuordnung. Bestehende Portal-/Lieferanten-/Angebotsersteller-Ausschlüsse bleiben erhalten.
- Kalender-Sammelübernahme verlangt die vorhandene Planungsberechtigung und aktive Firmenzuordnung. Die einzelne Triggerfunktion bleibt intern.
- Gesprächseskalationen sind über eine restriktive Policy an bereits lesbare Gespräche gebunden; Löschung nur Super Admin.
- Manuelle Rollen-Ablaufprüfung verlangt aktiven Super Admin/Firmenzuordnung oder den bestehenden privaten Server-/Datenbankkontext; fehlende Rollenmerkmale werden ausdrücklich fail-closed geprüft. Cronzeiten und Aktivierungen bleiben unverändert.

Die SQL-Prüfung mit temporären JWT-Claims ist eine **synthetische Datenbank-Autorisierungsprüfung**, keine echte Anmeldung. Ein bestehender aktiver Super-Admin-Datensatz wurde ausschließlich lesend zur Kompatibilitätsprüfung verwendet; keine Rollen oder Konten wurden verändert.

### SMS: Konfiguration, Testzugang und Grenzen

- Acht betroffene Funktionen bereitgestellt: Kunden-/OP-Versand, Administratortest, After-Sales-Erinnerung, verpasste Anrufe, MFA, Anzahlungsmahnung und interne Alix-Sign-Benachrichtigung.
- Sieben Konfigurationsleser verwendeten die seit Juli entfernte Klartextspalte `sms_settings.auth_token`. Sie verwenden nun den festen **service-only** Leser des bereits vorhandenen Vault-Verweises. Kein neuer Schlüssel, keine Rotation, kein Client-Token und keine generische Entschlüsselungsschnittstelle.
- Unterschiedliche gespeicherte/Umgebungskonten dürfen nicht mit fremden Zugangstokens kombiniert werden; Konfigurationsfehler stoppen den Versand.
- Administratortests verlangen verifiziertes aktives Konto, exakt zugewiesene Admin-/Super-Adminrolle, Firmenzuordnung, gültige Nummer, begrenzten Text und gespeichertes Versandvorhaben. Sie teilen die bestehenden Kunden-/OP-Kontingente und dürfen weder eine andere Mitarbeiter-ID wählen noch unsichere Sendungen automatisch wiederholen.
- Standardgrenzen unverändert: **20/Minute und 100/Stunde pro Mitarbeiter; 3/Stunde und 10/24 Stunden pro normalisierter Empfängernummer**. Prüfung vor Anbieterkontakt; Vorschauen frei; keine Rückerstattung bei unklarem Ergebnis.
- MFA und manuelle Anzahlungsmahnung verwenden jetzt die bestehenden vollständigen aktiven Konto-/Firmenprüfungen. Anzahlungsmahnung liest Auftrag, Kunde und Bankdaten mit dem Caller statt mit globalen Service-Rechten. Bestehende Rollenlisten und Vorlagen bleiben erhalten.
- MFA behält die vorhandenen eigenen Grenzen (ein Code/60 Sekunden, sechs/Stunde), stoppt bei fehlender Limitabfrage und generiert Codes kryptographisch. Die vollständige Konkurrenz-/Einrichtungs-/Loginabnahme dieser eigenen MFA-Grenzen bleibt offen; sie wurde nicht mit den Kunden-/OP-Standardlimits verwechselt.

## Verifikation

- **607 Deno-Sicherheits-/Regressionstests bestanden**, mit Typprüfung, ohne `--no-check`.
- **279 Anwendungstests in 59 Testdateien bestanden**.
- Acht bereitgestellte SMS-Einstiegspunkte separat mit `deno check` geprüft; drei zunächst gefundene Typfehler behoben und erneut geprüft.
- Beide Kunden-/OP-Handler: 14 zusätzliche isolierte Zugriffs-/Firmen-/Elternobjekt-/Empfänger-/Kontingent-/Protokollregressionen; erfolgreiche Providerantworten ausschließlich simuliert.
- Administratortest: elf zusätzliche isolierte Prüfungen für Konto/Rolle/Firma, ungültige Nummer, Textlänge, gemeinsames Kontingent, Protokollfehler und unklaren Anbieterstatus.
- Vier Konfigurations- und zwei kryptographische Code-Tests ergänzt.
- Alle vier SMS-Standardgrenzen in der echten Datenbank mit synthetischen Reservierungen geprüft; Subtransaktion vollständig zurückgenommen. Kein Versand, keine persistenten Testkontingente und keine Geschäftsdatenänderung.
- Echte öffentliche Gegenproben: sechs geschützte Datenbankzugänge und 14 SMS-Funktionszugänge mit HTTP 401 abgewiesen. Zwei absichtlich clientgesperrte Tabellen liefern anonym leere Arrays. Einzelresultate in `live-denials.json`.
- Build-Protokoll nach Änderungen: `build OK`.

`test-summary.txt` enthält die Zusammenfassungen und Hashes der tatsächlichen Testprotokolle. Keine Simulation ist als erfolgreiche echte SMS-Zustellung oder Anmeldung ausgewiesen.

## Verifizierte absichtliche Sperren und offene Konfiguration

`mfa_sms_codes` und `social_credentials` haben RLS und keine Client-Policies. Das bedeutet nicht offene Daten, sondern keinen erlaubten Clientzugriff; die reale anonyme Abfrage blieb leer. Es wurden weder neue Clientrechte noch Policies zum Freigeben dieser Tabellen hinzugefügt. Die beiden Linterhinweise bleiben sichtbar, keine Scanner-Ignorierung.

Die drei öffentlichen Extensions wurden nicht blind verschoben: gespeicherte Typen, Operatoren, unqualifizierte Funktionsnamen und abhängige Abfragen müssen vorher geprüft werden. Die zwölf anonymen Definer wurden mit ihren öffentlichen Capability-/Policy-Verwendungen abgeglichen; keine pauschale Ausführungssperre, da dies bestehende Schutzpolicies und Tokenverträge beschädigen könnte. Die verbliebenen 283 angemeldeten Definer benötigen individuelle Funktions-/Privatschema-/Rollen-/Firmenprüfungen. Die Metadatenprüfung allein ist keine Abnahme.

Konkrete nächste Risikogruppen: Nummernvergabe mit workflowbezogener Rechtezuordnung, verbleibende Finanz-/GoBD-Schreibfunktionen, Rollen-/Reauth-Kontexte, Firmen-/Objektbindung in Analytics und geschützte Elternobjekte. Die dazu erforderliche vollständige authentifizierte Rollentestmatrix ist nicht verfügbar; unklare Geschäftsrechte werden deshalb nicht durch neue, erfundene Rollenlisten ersetzt.

## Technische Blockaden und Tiefenprüfung

1. `lovable auth-session --json --self` verweigert technisch die Sitzung, weil das externe Supabase nicht von Lovable verwaltet wird. Auch die vorhandene rein lesende Konfigurationsabfrage über das Edge-Werkzeug erhält HTTP 401 ohne übernehmbare Preview-Sitzung. Keine Zugangsdaten angefordert und kein Konto-/Tokenersatz hergestellt.
2. Zweimal wurde als Testempfänger **ALIXLASERS** genannt. Das ist eine Absenderkennung, keine konkrete Empfängernummer. Keine Kundennummer, feste interne Benachrichtigungsnummer oder frei erfundene Nummer wurde als Zustimmung interpretiert. **Keine echte Test-SMS gesendet.**
3. Die vollständige echte Rollen-, Benutzer-, Mandanten-, MFA- und Versandabnahme bleibt mangels Testsitzung/Empfängerfreigabe offen. Isolierte Tests ersetzen sie nicht.
4. Der aktuelle gespeicherte Quellstand muss mit der neuen Tiefenprüfung eindeutig über den zurückgelieferten Commitbezug abgeglichen werden. Der bisherige Scannerzustand ist `incomplete`, Version 1.94, `up_to_date=false`; er ist kein aktueller Abschlussbeleg. Ein abweichender/vorangehender Scancommit darf nicht als Prüfung dieser Korrekturen bezeichnet werden. Keine Fehlermeldung wurde künstlich versteckt und keine Scannerwarnung pauschal ignoriert.
5. Die separate Wiederherstellungs-/43-Rollenabnahme aus dem Gesamtauftrag bleibt offen; diese Fortsetzung erzeugt kein isoliertes Restore-Projekt und behauptet keinen Restore-Erfolg.

Der begrenzte Schnellscan führte keine neuen aktiven Datenbankbefunde auf; die Connectorprüfung war mangels Konfiguration ausgelassen. Dies ersetzt weder die 300 Linterhinweise noch die vollständige Tiefenprüfung.

## Unveränderte Schutzinvarianten

- 44 Produkte; vorher/nachher gleicher Fingerprint `e631fcb224679573e47c42088240233e`.
- 102 Zeitpläne, 95 aktiv; vorher/nachher gleicher Schedule-Fingerprint `a7ea06835cd510abcc459a54545a9f96`.
- Product Hub: `enabled=false`, `emergency_stopped=true`, Revision 0, DE und COM `blocked`, jeweils kein Pilotgerät.
- Keine Änderung von Geschäftsbeträgen, Produktdatensätzen, Konten, Rollen, Schlüsseln oder Zeitplänen; keine Abschaltung der Protokollierung, kein Webseitenbefehl und kein Kundenversand zu Testzwecken.
- Keine App-Veröffentlichung oder Product-Hub-Freigabe veranlasst.