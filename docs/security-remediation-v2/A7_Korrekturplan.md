# A7 – Kommunikation, Portal, KI und Personen

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 134; bestätigt kritisch 102; ungeklärt 24; Fehlkonfigurationen 3; Doppelmeldungen 4; im Code geschützt 1.

Abhängigkeiten: A1, A2, A5, A8.

Kunden-/Mitarbeiterdaten nur nach aktiver Identität und konkreter Kanal-, Objekt- und Mandantenzuweisung. ALIXSMART bleibt einzige Lead-WhatsApp-Quelle. E-Mail/SMS/Telefonie vollständig mocken; unklaren Versand nicht automatisch wiederholen. Ungeprüfte HTML-Quellen-Snippets sicher rendern, nicht nur KI-Antworttexte. Freie Empfänger nur im tatsächlich berechtigten Versandpfad.

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

## Paketbezogene Betriebsfolgen

Strengere Rechte können bisher implizit globale Benutzer, Jobs und interne Aufrufer blockieren. Berechtigte Mehrgesellschaftszugriffe explizit erhalten; fehlende Mandantenzuweisung ist kein globales Recht.

## Konkrete Befund- und Korrekturpläne

### lov_finding_006a75d168f7259a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-email-autolink`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-email-autolink`.
- Belege: supabase/functions/ac-email-autolink/index.ts:4-29; src/pages/AlixConnect/EmailSync.tsx:29.
- Ursache/Prüfgrenze: Nach OPTIONS folgt unmittelbar ein Service-Role-Scan unverknüpfter Mails. Kontakt- und Auftragszuordnung sowie Updates erfolgen ohne Identitäts-, Aktivitäts-, Rollen- oder Mandantenprüfung. Der UI-Aufrufer ersetzt keine Serverautorisierung.
- Geplante konkrete Änderung: Aktives internes Konto mit Mailverwaltungsrecht oder explizites Maschinencredential verlangen; Mails und Zielobjekte gemeinsam mandantenbezogen begrenzen.
- Betriebsfolgen: Falsche Mailzuordnungen; Mandantenübergreifende Verarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, deaktiviert und fremder Mandant abweisen; berechtigte Zuordnung positiv prüfen..
- Sicherer Wiederherstellungsplan: Bei Regression Endpoint sperren; Änderungen anhand gesicherter Vorwerte zurücksetzen.
- Doppelmeldungsreferenz: keine.

### lov_finding_01c314f2b58b194b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.offers-ai-autoscore`; Abhängigkeiten A1, A2, A5.
- Funktionen: `offers-ai-autoscore`, `scoreBatch`.
- Belege: supabase/functions/offers-ai-autoscore/index.ts:28-58; supabase/functions/offers-ai-autoscore/index.ts:64-87.
- Ursache/Prüfgrenze: Der Handler selektiert offene Angebote privilegiert ohne Aufruferprüfung, sendet sie an KI und aktualisiert Scores anhand zurückgelieferter IDs. Ein Cron-Kommentar ist keine Zugangskontrolle.
- Geplante konkrete Änderung: Maschinenauthentifizierung oder aktive autorisierte Vertriebsrolle vor Selektion; Mandantenscope und zurückgelieferte Angebots-IDs gegen den selektierten Batch prüfen.
- Betriebsfolgen: Manipulierte Vertriebsbewertung; KI-Kosten; Verarbeitung privater Angebotsdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: unberechtigte Requests ohne KI-Aufruf; fremde Batch-ID ohne Update; berechtigter Job erfolgreich..
- Sicherer Wiederherstellungsplan: Scoringjob deaktivieren und frühere Scores wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_08c1beda03a5ef65

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-router-simulate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-router-simulate`.
- Belege: supabase/functions/ac-router-simulate/index.ts:21-42; supabase/functions/ac-router-simulate/index.ts:54-70; supabase/functions/ac-router-simulate/index.ts:92-103.
- Ursache/Prüfgrenze: getUser wird aufgerufen, aber das Ergebnis sperrt die privilegierte Simulation nicht. Kundenscore, Routingregeln, Agentenskills und Auslastung werden unabhängig von einer autorisierten Identität verarbeitet und als Simulationsergebnis ausgegeben.
- Geplante konkrete Änderung: Identität verbindlich validieren; aktives Routing-Administrationsrecht und Mandantenscope für Kunde, Regeln und Agenten verlangen.
- Betriebsfolgen: Offenlegung interner Routinginformationen; Auswertung fremder Kundenscores.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fehlende Identität, falsche Rolle und fremder Kunde abweisen; erlaubten Simulatorpfad prüfen..
- Sicherer Wiederherstellungsplan: Simulator sperren, nicht auf ungeprüften Zugriff zurückfallen.
- Doppelmeldungsreferenz: keine.

### lov_finding_108fb37fdfeda925

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-customer-intel`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-customer-intel`.
- Belege: supabase/functions/ac-customer-intel/index.ts:10-32; supabase/functions/ac-customer-intel/index.ts:46-65; supabase/config.toml:331-332.
- Ursache/Prüfgrenze: Beliebige contact_id führt ohne Authentifizierung zu Service-Role-Lesezugriffen auf Kontakt, Nachrichten und Anrufe. Die Daten werden an die KI weitergegeben und Vorhersagen gespeichert; verify_jwt ist explizit false.
- Geplante konkrete Änderung: Aktive berechtigte Mitarbeiteridentität und kontaktbezogene Mandantenfreigabe vor allen Reads und KI-Aufrufen erzwingen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kundenkommunikation; KI-Kosten; Unberechtigte Vorhersagen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremde Kontakt-ID und deaktiviertes Konto ohne Daten- oder KI-Zugriff; erlaubten Kontakt prüfen..
- Sicherer Wiederherstellungsplan: KI-Endpunkt deaktivieren; erzeugte Vorhersagen gezielt kennzeichnen oder entfernen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1376815e4ca5950a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ai-service-analyze`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ai-service-analyze`.
- Belege: supabase/functions/ai-service-analyze/index.ts:41-52; supabase/functions/ai-service-analyze/index.ts:68-102; supabase/functions/ai-service-analyze/index.ts:119-139.
- Ursache/Prüfgrenze: getUser authentifiziert den Nutzer, danach liest ein separater Service-Role-Client beliebige ticket_id und repair_id sowie seriennummernbezogene Historien. Ticket-, Reparatur-, Rollen-, Aktivitäts- und Mandantenzugriff werden nicht geprüft.
- Geplante konkrete Änderung: Aktives Servicekonto mit fachlicher Rolle verlangen; Ticket, Reparatur und gesamte Seriennummernhistorie im Aufruferscope laden.
- Betriebsfolgen: IDOR auf Servicehistorien; Weitergabe fremder Daten an KI; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: authentifizierter Fremdnutzer für Ticket, Reparatur und Seriennummer negativ; erlaubte Analyse positiv..
- Sicherer Wiederherstellungsplan: Analysefeature sperren; keine Rückkehr zu privilegierten ungeprüften Reads.
- Doppelmeldungsreferenz: keine.

### lov_finding_1cfc25c1a72b5091

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-user-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-user-notify`.
- Belege: supabase/functions/ticket-user-notify/index.ts:39-88; supabase/functions/ticket-user-notify/index.ts:109-114; supabase/config.toml:264-265.
- Ursache/Prüfgrenze: notification_id wird ohne Aufruferauthentifizierung privilegiert aufgelöst. Die Aktivitätsprüfung betrifft den Empfänger, nicht den Aufrufer. Ticketdaten werden für eine Mail genutzt und die Empfängeradresse wird zurückgegeben.
- Geplante konkrete Änderung: Vertrauenswürdige Jobauthentifizierung oder aktive Ticketberechtigung verlangen; Notification an Ticket und erlaubten Versandzustand binden.
- Betriebsfolgen: Unberechtigte Ticketbenachrichtigungen; Offenlegung von Empfängerinformationen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremde Notification, anonym und Replay abweisen; berechtigte Zustellung prüfen..
- Sicherer Wiederherstellungsplan: Versand sperren; bereits versandte Mails sind nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_214081f60b07281d

- Bewertung: ungeklärt; Korrekturgruppe `CG.mobile-voice-transcribe`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mobile-voice-transcribe`, `public.can_create_internal_note`, `public.can_manage_tickets`.
- Belege: supabase/functions/mobile-voice-transcribe/index.ts:19-26; supabase/functions/mobile-voice-transcribe/index.ts:49-52; supabase/migrations/20260729154143_29b6a62a-b3c9-4e0f-b824-abf26969f96b.sql:3-23; supabase/migrations/20261106144436_ad48ee78-8140-4bf3-af8e-fe45e81abcad.sql:1-22.
- Ursache/Prüfgrenze: getUser ist verbindlich, und der Datenbankclient trägt trotz Service-Key den Nutzer-Authorization-Header: ein RLS-Bypass ist deshalb nicht belegt. Es bestehen mehrere INSERT-Policies, darunter alte breite Fachrollenregeln und neuere aktive interne Notizrechte. Die vollständige effektive Ticket-RLS und Helferauflösung wurde nicht abschließend verifiziert; ein Schreibrecht jedes eingeloggten Nutzers ist nicht nachgewiesen.
- Geplante konkrete Änderung: Effektive Ticket- und INSERT-Policies vollständig auflösen; aktive Notizberechtigung vor kostenpflichtiger Transkription explizit prüfen.
- Betriebsfolgen: Mögliche unberechtigte interne Notizen; Transkriptionskosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Portalnutzer, deaktivierte Fachrolle und fremder Mandant gegen echte RLS prüfen; Insertfehler dürfen keinen Erfolg vortäuschen..
- Sicherer Wiederherstellungsplan: Ticketpersistierung separat deaktivieren; bestehende RLS nicht abschwächen.
- Doppelmeldungsreferenz: keine.

### lov_finding_27d2250b5b8790ba

- Bewertung: ungeklärt; Korrekturgruppe `CG.portal-delivery-actions`; Abhängigkeiten A1, A2, A5.
- Funktionen: `portal-delivery-actions`.
- Belege: supabase/functions/portal-delivery-actions/index.ts:14-18; supabase/functions/portal-delivery-actions/index.ts:74-99; supabase/functions/portal-delivery-actions/index.ts:106-128.
- Ursache/Prüfgrenze: Der behauptete vollständig ungeschützte ID-Zugriff trifft nicht zu: Auftrag, Kunden-E-Mail und Rechnungs- oder Liefer-PLZ müssen zusammenpassen. Das sind jedoch bekannte Bestandsdaten statt eines Besitznachweises. Der Rate-Limiter arbeitet ausdrücklich fail-open. Ob dieses Wissensmodell für Lieferänderungen akzeptiert ist, ist nicht belegt.
- Geplante konkrete Änderung: Kurzlebiges auftragsgebundenes Portalcredential oder verifizierte Sitzung einführen; Rate-Limit verbindlich machen und Änderungswünsche von finalen Änderungen trennen.
- Betriebsfolgen: Liefermanipulation bei Kenntnis von Bestandsdaten; Missbrauch öffentlicher Kundenaktionen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: jede falsche Merkmalskombination negativ; Rate-Limiter-Ausfall; Tokenbindung und Replay..
- Sicherer Wiederherstellungsplan: Änderungsaktionen sperren, lesenden Portalbetrieb erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_28cb10380cb01816

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.social-competitors-sync`; Abhängigkeiten A1, A2, A5.
- Funktionen: `social-competitors-sync`.
- Belege: supabase/functions/social-competitors-sync/index.ts:25-46.
- Ursache/Prüfgrenze: Ohne Authentifizierung werden Wettbewerber privilegiert ausgewählt und Snapshots sowie last_snapshot_at verändert. Auch generierte Stubwerte sind dauerhafte Änderungen echter Berichtstabellen.
- Geplante konkrete Änderung: Jobauthentifizierung oder aktive Social-Administrationsrolle mit Client-/Mandantenbindung verlangen; Stubdaten von Produktivberichten trennen.
- Betriebsfolgen: Verfälschte Wettbewerbsberichte; Mandantenübergreifende Änderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremder Client negativ; erlaubter Sync und eindeutige Stubkennzeichnung positiv..
- Sicherer Wiederherstellungsplan: Sync sperren; betroffene Snapshots aus Vorbestand wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_310b81ae9b51152a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mobile-push-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mobile-push-send`.
- Belege: supabase/functions/mobile-push-send/index.ts:34-70; supabase/functions/mobile-push-send/index.ts:79-94.
- Ursache/Prüfgrenze: Ohne Identitätsprüfung werden Zielnutzer über IDs oder Rollen bestimmt, Push-Subscriptions samt Schlüsseln privilegiert gelesen und Pushnachrichten verschickt. Die Antwort enthält Zähler, nicht die Subscription-Schlüssel selbst; eine direkte Schlüsseloffenlegung wird nicht behauptet.
- Geplante konkrete Änderung: Maschinencredential oder aktive berechtigte Versandrolle prüfen; Empfängerscope, Payload und Versandrate begrenzen.
- Betriebsfolgen: Unberechtigte Pushnachrichten; Missbrauch privater Subscriptiondaten; Löschung abgelaufener Subscriptions.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremde Nutzergruppe ohne Subscription-Read oder Push; erlaubten Versand prüfen..
- Sicherer Wiederherstellungsplan: Pushversand deaktivieren; entfernte Subscriptions erfordern gegebenenfalls Neuregistrierung.
- Doppelmeldungsreferenz: keine.

### lov_finding_374621ce0171a129

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-qm-coaching-recommend`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-qm-coaching-recommend`.
- Belege: supabase/functions/ac-qm-coaching-recommend/index.ts:8-23; supabase/functions/ac-qm-coaching-recommend/index.ts:25-48.
- Ursache/Prüfgrenze: agent_user_id wird ohne Aufruferprüfung verwendet, um QM-Bewertungen privilegiert zu lesen, daraus KI-Coaching abzuleiten und eine Coaching-Session anzulegen. Weder Eigenzugriff noch QM-Rolle oder Mandant werden geprüft.
- Geplante konkrete Änderung: Aktives QM-/Führungsrecht und Agentenscope verlangen; berechtigten Eigenzugriff ausdrücklich modellieren.
- Betriebsfolgen: Offenlegung von Mitarbeiterbewertungen; Unberechtigte Coachingeinträge; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremder Agent, falsche Rolle und deaktiviertes Konto negativ; erlaubte QM-Auswertung positiv..
- Sicherer Wiederherstellungsplan: Coachinggenerierung sperren; unberechtigte Sessions revisionssicher zurücknehmen.
- Doppelmeldungsreferenz: keine.

### lov_finding_38eef2927644a86c_47b6f826

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-sla-check`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-sla-check`, `public.ticket_sla_check_and_escalate`.
- Belege: supabase/functions/ticket-sla-check/index.ts:5-11; supabase/config.toml:164-165; supabase/config.toml:270-271.
- Ursache/Prüfgrenze: Jeder Nicht-OPTIONS-Request ruft die SLA-/Eskalations-RPC mit Service-Role auf. Es gibt keine Aufruferprüfung. Die Gateway-Konfiguration setzt verify_jwt an beiden vorhandenen Einträgen auf false; die doppelte TOML-Deklaration verhindert allerdings einen verlässlichen Deploymentnachweis.
- Geplante konkrete Änderung: Maschinenauthentifizierung vor RPC einführen und doppelte Funktionskonfiguration bereinigen; RPC-Ausführungsrechte separat prüfen.
- Betriebsfolgen: Unberechtigte SLA-/Eskalationsläufe.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fehlendes und falsches Jobcredential ohne RPC-Aufruf; autorisierter wiederholbarer Lauf..
- Sicherer Wiederherstellungsplan: Scheduler und Endpoint sperren; Eskalationsänderungen anhand Auditdaten prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_3b55d34b73b21e9d

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-chat.visitor-conversation-access`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-chat`, `getWebsite`, `loadConversation`.
- Belege: supabase/functions/ac-chat/index.ts:12-24; supabase/functions/ac-chat/index.ts:180-183; supabase/functions/ac-chat/index.ts:254-266; supabase/config.toml:307-308.
- Ursache/Prüfgrenze: Polling prüft aktive Website und bindet die conversation_id an website_id. Eine individuelle Besucherberechtigung fehlt jedoch: öffentliche Website-api_key plus fremde Gesprächs-ID reichen zum Lesen nichtinterner Nachrichten.
- Geplante konkrete Änderung: Beim Start ein kryptografisches gesprächsgebundenes Besuchercredential ausstellen und bei Polling prüfen; Website-Schlüssel nicht als Besucheridentität behandeln.
- Betriebsfolgen: Lesen fremder Chatkommunikation innerhalb derselben Website.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Besucher A kann Gespräch B auch mit gültigem Website-Schlüssel nicht pollen; eigene Sitzung positiv..
- Sicherer Wiederherstellungsplan: Polling für ungebundene Altgespräche sperren oder kontrollierte Sitzungserneuerung verlangen.
- Doppelmeldungsreferenz: keine.

### lov_finding_3e98351e84204cdc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-appointment-confirmation-mail`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-appointment-confirmation-mail`.
- Belege: supabase/functions/esc-appointment-confirmation-mail/index.ts:40-76; supabase/functions/esc-appointment-confirmation-mail/index.ts:100-123.
- Ursache/Prüfgrenze: getUser validiert die Identität, danach wird recipient_email aus dem Request für Markenmailversand genutzt. Eine aktive Mitarbeiterrolle, Terminberechtigung, Mandantenbindung oder Ableitung des Empfängers aus einem autorisierten Termin fehlt.
- Geplante konkrete Änderung: Aktive Terminverwaltungsrolle und Eventscope prüfen; Empfänger serverseitig aus dem berechtigten Termin ableiten.
- Betriebsfolgen: Branded Spam; Phishing; Versandkosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gewöhnlicher Login und Empfängerüberschreibung negativ; erlaubter Terminversand positiv..
- Sicherer Wiederherstellungsplan: Versandfunktion deaktivieren; versandte Nachrichten nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_413dd4d3641d23bd

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-ai-suggest`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-ai-suggest`.
- Belege: supabase/functions/as-ai-suggest/index.ts:40-65; supabase/functions/as-ai-suggest/index.ts:105-112; supabase/functions/as-ai-suggest/index.ts:135-152.
- Ursache/Prüfgrenze: Signierte Claims werden geprüft, aber keine aktive Fachrolle oder Fallberechtigung. Der separate Adminclient lädt beliebige case_id samt Timeline und Checklisten und schreibt KI-Ergebnisse, Vorschläge und Ereignisse zurück.
- Geplante konkrete Änderung: Aktives internes Fallbearbeitungsrecht und Fall-/Mandantenzugriff vor privilegiertem Lesen und Schreiben erzwingen.
- Betriebsfolgen: Fremde Falldaten an KI; Unberechtigte Falländerungen; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremder Fall, externe Rolle und deaktiviertes Konto negativ; erlaubte Fallanalyse positiv..
- Sicherer Wiederherstellungsplan: KI-Schreibpfad sperren; Änderungen über Vorwerte und Timeline zurücknehmen.
- Doppelmeldungsreferenz: keine.

### lov_finding_452bd5908dcf2082

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-customer-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-customer-notify`.
- Belege: supabase/functions/ticket-customer-notify/index.ts:31-62; supabase/config.toml:167-168.
- Ursache/Prüfgrenze: Der Handler akzeptiert event und recipient_email ohne Aufruferauthentifizierung, verschickt daraus eine Service-E-Mail und protokolliert privilegiert. verify_jwt ist false; weder Ticketzugriff noch Empfängerbindung werden erzwungen.
- Geplante konkrete Änderung: Vertrauenswürdigen Job oder aktive Ticketberechtigung prüfen; Empfänger und Vorlagen aus autorisiertem Ticket ableiten.
- Betriebsfolgen: Spoofing von Servicemails; Spam; Manipulierte Kommunikationsprotokolle.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, fremdes Ticket und beliebiger Empfänger negativ; legitimes Ereignis positiv..
- Sicherer Wiederherstellungsplan: Endpoint sperren; missbräuchliche Logeinträge markieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_4bd5ac08511c8e04

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-sms-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-sms-reminder`.
- Belege: supabase/functions/as-send-sms-reminder/index.ts:59-100; supabase/functions/as-send-sms-reminder/index.ts:110-126.
- Ursache/Prüfgrenze: Der Endpoint erlaubt Servicecredential oder verifizierte Nutzerclaims, aber keine aktive Versandrolle oder Fallautorisierung. Nach beliebiger case_id werden SMS-Empfänger und Text verarbeitet und Twilio aufgerufen. Telefonnummernformat und vorhandener Fall sind keine Versandberechtigung.
- Geplante konkrete Änderung: Servicecredential exakt vergleichen; aktive Fallrolle und Fallzugriff prüfen; freie Empfänger-/Textüberschreibung gesondert berechtigen.
- Betriebsfolgen: Unberechtigter SMS-Versand; Providerkosten; Branded Spam.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gewöhnlicher Login, fremder Fall und Empfängerüberschreibung negativ; berechtigte Erinnerung positiv..
- Sicherer Wiederherstellungsplan: SMS-Pfad sperren; bereits versandte SMS sind nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_5289cf703f8ac14d

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-sync-alert`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-sync-alert`.
- Belege: supabase/functions/ticket-sync-alert/index.ts:47-67; supabase/functions/ticket-sync-alert/index.ts:129-185; supabase/config.toml:198-199.
- Ursache/Prüfgrenze: Ohne Aufruferprüfung werden eingehende und ausgehende Ticket-Synclogs privilegiert gelesen, Alarmfälle verarbeitet und Alarmdatensätze angelegt. Eine direkte vollständige Rückgabe sämtlicher Rohlogs wird nicht behauptet; die unberechtigte Verarbeitung ist belegt.
- Geplante konkrete Änderung: Jobauthentifizierung oder aktive Sync-Administrationsrolle erzwingen; Mandantenscope und datensparsame Fehlerausgaben ergänzen.
- Betriebsfolgen: Unberechtigte Logverarbeitung; Alarm- und Mailmissbrauch.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym ohne Log-Read; falscher Mandant negativ; autorisierter Alarmjob positiv..
- Sicherer Wiederherstellungsplan: Alarmjob stoppen; erzeugte Alarme revisionssicher kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5e150bdaabc5e021

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mediapaket-reminders`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mediapaket-reminders`.
- Belege: supabase/functions/mediapaket-reminders/index.ts:49-62; supabase/functions/mediapaket-reminders/index.ts:78-126; supabase/functions/mediapaket-reminders/index.ts:223-238.
- Ursache/Prüfgrenze: Der Reminderhandler besitzt keine Aufruferprüfung. Er verarbeitet Pakete global, versendet Erinnerungen und kann bei entsprechender Konfiguration Kontakt-/Teamdaten anonymisieren. Konfigurations- und Fälligkeitsprüfungen ersetzen keine Jobautorisierung.
- Geplante konkrete Änderung: Maschinenauthentifizierung vor Verarbeitung erzwingen; Anonymisierung separat berechtigen und protokolliert freigeben.
- Betriebsfolgen: Unberechtigte Erinnerungen; Unbefugtes Auslösen irreversibler Anonymisierung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym ohne Reads oder Versand; Konfigurationsschalter und Anonymisierungsgrenzen; autorisierter Job..
- Sicherer Wiederherstellungsplan: Job stoppen; echte Anonymisierung nicht ohne Datenschutzprüfung rückgängig machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_63fca018638248be_28891043

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-chat.post-visitor-message`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-chat`, `loadConversation`.
- Belege: supabase/functions/ac-chat/index.ts:20-24; supabase/functions/ac-chat/index.ts:180-183; supabase/functions/ac-chat/index.ts:232-250.
- Ursache/Prüfgrenze: send bindet das Gespräch an die Website, nicht an den Besucher. visitor_hash wird nur als Metadatum gespeichert und nicht gegen das Gespräch geprüft. Mit öffentlichem Website-Schlüssel und fremder Gesprächs-ID lassen sich Nachrichten einschleusen.
- Geplante konkrete Änderung: Gesprächsgebundenes Besuchercredential vor jedem Send prüfen; Größen- und Ratenlimits sowie Replaykontrolle ergänzen.
- Betriebsfolgen: Chat-Impersonation; Manipulation fremder Kundenkommunikation; Unberechtigte KI-Folgeaktionen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Besucher A kann nicht in Gespräch B schreiben; manipuliertes visitor_hash ohne Wirkung; eigener Send positiv..
- Sicherer Wiederherstellungsplan: Ungebundene Sends sperren; eingeschleuste Nachrichten revisionssicher markieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_6f686b06e95c91e0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-omnichannel-orchestrate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-omnichannel-orchestrate`.
- Belege: supabase/functions/ac-omnichannel-orchestrate/index.ts:9-31; supabase/config.toml:337-338.
- Ursache/Prüfgrenze: Beliebige contact_id führt ohne Aufruferprüfung zu privilegierten Kontakt-, Nachrichten- und Anrufreads. Kontaktinformationen werden für die Kanalempfehlung an KI übertragen; verify_jwt ist false.
- Geplante konkrete Änderung: Aktive autorisierte Kontaktrolle und kontaktbezogenen Mandantenscope vor jeder Analyse verlangen.
- Betriebsfolgen: Unberechtigte Kundendatenverarbeitung; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremder Kontakt und anonym ohne KI-Aufruf; berechtigte Empfehlung positiv..
- Sicherer Wiederherstellungsplan: Orchestrierungsanalyse deaktivieren; erzeugte Empfehlungen kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_742579dc7034b64e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.social-metrics-sync`; Abhängigkeiten A1, A2, A5.
- Funktionen: `social-metrics-sync`.
- Belege: supabase/functions/social-metrics-sync/index.ts:36-65; supabase/functions/social-metrics-sync/index.ts:68-81.
- Ursache/Prüfgrenze: Die Authprüfung liegt ausschließlich im Zweig action ungleich sync und sync_one. Gerade die schreibenden Standardsyncs umgehen sie und aktualisieren Service-Role-seitig social_post_metrics mandantenübergreifend. Stubwerte werden dauerhaft gespeichert.
- Geplante konkrete Änderung: Alle Actions vor Verzweigung authentifizieren; aktive Socialrolle und Post-/Clientscope prüfen; Berechtigungs-RPC im Nutzerkontext ausführen.
- Betriebsfolgen: Manipulierte Kundenmetriken; Mandantenübergreifende Berichtsschäden.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: sync und sync_one anonym negativ; fremder Post negativ; berechtigter Scope positiv..
- Sicherer Wiederherstellungsplan: Sync stoppen; betroffene Tagesmetriken aus vertrauenswürdiger Quelle neu erstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_755a57788035e770

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-order-confirmation`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-order-confirmation`, `signOrderToken`.
- Belege: supabase/functions/send-order-confirmation/index.ts:39-55; supabase/functions/send-order-confirmation/index.ts:73-102; supabase/functions/send-order-confirmation/index.ts:104-120.
- Ursache/Prüfgrenze: getUser ist vorhanden, aber danach werden beliebige Signatur-/Auftrags-IDs mit separatem Adminclient gelesen. recipient_email ist frei übersteuerbar; erzeugte Downloadlinks enthalten gültige Signatur- oder HMAC-Credentials. Eine Auftrags- oder Mandantenautorisierung fehlt.
- Geplante konkrete Änderung: Aktive Auftragsversandrolle und Zugriff auf Auftrag sowie Signaturanfrage prüfen; Empfänger serverseitig binden, Overrides separat berechtigen.
- Betriebsfolgen: Abfluss zugangsfähiger Auftragslinks; Unberechtigte Bestellmails.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremder Auftrag und beliebiger Empfänger negativ; gemischte Signatur-/Auftrags-IDs negativ; legitimer Versand positiv..
- Sicherer Wiederherstellungsplan: Versand sperren; kompromittierte Downloadcredentials gezielt widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_7cfb49a133e44934

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.maintenance-reminder-daily`; Abhängigkeiten A1, A2, A5.
- Funktionen: `maintenance-reminder-daily`, `public.refresh_warranty_and_maintenance_status`.
- Belege: supabase/functions/maintenance-reminder-daily/index.ts:15-33; supabase/functions/maintenance-reminder-daily/index.ts:76-97.
- Ursache/Prüfgrenze: Nach OPTIONS wird ohne Aufruferprüfung der Wartungs-/Garantiestatus aktualisiert und device_maintenance verarbeitet. Erinnerungslogs und Versandflags werden privilegiert geschrieben; Fälligkeit ersetzt keine Jobberechtigung.
- Geplante konkrete Änderung: Maschinenauthentifizierung vor Statusrefresh und Reminderverarbeitung; interaktive Läufe nur für aktive Wartungsadministration.
- Betriebsfolgen: Unberechtigte Wartungsläufe; Manipulierte Erinnerungszustände.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym ohne RPC oder Änderungen; autorisierter Job und Wiederholungsfestigkeit positiv..
- Sicherer Wiederherstellungsplan: Scheduler und Endpoint sperren; Flags anhand Reminderlog korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_8b7a66d6300430d8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-sms-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-sms-reminder`.
- Belege: supabase/functions/as-send-sms-reminder/index.ts:63-85; supabase/functions/as-send-sms-reminder/index.ts:98-126.
- Ursache/Prüfgrenze: Verifizierte Nutzerclaims genügen zum Service-Role-Read beliebiger as_cases_list_v-IDs. Keine aktive Fachrolle, Team- oder Mandantenzuordnung wird geprüft, bevor Falldaten in SMS und Reminder-/Timelineeinträge eingehen. Dies ist der objektbezogene Zugriffspfad, nicht lediglich freie Textwahl.
- Geplante konkrete Änderung: Fallzugriff im Nutzerkontext prüfen; aktive Team-/Fachrollen und Mandantenscope vor Fallread und Versand verlangen.
- Betriebsfolgen: Fremde Falldaten per SMS; Unberechtigte Fallhistorie.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gültiger Login aus anderem Team/Mandanten negativ; eigener Fall mit erlaubter Rolle positiv..
- Sicherer Wiederherstellungsplan: Fallbezogenen SMS-Versand sperren; unberechtigte Historieneinträge markieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_9d9c7365b4cce7e8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-revenue-intel-v2`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-revenue-intel-v2`.
- Belege: supabase/functions/ac-revenue-intel-v2/index.ts:9-31; supabase/functions/ac-revenue-intel-v2/index.ts:39-47; supabase/config.toml:343-344.
- Ursache/Prüfgrenze: Ohne Authentifizierung werden beliebige Kontakte samt Nachrichteninhalt und Anrufdaten privilegiert gelesen und an kostenpflichtige KI übermittelt. Ergebnisse werden als Vorhersage gespeichert; verify_jwt ist false.
- Geplante konkrete Änderung: Aktive Vertriebs-/Analyseberechtigung und Kontaktmandant vor Reads, KI und Ergebniszugriff prüfen.
- Betriebsfolgen: Fremde Kundenkommunikation in KI; Unberechtigte Analyseergebnisse; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, fremder Kontakt und deaktiviertes Konto negativ; erlaubte Analyse positiv..
- Sicherer Wiederherstellungsplan: KI-Endpunkt sperren; unberechtigt erzeugte Vorhersagen kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_a33d1e6c8240851c

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-revenue-forecast`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-revenue-forecast`.
- Belege: supabase/functions/ac-revenue-forecast/index.ts:8-23; supabase/functions/ac-revenue-forecast/index.ts:46-56.
- Ursache/Prüfgrenze: Nach OPTIONS folgt ohne Identitätsprüfung ein Service-Role-Read von Umsatzattributionen. Zeitraum und Modell werden aus dem Request übernommen; durchschnittliche Tagesumsätze und 30-/60-/90-Tage-Prognosen werden ohne Rollen- oder Mandantengrenze zurückgegeben.
- Geplante konkrete Änderung: Aktive Umsatzanalyse-/Finanzrolle und Mandantenscope verlangen; Zeitraum begrenzen.
- Betriebsfolgen: Offenlegung vertraulicher Unternehmensumsätze und Prognosen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, unberechtigte Rolle und fremder Mandant negativ; erlaubter Forecast positiv..
- Sicherer Wiederherstellungsplan: Forecastendpoint sperren; keine Datenrückführung erforderlich.
- Doppelmeldungsreferenz: keine.

### lov_finding_a63e6a6f8b835b5d

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.lager-bestand-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `lager-bestand-notify`.
- Belege: supabase/functions/lager-bestand-notify/index.ts:12-45; supabase/functions/lager-bestand-notify/index.ts:45-56.
- Ursache/Prüfgrenze: Vom Request gelieferte Seriennummern werden ohne Aufruferprüfung privilegiert zu Lagergeräten, Aufträgen und Kunden aufgelöst. Der Endpoint ruft danach den Transaktionsmailversand mit Servercredential auf.
- Geplante konkrete Änderung: Aktive Lager-/Versandrolle oder vertrauenswürdiges Jobcredential prüfen; Seriennummern und Aufträge auf Mandanten- und Versandzustand begrenzen.
- Betriebsfolgen: Unberechtigte Versandbenachrichtigungen; Missbrauch interner Versandcredentials.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, fremde Seriennummer und nicht versandbereiter Auftrag negativ; legitimer Versand positiv..
- Sicherer Wiederherstellungsplan: Benachrichtigungsendpoint sperren; versandte Mails nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_a959243f59d4a590

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.ticket-customer-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-customer-notify`.
- Belege: supabase/functions/ticket-customer-notify/index.ts:31-62.
- Ursache/Prüfgrenze: Verifiziert dieselbe unautorisierte Requestverarbeitung und derselbe Resend-Aufruf wie beim Referenzbefund; frei gewählter Empfänger und Service-Mailinhalt beschreiben dieselbe Versandoperation.
- Geplante konkrete Änderung: Mit Referenzbefund beheben; Authentifizierung, Ticketzugriff und serverseitige Empfängerbindung.
- Betriebsfolgen: Service-Mailspoofing; Spam.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Negativ- und Positivtests des Referenzbefunds übernehmen..
- Sicherer Wiederherstellungsplan: Wie Referenzbefund: Versand sperren.
- Doppelmeldungsreferenz: lov_finding_452bd5908dcf2082.

### lov_finding_aab25c4aac0c36d0_c2bf6c3e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-qm-auto-score.call-transcript-analysis`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-qm-auto-score`.
- Belege: supabase/functions/ac-qm-auto-score/index.ts:12-38; supabase/functions/ac-qm-auto-score/index.ts:58-101.
- Ursache/Prüfgrenze: call_id und scorecard_id werden ohne Aufruferprüfung privilegiert aufgelöst. Das Gesprächstranskript wird an KI gesendet; Bewertungen und gegebenenfalls Coaching-Sessions werden angelegt und Bewertungsdaten zurückgegeben.
- Geplante konkrete Änderung: Aktive QM-Rolle und Zugriff auf Gespräch, Agent und Scorecard innerhalb des Mandanten vor KI-Verarbeitung prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung von Gesprächstranskripten; Manipulierte Mitarbeiterbewertungen; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremdes Gespräch und falsche Rolle ohne KI oder Writes; erlaubte QM-Bewertung positiv..
- Sicherer Wiederherstellungsplan: Scoring sperren; unberechtigte Bewertungen und Folgecoachings revisionssicher zurücknehmen.
- Doppelmeldungsreferenz: keine.

### lov_finding_ae041d22cd49aa24

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.survey-send-invites`; Abhängigkeiten A1, A2, A5.
- Funktionen: `survey-send-invites`.
- Belege: supabase/functions/survey-send-invites/index.ts:22-58; supabase/functions/survey-send-invites/index.ts:71-119; supabase/functions/survey-send-invites/index.ts:147-161.
- Ursache/Prüfgrenze: Der Handler verlangt eine Nutzeridentität beziehungsweise akzeptiert seinen Servicepfad, aber prüft anschließend keine aktive Umfrageverwaltungsrolle. survey_id lädt Umfrage und Empfänger mit Adminclient; Einladungen und Versandlogs werden erzeugt.
- Geplante konkrete Änderung: Aktive Umfrageverwaltungsrolle und Umfrage-/Mandantenzugriff prüfen; Servicezugang exakt und getrennt validieren.
- Betriebsfolgen: Unberechtigte Einladungen; Versandkosten; Manipulierte Umfragehistorie.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gewöhnlicher Login und fremde Umfrage negativ; berechtigter Versand sowie Wiederholung positiv..
- Sicherer Wiederherstellungsplan: Einladungsversand sperren; unberechtigt erstellte Einladungstokens widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b59f50206d13ea0b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-customer-sms`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-customer-sms`.
- Belege: supabase/functions/send-customer-sms/index.ts:77-130; supabase/functions/send-customer-sms/index.ts:136-167; src/components/CustomerSmsTab.tsx:162.
- Ursache/Prüfgrenze: Claims und erlaubte Rollen werden geprüft. Danach stammen customer_id, document_id, phone und message_text aus dem Request. Eine Bindung von Telefonnummer und Dokument an einen berechtigten Kunden fehlt vor Token-/Linkerzeugung und SMS-Versand; aktiver Kontostatus wird ebenfalls nicht geprüft.
- Geplante konkrete Änderung: Aktives Versandkonto sowie Kunden-, Dokument- und Mandantenzugriff prüfen; Telefonnummer aus autorisiertem Kunden ableiten, Override gesondert berechtigen.
- Betriebsfolgen: SMS an beliebige Telefonnummern; Abfluss von Dokumentlinks; Providerkosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: erlaubte Rolle mit fremdem Dokument oder abweichender Telefonnummer negativ; legitimer Versand positiv..
- Sicherer Wiederherstellungsplan: SMS sperren und unberechtigt erzeugte Dokumenttokens widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b86c0cca0683482a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-create-appointment`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-create-appointment`.
- Belege: supabase/functions/ticket-create-appointment/index.ts:33-66; supabase/functions/ticket-create-appointment/index.ts:68-94; supabase/functions/ticket-create-appointment/index.ts:100-125.
- Ursache/Prüfgrenze: callerAuth wird gelesen, aber vor privilegiertem Ticketread und Eventanlage nicht authentifiziert oder autorisiert. Requestwerte können Abteilung, Bearbeiter, Ressource und Kundenangaben übersteuern; UUID-Validierung prüft keine Zugriffsrechte.
- Geplante konkrete Änderung: Aktive Termin-/Ticketrolle und Ticketzugriff verlangen; sämtliche Ressourcen- und Abteilungsüberschreibungen auf erlaubten Scope prüfen.
- Betriebsfolgen: Unberechtigte Termine; Manipulierte Ressourcenbelegung; Falsche Kundendaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, fremdes Ticket und fremde Ressource negativ; erlaubte Terminanlage positiv..
- Sicherer Wiederherstellungsplan: Terminendpoint sperren; unberechtigte Termine stornieren und Bestätigungstokens widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_ba7c311bb074fdc2_bd0ae6c3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-predictive-engagement`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-predictive-engagement`.
- Belege: supabase/functions/ac-predictive-engagement/index.ts:9-18; supabase/config.toml:346-347.
- Ursache/Prüfgrenze: Der Handler akzeptiert contact_id ohne Identitätsprüfung und liest Kontakt und Kommunikationshistorie privilegiert für die Vorhersage. Weder aktiver Nutzer noch Kontakt-/Mandantenscope sind vorgeschaltet; verify_jwt ist false.
- Geplante konkrete Änderung: Aktive Kontaktanalyseberechtigung und Kontaktmandant vor Datenzugriff und Vorhersage erzwingen.
- Betriebsfolgen: Unberechtigte Kontaktanalysen; Verarbeitung fremder Kommunikationshistorie.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremde Kontakt-ID ohne Analyse; berechtigter Kontakt positiv..
- Sicherer Wiederherstellungsplan: Vorhersageendpoint sperren; unberechtigte Ergebnisse kennzeichnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c1f51fb90f414c65

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-3cx-call`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-3cx-call`.
- Belege: supabase/functions/ac-3cx-call/index.ts:12-25; supabase/functions/ac-3cx-call/index.ts:27-44; supabase/functions/ac-3cx-call/index.ts:53-59.
- Ursache/Prüfgrenze: Nach erfolgreichem Login fehlt eine aktive Telefonierrolle. Der Adminclient fällt von Nutzereinstellungen auf globale PBX-Einstellungen zurück und sendet Requestfeld to als destination an makecall. Kontakt-/Gesprächsberechtigung und Zielrufnummernregeln fehlen.
- Geplante konkrete Änderung: Aktive Telefonierberechtigung, erlaubte Nebenstelle und Kontakt-/Mandantenscope prüfen; Rufnummernklassen, Kosten- und Ratenlimits erzwingen.
- Betriebsfolgen: Unberechtigte Anrufe; Telefoniekosten; Missbrauch globaler PBX-Zugänge.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: normaler Login, gesperrtes Ziel und unberechtigter globaler Fallback negativ; erlaubter Anruf positiv..
- Sicherer Wiederherstellungsplan: makecall-Pfad sperren; laufende Anrufe gegebenenfalls administrativ beenden.
- Doppelmeldungsreferenz: keine.

### lov_finding_c45c9cbb478d7312

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mediapaket-portal`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mediapaket-portal:notify_customer_status`.
- Belege: supabase/functions/mediapaket-portal/index.ts:159-185; supabase/functions/mediapaket-portal/index.ts:421-451; supabase/config.toml:41-42.
- Ursache/Prüfgrenze: Die Action notify_customer_status besitzt anders als benachbarte interne Actions keinen eigenen Authblock. Frei gelieferte mp_id und new_status lösen privilegierten Kundenread, signierten Portallink, Mailversand und Historieneintrag aus; verify_jwt ist false.
- Geplante konkrete Änderung: Aktives Paketverwaltungsrecht und Paketzugriff vor dieser Action prüfen; Status aus bestätigtem Datenbankzustand ableiten.
- Betriebsfolgen: Gefälschte Statusmails; Unberechtigtes Erzeugen von Portallinks; Manipulierte Historie.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym, fremdes Paket und erfundener Status negativ; legitimer Statuswechsel positiv..
- Sicherer Wiederherstellungsplan: Nur betroffene Action sperren; kompromittierte Portallinks widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d516be27dfccb6c8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-router`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-router`.
- Belege: supabase/functions/ticket-router/index.ts:18-36; supabase/functions/ticket-router/index.ts:48-55; supabase/functions/ticket-router/index.ts:110-115.
- Ursache/Prüfgrenze: Ohne Aufruferprüfung wird ticket_id mit Service-Role geladen. Routing kann Ticketabteilung ergänzen, Bearbeiter bestimmen und tickets sowie ticket_history verändern. Ticket-, Mandanten- oder aktive Rollenautorisierung fehlt.
- Geplante konkrete Änderung: Vertrauenswürdigen Routingjob oder aktive Ticketverwaltungsrolle mit Ticketzugriff verlangen; Zielbearbeiter und Abteilung im gleichen Scope prüfen.
- Betriebsfolgen: Unberechtigte Ticketzuweisung; Verfälschte Tickethistorie.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und fremdes Ticket negativ; berechtigter Routinglauf positiv..
- Sicherer Wiederherstellungsplan: Routingendpoint sperren; Zuordnungen anhand Historie zurücksetzen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d86e3d3e3deb87d6

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-send-message`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-send-message`, `sendEmail`, `sendTwilio`.
- Belege: supabase/functions/esc-send-message/index.ts:46-71; supabase/config.toml:245-246.
- Ursache/Prüfgrenze: Im Handler fehlt eine eigene Aufruferprüfung vollständig. recipient, subject und body werden unmittelbar für E-Mail, SMS oder WhatsApp genutzt. verify_jwt = true ist nur ein Gateway-Tokencheck und ersetzt keine aktive Mitarbeiter-, Rollen-, Event- oder Mandantenberechtigung.
- Geplante konkrete Änderung: Verifizierte aktive Mitarbeiteridentität, kanalspezifisches Versandrecht und Event-/Empfängerscope serverseitig erzwingen.
- Betriebsfolgen: Beliebige Markenkommunikation; Spam/Phishing; Providerkosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gültiger Token ohne Versandrolle negativ; fremdes Event und beliebiger Empfänger negativ; erlaubter Versand positiv..
- Sicherer Wiederherstellungsplan: Nachrichtenendpoint sperren; Providerlimits und Missbrauchsmonitoring aktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_dae991b95413b3dd

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-omnichannel-merge`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-omnichannel-merge`.
- Belege: supabase/functions/ac-omnichannel-merge/index.ts:21-30; supabase/functions/ac-omnichannel-merge/index.ts:72-77.
- Ursache/Prüfgrenze: Ohne Identitäts- oder Rollenprüfung liest der Handler Kontakte privilegiert, verschiebt Nachrichten und Anrufe auf einen Master und löscht Duplikatkontakte. Es gibt vor dieser destruktiven Operation keine verifizierte Mandantengrenze.
- Geplante konkrete Änderung: Aktive Datenadministrationsrolle oder enges Jobcredential verlangen; Kandidaten strikt mandantenbezogen bilden und Merge atomar freigeben.
- Betriebsfolgen: Destruktive Kontaktzusammenführung; Falsche Kommunikationszuordnung; Mandantenvermischung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: anonym und mandantenübergreifendes Kandidatenpaar negativ; atomarer erlaubter Merge; Fehlerrollbacks..
- Sicherer Wiederherstellungsplan: Merge sofort sperren; Wiederherstellung benötigt gesicherte Kontakt- und Fremdschlüsselvorwerte.
- Doppelmeldungsreferenz: keine.

### lov_finding_e9436bf2ec03c48f_2176d0bb

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-repair-quote`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-repair-quote`.
- Belege: supabase/functions/send-repair-quote/index.ts:11-24; supabase/functions/send-repair-quote/index.ts:46-72; supabase/config.toml:203-204.
- Ursache/Prüfgrenze: quote_id führt ohne eigene Aufruferprüfung zu Service-Role-Reads, Versand und Status-/Historienupdates. Der gültige approval_token wird sogar als Link zurückgegeben. verify_jwt = true begrenzt den Gatewayzugang, prüft aber weder aktive Servicerolle noch Reparatur-/Mandantenzugriff.
- Geplante konkrete Änderung: Aktive berechtigte Servicerolle und Zugriff auf Angebot/Reparatur prüfen; Versandstatus nur nach bestätigtem Erfolg setzen und Approvalcredentials nicht unnötig zurückgeben.
- Betriebsfolgen: Unberechtigter Angebotsversand; Manipulierte Angebotsstände; Abfluss von Freigabelinks.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: gültiger fremder Login und fremdes Angebot negativ; Providerfehler ohne Status Versendet; legitimer Versand positiv..
- Sicherer Wiederherstellungsplan: Versand sperren; kompromittierte Freigabetokens rotieren und Status fachlich abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_02f750951452daf6

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-journey-tick`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-journey-tick`.
- Belege: supabase/functions/ac-journey-tick/index.ts:44-72; supabase/functions/ac-journey-tick/index.ts:78-107.
- Ursache/Prüfgrenze: Nach OPTIONS erfolgt ohne Handler-Authentifizierung die Service-Role-Abfrage fälliger Journey-Läufe samt Kontakten. Statusänderungen und Kommunikationsschritte sind erreichbar; die Antwort gibt vor allem Zähler zurück, nicht sämtliche gelesenen Kontaktdaten.
- Geplante konkrete Änderung: Vor allen Datenoperationen ausschließlich verifizierte Job-Zugangsdaten zulassen.
- Betriebsfolgen: Unberechtigtes Auslösen von Kundenkommunikation; Veränderung von Journey-Zuständen.
- Geplante Regressionstests, noch nicht ausgeführt: Fehlende, öffentliche und gefälschte Job-Zugangsdaten ohne Datenzugriff ablehnen; gültigen Job isoliert mit Versand-Mocks prüfen..
- Sicherer Wiederherstellungsplan: Scheduler pausieren und Endpunkt gesperrt lassen.
- Doppelmeldungsreferenz: keine.

### lov_finding_13d6e91ec712f40a_604475b4

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-router-simulate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-router-simulate`.
- Belege: supabase/functions/ac-router-simulate/index.ts:24-43; supabase/functions/ac-router-simulate/index.ts:91-103; src/pages/AlixConnect/RoutingSimulator.tsx:70.
- Ursache/Prüfgrenze: getUser wird aufgerufen, sein Ergebnis aber nicht als Zugriffssperre verwendet. Kundenbewertungen und Routingdaten werden privilegiert gelesen; save kann Simulationen speichern.
- Geplante konkrete Änderung: Fehlende Identität abweisen und aktive Routing-Berechtigung samt Mandantenbindung vor allen Service-Role-Abfragen prüfen.
- Betriebsfolgen: Offenlegung von Kundenscores und Routinglogik; Unberechtigte Simulationseinträge.
- Geplante Regressionstests, noch nicht ausgeführt: Leere Identität, fremden Kunden und fremden Mandanten ablehnen; save darf keine Nebenwirkung erzeugen..
- Sicherer Wiederherstellungsplan: Simulator serverseitig deaktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_183ae0ad4cf721dc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.compliance-ai-assist`; Abhängigkeiten A1, A2, A5, A8.
- Funktionen: `compliance-ai-assist`.
- Belege: supabase/functions/compliance-ai-assist/index.ts:40-46; supabase/functions/compliance-ai-assist/index.ts:61-68; supabase/functions/compliance-ai-assist/index.ts:90-109; src/components/compliance/AiAssistField.tsx:37.
- Ursache/Prüfgrenze: Verifizierte Claims belegen nur die Identität. taskId führt anschließend zu Service-Role-Lesezugriffen auf Aufgabe, Projekt und Schritte ohne Aufgaben- oder Projektberechtigung; die Inhalte gelangen in die KI-Verarbeitung.
- Geplante konkrete Änderung: Aufgabe und Projekt im berechtigten Benutzerkontext laden; aktive Projektberechtigung vor KI-Übermittlung prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung vertraulicher Compliance-Inhalte; Mögliche Offenlegung über KI-Antworten.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde taskId und inaktives Konto vor KI-Aufruf ablehnen; erlaubte Aufgabe positiv prüfen..
- Sicherer Wiederherstellungsplan: Aufgabenbasierte KI-Anreicherung sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_1b423c4366778754_78e6bd31

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.public.ac_web_live_map-uuid`; Abhängigkeiten A1, A2, A5.
- Funktionen: `public.ac_web_live_map(uuid)`.
- Belege: supabase/migrations/20260720212030_9bf55c82-51cf-4ae2-b9f5-c0c3c167c120.sql:165-179.
- Ursache/Prüfgrenze: Die SECURITY-DEFINER-Funktion filtert nur nach frei gewählter Website-ID und Zeit. EXECUTE für authenticated enthält keine Website- oder Mandantenberechtigung. Ausgegeben werden Länderaggregate, keine präzisen Einzelstandorte.
- Geplante konkrete Änderung: Aktive Website-Leseberechtigung innerhalb der SQL-Funktion erzwingen oder mit geeigneten RLS-Regeln SECURITY INVOKER verwenden.
- Betriebsfolgen: Mandantenübergreifende Offenlegung von Live-Besucheraggregaten.
- Geplante Regressionstests, noch nicht ausgeführt: Direkten RPC-Aufruf für fremde Website, inaktiven Benutzer und berechtigten Benutzer isoliert prüfen..
- Sicherer Wiederherstellungsplan: EXECUTE für Benutzer bis zur korrigierten Funktion entziehen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1deb9bcf8e2fe9db

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-create-appointment`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-create-appointment`.
- Belege: supabase/functions/ticket-create-appointment/index.ts:33-63; supabase/functions/ticket-create-appointment/index.ts:103-146; supabase/functions/ticket-create-appointment/index.ts:195; src/components/tickets/CreateAppointmentFromTicket.tsx:65.
- Ursache/Prüfgrenze: callerAuth wird übernommen und später weitergereicht, aber nicht vor dem privilegierten Laden des gewählten Tickets geprüft. Ereignisanlage, Ticketänderungen und Historieneinträge erfolgen vorher ohne Ressourcenberechtigung.
- Geplante konkrete Änderung: Aktive Ticket- und Terminberechtigung vor Ticketabfrage und Ereignisanlage erzwingen.
- Betriebsfolgen: Unberechtigte Termin- und Ticketänderungen; Mögliche Kundenbenachrichtigungen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremdes Ticket muss ohne Ereignis-, Historien- oder Mail-Nebenwirkung abgewiesen werden..
- Sicherer Wiederherstellungsplan: Terminerstellung über diesen Handler sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_217a6dfc717596f3_bfdcff55

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-conv-intel-analyze`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-conv-intel-analyze`.
- Belege: supabase/functions/ac-conv-intel-analyze/index.ts:11-23; supabase/functions/ac-conv-intel-analyze/index.ts:59-62; src/pages/AlixConnect/ConversationalIntelligence.tsx:38.
- Ursache/Prüfgrenze: Der Handler lädt frei gewählte Anruftranskripte ohne Benutzerprüfung, verarbeitet sie und speichert beziehungsweise liefert Insights. verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Aktive Gesprächsanalyse-Berechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff prüfen.
- Betriebsfolgen: Offenlegung und externe Verarbeitung privater Gesprächsinhalte; Unberechtigte Insight-Erstellung.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme, fremde und inaktive Aufrufer vor Transkript- und KI-Zugriff abweisen..
- Sicherer Wiederherstellungsplan: Analyseendpunkt sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_232765c9fa069fde

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-email-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-email-reminder`.
- Belege: supabase/functions/as-send-email-reminder/index.ts:33-54; supabase/functions/as-send-email-reminder/index.ts:56-75; src/pages/AfterSales/CaseDetail.tsx:281.
- Ursache/Prüfgrenze: Der Benutzerpfad validiert Claims, prüft aber weder aktive Fallberechtigung noch Mandantenzugehörigkeit. Der gewählte Fall wird mit Service Role gelesen und dessen Inhalt versendet.
- Geplante konkrete Änderung: Aktive Fall- und Versandberechtigung vor Fallabfrage erzwingen; Service-Role-Zugang exakt statt per Teilstring vergleichen.
- Betriebsfolgen: Unberechtigter Versand fremder Falldaten; Manipulation von Fallhistorien.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Fall und inaktives Konto ohne Versand oder Protokollmutation ablehnen..
- Sicherer Wiederherstellungsplan: Erinnerungsversand serverseitig sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_291229c8706e74d8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-whatsapp-inbound`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-whatsapp-inbound`.
- Belege: supabase/functions/esc-whatsapp-inbound/index.ts:20-29; supabase/functions/esc-whatsapp-inbound/index.ts:40-51.
- Ursache/Prüfgrenze: Der WhatsApp-Handler prüft vor Protokollierung und Statusänderung keine Provider-Signatur. Vom Aufrufer gelieferte Absender- und Antwortwerte steuern die Teilnehmerzuordnung und Ereignisänderung.
- Geplante konkrete Änderung: Provider-Signatur vor jeder Datenoperation verifizieren und Antwort an den erwarteten Teilnehmer und Vorgang binden.
- Betriebsfolgen: Gefälschte Terminbestätigungen oder Ablehnungen; Verfälschung von Kommunikationsprotokollen.
- Geplante Regressionstests, noch nicht ausgeführt: Fehlende, falsche und für andere URL gültige Signaturen ohne Mutation ablehnen; gültige Provider-Fixtures prüfen..
- Sicherer Wiederherstellungsplan: Webhook-Eingang sperren und Antworten vorübergehend manuell bearbeiten.
- Doppelmeldungsreferenz: keine.

### lov_finding_37d780060351d132

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mediapaket-reminders`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mediapaket-reminders`.
- Belege: supabase/functions/mediapaket-reminders/index.ts:49-56; supabase/functions/mediapaket-reminders/index.ts:77-95; supabase/functions/mediapaket-reminders/index.ts:124-126.
- Ursache/Prüfgrenze: Ohne Handler-Authentifizierung werden Pakete und Kontakte privilegiert geladen. base_url aus der Anfrage beeinflusst Kommunikationslinks. Tagesprotokolle begrenzen Wiederholungen, ersetzen aber keine Aufruferberechtigung.
- Geplante konkrete Änderung: Verifizierten Job-Zugang vor Datenzugriff verlangen und Linkbasis ausschließlich aus vertrauenswürdiger Konfiguration beziehen.
- Betriebsfolgen: Unberechtigter Erinnerungsversand; Einbettung fremder Links in Geschäftskommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten Aufruf und fremde base_url ohne Mailversand prüfen; Idempotenz mit Mocks testen..
- Sicherer Wiederherstellungsplan: Erinnerungsjob pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_39468467a3a1e242

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-repair-quote`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-repair-quote`.
- Belege: supabase/functions/send-repair-quote/index.ts:11-21; supabase/functions/send-repair-quote/index.ts:67-72; src/pages/Reparatur/QuoteDetail.tsx:144.
- Ursache/Prüfgrenze: Der Handler besitzt keine eigene Identitäts- oder Angebotsberechtigungsprüfung vor Service-Role-Zugriff und Versand. verify_jwt=true begrenzt gegebenenfalls den Gateway-Einstieg, autorisiert aber keinen Zugriff auf das gewählte Angebot; die pauschale Behauptung anonymer Produktionserreichbarkeit ist damit nicht belegt.
- Geplante konkrete Änderung: Aktive Reparaturangebots- und Versandberechtigung für quote_id erzwingen.
- Betriebsfolgen: Unberechtigter Angebotsversand; Unberechtigte Status- und Historienänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Authentifizierten Benutzer ohne Angebotsrecht ohne Versand und Mutation abweisen; Gateway-JWT separat prüfen..
- Sicherer Wiederherstellungsplan: Angebotsversand sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_43bb2ddd0aab0e94

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-knowledge-rag`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-knowledge-rag`.
- Belege: supabase/functions/ac-knowledge-rag/index.ts:9-21; supabase/functions/ac-knowledge-rag/index.ts:60; src/pages/AlixConnect/KnowledgeRag.tsx:19.
- Ursache/Prüfgrenze: Die Suche liest ohne Aufruferprüfung mit privilegiertem Client Nachrichten, Tickets und Dokumentzusammenfassungen. Quellen werden in der Antwort zurückgegeben; verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Aktive Suchberechtigung erzwingen und jede Quelle mit Benutzer-/Mandantenrechten filtern; RLS-fähigen Benutzerclient verwenden.
- Betriebsfolgen: Offenlegung privater Kommunikation und Dokumentinhalte; Unberechtigte KI-Verarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme Suche und fremde Quellen ausschließen; Berechtigung für jede Quellenart separat prüfen..
- Sicherer Wiederherstellungsplan: RAG-Suche sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_52b818a8bbb78eb6

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.social-showcase-public`; Abhängigkeiten A1, A2, A5.
- Funktionen: `social-showcase-public`, `getConfig`, `saveConfig`.
- Belege: supabase/functions/social-showcase-public/index.ts:31-48; supabase/functions/social-showcase-public/index.ts:65-93.
- Ursache/Prüfgrenze: get_config und set_config verwenden callerbestimmte client_id ohne Verwaltungsberechtigung. Der spätere Tokencheck schützt nur öffentliche Inhaltsaktionen, nicht die vorangehenden Konfigurationszweige.
- Geplante konkrete Änderung: Konfigurationsaktionen von öffentlicher Darstellung trennen und aktive Kundenverwaltungsberechtigung verlangen.
- Betriebsfolgen: Unberechtigte Konfigurationsänderung; Offenlegung beziehungsweise Rotation von Freigabetokens.
- Geplante Regressionstests, noch nicht ausgeführt: Öffentliche get_config- und set_config-Aufrufe ohne Lese- oder Schreibzugriff ablehnen; Tokenansicht separat erhalten..
- Sicherer Wiederherstellungsplan: Verwaltungsaktionen sperren, öffentliche Ansicht nur mit bestehenden gültigen Tokens erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_63fca018638248be_53993ff0

- Bewertung: im aktuellen Code geschützt (kein Deploymentnachweis); Korrekturgruppe `CG.ac-chat.cross-website-binding-fixed`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-chat`, `loadConversation`.
- Belege: supabase/functions/ac-chat/index.ts:20-24; supabase/functions/ac-chat/index.ts:180-183; supabase/functions/ac-chat/index.ts:232-235; supabase/functions/ac-chat/index.ts:254-257.
- Ursache/Prüfgrenze: Der behauptete websiteübergreifende Zugriff ist im aktuellen Code durch loadConversation eingeschränkt: conversation_id und website_id müssen gemeinsam passen. send und poll verwenden diesen Helfer. Die weiterhin fehlende Besucherbindung ist ein anderer, separat bewerteter Befund.
- Geplante konkrete Änderung: Websitebindung erhalten; zusätzlich die separat erforderliche Besucher-Capability implementieren.
- Betriebsfolgen: Behaupteter websiteübergreifender Zugriff im untersuchten Pfad blockiert; Besucherübergreifendes Restrisiko bleibt separat bestehen.
- Geplante Regressionstests, noch nicht ausgeführt: Website-A-Schlüssel mit Website-B-Konversation muss vor Nachrichtenabfrage und Insert abgewiesen werden..
- Sicherer Wiederherstellungsplan: Bei Regression send und poll sperren; Websitefilter niemals entfernen.
- Doppelmeldungsreferenz: keine.

### lov_finding_6820ef9219a29db8

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-kb-embed`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-kb-embed`.
- Belege: supabase/functions/ac-kb-embed/index.ts:12-24; supabase/functions/ac-kb-embed/index.ts:32; src/pages/AlixConnect/KnowledgeBase.tsx:71.
- Ursache/Prüfgrenze: article_id bestimmt ohne Handler-Berechtigungsprüfung den privilegierten Artikelzugriff, die Übermittlung an den Embedding-Dienst und das Speichern des Embeddings.
- Geplante konkrete Änderung: Aktive Wissensbasis-Bearbeitungsberechtigung für Artikel und Mandant vor Lesen und externer Verarbeitung prüfen.
- Betriebsfolgen: Unberechtigte externe Verarbeitung privater Artikel; Unberechtigte Embedding-Änderungen und Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Artikel und unberechtigten Benutzer ohne Embedding-Aufruf oder Update abweisen..
- Sicherer Wiederherstellungsplan: Embedding-Endpunkt sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_6cdb90a4e4b3d4f9

- Bewertung: Fehlkonfiguration; Korrekturgruppe `CG.aic-send-report`; Abhängigkeiten A1, A2, A5.
- Funktionen: `aic-send-report`, `public.has_role(text)`.
- Belege: supabase/functions/aic-send-report/index.ts:80-100; supabase/functions/aic-send-report/index.ts:105-128; supabase/migrations/20260721115832_c60f3a32-4a51-4e58-9624-19ab1ffa85ac.sql:9-19; src/pages/AIC/Berichte.tsx:30.
- Ursache/Prüfgrenze: Versand ist durch Cron-Secret oder getUser plus has_role beschränkt. Frei wählbare Empfänger sind daher nicht allein Beweis eines kritischen Relays. has_role lässt jedoch auch Admin zu und prüft keinen aktiven Kontostatus; diese Einschränkung fehlt im Handler ebenfalls.
- Geplante konkrete Änderung: Aktives Konto und ausdrücklich gewünschte Berichtsversandrolle prüfen; Empfängerfreiheit fachlich dokumentieren und gegebenenfalls begrenzen.
- Betriebsfolgen: Zu breite administrative Versandberechtigung; Berichtsversand durch nicht mehr aktive Rollenträger möglich.
- Geplante Regressionstests, noch nicht ausgeführt: Inaktive Administratoren abweisen; Admin-Vererbung und erlaubte Empfängerscopes ausdrücklich testen..
- Sicherer Wiederherstellungsplan: Manuellen Versand sperren, verifizierten Scheduler separat erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_6feae31e06a64cf3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-automation-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-automation-run`.
- Belege: supabase/functions/ac-automation-run/index.ts:13-49; supabase/functions/ac-automation-run/index.ts:64-82; supabase/functions/ac-automation-run/index.ts:121-159.
- Ursache/Prüfgrenze: Der Handler liest nach payload.event ohne Aufruferprüfung aktive Automationsregeln. Callergewählte Konversation und Mandantenwerte steuern Service-Role-Lesezugriffe, Nachrichten, Zuweisungen und Webhooks.
- Geplante konkrete Änderung: Nur verifizierte Ereignisproduzenten zulassen; Konversation und Regeln serverseitig demselben Mandanten zuordnen.
- Betriebsfolgen: Unberechtigte Nachrichten und Konversationsänderungen; Auslösen externer Webhooks und KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Gefälschten Event und widersprüchliche Mandanten-/Konversationswerte ohne Nebenwirkungen abweisen..
- Sicherer Wiederherstellungsplan: Automationsausführung pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_77810b1b4b728af7

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.public.ac_web_goals_summary-uuid-timestamptz-timestamptz`; Abhängigkeiten A1, A2, A5.
- Funktionen: `public.ac_web_goals_summary(uuid,timestamptz,timestamptz)`.
- Belege: supabase/migrations/20260720205540_12d9e922-2380-414e-81fd-03062eda49ac.sql:111-143.
- Ursache/Prüfgrenze: SECURITY DEFINER aggregiert Ziele und Umsatz für eine callergewählte Website-ID ohne interne Website- oder Mandantenberechtigung. EXECUTE für authenticated reicht dafür nicht aus.
- Geplante konkrete Änderung: Aktive Websiteberechtigung innerhalb der Funktion prüfen und Funktionsrechte auf das notwendige Minimum reduzieren.
- Betriebsfolgen: Mandantenübergreifende Offenlegung von Conversion- und Umsatzaggregaten.
- Geplante Regressionstests, noch nicht ausgeführt: Direkte RPC-Aufrufe mit fremder Website und inaktivem Konto müssen scheitern..
- Sicherer Wiederherstellungsplan: EXECUTE bis zur abgesicherten Ersatzfunktion entziehen.
- Doppelmeldungsreferenz: keine.

### lov_finding_840f31fb29294dc7

- Bewertung: Fehlkonfiguration; Korrekturgruppe `CG.sms-config-test`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sms-config-test`.
- Belege: supabase/functions/sms-config-test/index.ts:50-65; supabase/functions/sms-config-test/index.ts:87-104; src/pages/operation/SmsKonfiguration.tsx:75.
- Ursache/Prüfgrenze: Die Test-SMS-Funktion validiert Claims und verlangt Admin oder Super Admin. Eine beliebige Testnummer ist damit nicht automatisch ein kritischer offener SMS-Relay. Eine aktive Kontoprüfung fehlt jedoch vor dem administrativen Providerzugriff.
- Geplante konkrete Änderung: Aktiven Administrator und explizite SMS-Konfigurationsberechtigung prüfen; Testempfänger und Ratenlimits fachlich festlegen.
- Betriebsfolgen: Testversand durch inaktive Rollenträger; Kostenmissbrauch innerhalb zu weit gefasster Administration.
- Geplante Regressionstests, noch nicht ausgeführt: Inaktiven Administrator abweisen; erlaubten Testversand ausschließlich mit Provider-Mock und gegebenenfalls Empfänger-Allowlist prüfen..
- Sicherer Wiederherstellungsplan: Testversand deaktivieren, Statusanzeige separat schützen.
- Doppelmeldungsreferenz: keine.

### lov_finding_8703f96241dee35e_4db211d4

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sync-to-alixsmart`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sync-to-alixsmart`.
- Belege: supabase/functions/sync-to-alixsmart/index.ts:46-86; supabase/functions/sync-to-alixsmart/index.ts:134-167; src/pages/Tickets/TicketDetail.tsx:158.
- Ursache/Prüfgrenze: getUser validiert die Anmeldung. ticket_id wird danach mit privilegiertem Client ohne Ticketberechtigungsprüfung geladen und gegebenenfalls an AlixSmart synchronisiert. source_system- und external_ticket_id-Prüfungen sind nur fachliche Voraussetzungen.
- Geplante konkrete Änderung: Aktive Ticket- und Integrationsberechtigung vor Ticket-/Nachrichtenzugriff und externem Sync prüfen.
- Betriebsfolgen: Unberechtigte Übermittlung geschützter Ticketdaten; Unberechtigte Synchronisationszustände.
- Geplante Regressionstests, noch nicht ausgeführt: Fremdes synchronisierbares Ticket ohne externen Aufruf oder Logmutation ablehnen..
- Sicherer Wiederherstellungsplan: Manuellen Sync sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_951b00a22a7089dc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-workflows-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-workflows-run`.
- Belege: supabase/functions/as-workflows-run/index.ts:53-73; supabase/functions/as-workflows-run/index.ts:87-135.
- Ursache/Prüfgrenze: Ohne Handler-Aufruferprüfung werden Fälle, Checklisten und Rückrufe privilegiert bearbeitet. Der interne Versandhelper verwendet Service Role und legitimiert den ursprünglichen Aufrufer nicht.
- Geplante konkrete Änderung: Verifizierte Workflow-Jobs vor jeglichem Fallzugriff verlangen und Mandantenscope der Verarbeitung festlegen.
- Betriebsfolgen: Unberechtigte Fallverarbeitung; Erinnerungsversand und Timeline-Manipulation.
- Geplante Regressionstests, noch nicht ausgeführt: Fehlende und öffentliche Job-Zugangsdaten ohne Fallzugriff, Versand und Updates ablehnen..
- Sicherer Wiederherstellungsplan: Workflow-Scheduler pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_9e661ffc56acce39

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-chat.visitor-conversation-access`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-chat`, `loadConversation`.
- Belege: supabase/functions/ac-chat/index.ts:20-24; supabase/functions/ac-chat/index.ts:180-183; supabase/functions/ac-chat/index.ts:254-266; supabase/functions/ac-widget/index.ts:16.
- Ursache/Prüfgrenze: Die Website wird geprüft, aber poll bindet die Konversation nicht an einen authentisierten Besucher oder eine geheime Besuchercapability. Der öffentliche Widget-Schlüssel plus fremde Konversations-ID derselben Website genügt im Codepfad zum Lesen nichtinterner Nachrichten.
- Geplante konkrete Änderung: Bei start eine kryptografische konversationsgebundene Besuchercapability ausgeben und für send sowie poll verlangen.
- Betriebsfolgen: Besucherübergreifendes Lesen von Chatnachrichten; Mögliche fremde Nachrichteneinspeisung.
- Geplante Regressionstests, noch nicht ausgeführt: Zwei Besucher derselben Website müssen trotz bekannter fremder Konversations-ID strikt getrennt bleiben..
- Sicherer Wiederherstellungsplan: send und poll sperren, Websitebindung erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_a344cf8be2820684

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-journey-trigger`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-journey-trigger`.
- Belege: supabase/functions/ac-journey-trigger/index.ts:8-25.
- Ursache/Prüfgrenze: event_type und contact_id bestimmen ohne Aufruferberechtigung die Suche nach Journeys und Anlage von Journey-Läufen. Eine Prüfung vorhandener Läufe ist nur Dublettenvermeidung.
- Geplante konkrete Änderung: Verifizierte Eventproduzenten oder aktive kontaktbezogene Journey-Berechtigung verlangen; Journey und Kontakt mandantenseitig binden.
- Betriebsfolgen: Unberechtigte Journey-Einschreibung; Nachgelagerte Kundenkommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Gefälschten Event und fremden Kontakt ohne Run-Anlage abweisen..
- Sicherer Wiederherstellungsplan: Journey-Trigger sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_a6af40d2b040e4a1

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.ac-knowledge-rag`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-knowledge-rag`.
- Belege: supabase/functions/ac-knowledge-rag/index.ts:9-21; supabase/functions/ac-knowledge-rag/index.ts:60.
- Ursache/Prüfgrenze: Manuell gleicher Einstieg und dieselbe unautorisierte RAG-Suche verifiziert. Die Dokumentzusammenfassungen werden im selben Promise-basierten Suchpfad gelesen und über dieselbe Quellenantwort ausgegeben wie die bereits bewerteten privaten Kommunikationsquellen.
- Geplante konkrete Änderung: Gemeinsam mit dem Hauptbefund sämtliche Quellenarten benutzer- und mandantenbezogen autorisieren.
- Betriebsfolgen: Offenlegung von Dokumentzusammenfassungen.
- Geplante Regressionstests, noch nicht ausgeführt: Dokumentquellen mit abweichenden ACLs separat in den RAG-Berechtigungstest aufnehmen..
- Sicherer Wiederherstellungsplan: RAG-Suche sperren.
- Doppelmeldungsreferenz: lov_finding_43bb2ddd0aab0e94.

### lov_finding_ae5f39e7f20249fc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mobile-push-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mobile-push-send`.
- Belege: supabase/functions/mobile-push-send/index.ts:34-68; supabase/functions/mobile-push-send/index.ts:92-94; supabase/functions/alixsmart-reminders-cron/index.ts:99.
- Ursache/Prüfgrenze: Ohne Aufruferprüfung werden callergewählte Benutzer oder Rollen auf Push-Abonnements aufgelöst und benachrichtigt. Die Antwort enthält Zähler, nicht unmittelbar sämtliche Subscription-Daten; der unberechtigte privilegierte Zugriff und Versand bleiben bestehen.
- Geplante konkrete Änderung: Verifizierte interne Produzenten oder aktive Push-Versandberechtigung mit Empfängerscope verlangen.
- Betriebsfolgen: Unberechtigter Push-Versand; Privilegierter Zugriff auf Subscription-Zuordnungen.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte direkte Benutzer- und Rollenadressierung ohne Subscription-Abfrage oder Push ablehnen..
- Sicherer Wiederherstellungsplan: Push-Endpunkt sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_b4d04ac4e0a048bd

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-missed-call-sms`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-missed-call-sms`.
- Belege: supabase/functions/ac-missed-call-sms/index.ts:61-95; supabase/functions/ac-missed-call-sms/index.ts:106-162.
- Ursache/Prüfgrenze: call_id wird ohne Aufruferprüfung privilegiert geladen. Einstellungen, Geschäftszeiten und Cooldown begrenzen den Versand fachlich, prüfen aber nicht die Autorität des Aufrufers.
- Geplante konkrete Änderung: Nur verifizierte Telefonie-Events oder berechtigte aktive Benutzer für den konkreten Anruf zulassen.
- Betriebsfolgen: Unberechtigter SMS-Versand; Veränderung von Anruf- und Kommunikationsprotokollen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde berechtigungslos gewählte missed-call-ID trotz erfüllter Geschäftsbedingungen ohne Versand ablehnen..
- Sicherer Wiederherstellungsplan: Automatische Rückruf-SMS pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_bf2b6a2d007ce4fc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-journey-optimize`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-journey-optimize`.
- Belege: supabase/functions/ac-journey-optimize/index.ts:10-20; supabase/functions/ac-journey-optimize/index.ts:53-57; src/pages/AlixConnect/JourneyOptimizer.tsx:32.
- Ursache/Prüfgrenze: journey_id steuert ohne Benutzer- oder Mandantenprüfung privilegierte Abfragen auf Journey, Schritte und Ergebnisse. Die Daten fließen in Optimierung und Antwort; verify_jwt=false ist explizit konfiguriert.
- Geplante konkrete Änderung: Aktive Journey-Leseberechtigung und Mandantenzugehörigkeit vor Datenzugriff und KI-Verarbeitung prüfen.
- Betriebsfolgen: Offenlegung fremder Journey-Ergebnisse; Unberechtigte KI-Verarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Journey ohne Daten- und KI-Aufruf abweisen..
- Sicherer Wiederherstellungsplan: Optimierungsfunktion sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_c4bcebcef88683c2

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-email-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-email-reminder`.
- Belege: supabase/functions/as-send-email-reminder/index.ts:42-57; supabase/functions/as-send-email-reminder/index.ts:74-75; supabase/functions/as-send-email-reminder/index.ts:108.
- Ursache/Prüfgrenze: Zusätzlich zur fehlenden Fallberechtigung akzeptiert derselbe Handler recipient_email, custom_message und CTA-Werte und versendet sie mit privilegierten Versandzugangsdaten. Dieser Befund beschreibt eine eigenständige Empfänger-/Inhaltskontrolle und wird nicht allein wegen desselben Handlers als Duplikat markiert.
- Geplante konkrete Änderung: Empfänger aus autorisiertem Fall ableiten; Übersteuerung und freie Inhalte separat berechtigen, validieren und protokollieren.
- Betriebsfolgen: Weitergabe von Falldaten an fremde Empfänger; Missbrauch geschäftlicher E-Mails.
- Geplante Regressionstests, noch nicht ausgeführt: Berechtigten Fallzugriff mit unberechtigter Empfänger- oder CTA-Übersteuerung ohne Versand ablehnen..
- Sicherer Wiederherstellungsplan: Freie Empfänger- und Inhaltsübersteuerung deaktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_d0449b3fd945f992

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.maintenance-reminder-daily`; Abhängigkeiten A1, A2, A5.
- Funktionen: `maintenance-reminder-daily`.
- Belege: supabase/functions/maintenance-reminder-daily/index.ts:15-27; supabase/functions/maintenance-reminder-daily/index.ts:76-91; src/pages/Wartungsmanagement.tsx:149.
- Ursache/Prüfgrenze: Der Handler startet ohne Aufruferprüfung bereits eine Statusaktualisierungs-RPC und lädt anschließend Wartungsdaten für Erinnerungen. Protokoll- und Wartungsänderungen sind erreichbar.
- Geplante konkrete Änderung: Verifizierte Job-Berechtigung vor der ersten RPC und sämtlichen Wartungszugriffen verlangen.
- Betriebsfolgen: Unberechtigter Wartungserinnerungsversand; Veränderung von Wartungs- und Erinnerungsständen.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten Aufruf bereits vor refresh_warranty_and_maintenance_status und Versand abweisen..
- Sicherer Wiederherstellungsplan: Tagesjob pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_d51da742f6515a44

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-review-invitation`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-review-invitation`.
- Belege: supabase/functions/send-review-invitation/index.ts:22-63; supabase/functions/send-review-invitation/index.ts:102-155; supabase/functions/send-review-invitation/index.ts:211.
- Ursache/Prüfgrenze: Claims werden validiert; die zusätzliche Rollenprüfung gilt nur dem manuellen Sonderpfad. Der reguläre Pfad lädt eine callergewählte Bestellung privilegiert, erstellt beziehungsweise verwendet Bewertungsdaten und kann review_url zurückgeben, ohne Bestellberechtigung zu prüfen.
- Geplante konkrete Änderung: Aktive Bestell- und Einladungsberechtigung auf allen Pfaden erzwingen; Bewertungstoken nicht unnötig an Aufrufer zurückgeben.
- Betriebsfolgen: Unberechtigter Zugriff auf Bewertungscapabilities; Unberechtigter Einladungsversand.
- Geplante Regressionstests, noch nicht ausgeführt: Regulären und manuellen Pfad mit fremder Bestellung ohne Tokenrückgabe oder Versand ablehnen..
- Sicherer Wiederherstellungsplan: Einladungsfunktion sperren und gegebenenfalls betroffene Tokens separat widerrufen.
- Doppelmeldungsreferenz: keine.

### lov_finding_df054ee0d6a3c45f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-voicemail-transcribe`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-voicemail-transcribe`.
- Belege: supabase/functions/ac-voicemail-transcribe/index.ts:5-20; supabase/functions/ac-voicemail-transcribe/index.ts:32-52; src/pages/AlixConnect/Telephony.tsx:220.
- Ursache/Prüfgrenze: call_id steuert ohne Handler-Berechtigungsprüfung den privilegierten Zugriff auf die Voicemail-URL, Audioabruf, Transkription und Rückgabe des Texts.
- Geplante konkrete Änderung: Aktive anrufbezogene Hör- und Transkriptionsberechtigung vor Metadaten-, Audio- und KI-Zugriff verlangen.
- Betriebsfolgen: Offenlegung fremder Voicemails; Unberechtigte externe Audioverarbeitung und Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Anruf ohne Audioabruf, Statusupdate oder Transkriptionsaufruf abweisen..
- Sicherer Wiederherstellungsplan: Voicemail-Transkription sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_e41206eaf4d35d0e

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.social-showcase-public`; Abhängigkeiten A1, A2, A5.
- Funktionen: `social-showcase-public`, `saveConfig`.
- Belege: supabase/functions/social-showcase-public/index.ts:44-48; supabase/functions/social-showcase-public/index.ts:65-86.
- Ursache/Prüfgrenze: Manuell derselbe ungeschützte set_config-Zweig und dieselbe app_settings-Schreiboperation wie beim Hauptbefund verifiziert. Die Aktivierung einer fremden Showcase ist eine konkrete Wirkung derselben fehlenden Verwaltungsautorisierung.
- Geplante konkrete Änderung: Gemeinsam mit dem Hauptbefund aktive clientbezogene Verwaltungsberechtigung vor set_config erzwingen.
- Betriebsfolgen: Unberechtigte Veröffentlichung einer fremden Showcase.
- Geplante Regressionstests, noch nicht ausgeführt: Aktivierung fremder client_id ohne Konfigurationsmutation abweisen..
- Sicherer Wiederherstellungsplan: Öffentliche Konfigurationsänderungen sperren.
- Doppelmeldungsreferenz: lov_finding_52b818a8bbb78eb6.

### lov_finding_e9436bf2ec03c48f_41eebedc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-repair-quote`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-repair-quote`.
- Belege: supabase/functions/send-repair-quote/index.ts:14-21; supabase/functions/send-repair-quote/index.ts:68-72; src/pages/Reparatur/QuoteDetail.tsx:144.
- Ursache/Prüfgrenze: Der unzureichend autorisierte Angebotsversand gibt zusätzlich den approvalLink direkt zurück. Diese Capability-Offenlegung ist über reinen Versandmissbrauch hinaus relevant und wird deshalb nicht automatisch als Duplikat eingestuft. Gateway-JWT allein schützt das gewählte Angebot nicht.
- Geplante konkrete Änderung: Aktive Angebotsberechtigung prüfen und Freigabecapability aus Standardantwort und unnötigen Protokollen entfernen.
- Betriebsfolgen: Offenlegung fremder Angebotsfreigabelinks; Möglicher Missbrauch der damit verbundenen Freigaberechte.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigter Benutzer darf weder Link noch tokenhaltige Historie erhalten; nachgelagerte Freigaberechte separat prüfen..
- Sicherer Wiederherstellungsplan: Endpunkt sperren; kompromittierte Freigabetokens nur kontrolliert rotieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_ec3de0a630ccb72f_3f6f0b90

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-ai-assist`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-ai-assist`.
- Belege: supabase/functions/ticket-ai-assist/index.ts:18-45; supabase/functions/ticket-ai-assist/index.ts:62-71.
- Ursache/Prüfgrenze: getUser validiert nur die Identität. Derselbe Service-Role-Client liest anschließend frei gewähltes Ticket und interne Nachrichten ohne Ticket- oder Mandantenberechtigung; ähnliche Tickets werden ebenfalls privilegiert durchsucht.
- Geplante konkrete Änderung: Aktive Ticketberechtigung vor Primär- und Ähnlichkeitssuche erzwingen; nur berechtigte Nachrichten an KI übermitteln.
- Betriebsfolgen: Unberechtigte Verarbeitung fremder Tickets und interner Notizen; Mögliche Offenlegung über KI-Ausgaben.
- Geplante Regressionstests, noch nicht ausgeführt: Fremdes Primärticket und unberechtigte ähnliche Tickets vor KI-Verarbeitung ausschließen..
- Sicherer Wiederherstellungsplan: Ticket-KI-Anreicherung sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_f04bfe8a3011dee3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-voice-ai-studio`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-voice-ai-studio`.
- Belege: supabase/functions/ac-voice-ai-studio/index.ts:9-18; supabase/functions/ac-voice-ai-studio/index.ts:41-50.
- Ursache/Prüfgrenze: Der Handler liest callergewählte Kontaktdaten ohne Aufruferprüfung und verwendet diese in der KI-Verarbeitung. Die resultierende Antwort beziehungsweise Prediction kann daraus abgeleitete private Angaben enthalten; ein vollständiger Rohdatenexport ist nicht nachgewiesen.
- Geplante konkrete Änderung: Aktive kontaktbezogene Voice-AI-Berechtigung und Mandantenbindung vor Kontaktzugriff und KI-Aufruf verlangen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kontaktdaten; Unberechtigte KI-Kosten und Predictions.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden contact_id ohne Kontaktabfrage, KI-Aufruf und Prediction-Anlage abweisen..
- Sicherer Wiederherstellungsplan: Kontaktbasierte Voice-AI-Verarbeitung sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_0cd00d4445ad701e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-sms-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-sms-reminder`.
- Belege: supabase/functions/as-send-sms-reminder/index.ts:63-91; supabase/functions/as-send-sms-reminder/index.ts:98-123.
- Ursache/Prüfgrenze: Benutzer werden authentifiziert, der ausgewählte After-Sales-Fall aber ausschließlich über case_id privilegiert geladen. Weder Team- noch Mandantenberechtigung wird geprüft. Anschließend werden SMS und dauerhafte Erinnerungs-/Timeline-Einträge erzeugt.
- Geplante konkrete Änderung: Schreib- und Kommunikationsberechtigung auf den konkreten Fall prüfen; maschinelle Identität exakt statt per includes vergleichen.
- Betriebsfolgen: Fremde Fälle verändern; Kostenpflichtiger SMS-Versand; Verfälschte Fallhistorie.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde case_id mit gültigem Benutzer ablehnen; berechtigten Fall zulassen; keine Nebenwirkungen bei Ablehnung..
- Sicherer Wiederherstellungsplan: SMS-Funktion sperren und fehlerhafte Historieneinträge nachvollziehbar korrigieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_16d3e37b9c8ba4ad

- Bewertung: ungeklärt; Korrekturgruppe `CG.public.ac_web_funnel_stats`; Abhängigkeiten A1, A2, A5.
- Funktionen: `public.ac_web_funnel_stats`.
- Belege: supabase/migrations/20260720211642_0d5010b4-1c33-4de4-a985-051f29bfb91d.sql:107.
- Ursache/Prüfgrenze: Die aktuelle SQL-Definition einschließlich späterer Ersetzungen, EXECUTE-Grants und Website-Berechtigungsabhängigkeiten wurde nicht vollständig gelesen. Der Fundstellenhinweis allein beweist den aktuellen SECURITY-DEFINER-Zugriff nicht.
- Geplante konkrete Änderung: Aktuell wirksame Funktionsdefinition und Grants rekonstruieren; danach Websiteberechtigung innerhalb der Funktion erzwingen, falls sie fehlt.
- Betriebsfolgen: Potenzielle Offenlegung fremder Websiteanalytik.
- Geplante Regressionstests, noch nicht ausgeführt: Aufruf mit fremder funnel_id; Prüfung späterer Migrationen und Rollenrechte..
- Sicherer Wiederherstellungsplan: EXECUTE für unberechtigte Rollen entziehen, falls der Verdacht bestätigt wird.
- Doppelmeldungsreferenz: keine.

### lov_finding_193e452aa8130a17

- Bewertung: ungeklärt; Korrekturgruppe `CG.announce-capa-cockpit`; Abhängigkeiten A1, A2, A5.
- Funktionen: `announce-capa-cockpit`, `send-transactional-email`.
- Belege: supabase/functions/send-transactional-email/index.ts:376-391.
- Ursache/Prüfgrenze: Der aktuelle Ankündigungs-Einstieg und seine vollständige Autorisierungskette zum transaktionalen Mailversand wurden nicht abschließend gelesen. Der behauptete feste Trigger darf nicht ohne aktuelle Prüfung als wirksame Authentifizierung oder bestätigte Lücke bewertet werden.
- Geplante konkrete Änderung: Triggerprüfung und Aufrufer vollständig prüfen; gegebenenfalls festen Trigger durch verifizierte Job- oder Administratoridentität ersetzen.
- Betriebsfolgen: Potenzieller Massenversand an Beschäftigte.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme und unberechtigte Trigger ablehnen; berechtigten Versand ohne reale Zustellung simulieren..
- Sicherer Wiederherstellungsplan: Ankündigungsjob deaktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_1faf96e95ce2b494

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-portal-invite`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-portal-invite`.
- Belege: supabase/functions/cmr-portal-invite/index.ts:26-56; supabase/functions/cmr-portal-invite/index.ts:69-85.
- Ursache/Prüfgrenze: CMR-Rolle wird geprüft, aber der per tokenId gewählte Portalzugang wird ohne Benutzer-Mandantenabgleich privilegiert geladen. Anschließend wird sein customer_email auf die gewählte Zieladresse geändert.
- Geplante konkrete Änderung: Berechtigung auf tok.tenant_id und den konkreten Kunden prüfen; Empfängeränderungen gesondert autorisieren.
- Betriebsfolgen: Mandantenfremder Einladungsversand; Änderung fremder Portal-Kontaktadresse.
- Geplante Regressionstests, noch nicht ausgeführt: CMR-Benutzer aus A mit tokenId aus B ablehnen; keine E-Mail oder Adressänderung..
- Sicherer Wiederherstellungsplan: Einladungsversand sperren; unberechtigte Kontaktänderungen nachvollziehbar zurücksetzen.
- Doppelmeldungsreferenz: keine.

### lov_finding_217a6dfc717596f3_f43be5ff

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-conv-intel-analyze`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-conv-intel-analyze`.
- Belege: supabase/functions/ac-conv-intel-analyze/index.ts:11-20.
- Ursache/Prüfgrenze: call_id wird ohne Authentifizierung verarbeitet. Der Service-Role-Client liest das zugehörige private Transkript ausschließlich anhand der übergebenen ID.
- Geplante konkrete Änderung: Identität, Analyseberechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff und KI-Verarbeitung prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Gesprächstranskripte.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und mandantenfremden call_id-Zugriff ablehnen; KI-Aufruf darf dabei nicht erfolgen..
- Sicherer Wiederherstellungsplan: Analyseendpunkt sperren; unberechtigt erzeugte Analysen überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_2989a7a085c7a5ca_43adb61f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.dispatch-eta-sms`; Abhängigkeiten A1, A2, A5.
- Funktionen: `dispatch-eta-sms`.
- Belege: supabase/functions/dispatch-eta-sms/index.ts:42-64; supabase/functions/dispatch-eta-sms/index.ts:100-107.
- Ursache/Prüfgrenze: getUser prüft nur die Identität. route_plan_id wird anschließend per Service Role ohne Dispositionsrolle, Mitarbeiterzuordnung oder Mandantenscope gelesen und die hinterlegte Telefonnummer für den SMS-Versand verwendet.
- Geplante konkrete Änderung: Dispositionsberechtigung auf den konkreten Einsatz vor Zugriff und Versand prüfen.
- Betriebsfolgen: Unberechtigte Kunden-SMS; Missbrauch kostenpflichtiger Kommunikationsdienste.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden route_plan_id trotz gültigem Login ablehnen; berechtigte Disposition zulassen..
- Sicherer Wiederherstellungsplan: ETA-SMS deaktivieren; bereits gesendete Nachrichten sind nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_3f531b21758d8b2f

- Bewertung: ungeklärt; Korrekturgruppe `CG.send-mail`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-mail`.
- Belege: supabase/functions/send-mail/index.ts:146-148.
- Ursache/Prüfgrenze: Der aktuelle Code enthält mindestens objektbezogene Prüfungen für order_id und customer_id. Die vollständige Mailberechtigung, alle alternativen Versandpfade und die Produktanforderung für freie Korrespondenz wurden nicht gelesen. Frei wählbare Empfänger allein beweisen bei einem berechtigten Mailclient keine kritische Lücke.
- Geplante konkrete Änderung: Mailrolle, Absenderrechte, Objektpfade und zulässige freie Korrespondenz vollständig abgleichen; nur tatsächlich fehlende Grenzen ergänzen.
- Betriebsfolgen: Potenzieller Mailmissbrauch; legitime freie Korrespondenz möglich.
- Geplante Regressionstests, noch nicht ausgeführt: Benutzer ohne Mailrecht; fremder Auftrag; zulässige freie Korrespondenz; unzulässiger Absender..
- Sicherer Wiederherstellungsplan: Nur betroffenen Versandpfad sperren; legitime Mailfunktion nicht pauschal entfernen.
- Doppelmeldungsreferenz: keine.

### lov_finding_43edd4e59b516cae

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-agent-assist-live`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-agent-assist-live`.
- Belege: supabase/functions/ac-agent-assist-live/index.ts:11-24; supabase/functions/ac-agent-assist-live/index.ts:36-66.
- Ursache/Prüfgrenze: conversation_id wird ohne Identitätsprüfung angenommen. Konversation und letzte Nachrichten werden privilegiert geladen und an die KI gegeben. agent_user_id ist ebenfalls frei vorgebbar und steuert das Speichern von Vorschlägen.
- Geplante konkrete Änderung: Konversationszugriff und Agentenrolle prüfen; agent_user_id aus der verifizierten Identität ableiten.
- Betriebsfolgen: Verarbeitung fremder Chatnachrichten; KI-Kosten; Fremde Vorschlagseinträge.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme und fremde Konversation ablehnen; Identitäts-Spoofing über agent_user_id verhindern..
- Sicherer Wiederherstellungsplan: Assistenzendpunkt sperren; fremd erzeugte Vorschläge überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_4e8e8f0051d29984

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-calendar-sync`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-calendar-sync`, `pushToGoogle`, `pushToMicrosoft`.
- Belege: supabase/functions/esc-calendar-sync/index.ts:62-97; supabase/functions/esc-calendar-sync/index.ts:100-104.
- Ursache/Prüfgrenze: Der Kalendersync nimmt user_id ohne Identitätsprüfung entgegen. Die Providerfunktionen schreiben externe Kalenderereignisse mit gespeicherten OAuth-Berechtigungen; die Benutzer-ID im Request ist kein Berechtigungsnachweis.
- Geplante konkrete Änderung: Eigene Kalenderidentität oder explizite administrative Jobberechtigung prüfen; Auswahl fremder Benutzer serverseitig begrenzen.
- Betriebsfolgen: Unberechtigte Auslösung externer Kalenderänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Aufruf und fremde user_id ablehnen; eigenen beziehungsweise administrativen Sync zulassen..
- Sicherer Wiederherstellungsplan: Kalendersync stoppen; erzeugte Providerereignisse anhand ihrer Referenzen abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5353120018933fbe

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.offers-ai-score`; Abhängigkeiten A1, A2, A5.
- Funktionen: `offers-ai-score`.
- Belege: supabase/functions/offers-ai-score/index.ts:25-59.
- Ursache/Prüfgrenze: Nach getUser werden bis zu 25 frei gewählte Angebots-IDs direkt mit Service Role gelesen. Eine Angebots-, Vertriebs- oder Mandantenberechtigung fehlt vor der KI-Verarbeitung. Der spätere Score-Schreibpfad wurde nicht vollständig gelesen.
- Geplante konkrete Änderung: Alle Angebots-IDs gegen den autorisierten Scope prüfen und nicht autorisierte Stapel vollständig ablehnen.
- Betriebsfolgen: Unberechtigte Verarbeitung fremder Angebotsdaten; KI-Kosten; Scoreänderungen zusätzlich verifizieren.
- Geplante Regressionstests, noch nicht ausgeführt: Gemischten Stapel aus eigenen und fremden IDs ohne Teilverarbeitung ablehnen..
- Sicherer Wiederherstellungsplan: Scoring sperren; betroffene Scores aus gesicherter Historie wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5e9ccda6a9cfe1b0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.cmr-portal-invite`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-portal-invite`.
- Belege: supabase/functions/cmr-portal-invite/index.ts:31-54; supabase/functions/cmr-portal-invite/index.ts:60-85.
- Ursache/Prüfgrenze: Nach globaler CMR-Rollenprüfung werden to und portalUrl unverändert aus dem Request verwendet. Zusätzlich wird die hinterlegte Portal-Kundenadresse auf to geändert. Es fehlt eine konkrete Empfänger- und Änderungsberechtigung.
- Geplante konkrete Änderung: Empfänger aus autorisiertem Kundenkontakt ableiten; URL serverseitig erzeugen; Kontaktänderungen getrennt berechtigen.
- Betriebsfolgen: Missbrauch von Portal-Einladungen; Unberechtigte Kontaktänderung; Phishing über vorgegebene URL.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Empfängeradresse und externe portalUrl ablehnen..
- Sicherer Wiederherstellungsplan: Einladungen stoppen; geänderte Kontaktadressen und versendete Links überprüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_62db31108e6e90e3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-voice-ai-studio`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-voice-ai-studio`.
- Belege: supabase/functions/ac-voice-ai-studio/index.ts:9-30; supabase/functions/ac-voice-ai-studio/index.ts:41-50.
- Ursache/Prüfgrenze: Der Handler verarbeitet objective ohne Aufruferprüfung und ruft den kostenpflichtigen KI-Dienst auf. Bei contact_id liest er zusätzlich Name, E-Mail, Telefon und Tags per Service Role.
- Geplante konkrete Änderung: Voice-Studio-Berechtigung, Kontaktzugriff und benutzerbezogene Quoten vor KI-Aufruf prüfen.
- Betriebsfolgen: Unberechtigte KI-Kosten; Verarbeitung fremder Kontaktdaten; Unberechtigte Prediction-Einträge.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Aufruf und fremden Kontakt ablehnen; Quoten und berechtigte Nutzung prüfen..
- Sicherer Wiederherstellungsplan: Studio deaktivieren; unberechtigt erzeugte Predictions prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_6cf979d98c0592e9

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-customer-intel`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-customer-intel`.
- Belege: supabase/functions/ac-customer-intel/index.ts:10-32.
- Ursache/Prüfgrenze: contact_id wird ohne Authentifizierung angenommen. Kontakt, Nachrichten und Anrufe werden privilegiert geladen und als KI-Kontext übertragen.
- Geplante konkrete Änderung: Intelligence-Rolle und konkrete Kontakt-/Mandantenberechtigung vor Datenzugriff prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kundenkommunikation; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme und fremde contact_id vor sämtlichen Abfragen ablehnen..
- Sicherer Wiederherstellungsplan: Intelligence-Endpunkt sperren; erzeugte Analysen prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_7845d0d7721ae86a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mobile-push-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mobile-push-send`.
- Belege: supabase/functions/mobile-push-send/index.ts:34-74.
- Ursache/Prüfgrenze: Der Handler prüft nur VAPID-Konfiguration und Eingabeformat. Frei gewählte user_ids beziehungsweise role bestimmen privilegiert geladene Push-Abonnements; eine Aufrufer- oder Empfängerberechtigung fehlt.
- Geplante konkrete Änderung: Push-Senderrolle und erlaubten Empfängerscope vor Abonnementzugriff und Versand prüfen.
- Betriebsfolgen: Unberechtigte Push-Nachrichten an ausgewählte Beschäftigte.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und fachfremden Versand sowie fremden Empfängerscope ablehnen..
- Sicherer Wiederherstellungsplan: Push-Versand sperren; bereits zugestellte Push-Nachrichten sind nicht zuverlässig rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_80694480687b8731

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-sync-alert`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-sync-alert`.
- Belege: supabase/functions/ticket-sync-alert/index.ts:11-16; supabase/functions/ticket-sync-alert/index.ts:47-60.
- Ursache/Prüfgrenze: Der Alarmhandler startet unmittelbar mit Service Role und übernimmt eine optionale lookback_minutes-Auswahl ohne Identitätsprüfung. Ein konfigurierter Empfänger und Cooldown begrenzen Auswirkungen, ersetzen aber keine Jobberechtigung.
- Geplante konkrete Änderung: Verifizierte Job- oder administrative Syncberechtigung vor Logzugriff verlangen; Lookback begrenzen.
- Betriebsfolgen: Unberechtigte Auslösung interner Ticketalarmverarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Start ablehnen; berechtigten Job und begrenztes Lookback prüfen..
- Sicherer Wiederherstellungsplan: Alarmjob deaktivieren; Cooldown-Zustände gezielt prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_8703f96241dee35e_aec296a4

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sync-to-alixsmart`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sync-to-alixsmart`.
- Belege: supabase/functions/sync-to-alixsmart/index.ts:46-90.
- Ursache/Prüfgrenze: Der Handler authentifiziert den Benutzer, lädt ticket_id aber anschließend ohne Objektberechtigung mit Service Role. source_system=alixsmart ist lediglich eine fachliche Herkunftsprüfung. Eine optionale message_id wird außerdem unabhängig von ticket_id gelesen.
- Geplante konkrete Änderung: Syncberechtigung auf das konkrete Ticket prüfen; message_id zwingend an dasselbe autorisierte Ticket binden.
- Betriebsfolgen: Unberechtigte Verarbeitung fremder Tickets; Mögliche ticketübergreifende Nachrichtenübernahme.
- Geplante Regressionstests, noch nicht ausgeführt: Fremdes Ticket und Nachricht aus anderem Ticket ablehnen..
- Sicherer Wiederherstellungsplan: Externen Sync sperren; betroffene externe Übertragungen abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_89bba568925256f2_166f7873

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-playbook-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-playbook-run`, `runAction`.
- Belege: supabase/functions/ac-playbook-run/index.ts:19-54; supabase/functions/ac-playbook-run/index.ts:82-109.
- Ursache/Prüfgrenze: Der Einstieg prüft keine Identität und übernimmt playbook_id sowie customer_id nur als Filter. Aktive Playbooks und Kunden-Health-Daten werden privilegiert geladen; runAction kann unmittelbar E-Mail, SMS und WhatsApp auslösen.
- Geplante konkrete Änderung: Verifizierte Jobidentität oder administrative Playbookberechtigung mit Kundenscope verlangen.
- Betriebsfolgen: Unberechtigte Automationsausführung; Externe Kundenkommunikation; Verarbeitung geschützter Kundendaten.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Start und fremde customer_id ablehnen; externe Dienste nur mocken..
- Sicherer Wiederherstellungsplan: Playbookjob deaktivieren; erzeugte Aktionen anhand der Laufprotokolle abgleichen.
- Doppelmeldungsreferenz: keine.

### lov_finding_8ac8ea7d48393f28

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-journey-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-journey-run`, `loadContact`, `runAction`.
- Belege: supabase/functions/ac-journey-run/index.ts:29-31; supabase/functions/ac-journey-run/index.ts:50-85.
- Ursache/Prüfgrenze: Kontaktladung und externe Journey-Aktionen wurden gelesen, der konkrete Einschreibungs-Einstieg jedoch nicht abschließend. Die behauptete unberechtigte Anlage eines Journey-Runs ist deshalb nicht vollständig belegt.
- Geplante konkrete Änderung: Einschreibungs- und Tick-Einstiege einschließlich Jobauthentifizierung, Kontakt- und Journeyberechtigung vollständig prüfen.
- Betriebsfolgen: Potenzielle unberechtigte Einschreibung und Kundenkommunikation.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme Einschreibung und fremden Kontakt ablehnen; berechtigten Tick simulieren..
- Sicherer Wiederherstellungsplan: Journey-Ausführung pausieren; fremde Runs gezielt abbrechen.
- Doppelmeldungsreferenz: keine.

### lov_finding_a7401cb3c80f2da9

- Bewertung: ungeklärt; Korrekturgruppe `CG.mobile-voice-transcribe`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mobile-voice-transcribe`.
- Belege: supabase/functions/mobile-voice-transcribe/index.ts:19-26; supabase/functions/mobile-voice-transcribe/index.ts:49-52.
- Ursache/Prüfgrenze: Der Client wird zwar mit Service-Key erzeugt, erhält aber den Benutzer-Authorization-Header als globalen Header. Deshalb darf ein RLS-Bypass nicht allein aus dem Schlüssel abgeleitet werden. Der Insert in ticket_messages wurde gelesen; die tatsächlich wirksamen INSERT-Policies und Ticketzuordnungen wurden nicht vollständig geprüft.
- Geplante konkrete Änderung: Wirksame Benutzeridentität und ticket_messages-INSERT-Policies prüfen; falls nötig explizite Ticket-Schreibberechtigung vor Transkription und Insert ergänzen.
- Betriebsfolgen: Potenzielles Schreiben interner Notizen in fremde Tickets.
- Geplante Regressionstests, noch nicht ausgeführt: Mit Benutzer-JWT Insert auf fremdes Ticket unter den aktuellen RLS-Policies prüfen..
- Sicherer Wiederherstellungsplan: Optionales Schreiben von Ticketnotizen deaktivieren; Transkription separat behandeln.
- Doppelmeldungsreferenz: keine.

### lov_finding_aca0bf1eb36bddcc

- Bewertung: ungeklärt; Korrekturgruppe `CG.send-review-invitation`; Abhängigkeiten A1, A2, A5.
- Funktionen: `send-review-invitation`.
- Belege: supabase/functions/send-review-invitation/index.ts:22-69.
- Ursache/Prüfgrenze: Der normale Pfad prüft nur Claims und lädt fremd wählbare order_id mit Service Role. manual=true verlangt zwar Super Admin, manual=false jedoch nicht. Der spätere Pfad zur Rückgabe eines vorhandenen Reviewtokens wurde nicht abschließend gelesen.
- Geplante konkrete Änderung: Auftragsberechtigung unabhängig von manual prüfen; vorhandene Tokens niemals ohne dieselbe Objektberechtigung zurückgeben.
- Betriebsfolgen: Bestätigter ungeschützter Objektzugriff nach Login; Behauptete Reviewtoken-Offenlegung noch offen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde order_id mit manual=false und true sowie vorhandenen Revieweintrag prüfen..
- Sicherer Wiederherstellungsplan: Einladungsfunktion sperren; betroffene Reviewtokens gegebenenfalls rotieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_ba12e323f71e0fa4

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.return-note-send`; Abhängigkeiten A1, A2, A5.
- Funktionen: `return-note-send`.
- Belege: supabase/functions/return-note-send/index.ts:41-58.
- Ursache/Prüfgrenze: Nach getUser wird return_id ohne Objekt- oder Mandantenprüfung mit Service Role geladen. Die Zieladresse stammt frei aus body.email; die Syntaxprüfung ersetzt keine Berechtigung auf die Retourendaten.
- Geplante konkrete Änderung: Retourenberechtigung auf den konkreten Datensatz prüfen und Empfängeroverrides explizit autorisieren.
- Betriebsfolgen: Unberechtigte Verarbeitung fremder Retourendaten; Potenzieller Versand an fremde Adressen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde return_id und nicht autorisierte Zieladresse ablehnen..
- Sicherer Wiederherstellungsplan: Retourenversand deaktivieren; bereits gesendete Inhalte sind nicht rückholbar.
- Doppelmeldungsreferenz: keine.

### lov_finding_bb420b3953e6ab20

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-health-score`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-health-score`.
- Belege: supabase/functions/ac-health-score/index.ts:17-34.
- Ursache/Prüfgrenze: Der Scoringhandler nimmt ohne Identitätsprüfung einen Lauf entgegen und lädt Kunden, Aufträge, offene Rechnungen, Nachrichten und Kontaktsignale mit Service Role. Der Zugriff wird lediglich mengenmäßig begrenzt, nicht autorisiert.
- Geplante konkrete Änderung: Verifizierte Jobberechtigung oder Health-Scoringrolle mit Mandantenscope verlangen.
- Betriebsfolgen: Unberechtigte Verarbeitung mandantenübergreifender Kundensignale.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Start vor der ersten Abfrage ablehnen; berechtigten Lauf auf Mandantentrennung prüfen..
- Sicherer Wiederherstellungsplan: Scoringjob sperren; erzeugte Scores bei Bedarf neu berechnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_cc69b9a46e5b7c7e

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.ac-playbook-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-playbook-run`, `runAction`.
- Belege: supabase/functions/ac-playbook-run/index.ts:19-54; supabase/functions/ac-playbook-run/index.ts:82-109.
- Ursache/Prüfgrenze: Beide Befunde betreffen denselben nicht authentifizierten Deno.serve-Einstieg, dieselbe Auswahl aktiver Playbooks und dieselbe runAction-Ausführung für Kundendaten.
- Geplante konkrete Änderung: Gemeinsam mit dem Primärbefund Job- und Kundenscope-Autorisierung ergänzen.
- Betriebsfolgen: Dieselbe unberechtigte Playbook- und Kommunikationsausführung.
- Geplante Regressionstests, noch nicht ausgeführt: Gemeinsame Negativtests für anonymen Start und fremde Kunden..
- Sicherer Wiederherstellungsplan: Playbookjob deaktivieren.
- Doppelmeldungsreferenz: lov_finding_89bba568925256f2_166f7873.

### lov_finding_d30e657eadd449e2

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-conv-intel-analyze`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-conv-intel-analyze`.
- Belege: supabase/functions/ac-conv-intel-analyze/index.ts:11-20.
- Ursache/Prüfgrenze: Der konkrete Transkriptzugriff erfolgt mit Service Role allein anhand der vom Request gelieferten call_id. Davor gibt es weder Identitäts- noch Anrufberechtigungsprüfung.
- Geplante konkrete Änderung: Analyse- und Anrufberechtigung vor Transkriptzugriff erzwingen; zugehörigen KI-Pfad mit derselben Prüfung schützen.
- Betriebsfolgen: Unberechtigte Nutzung gespeicherter Gesprächstranskripte.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und fremden call_id-Zugriff vor Abfrage und KI-Verarbeitung ablehnen..
- Sicherer Wiederherstellungsplan: Gesprächsanalyse sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_d56fcb31625300b3

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-call-ai-process`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-call-ai-process`, `transcribe`, `analyze`.
- Belege: supabase/functions/ac-call-ai-process/index.ts:12-37.
- Ursache/Prüfgrenze: Die Hilfsfunktionen für Audioabruf, Transkription und KI-Analyse wurden gelesen. Der eigentliche Request-Einstieg und die Rückgabe privater Transkripte wurden nicht abschließend ausgewertet.
- Geplante konkrete Änderung: Request-Einstieg, Anrufautorisierung, Recording-URL-Herkunft und Rückgabedaten vollständig prüfen.
- Betriebsfolgen: Potenzielle Offenlegung oder unberechtigte Verarbeitung privater Transkripte.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und fremden Anrufzugriff prüfen; Audio- und KI-Dienste mocken..
- Sicherer Wiederherstellungsplan: Transkriptionsendpunkt sperren, falls fehlende Anrufberechtigung bestätigt wird.
- Doppelmeldungsreferenz: keine.

### lov_finding_d788ed2671203a5e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.as-send-sms-reminder`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-send-sms-reminder`.
- Belege: supabase/functions/as-send-sms-reminder/index.ts:63-91; supabase/functions/as-send-sms-reminder/index.ts:98-102.
- Ursache/Prüfgrenze: Der authentifizierte Benutzer wird nicht mit dem per case_id geladenen After-Sales-Fall abgeglichen. recipient_phone und custom_text sind zusätzlich frei vorgebbar; der Kundenname aus dem fremden Fall wird in die Nachricht eingesetzt.
- Geplante konkrete Änderung: Team- und Mandantenzugriff auf den Fall sowie Berechtigung für Empfänger- und Textoverride prüfen.
- Betriebsfolgen: Offenlegung fremder Falldetails per SMS; Unberechtigter SMS-Versand.
- Geplante Regressionstests, noch nicht ausgeführt: Fremden Teamfall und externe recipient_phone ohne Override-Recht ablehnen..
- Sicherer Wiederherstellungsplan: SMS-Versand sperren; Kommunikationshistorie prüfen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e0f5db0abd0fbc9a

- Bewertung: ungeklärt; Korrekturgruppe `CG.cmr-portal-invite`; Abhängigkeiten A1, A2, A5.
- Funktionen: `cmr-portal-invite`.
- Belege: supabase/functions/cmr-portal-invite/index.ts:38-64; supabase/functions/cmr-portal-invite/index.ts:85.
- Ursache/Prüfgrenze: Die fehlende Tokenzeilen-/Mandantenprüfung ist bestätigt. Die spezifische Behauptung, der Handler lese und versende selbst den geheimen Portalzugangstoken, trifft im gelesenen Code jedoch nicht unmittelbar zu: Der versendete Link stammt aus body.portalUrl. Der Aufruferpfad, der diesen Link erzeugt oder offenlegt, wurde nicht geprüft.
- Geplante konkrete Änderung: Linkerzeugung und Tokenzugriff beim Aufrufer prüfen; Portal-URL serverseitig aus einem autorisierten Token erzeugen.
- Betriebsfolgen: Bestätigter unberechtigter Einladungs-/Kontaktänderungspfad; Spezifischer Tokenabfluss noch nicht bewiesen.
- Geplante Regressionstests, noch nicht ausgeführt: Nachweisen, ob ein Benutzer den fremden Portal-Link erhalten kann; fremde tokenId unabhängig davon ablehnen..
- Sicherer Wiederherstellungsplan: Portal-Einladungen sperren; nachweislich offengelegte Tokens rotieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_ef43972ba6ab93b7_47ca5b03

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-outreach-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-outreach-engine`.
- Belege: supabase/functions/ac-outreach-engine/index.ts:1-91; supabase/functions/_shared/job-auth.ts:12-37.
- Ursache/Prüfgrenze: Der aktuelle Outreach-Einstieg und die tatsächliche administrative Queue-Autorisierung wurden nicht abschließend gelesen. Vorhandene gemeinsame Jobauthentifizierung darf nicht ohne Prüfung ihres konkreten Call-Sites als wirksam angenommen werden.
- Geplante konkrete Änderung: Konkreten requireJobAccess-Aufruf beziehungsweise dessen Fehlen sowie Queueauswahl und Versandkette prüfen.
- Betriebsfolgen: Potenzielle unberechtigte Ausführung der Outreach-Warteschlange.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und nicht administrativen Start vor Queue-Lesen und Versand ablehnen..
- Sicherer Wiederherstellungsplan: Outreach-Worker pausieren; bereits beanspruchte Queueeinträge kontrolliert freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_f0b428fcfe8c9417_0b92b853

- Bewertung: ungeklärt; Korrekturgruppe `CG.email-selftest`; Abhängigkeiten A1, A2, A5.
- Funktionen: `email-selftest`.
- Belege: supabase/functions/email-selftest/index.ts:58-69.
- Ursache/Prüfgrenze: Der aktuelle Selftest-Einstieg und mögliche inzwischen ergänzte Zugriffsprüfungen wurden nicht abschließend gelesen. Der im Eingangsbefund genannte Versandaufruf genügt nicht zum Nachweis aktueller öffentlicher Erreichbarkeit.
- Geplante konkrete Änderung: Aktuelle Selftest-Autorisierung prüfen; gegebenenfalls auf Administratoren und verifizierte Testempfänger begrenzen.
- Betriebsfolgen: Potenzieller unberechtigter Testmailversand.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und fachfremden Benutzer sowie nicht erlaubten Testempfänger prüfen..
- Sicherer Wiederherstellungsplan: Selftest-Endpunkt deaktivieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_f54ab7127848f856

- Bewertung: ungeklärt; Korrekturgruppe `CG.lager-bestand-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `lager-bestand-notify`.
- Belege: supabase/functions/lager-bestand-notify/index.ts:1-105.
- Ursache/Prüfgrenze: Der aktuelle Seriennummern-Einstieg, Kundendatenumfang und die zugehörigen Rollen-/Mandantenprüfungen wurden nicht abschließend gelesen.
- Geplante konkrete Änderung: Seriennummernsuche, Geräte-/Kundenberechtigung und Benachrichtigungspfad vollständig prüfen; Datenumfang minimieren.
- Betriebsfolgen: Potenzielle Offenlegung von Kundendaten anhand einer Geräteseriennummer.
- Geplante Regressionstests, noch nicht ausgeführt: Anonyme Suche und fremde Seriennummer bei gültigem Login prüfen; Enumeration begrenzen..
- Sicherer Wiederherstellungsplan: Kundenbezogene Seriennummernausgabe sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_0e9d121dc4ee77fc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.bank-api-fetch`; Abhängigkeiten A1, A2, A5.
- Funktionen: `bank-api-fetch`.
- Belege: supabase/functions/bank-api-fetch/index.ts:31-42; supabase/functions/bank-api-fetch/index.ts:66-82; src/pages/Finance/Kontoauszuege/BankApi.tsx:71; supabase/config.toml:429-430.
- Ursache/Prüfgrenze: Zwischen HTTP-Einstieg und Service-Zugriff auf Bankverbindungen, Abruf externer Bankdaten sowie Speicherung liegt keine Aufruferprüfung. Der Frontendaufruf übergibt eine connectionId, autorisiert den Handler aber nicht. verify_jwt ist in der Quelldatei deaktiviert.
- Geplante konkrete Änderung: Bankimportberechtigung und Verbindungsscope prüfen; automatische Läufe gesondert authentifizieren.
- Betriebsfolgen: Unberechtigte Bankabrufe; Import- und Storage-Seiteneffekte.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_12f184f4fe482d12

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.mediapaket-portal`; Abhängigkeiten A1, A2, A5.
- Funktionen: `mediapaket-portal:notify_customer_status`, `send-mail`.
- Belege: supabase/functions/mediapaket-portal/index.ts:422-449; supabase/functions/mediapaket-portal/index.ts:242-258; supabase/config.toml:41-42.
- Ursache/Prüfgrenze: Die Aktion notify_customer_status verarbeitet eine frei übergebene Paket-ID unmittelbar mit dem Service-Client und ruft send-mail mit Service-Identität auf. Anders als andere Aktionen liegt hier weder eine Benutzerprüfung noch eine Paket-RLS-Abfrage vor. Der spätere Versandclient erhält daher nicht die ursprüngliche Aufruferidentität.
- Geplante konkrete Änderung: Vor Datenzugriff Paketberechtigung des verifizierten Aufrufers oder eine strikt verifizierte interne Ereignisidentität prüfen.
- Betriebsfolgen: Unberechtigte Kundenbenachrichtigung; Weitergabe paketbezogener Zugangslinks.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1a410c3cce005159

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.social-competitors-sync`; Abhängigkeiten A1, A2, A5.
- Funktionen: `social-competitors-sync`.
- Belege: supabase/functions/social-competitors-sync/index.ts:25-43; src/pages/Social/Wettbewerber.tsx:60.
- Ursache/Prüfgrenze: Der Handler verwendet den Service-Client ohne Identitäts- und Kundenberechtigungsprüfung zum Lesen der Wettbewerber und Schreiben von Snapshots sowie Zeitstempeln. Der UI-Aufruf mit client_id ist nur eine Eingabequelle, kein serverseitiger Berechtigungsnachweis. Anonymer Gatewayzugang ist nicht abschließend belegt.
- Geplante konkrete Änderung: Verifizierten Aufrufer und Social-Kundenscope vor Synchronisierung prüfen; globale Läufe nur für verifizierte Jobs.
- Betriebsfolgen: Unberechtigte Wettbewerber-Synchronisierung; Datenmanipulation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_1c6e8cfec49210c7

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-revenue-intel-v2`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-revenue-intel-v2`.
- Belege: supabase/functions/ac-revenue-intel-v2/index.ts:9-31; supabase/functions/ac-revenue-intel-v2/index.ts:43; src/pages/AlixConnect/RevenueIntelligenceV2.tsx:30; supabase/config.toml:343-344.
- Ursache/Prüfgrenze: Eine übergebene contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Aufruferprüfung. Die Daten werden an den KI-Dienst übertragen und Prognosen gespeichert. Der Frontendaufruf begrenzt direkte HTTP-Aufrufe nicht.
- Geplante konkrete Änderung: Kontakt- und Mandantenberechtigung vor jedem privilegierten Lesen und KI-Aufruf erzwingen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kommunikation; KI-Kosten; Prognoseschreibzugriffe.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_21a637de07028856

- Bewertung: Fehlkonfiguration; Korrekturgruppe `CG.announce-capa-cockpit`; Abhängigkeiten A1, A2, A5.
- Funktionen: `announce-capa-cockpit`.
- Belege: supabase/functions/announce-capa-cockpit/index.ts:12-30; supabase/functions/announce-capa-cockpit/index.ts:47-65; supabase/config.toml:492-493.
- Ursache/Prüfgrenze: Ein im Quelltext festgelegter Triggerwert wird als alleiniger Zugriffsschutz verwendet. Danach werden Mitarbeiterdaten gelesen und Benachrichtigungen ausgelöst. Das einmalige app_settings-Flag begrenzt Wiederholungen, ersetzt aber keine geheime oder personenbezogene Autorisierung. Der aktuell gesetzte Flagzustand wurde nicht gelesen.
- Geplante konkrete Änderung: Einmalhandler entfernen oder ausschließlich verifizierter interner Identität zugänglich machen; veröffentlichten Triggerwert nicht weiter als Geheimnis behandeln.
- Betriebsfolgen: Unberechtigte Mitarbeiterbenachrichtigung; Privilegierte Verarbeitung von Mitarbeiterdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_32ab3ba23bc4c3c6

- Bewertung: ungeklärt; Korrekturgruppe `CG.as-workflows-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `as-workflows-run`, `as-send-email-reminder`.
- Belege: supabase/functions/as-workflows-run/index.ts:53-73; supabase/functions/as-workflows-run/index.ts:110-135.
- Ursache/Prüfgrenze: Der HTTP-Handler führt Service-Lese- und Schreibzugriffe auf Mahnfälle, Checklisten, Rückrufe und Timeline aus, ohne sichtbare Aufruferprüfung. Für die vollständige Kette zum nachgelagerten as-send-email-reminder wurden dessen eigene Autorisierung und die Jobkonfiguration nicht abschließend gelesen.
- Geplante konkrete Änderung: Jobidentität am Einstieg positiv verifizieren; nachgelagerte Aufrufe und Fallberechtigungen vollständig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Falländerungen und Erinnerungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_38eef2927644a86c_2da0a87d

- Bewertung: ungeklärt; Korrekturgruppe `CG.ticket-sla-check`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-sla-check`, `ticket_sla_check_and_escalate`.
- Belege: supabase/functions/ticket-sla-check/index.ts:5-9; supabase/config.toml:270-271; supabase/migrations/20260712150349_e610b87f-7cf1-4ace-b3da-86b58c657415.sql:66.
- Ursache/Prüfgrenze: Der öffentlich konfigurierte Handler ruft ohne Identitätsprüfung die RPC ticket_sla_check_and_escalate mit Service-Rechten auf. Die RPC-Definition wurde lokalisiert, ihre vollständige aktuelle Implementierung samt Grants und späteren Änderungen aber nicht abschließend verfolgt.
- Geplante konkrete Änderung: Interne Jobidentität vor RPC-Aufruf erzwingen und vollständige RPC-Abhängigkeit separat abschließen.
- Betriebsfolgen: Mögliche unberechtigte SLA-Eskalationen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_3b50bf868a4ca4dc

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ticket-user-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-user-notify`.
- Belege: supabase/functions/ticket-user-notify/index.ts:39-90; supabase/migrations/20260712144259_6f081650-5483-4ad7-9bab-dff3fd854a81.sql:28; supabase/config.toml:264-265.
- Ursache/Prüfgrenze: Eine notification_id reicht für Service-Zugriffe auf Benachrichtigung, Benutzerprofil und Ticket; eine Bindung des Aufrufers an den Empfänger fehlt. Danach wird der Provider direkt aufgerufen. Ein Datenbanktrigger als legitimer Aufrufer schützt den separat erreichbaren Handler nicht.
- Geplante konkrete Änderung: Nur verifizierte interne Benachrichtigungsereignisse akzeptieren; Versandzustand und Ereignisbindung vor Provideraufruf prüfen.
- Betriebsfolgen: Unberechtigte Ticket-E-Mails; Verarbeitung fremder Ticketdaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_3f6f96a860e513ff

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-workflow-studio`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-workflow-studio`.
- Belege: supabase/functions/ac-workflow-studio/index.ts:31-79; src/pages/AlixConnect/WorkflowStudio.tsx:35-46; supabase/config.toml:358-359.
- Ursache/Prüfgrenze: Der Handler unterscheidet Generierung, Validierung und Speicherung, prüft aber vor dem Service-Insert in ac_automation_rules keine Identität oder Administrationsberechtigung. Der WorkflowStudio-Aufrufer ist lediglich Clientcode; die Gateway-Quelldatei deaktiviert JWT-Prüfung.
- Geplante konkrete Änderung: Workflow-Verwaltungsrecht und Mandantenscope vor Generierung, Speicherung und Aktivierung prüfen.
- Betriebsfolgen: Unberechtigte Automationsregeln; Mögliche nachgelagerte Kundenaktionen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_4bc3611a6285a5f0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-conversation-qa`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-conversation-qa`.
- Belege: supabase/functions/ac-conversation-qa/index.ts:24-53; supabase/functions/ac-conversation-qa/index.ts:72-79; supabase/functions/ac-conversation-qa/index.ts:107; src/pages/AlixConnect/ConversationQA.tsx:68.
- Ursache/Prüfgrenze: Der Handler wählt Konversationen und Nachrichten mit einem Service-Client aus, überträgt den Verlauf zur KI und schreibt QA-Ergebnisse, ohne den Aufrufer zu prüfen. Ein UI-Aufruf autorisiert diese Service-Zugriffe nicht.
- Geplante konkrete Änderung: QA-Rolle und Konversationsscope vor Auswahl und KI-Übertragung erzwingen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Gesprächsverläufe; QA-Manipulation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_4ea4f21737ef5149

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-qm-auto-score.create-completed-evaluation`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-qm-auto-score:Bewertung`.
- Belege: supabase/functions/ac-qm-auto-score/index.ts:12-21; supabase/functions/ac-qm-auto-score/index.ts:58-65; src/pages/AlixConnect/QualityMgmt.tsx:64.
- Ursache/Prüfgrenze: call_id und scorecard_id steuern einen Service-Lesezugriff und anschließend das Anlegen einer abgeschlossenen QM-Bewertung ohne Aufrufer- oder Bewerterberechtigungsprüfung. Dies ist eine andere Operation als der separat gemeldete Transkriptzugriff.
- Geplante konkrete Änderung: QM-Bewerterrecht sowie Call- und Scorecard-Scope vor Verarbeitung und Abschluss prüfen.
- Betriebsfolgen: Unberechtigte Mitarbeiterbewertungen; Mögliche Coaching-Folgeaktionen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_55788009de5e6065

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-wfm-adherence-alerts`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-wfm-adherence-alerts`, `ac_wfm_adherence_live`.
- Belege: supabase/functions/ac-wfm-adherence-alerts/index.ts:10-23.
- Ursache/Prüfgrenze: Der Handler besitzt keine sichtbare Identitätsprüfung und nutzt Service-Rechte für ac_wfm_adherence_live sowie Benachrichtigungen. Die vollständige Implementierung und Sichtbarkeitslogik dieser RPC und die effektive Job-/Gatewaykonfiguration wurden nicht abschließend aufgelöst.
- Geplante konkrete Änderung: Jobidentität prüfen; RPC und Empfängerableitung vollständig nachvollziehen.
- Betriebsfolgen: Mögliche unberechtigte Mitarbeiter-Adherence-Alarme.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_63a444f362255ddb

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-campaign-ab-decide`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-campaign-ab-decide`.
- Belege: supabase/functions/ac-campaign-ab-decide/index.ts:8-25; supabase/functions/ac-campaign-ab-decide/index.ts:46; src/pages/AlixConnect/OmnichannelCampaigns.tsx:72.
- Ursache/Prüfgrenze: Der Handler verwendet die frei übergebene campaign_id für Service-Lesezugriffe auf Kampagne und Empfänger sowie ein anschließendes Kampagnenupdate ohne Identitäts- oder Kampagnenberechtigungsprüfung.
- Geplante konkrete Änderung: Kampagnenverwaltungsrecht und Mandantenscope vor Auswertung und Entscheidung erzwingen.
- Betriebsfolgen: Manipulation von Kampagnenentscheidungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_675c4841c9be4f6b

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-router-simulate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-router-simulate`.
- Belege: supabase/functions/ac-router-simulate/index.ts:21-38; supabase/functions/ac-router-simulate/index.ts:42-70; supabase/functions/ac-router-simulate/index.ts:91-103; src/pages/AlixConnect/RoutingSimulator.tsx:70.
- Ursache/Prüfgrenze: getUser wird aufgerufen, ein fehlender Benutzer führt aber nicht zum Abbruch. Routingregeln, Agentenfähigkeiten und Auslastung werden mit Service-Rechten verarbeitet; Ergebnis und Trace werden zurückgegeben. Optional kann sogar ohne Benutzer eine Simulation gespeichert werden.
- Geplante konkrete Änderung: Fehlende Identität ablehnen und Routing-/Personaldatenberechtigung samt Mandantenscope vor Service-Zugriffen prüfen.
- Betriebsfolgen: Offenlegung interner Routing- und Personaldaten; Unberechtigte Simulationsspeicherung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_6a796ab89ffc66d5

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-customer-intel`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-customer-intel`.
- Belege: supabase/functions/ac-customer-intel/index.ts:10-32; supabase/functions/ac-customer-intel/index.ts:46-56; src/pages/AlixConnect/CustomerIntelligence.tsx:33; supabase/config.toml:331-332.
- Ursache/Prüfgrenze: contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Autorisierung. Die Daten gehen an den KI-Dienst; Prognosen und Customer-Health-Daten werden geschrieben. Der Clientaufruf ersetzt keine serverseitige Prüfung.
- Geplante konkrete Änderung: Kontaktberechtigung und Mandantenscope vor KI-Verarbeitung erzwingen.
- Betriebsfolgen: Unberechtigte externe Verarbeitung privater Kundendaten; Manipulation von Kundenanalysen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_7c6fbb7e2e06dc5b

- Bewertung: ungeklärt; Korrekturgruppe `CG.lager-bestand-notify`; Abhängigkeiten A1, A2, A5.
- Funktionen: `lager-bestand-notify`, `send-transactional-email`.
- Belege: supabase/functions/lager-bestand-notify/index.ts:12-47.
- Ursache/Prüfgrenze: Übergebene Seriennummern steuern Service-Lesezugriffe auf Geräte, Aufträge und Kunden ohne sichtbare Identitätsprüfung. Der Handler ruft send-transactional-email privilegiert auf. Dessen tatsächliche Empfänger- und Autorisierungswirkung wurde nicht vollständig verfolgt.
- Geplante konkrete Änderung: Lagerberechtigung und Gerätescope prüfen; interne Mailkette vollständig auflösen.
- Betriebsfolgen: Mögliche unberechtigte Lager-/Kundenbenachrichtigungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_80702a087db69b7e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-omnichannel-orchestrate`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-omnichannel-orchestrate`.
- Belege: supabase/functions/ac-omnichannel-orchestrate/index.ts:9-31; supabase/functions/ac-omnichannel-orchestrate/index.ts:42; src/pages/AlixConnect/OmnichannelOrchestrator.tsx:39; supabase/config.toml:337-338.
- Ursache/Prüfgrenze: Der Handler liest für eine beliebige contact_id Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und verarbeitet sie per KI ohne Aufruferprüfung. Anschließend wird eine Prognose gespeichert. Ein tatsächlicher Nachrichtenversand wird hier nicht behauptet.
- Geplante konkrete Änderung: Kontakt- und Analyseberechtigung vor Datenauswahl und KI-Aufruf prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kontaktdaten; Prognoseschreibzugriffe.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_89bba568925256f2_d4756c15

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-playbook-run`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-playbook-run`.
- Belege: supabase/functions/ac-playbook-run/index.ts:34-70; supabase/functions/ac-playbook-run/index.ts:82-121; supabase/migrations/20260721130850_b2c18de2-ff0b-4288-a819-bb5e09ffc493.sql:21.
- Ursache/Prüfgrenze: Der Handler startet ohne sichtbare Aufruferprüfung und liest Playbooks sowie Kundenstatus mit Service-Rechten. Direkte SMS-/WhatsApp-Pfade und interne Aktionen sind vorhanden. Cronregistrierung wurde gefunden, aber die gesamte Auswahl-, Aktions- und Wiederholungskette nicht abschließend gelesen.
- Geplante konkrete Änderung: Jobidentität positiv prüfen und jede Playbookaktion samt Mandantenscope und Wiederholungsschutz vollständig auditieren.
- Betriebsfolgen: Mögliche unberechtigte Kundenansprache und interne Folgeaktionen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_9328ed89c215056e

- Bewertung: ungeklärt; Korrekturgruppe `CG.offer-followup-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `offer-followup-engine`, `getTenantScope`.
- Belege: supabase/functions/offer-followup-engine/index.ts:28-51; supabase/functions/_shared/tenant-scope.ts:49-67; src/pages/Sales/AngebotsKalender.tsx:151.
- Ursache/Prüfgrenze: Der Handler übernimmt die restricted-Semantik des gemeinsamen Helpers. Für gültige Benutzer ohne Zuweisungen liefert dieser restricted=false; die Angebotsabfrage wird dann nicht nach Mandanten eingeschränkt. Ob diese globalen Rechte fachlich zulässig sind und ob alle Folgeaktionen denselben Scope beachten, ist offen.
- Geplante konkrete Änderung: Explizite globale Berechtigung statt impliziter Freigabe durch fehlende Zuweisung; sämtliche Folgeabfragen und Mailpfade auf Scope prüfen.
- Betriebsfolgen: Mögliche mandantenübergreifende Angebotsverarbeitung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_98ce69bedfbee8e0

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.esc-calendar-sync`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-calendar-sync`, `pushToMicrosoft`, `pushToGoogle`.
- Belege: supabase/functions/esc-calendar-sync/index.ts:100-127; supabase/config.toml:254-255; src/components/esc/CalendarConnectionsCard.tsx:59.
- Ursache/Prüfgrenze: Die Quelldatei konfiguriert Gateway-JWT-Prüfung, der Handler selbst bindet user_id jedoch nicht an die verifizierte Identität. Ohne user_id verarbeitet er alle aktiven Verbindungen. Gespeicherte OAuth-Zugänge werden für Kalender-POSTs genutzt. Damit bleibt mindestens ein objektbezogenes Autorisierungsdefizit; vollständig anonymer Zugriff ist nicht behauptet.
- Geplante konkrete Änderung: Identität im Handler verifizieren und nur eigene Kalender zulassen; globale Synchronisierung ausschließlich für verifizierte Jobs.
- Betriebsfolgen: Unberechtigte Erstellung fremder Kalenderereignisse; Mögliche Mehrfachanlage.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_aab25c4aac0c36d0_10807eba

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-qm-auto-score.call-transcript-analysis`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-qm-auto-score:Transkriptanalyse`.
- Belege: supabase/functions/ac-qm-auto-score/index.ts:12-21; supabase/functions/ac-qm-auto-score/index.ts:31-38; src/pages/AlixConnect/QualityMgmt.tsx:64.
- Ursache/Prüfgrenze: Vor dem Service-Lesen des per call_id gewählten Transkripts findet keine Aufrufer- oder Callberechtigungsprüfung statt. Das Transkript wird anschließend zur KI übertragen. Dies ist keine identische Operation zum Anlegen einer QM-Bewertung.
- Geplante konkrete Änderung: QM-Analyseberechtigung und Call-Scope vor Transkriptzugriff prüfen.
- Betriebsfolgen: Unberechtigte externe Verarbeitung privater Gesprächstranskripte.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b84cf71745089f7f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-agent-assist-live`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-agent-assist-live`.
- Belege: supabase/functions/ac-agent-assist-live/index.ts:11-20; supabase/functions/ac-agent-assist-live/index.ts:37-56; src/pages/AlixConnect/AgentAssistLive.tsx:35; supabase/config.toml:328-329.
- Ursache/Prüfgrenze: Eine conversation_id steuert Service-Lesezugriffe auf Konversation und Nachrichten ohne Aufruferprüfung. Gesprächsverlauf und Wissenskontext werden an die KI übertragen; Vorschläge werden gespeichert.
- Geplante konkrete Änderung: Agentenberechtigung und Konversationsscope vor jedem Lese- und KI-Zugriff prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Konversationen; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_ba7c311bb074fdc2_4edc88a2

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-predictive-engagement`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-predictive-engagement`.
- Belege: supabase/functions/ac-predictive-engagement/index.ts:9-31; supabase/functions/ac-predictive-engagement/index.ts:42; src/pages/AlixConnect/PredictiveEngagement.tsx:30; supabase/config.toml:346-347.
- Ursache/Prüfgrenze: Der Handler akzeptiert contact_id ohne Identitätsprüfung, liest Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und überträgt sie zur KI. Ergebnisse werden in ac_predictions gespeichert.
- Geplante konkrete Änderung: Kontaktberechtigung und Mandantenscope vor Analyse erzwingen.
- Betriebsfolgen: Unberechtigte Verarbeitung privater Kontaktaktivitäten; Prognosemanipulation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c1b20729293ac269

- Bewertung: ungeklärt; Korrekturgruppe `CG.ticket-auto-close`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ticket-auto-close`, `ticket_auto_close_stale`.
- Belege: supabase/functions/ticket-auto-close/index.ts:11-20; supabase/config.toml:267-268; supabase/migrations/20260712145321_bc279ece-0c3e-4271-9422-a95e7cf00e92.sql:58.
- Ursache/Prüfgrenze: Der Handler besitzt keine eigene Aufruferprüfung und ruft ticket_auto_close_stale mit Service-Rechten auf; verify_jwt ist laut Quelle deaktiviert. Die vollständige aktuelle RPC-Implementierung und ihre Grants wurden nicht abschließend gelesen.
- Geplante konkrete Änderung: Verifizierte Jobidentität vor RPC-Aufruf erzwingen; RPC-Autorisierung und Abschlussbedingungen vollständig prüfen.
- Betriebsfolgen: Möglicher unberechtigter Ticketabschluss.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c77c59c8e36d2de5

- Bewertung: ungeklärt; Korrekturgruppe `CG.esc-conflict-check`; Abhängigkeiten A1, A2, A5.
- Funktionen: `esc-conflict-check`.
- Belege: supabase/functions/esc-conflict-check/index.ts:12-31.
- Ursache/Prüfgrenze: Der Handler akzeptiert ein Zeitfenster und liest esc_events mit einem Service-Client ohne sichtbare Identitätsprüfung. Die vollständige Projektions-, Filter- und Rückgabelogik sowie Gatewayabsicherung wurden nicht abschließend geprüft; Umfang der tatsächlich offengelegten Fremddaten bleibt offen.
- Geplante konkrete Änderung: Kalenderberechtigung und zulässigen Benutzer-/Mandantenscope prüfen; Antwort auf erforderliche Konfliktinformationen minimieren.
- Betriebsfolgen: Mögliche Offenlegung fremder Kalenderbelegung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d50cef29292119e8

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-churn-predict`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-churn-predict`.
- Belege: supabase/functions/ac-churn-predict/index.ts:10-13; supabase/functions/ac-churn-predict/index.ts:79; src/pages/AlixConnect/ChurnDetection.tsx:40.
- Ursache/Prüfgrenze: Der Handler erzeugt ohne sichtbare Identitätsprüfung einen Service-Client und unterstützt Einzelkontakt- sowie Batchverarbeitung. Die gesamte Scoreherleitung, Datenauswahl und Rückgabe wurde nicht abschließend gelesen; die konkrete Datenoffenlegung bleibt unresolved.
- Geplante konkrete Änderung: Analyseberechtigung und Kontakt-/Batchscope prüfen; vollständige Score- und Rückgabekette auditieren.
- Betriebsfolgen: Möglicher fremder Zugriff auf Kundenrisikodaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_d9ed56cd61cd46cd

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-webhook-meta`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-webhook-meta`.
- Belege: supabase/functions/ac-webhook-meta/index.ts:34-57; supabase/functions/ac-webhook-meta/index.ts:12-30; supabase/config.toml:319-320.
- Ursache/Prüfgrenze: Die GET-Verifikation verwendet einen Verifikationstoken, der POST-Eingang prüft dagegen keine kryptografische Provider-Signatur vor privilegierter Kontakt-/Konversations- und Nachrichtenerzeugung. Ein GET-Abonnementcheck authentifiziert keine späteren POST-Nachrichten.
- Geplante konkrete Änderung: Provider-Signatur am unveränderten Requestbody prüfen, bevor JSON verarbeitet oder Daten geschrieben werden; Kanal-/Mandantenbindung und Ereignisdeduplizierung ergänzend prüfen.
- Betriebsfolgen: Gefälschte eingehende Social-Nachrichten; Kontakt- und Konversationsverfälschung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e90b7b2049e0b2bb

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.ac-journey-optimize`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-journey-optimize`.
- Belege: supabase/functions/ac-journey-optimize/index.ts:10-15; supabase/functions/ac-journey-optimize/index.ts:45-46; supabase/config.toml:325-326.
- Ursache/Prüfgrenze: Eine frei übergebene journey_id steuert privilegierte Journey-Abfragen und einen KI-Aufruf ohne Aufruferprüfung. Der UI-Aufruf schützt den direkten HTTP-Einstieg nicht; verify_jwt ist in der Quelle deaktiviert.
- Geplante konkrete Änderung: Journey-Analyseberechtigung und Mandantenscope vor Datenzugriff und kostenpflichtiger KI-Verarbeitung prüfen.
- Betriebsfolgen: Unberechtigte Verarbeitung interner Journey-Daten; KI-Kosten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_ef43972ba6ab93b7_81382866

- Bewertung: ungeklärt; Korrekturgruppe `CG.ac-outreach-engine`; Abhängigkeiten A1, A2, A5.
- Funktionen: `ac-outreach-engine`.
- Belege: supabase/functions/ac-outreach-engine/index.ts:11-14.
- Ursache/Prüfgrenze: Der Handler erzeugt ohne sichtbare Aufruferprüfung einen Service-Client. Die vollständige Auswahl-, Warteschlangen- und Versandkette wurde nicht abschließend gelesen; eine konkrete unberechtigte Queueoperation und ihre Folgewirkung bleiben deshalb unresolved.
- Geplante konkrete Änderung: Outreachrecht oder verifizierte Jobidentität vor Service-Zugriffen erzwingen; Queue-, Scope- und Versandabhängigkeiten vollständig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Kunden-Outreach-Aufträge.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_f0b428fcfe8c9417_dad9f717

- Bewertung: ungeklärt; Korrekturgruppe `CG.email-selftest`; Abhängigkeiten A1, A2, A5.
- Funktionen: `email-selftest`.
- Belege: supabase/functions/email-selftest/index.ts:9-36; supabase/functions/email-selftest/index.ts:67.
- Ursache/Prüfgrenze: Der Handler enthält keine sichtbare Identitätsprüfung vor einem Provideraufruf mit serverseitigem API-Key. Der gesamte Empfängerpfad, Beschränkungen der Testmail und die effektive Gatewayabsicherung wurden nicht abschließend gelesen; beliebige Zieladressen sind daher nicht abschließend bestätigt.
- Geplante konkrete Änderung: Administratives Testversandrecht prüfen und Testempfänger ausdrücklich begrenzen; vollständigen Versandpfad auditieren.
- Betriebsfolgen: Möglicher Missbrauch des Mailproviders und der Absenderreputation.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

