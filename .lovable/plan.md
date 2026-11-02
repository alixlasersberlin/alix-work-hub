# Meine Leads – Leadbearbeitung mit WhatsApp Sales

## Ziel und feste Zugriffsregeln

Ein neuer Arbeitsbereich **Vertrieb → Meine Leads** ergänzt ALIXWORK, ohne die bestehende Angebots-, Auftrags- oder WhatsApp-Verwaltung zu ersetzen.

- Mitarbeiter sehen und bearbeiten ausschließlich persönlich zugewiesene Leads – auch Vertriebsleitung und Geschäftsführung.
- Nur **Admin und Super Admin** dürfen fremde Leads sehen und neu zuweisen.
- Die bisherige Seite **Verkauf → Angebote → Anfragen** bleibt Admin/Super Admin vorbehalten.
- Originalanfragen bleiben erhalten; eine Zuweisung erzeugt keine zweite Leadakte.
- Keine neuen Tabellen, keine destruktiven Änderungen, keine Veröffentlichung ohne ausdrückliche Freigabe.

## 1. Persönliche Arbeitsoberfläche

- Durchsuchbare Leadliste mit Status-, Prioritäts-, Produkt- und Datumsfiltern; alle berechtigten Leads paginiert abrufbar.
- Kennzahlen: eigene Leads, neu/unbearbeitet, heute fällige Kontakte, überfällige Wiedervorlagen, offene Angebote, gewonnen/verloren und zugehöriger Auftragswert.
- Markierung nach 48 Stunden ohne Bearbeitung, anhand tatsächlicher Bearbeitungsaktivitäten statt bloßer Anzeige oder Zuweisung.
- Vollständige Leadseite: Kundendaten, Aktivitäten, Angebotsinformationen, verbundene Angebote/Aufträge, Dokumente und chronologische Historie.
- Am großen Bildschirm links Leadliste, mittig Leadakte und rechts WhatsApp/Nächste Aktion; auf kleinen Bildschirmen getrennte, gut erreichbare Ansichten.
- Klare Leer-, Lade-, Sperr- und Fehlerzustände, keine kleinen Popups als Ersatz für die Leadakte.

## 2. Kontaktbearbeitung und Wiedervorlagen

- Kontaktversuch mit Kontaktart, Ergebnis, Notiz, Interesse, nächstem Schritt und optionalem Folgetermin erfassen. Datum und Mitarbeiter werden serverseitig gesetzt.
- Statusfolge: Neu, Kontaktaufnahme läuft, Kunde erreicht, Beratung läuft, Angebot in Vorbereitung, Angebot versendet, Nachverhandlung, Auftrag erhalten, Gewonnen, Verloren.
- Neue Einträge dauerhaft anhängen; Korrekturen als neue nachvollziehbare Einträge statt unbemerktem Überschreiben.
- Bestehende Statuswerte erhalten und für die neue Ansicht kompatibel zuordnen; keine pauschale Umschreibung vorhandener Leads.
- Wiedervorlagen mit Datum, Uhrzeit, Anlass und Notiz; fällig/überfällig in der persönlichen Übersicht.

## 3. Angebote, Aufträge und Dokumente

- Bestehenden Angebotseditor mit Lead-/Kundendaten und Angebotsinformationen öffnen, keine parallele Angebotsverwaltung.
- Den vorhandenen Übergabemechanismus um dauerhafte, servergeprüfte Lead-Verknüpfung ergänzen: derzeit übernimmt der Editor Kundendaten/Notizen, nicht nachweisbar die Lead-ID.
- Angebote nur bei eindeutiger Verknüpfung dem Lead zuordnen; nicht alle Angebote eines Kunden automatisch einem Lead zurechnen.
- Zugehörige Aufträge anhand bestehender Angebotskonvertierung auflösen; Nummer, Betrag, Zahlung und Lieferung aus den Originaldatensätzen lesen.
- Die Leadanzeige aktuell halten; Angebot erst nach tatsächlichem Speichern als erstellt und erst nach bestätigtem Versand als versendet markieren.
- Bestehende Dokumentablage und autorisierten Download verwenden. Vor Upload die geeignete bestehende Datei-/Vorgangszuordnung prüfen; wenn nötig additive Felder oder geschützte Metadaten in bestehenden Strukturen, keine neue Tabelle.
- Keine pauschale Ausweitung der Kunden-, Angebots-, Auftrags- oder Dokumentrechte: zusätzliche Bearbeitung ausschließlich für den nachweisbar zugewiesenen Lead.

## 4. Bestehendes ALIXSMART WhatsApp Sales integrieren

**Bestandsaufnahme:** ALIXSMART betreibt bereits den Sales-Posteingang, Twilio-Versand, Eingangsnachrichten, Statusrückmeldungen und Vorlagen. Es ist ein anderes Supabase-Projekt. Die gefundene Übergabefunktion exportiert eine Sitzung, bietet aber keine bestätigte Schnittstelle zum laufenden Lesen und Senden aus ALIXWORK.

- ALIXSMART bleibt führend für Chats; ALIXWORKs eigene WhatsApp-Anbindung wird dafür nicht verwendet.
- Kontakt-/Konversations-ID ausdrücklich mit dem Lead verbinden. Telefonnummer nur zum kontrollierten Abgleich; bei mehreren Treffern Zuordnung durch berechtigten Nutzer, niemals automatisch den ersten Treffer verwenden.
- Einbettung über eine geschützte serverseitige Verbindung: Verlauf lesen/suchen, neue Nachrichten empfangen, senden, Dateien, ungelesene Nachrichten und Zustellstatus.
- Jede Anfrage prüft in ALIXWORK Nutzer, Leadzuweisung und Mandant; ALIXSMART prüft zusätzlich die erlaubte Konversation. Fremde Chats sind nicht durch Eingabe einer ID erreichbar.
- WhatsApp-Ereignisse mit eindeutiger Nachrichten-ID in der Leadzeitleiste anzeigen; wiederholte Ereignisse erzeugen keine Duplikate.
- Nur freigegebene Angebots-PDFs versenden. Kein Chattext gilt automatisch als rechtssichere Auftragsannahme.
- Außerhalb des 24-Stunden-Fensters ausschließlich freigegebene Vorlagen; Zeitfenster und Vorlagenfreigabe serverseitig prüfen, nicht nur im Chatfenster.
- Neue WhatsApp-Anfragen ohne Lead können dedupliziert als unzugewiesene Anfrage vorbereitet werden; nur Admin/Super Admin weisen sie zu. Nicht ohne eingerichtete und geprüfte Verbindung aktivieren.

**Voraussetzung:** Ein autorisierter Lese-/Versand-/Ereignisvertrag muss in ALIXSMART vorhanden oder dort ergänzt werden. Änderungen am anderen Projekt können hier nicht vorgenommen werden. Bei fehlender Schnittstelle bleibt der Chat klar als nicht verbunden gekennzeichnet; kein fingierter Verlauf und kein Versand über einen zweiten Anbieter.

## Technische Umsetzung

- Neue Routen `/vertrieb/meine-leads` und `/vertrieb/meine-leads/:id`, getrennt von den zentralen administrativen Anfragenrouten.
- Bestehende `sales_leads`, `sales_lead_history`, `sales_followups`, `offers` und Auftragsdaten nutzen; Bearbeitungsinformationen in versionierten bestehenden Metadaten bzw. additiven Feldern, Original-Importdaten unverändert.
- Die aktuelle restriktive Admin-Lesesperre gezielt um **eigene Zuweisung** erweitern; dazu passende positive Leserechte und abhängige Verlauf-/Aufgabenrechte ergänzen. Die administrative Route bleibt unabhängig davon gesperrt.
- Schreibaktionen erlauben nur definierte Bearbeitungsfelder; Mitarbeiter dürfen weder Zuweisung noch Mandant oder Originalanfrage manipulieren. Historienänderungen und verknüpfte Datensätze ebenfalls serverseitig absichern.
- Vor jeder Erweiterung aktive Nutzerfreigabe, endgültige RLS-Regeln, Trigger, RPC-Ausführungsrechte und vorhandene Seiteneffekte prüfen; Service-Zugriffe dürfen die Nutzerberechtigung nicht ersetzen.
- **93 von 93 bestehenden Leads haben derzeit keinen Mandanten.** Vor mandantenübergreifender Nutzung eindeutige vorhandene Herkunft/Zuordnung prüfen. Bei Mehrdeutigkeit keine automatische Mandantenzuweisung oder pauschale Freigabe; betroffene Leads für Mitarbeiter gesperrt lassen und Admin-Klärung anzeigen.
- ALIXSMART-Konversationszuordnung und externe Nachrichten-ID in vorhandenen geschützten Metadaten speichern; keine zweite Nachrichtendatenbank aufbauen. Echtzeitverbindungen stets mit sauberem Abmelden, begrenzte Nachladevorgänge statt permanenter Vollabfragen.

## Umsetzung und Abnahme

1. Endgültige Daten-, Mandanten- und Zugriffsregeln prüfen; sichere persönliche Lese-/Bearbeitungswege schaffen.
2. Leadübersicht, vollständige Bearbeitung, Historie und Wiedervorlagen umsetzen.
3. Bestehenden Angebotseditor und Konvertierung eindeutig verknüpfen; Dokumentzugriff ergänzen.
4. ALIXSMART-Vertrag abstimmen und bestehendes WhatsApp Sales anbinden, erst danach Nachrichten-/PDF-Versand aktivieren.
5. Tests mit zwei Mitarbeitern und getrennten Leads: fremde IDs verweigert, Neuzuweisung entzieht Zugriff, Originaldaten erhalten, keine Doppelakten, aktuelle Angebote/Aufträge, unveränderbare Historie, 48-Stunden-Markierung, Vorlagenpflicht und Ereignisdeduplizierung.
6. Angemeldete Ende-zu-Ende-Prüfung mit kontrollierten Testdaten, keine Testnachrichten an echte Kunden. Für dieses externe Supabase-Projekt ist derzeit keine automatisierte Mitarbeiteranmeldung verfügbar; diese Abnahme braucht einen verfügbaren geschützten Testzugang.
7. Ergebnisse und offene Voraussetzungen dokumentieren. Veröffentlichung nur nach gesonderter Freigabe.

Die Freigabe dieses Plans startet die schrittweise Umsetzung in ALIXWORK, nicht die Veröffentlichung oder einen echten Kundenversand.