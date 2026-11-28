# ALIXWORK – Korrekturpaket A zur Freigabe

**Nur vorbereitet. Keine Ausführung freigegeben oder durchgeführt.**

Bestätigte Quellcodelücken und Fehlkonfigurationen sind als getrennte Einheiten aufgeführt. Risikoabschätzung beruht auf Quellcode und Metadaten, nicht auf produktiver Ausnutzung. Ungeklärte Befunde gehören zuerst in die Prüfungsliste, nicht in einen ungeprüften automatischen Massenfix. Doppel-IDs werden bei der Korrektur nur mit dem bestätigten Hauptbefund berücksichtigt. Keine bestehende Funktion löschen; Schlüssel/Verträge/Zeitpläne und 44 Geräte unverändert.

Zusätzliche zentrale Maßnahmen: A-ROLE-001 (Rollen-/Policy-Eskalation) und A-AUDIT-001 (veränderbare Korrekturfreigaben), mit Ursache, Auswirkungen, Tests und Rollback im Prüfbericht. Diese sind keine zusätzlichen IDs innerhalb der 266 Scanner-IDs.

## lov_finding_006a75d168f7259a

Anyone can trigger global private mail relinking

Ursache: Nach OPTIONS folgt unmittelbar ein Service-Role-Scan unverknüpfter Mails. Kontakt- und Auftragszuordnung sowie Updates erfolgen ohne Identitäts-, Aktivitäts-, Rollen- oder Mandantenprüfung. Der UI-Aufrufer ersetzt keine Serverautorisierung.

Funktionen: - ac-email-autolink

Korrektur: Aktives internes Konto mit Mailverwaltungsrecht oder explizites Maschinencredential verlangen; Mails und Zielobjekte gemeinsam mandantenbezogen begrenzen.

Auswirkung: - Falsche Mailzuordnungen
- Mandantenübergreifende Verarbeitung

Tests: - Geplant: anonym, deaktiviert und fremder Mandant abweisen; berechtigte Zuordnung positiv prüfen.

Rollback: Bei Regression Endpoint sperren; Änderungen anhand gesicherter Vorwerte zurücksetzen.

## lov_finding_01c314f2b58b194b

Anyone can change offer scores

Ursache: Der Handler selektiert offene Angebote privilegiert ohne Aufruferprüfung, sendet sie an KI und aktualisiert Scores anhand zurückgelieferter IDs. Ein Cron-Kommentar ist keine Zugangskontrolle.

Funktionen: - offers-ai-autoscore
- scoreBatch

Korrektur: Maschinenauthentifizierung oder aktive autorisierte Vertriebsrolle vor Selektion; Mandantenscope und zurückgelieferte Angebots-IDs gegen den selektierten Batch prüfen.

Auswirkung: - Manipulierte Vertriebsbewertung
- KI-Kosten
- Verarbeitung privater Angebotsdaten

Tests: - Geplant: unberechtigte Requests ohne KI-Aufruf; fremde Batch-ID ohne Update; berechtigter Job erfolgreich.

Rollback: Scoringjob deaktivieren und frühere Scores wiederherstellen.

## lov_finding_08c1beda03a5ef65

Anyone can view customer scores and routing details

Ursache: getUser wird aufgerufen, aber das Ergebnis sperrt die privilegierte Simulation nicht. Kundenscore, Routingregeln, Agentenskills und Auslastung werden unabhängig von einer autorisierten Identität verarbeitet und als Simulationsergebnis ausgegeben.

Funktionen: - ac-router-simulate

Korrektur: Identität verbindlich validieren; aktives Routing-Administrationsrecht und Mandantenscope für Kunde, Regeln und Agenten verlangen.

Auswirkung: - Offenlegung interner Routinginformationen
- Auswertung fremder Kundenscores

Tests: - Geplant: fehlende Identität, falsche Rolle und fremder Kunde abweisen; erlaubten Simulatorpfad prüfen.

Rollback: Simulator sperren, nicht auf ungeprüften Zugriff zurückfallen.

## lov_finding_108fb37fdfeda925

Anyone can send private customer records outside

Ursache: Beliebige contact_id führt ohne Authentifizierung zu Service-Role-Lesezugriffen auf Kontakt, Nachrichten und Anrufe. Die Daten werden an die KI weitergegeben und Vorhersagen gespeichert; verify_jwt ist explizit false.

Funktionen: - ac-customer-intel

Korrektur: Aktive berechtigte Mitarbeiteridentität und kontaktbezogene Mandantenfreigabe vor allen Reads und KI-Aufrufen erzwingen.

Auswirkung: - Unberechtigte Verarbeitung privater Kundenkommunikation
- KI-Kosten
- Unberechtigte Vorhersagen

Tests: - Geplant: fremde Kontakt-ID und deaktiviertes Konto ohne Daten- oder KI-Zugriff; erlaubten Kontakt prüfen.

Rollback: KI-Endpunkt deaktivieren; erzeugte Vorhersagen gezielt kennzeichnen oder entfernen.

## lov_finding_1376815e4ca5950a

Ticket IDs bypass the caller's ticket access policy

Ursache: getUser authentifiziert den Nutzer, danach liest ein separater Service-Role-Client beliebige ticket_id und repair_id sowie seriennummernbezogene Historien. Ticket-, Reparatur-, Rollen-, Aktivitäts- und Mandantenzugriff werden nicht geprüft.

Funktionen: - ai-service-analyze

Korrektur: Aktives Servicekonto mit fachlicher Rolle verlangen; Ticket, Reparatur und gesamte Seriennummernhistorie im Aufruferscope laden.

Auswirkung: - IDOR auf Servicehistorien
- Weitergabe fremder Daten an KI
- KI-Kosten

Tests: - Geplant: authentifizierter Fremdnutzer für Ticket, Reparatur und Seriennummer negativ; erlaubte Analyse positiv.

Rollback: Analysefeature sperren; keine Rückkehr zu privilegierten ungeprüften Reads.

## lov_finding_1794cebaf2967832

Production staff can grant their own QM approvals

Ursache: plm_can_write erlaubt Produktion ausdrücklich. Die UPDATE-Policy schützt nur die Zeile über denselben breiten Helfer, nicht QM-Felder. qm_approved_by und qm_approved_at liegen in derselben Tabelle; der vorhandene Update-Trigger aktualisiert lediglich den Zeitstempel.

Funktionen: - public.plm_can_write
- public.plm_changes
- public.plm_touch_updated_at

Korrektur: QM-Freigaben über atomare rollenbeschränkte Operation mit aktivem QM-Konto und Vieraugenprüfung führen; direkte Änderungen geschützter Felder verhindern.

Auswirkung: - Umgehung der QM-Freigabe
- Verlust der Funktionstrennung

Tests: - Geplant: Produktion darf Fachfelder, aber keine QM-Felder ändern; Selbstfreigabe negativ; unabhängige QM-Freigabe positiv.

Rollback: QM-Änderungen sperren; Freigabestatus aus revisionssicherer Historie rekonstruieren.

## lov_finding_1aac574b83b92e0b

Anyone can trigger recurring billing across tenants

Ursache: Der Handler prüft keinen Aufrufer. tenantId ist optional und stammt aus dem Request; ohne Wert werden aktive wiederkehrende Pläne mandantenübergreifend verarbeitet, Vorankündigungen versendet und Rechnungsdokumente angelegt.

Funktionen: - cmr-recurring-run

Korrektur: Globalen Lauf ausschließlich maschinell authentifizieren; interaktive Läufe auf aktive Finanzrolle und serverseitigen Mandantenscope begrenzen.

Auswirkung: - Unberechtigte Rechnungsanlage
- Mandantenübergreifender Mailversand

Tests: - Geplant: anonymer und fremdmandantiger Lauf negativ; autorisierter Job und Wiederholungsfestigkeit positiv.

Rollback: Job stoppen; erzeugte Dokumente fachlich stornieren statt unkontrolliert löschen.

## lov_finding_1cfc25c1a72b5091

Anyone can trigger private ticket notifications

Ursache: notification_id wird ohne Aufruferauthentifizierung privilegiert aufgelöst. Die Aktivitätsprüfung betrifft den Empfänger, nicht den Aufrufer. Ticketdaten werden für eine Mail genutzt und die Empfängeradresse wird zurückgegeben.

Funktionen: - ticket-user-notify

Korrektur: Vertrauenswürdige Jobauthentifizierung oder aktive Ticketberechtigung verlangen; Notification an Ticket und erlaubten Versandzustand binden.

Auswirkung: - Unberechtigte Ticketbenachrichtigungen
- Offenlegung von Empfängerinformationen

Tests: - Geplant: fremde Notification, anonym und Replay abweisen; berechtigte Zustellung prüfen.

Rollback: Versand sperren; bereits versandte Mails sind nicht rückholbar.

## lov_finding_22d2f74a8a4d2421

Anyone can run the bank statement import

Ursache: Der Endpoint liest Bankverbindungen und startet deren Import ohne Aufruferprüfung; connectionId ist nur ein Zielauswahlfilter. Aktivierte Verbindung und vorhandener Provider-Token sind Betriebsvoraussetzungen, keine Autorisierung.

Funktionen: - bank-api-fetch

Korrektur: Maschinencredential oder aktive Bankimportrolle erzwingen; Verbindungen an erlaubten Mandanten binden.

Auswirkung: - Unberechtigte Bankimporte
- Speicher- und Providerbelastung

Tests: - Geplant: anonym, falsche Rolle und fremde Verbindung ohne Provideraufruf; autorisierten Import prüfen.

Rollback: Importverbindungen deaktivieren; neu erzeugte Importobjekte anhand des Laufprotokolls isolieren.

## lov_finding_28cb10380cb01816

Anyone can alter every competitor's social reports

Ursache: Ohne Authentifizierung werden Wettbewerber privilegiert ausgewählt und Snapshots sowie last_snapshot_at verändert. Auch generierte Stubwerte sind dauerhafte Änderungen echter Berichtstabellen.

Funktionen: - social-competitors-sync

Korrektur: Jobauthentifizierung oder aktive Social-Administrationsrolle mit Client-/Mandantenbindung verlangen; Stubdaten von Produktivberichten trennen.

Auswirkung: - Verfälschte Wettbewerbsberichte
- Mandantenübergreifende Änderungen

Tests: - Geplant: anonym und fremder Client negativ; erlaubter Sync und eindeutige Stubkennzeichnung positiv.

Rollback: Sync sperren; betroffene Snapshots aus Vorbestand wiederherstellen.

## lov_finding_29b6057cf3486198

Anyone can force customer dunning emails

Ursache: Keine Aufruferprüfung vor dem globalen Rücklastschriftlauf. Besonders relevant: body.force setzt cfg.enabled auf true und umgeht damit eine konfigurierte Deaktivierung. Danach werden fällige Mahnfälle privilegiert verarbeitet.

Funktionen: - bank-return-dunning-escalate

Korrektur: Maschinenauthentifizierung verlangen; force separat auf aktive privilegierte Finanzrolle begrenzen; mandantenbezogene Verarbeitung erzwingen.

Auswirkung: - Erzwungene Mahnläufe
- Umgehung des Abschaltschalters
- Kundenbelästigung

Tests: - Geplant: anonymes force und dryRun negativ; deaktivierte Konfiguration bleibt gesperrt; autorisierten Lauf prüfen.

Rollback: Endpoint und Scheduler sperren; Mahnstände aus Laufhistorie fachlich korrigieren.

## lov_finding_310b81ae9b51152a

Unauthenticated requests can read push subscriptions

Ursache: Ohne Identitätsprüfung werden Zielnutzer über IDs oder Rollen bestimmt, Push-Subscriptions samt Schlüsseln privilegiert gelesen und Pushnachrichten verschickt. Die Antwort enthält Zähler, nicht die Subscription-Schlüssel selbst; eine direkte Schlüsseloffenlegung wird nicht behauptet.

Funktionen: - mobile-push-send

Korrektur: Maschinencredential oder aktive berechtigte Versandrolle prüfen; Empfängerscope, Payload und Versandrate begrenzen.

Auswirkung: - Unberechtigte Pushnachrichten
- Missbrauch privater Subscriptiondaten
- Löschung abgelaufener Subscriptions

Tests: - Geplant: anonym und fremde Nutzergruppe ohne Subscription-Read oder Push; erlaubten Versand prüfen.

Rollback: Pushversand deaktivieren; entfernte Subscriptions erfordern gegebenenfalls Neuregistrierung.

## lov_finding_374621ce0171a129

Anyone can request another agent’s QM history

Ursache: agent_user_id wird ohne Aufruferprüfung verwendet, um QM-Bewertungen privilegiert zu lesen, daraus KI-Coaching abzuleiten und eine Coaching-Session anzulegen. Weder Eigenzugriff noch QM-Rolle oder Mandant werden geprüft.

Funktionen: - ac-qm-coaching-recommend

Korrektur: Aktives QM-/Führungsrecht und Agentenscope verlangen; berechtigten Eigenzugriff ausdrücklich modellieren.

Auswirkung: - Offenlegung von Mitarbeiterbewertungen
- Unberechtigte Coachingeinträge
- KI-Kosten

Tests: - Geplant: fremder Agent, falsche Rolle und deaktiviertes Konto negativ; erlaubte QM-Auswertung positiv.

Rollback: Coachinggenerierung sperren; unberechtigte Sessions revisionssicher zurücknehmen.

## lov_finding_38eef2927644a86c_47b6f826

Anyone can change ticket SLA and escalation records

Ursache: Jeder Nicht-OPTIONS-Request ruft die SLA-/Eskalations-RPC mit Service-Role auf. Es gibt keine Aufruferprüfung. Die Gateway-Konfiguration setzt verify_jwt an beiden vorhandenen Einträgen auf false; die doppelte TOML-Deklaration verhindert allerdings einen verlässlichen Deploymentnachweis.

Funktionen: - ticket-sla-check
- public.ticket_sla_check_and_escalate

Korrektur: Maschinenauthentifizierung vor RPC einführen und doppelte Funktionskonfiguration bereinigen; RPC-Ausführungsrechte separat prüfen.

Auswirkung: - Unberechtigte SLA-/Eskalationsläufe

Tests: - Geplant: fehlendes und falsches Jobcredential ohne RPC-Aufruf; autorisierter wiederholbarer Lauf.

Rollback: Scheduler und Endpoint sperren; Eskalationsänderungen anhand Auditdaten prüfen.

## lov_finding_3b55d34b73b21e9d

Public chat polling lacks caller authentication

Ursache: Polling prüft aktive Website und bindet die conversation_id an website_id. Eine individuelle Besucherberechtigung fehlt jedoch: öffentliche Website-api_key plus fremde Gesprächs-ID reichen zum Lesen nichtinterner Nachrichten.

Funktionen: - ac-chat
- getWebsite
- loadConversation

Korrektur: Beim Start ein kryptografisches gesprächsgebundenes Besuchercredential ausstellen und bei Polling prüfen; Website-Schlüssel nicht als Besucheridentität behandeln.

Auswirkung: - Lesen fremder Chatkommunikation innerhalb derselben Website

Tests: - Geplant: Besucher A kann Gespräch B auch mit gültigem Website-Schlüssel nicht pollen; eigene Sitzung positiv.

Rollback: Polling für ungebundene Altgespräche sperren oder kontrollierte Sitzungserneuerung verlangen.

## lov_finding_3e98351e84204cdc

Signed-in users can send arbitrary branded appointment emails

Ursache: getUser validiert die Identität, danach wird recipient_email aus dem Request für Markenmailversand genutzt. Eine aktive Mitarbeiterrolle, Terminberechtigung, Mandantenbindung oder Ableitung des Empfängers aus einem autorisierten Termin fehlt.

Funktionen: - esc-appointment-confirmation-mail

Korrektur: Aktive Terminverwaltungsrolle und Eventscope prüfen; Empfänger serverseitig aus dem berechtigten Termin ableiten.

Auswirkung: - Branded Spam
- Phishing
- Versandkosten

Tests: - Geplant: gewöhnlicher Login und Empfängerüberschreibung negativ; erlaubter Terminversand positiv.

Rollback: Versandfunktion deaktivieren; versandte Nachrichten nicht rückholbar.

## lov_finding_413dd4d3641d23bd

AI endpoint updates cases without a staff-role check

Ursache: Signierte Claims werden geprüft, aber keine aktive Fachrolle oder Fallberechtigung. Der separate Adminclient lädt beliebige case_id samt Timeline und Checklisten und schreibt KI-Ergebnisse, Vorschläge und Ereignisse zurück.

Funktionen: - as-ai-suggest

Korrektur: Aktives internes Fallbearbeitungsrecht und Fall-/Mandantenzugriff vor privilegiertem Lesen und Schreiben erzwingen.

Auswirkung: - Fremde Falldaten an KI
- Unberechtigte Falländerungen
- KI-Kosten

Tests: - Geplant: fremder Fall, externe Rolle und deaktiviertes Konto negativ; erlaubte Fallanalyse positiv.

Rollback: KI-Schreibpfad sperren; Änderungen über Vorwerte und Timeline zurücknehmen.

## lov_finding_452bd5908dcf2082

Anyone can send caller-written emails to arbitrary recipients

Ursache: Der Handler akzeptiert event und recipient_email ohne Aufruferauthentifizierung, verschickt daraus eine Service-E-Mail und protokolliert privilegiert. verify_jwt ist false; weder Ticketzugriff noch Empfängerbindung werden erzwungen.

Funktionen: - ticket-customer-notify

Korrektur: Vertrauenswürdigen Job oder aktive Ticketberechtigung prüfen; Empfänger und Vorlagen aus autorisiertem Ticket ableiten.

Auswirkung: - Spoofing von Servicemails
- Spam
- Manipulierte Kommunikationsprotokolle

Tests: - Geplant: anonym, fremdes Ticket und beliebiger Empfänger negativ; legitimes Ereignis positiv.

Rollback: Endpoint sperren; missbräuchliche Logeinträge markieren.

## lov_finding_4bd5ac08511c8e04

Caller controls SMS recipient and message text

Ursache: Der Endpoint erlaubt Servicecredential oder verifizierte Nutzerclaims, aber keine aktive Versandrolle oder Fallautorisierung. Nach beliebiger case_id werden SMS-Empfänger und Text verarbeitet und Twilio aufgerufen. Telefonnummernformat und vorhandener Fall sind keine Versandberechtigung.

Funktionen: - as-send-sms-reminder

Korrektur: Servicecredential exakt vergleichen; aktive Fallrolle und Fallzugriff prüfen; freie Empfänger-/Textüberschreibung gesondert berechtigen.

Auswirkung: - Unberechtigter SMS-Versand
- Providerkosten
- Branded Spam

Tests: - Geplant: gewöhnlicher Login, fremder Fall und Empfängerüberschreibung negativ; berechtigte Erinnerung positiv.

Rollback: SMS-Pfad sperren; bereits versandte SMS sind nicht rückholbar.

## lov_finding_5289cf703f8ac14d

Anyone can trigger reads of restricted sync logs

Ursache: Ohne Aufruferprüfung werden eingehende und ausgehende Ticket-Synclogs privilegiert gelesen, Alarmfälle verarbeitet und Alarmdatensätze angelegt. Eine direkte vollständige Rückgabe sämtlicher Rohlogs wird nicht behauptet; die unberechtigte Verarbeitung ist belegt.

Funktionen: - ticket-sync-alert

Korrektur: Jobauthentifizierung oder aktive Sync-Administrationsrolle erzwingen; Mandantenscope und datensparsame Fehlerausgaben ergänzen.

Auswirkung: - Unberechtigte Logverarbeitung
- Alarm- und Mailmissbrauch

Tests: - Geplant: anonym ohne Log-Read; falscher Mandant negativ; autorisierter Alarmjob positiv.

Rollback: Alarmjob stoppen; erzeugte Alarme revisionssicher kennzeichnen.

## lov_finding_55eebf6531b0d797 · PRODUCT HUB

Anyone can overwrite catalog items through product importing

Ursache: Requestparameter steuern Mapping und Scraping ohne Aufruferprüfung. Scrapeergebnisse werden anhand SKU in catalog_items eingefügt oder aktualisiert; Importjobs und Quellenstatus werden privilegiert verändert.

Funktionen: - catalog-import-firecrawl

Korrektur: Aktive Katalogimportrolle verlangen; Quellen erlaubnislistenbasiert beschränken, Vorschau von Freigabe trennen und Schreibscope prüfen.

Auswirkung: - Katalogmanipulation
- Scrapingkosten
- Unberechtigte Produktimporte

Tests: - Geplant: anonym, unerlaubte Quelle und fremder Katalog negativ; freigegebener Import positiv.

Rollback: Import deaktivieren; betroffene SKU-Versionen aus Vorbestand wiederherstellen.

## lov_finding_59b7e25453966dd1

OAuth callback saves attacker tokens under a chosen user

Ursache: Der OAuth-Callback übernimmt state direkt als user_id. Nach erfolgreichem Provider-Codeaustausch werden Tokens privilegiert für diese frei gewählte ID gespeichert. Es fehlt eine serverseitig gespeicherte, einmalige State-Bindung an die initiierende Sitzung.

Funktionen: - esc-calendar-oauth

Korrektur: Zufälligen einmaligen State mit Nutzer-, Provider-, Redirect- und Ablaufbindung speichern; vor Tokenpersistierung atomar verbrauchen, PKCE ergänzen.

Auswirkung: - Fremdverknüpfung von Kalenderkonten
- Verletzung der OAuth-Sitzungsintegrität

Tests: - Geplant: fremde user_id, manipuliertes State, Replay und abgelaufenes State negativ; legitimer Callback positiv.

Rollback: OAuth-Verknüpfung sperren; verdächtige Verbindungen widerrufen und neu autorisieren.

## lov_finding_5e150bdaabc5e021

Anyone can trigger mediapaket reminders and anonymization

Ursache: Der Reminderhandler besitzt keine Aufruferprüfung. Er verarbeitet Pakete global, versendet Erinnerungen und kann bei entsprechender Konfiguration Kontakt-/Teamdaten anonymisieren. Konfigurations- und Fälligkeitsprüfungen ersetzen keine Jobautorisierung.

Funktionen: - mediapaket-reminders

Korrektur: Maschinenauthentifizierung vor Verarbeitung erzwingen; Anonymisierung separat berechtigen und protokolliert freigeben.

Auswirkung: - Unberechtigte Erinnerungen
- Unbefugtes Auslösen irreversibler Anonymisierung

Tests: - Geplant: anonym ohne Reads oder Versand; Konfigurationsschalter und Anonymisierungsgrenzen; autorisierter Job.

Rollback: Job stoppen; echte Anonymisierung nicht ohne Datenschutzprüfung rückgängig machen.

## lov_finding_607c1e0633e683f5

Anyone can download another person’s direct-debit details

Ursache: Die einzige Authprüfung ist startsWith('Bearer '); der Token wird nicht validiert. run_id lädt Service-Role-seitig Lastschriftlauf und Mandate einschließlich IBAN, erzeugt XML und setzt Exportstatus ohne Rollen-, Aktivitäts- oder Mandantenprüfung.

Funktionen: - finance-ch-dd-export

Korrektur: Token verbindlich validieren; aktive Exportrolle und Laufmandant prüfen; Exportzustandsänderung atomar durchführen.

Auswirkung: - Offenlegung von Bank- und Mandatsdaten
- Unberechtigte Exportstatusänderungen

Tests: - Geplant: beliebiger Bearertext, fremder Lauf und falsche Rolle negativ; autorisierter XML-Export positiv.

Rollback: Export sperren; Exportstatus anhand Auditdaten korrigieren.

## lov_finding_63fca018638248be_28891043

Anyone can post messages into other chat conversations

Ursache: send bindet das Gespräch an die Website, nicht an den Besucher. visitor_hash wird nur als Metadatum gespeichert und nicht gegen das Gespräch geprüft. Mit öffentlichem Website-Schlüssel und fremder Gesprächs-ID lassen sich Nachrichten einschleusen.

Funktionen: - ac-chat
- loadConversation

Korrektur: Gesprächsgebundenes Besuchercredential vor jedem Send prüfen; Größen- und Ratenlimits sowie Replaykontrolle ergänzen.

Auswirkung: - Chat-Impersonation
- Manipulation fremder Kundenkommunikation
- Unberechtigte KI-Folgeaktionen

Tests: - Geplant: Besucher A kann nicht in Gespräch B schreiben; manipuliertes visitor_hash ohne Wirkung; eigener Send positiv.

Rollback: Ungebundene Sends sperren; eingeschleuste Nachrichten revisionssicher markieren.

## lov_finding_676a76c192d1c5c0

Anyone can change an invoice's payment reference

Ursache: Ein beliebiger Bearer-Präfix genügt. Ohne Tokenvalidierung lädt der Adminclient body.id und generiert bei fehlender QRR-Referenz einen vom reference_seed beeinflussten Wert; anschließend werden Referenz und gegebenenfalls Status gespeichert. Bestehende Referenzen werden nicht beliebig überschrieben.

Funktionen: - finance-qr-generate

Korrektur: Aktives Finanzkonto mit Rechnungs-/Mandantenscope verlangen; Referenz ausschließlich serverseitig und atomar initialisieren.

Auswirkung: - Unberechtigte Referenzinitialisierung
- Offenlegung von QR-Zahlungsdaten
- Statusänderung

Tests: - Geplant: ungültiger Bearer und fremde Rechnung negativ; bestehende Referenz unverändert; zulässige Initialisierung positiv.

Rollback: Persistierenden QR-Pfad sperren; Referenzänderungen nur nach Zahlungsabgleich zurücknehmen.

## lov_finding_6bdc45abf053d23e · PRODUCT HUB

Anyone can create product records

Ursache: Der Importhandler prüft keinen Aufrufer. Er verarbeitet Request-/Quelldaten privilegiert und erstellt oder aktualisiert ph_products samt Kanal-, Medien- und Dokumentdaten. body.user_id dient als Attribution, nicht als verifizierte Identität.

Funktionen: - product-hub-import

Korrektur: Aktive Product-Hub-Importrolle und geprüfte Quelle erzwingen; importedBy aus verifizierter Identität ableiten; Vorschau und Schreibfreigabe trennen.

Auswirkung: - Unberechtigte Produktanlage und -änderung
- Manipulierte Herkunftszuordnung

Tests: - Geplant: anonym, gefälschte user_id und unzulässige Quelle negativ; erlaubter Import mit korrekter Attribution positiv.

Rollback: Import sperren; Produkte und Kinddaten anhand Importlauf und Vorversionen zurücksetzen.

## lov_finding_6f686b06e95c91e0

Anyone can send customer details to the analysis service

Ursache: Beliebige contact_id führt ohne Aufruferprüfung zu privilegierten Kontakt-, Nachrichten- und Anrufreads. Kontaktinformationen werden für die Kanalempfehlung an KI übertragen; verify_jwt ist false.

Funktionen: - ac-omnichannel-orchestrate

Korrektur: Aktive autorisierte Kontaktrolle und kontaktbezogenen Mandantenscope vor jeder Analyse verlangen.

Auswirkung: - Unberechtigte Kundendatenverarbeitung
- KI-Kosten

Tests: - Geplant: fremder Kontakt und anonym ohne KI-Aufruf; berechtigte Empfehlung positiv.

Rollback: Orchestrierungsanalyse deaktivieren; erzeugte Empfehlungen kennzeichnen.

## lov_finding_742579dc7034b64e

Anyone can change every customer's social metrics

Ursache: Die Authprüfung liegt ausschließlich im Zweig action ungleich sync und sync_one. Gerade die schreibenden Standardsyncs umgehen sie und aktualisieren Service-Role-seitig social_post_metrics mandantenübergreifend. Stubwerte werden dauerhaft gespeichert.

Funktionen: - social-metrics-sync

Korrektur: Alle Actions vor Verzweigung authentifizieren; aktive Socialrolle und Post-/Clientscope prüfen; Berechtigungs-RPC im Nutzerkontext ausführen.

Auswirkung: - Manipulierte Kundenmetriken
- Mandantenübergreifende Berichtsschäden

Tests: - Geplant: sync und sync_one anonym negativ; fremder Post negativ; berechtigter Scope positiv.

Rollback: Sync stoppen; betroffene Tagesmetriken aus vertrauenswürdiger Quelle neu erstellen.

## lov_finding_755a57788035e770

Signed-in users can email order links to arbitrary addresses

Ursache: getUser ist vorhanden, aber danach werden beliebige Signatur-/Auftrags-IDs mit separatem Adminclient gelesen. recipient_email ist frei übersteuerbar; erzeugte Downloadlinks enthalten gültige Signatur- oder HMAC-Credentials. Eine Auftrags- oder Mandantenautorisierung fehlt.

Funktionen: - send-order-confirmation
- signOrderToken

Korrektur: Aktive Auftragsversandrolle und Zugriff auf Auftrag sowie Signaturanfrage prüfen; Empfänger serverseitig binden, Overrides separat berechtigen.

Auswirkung: - Abfluss zugangsfähiger Auftragslinks
- Unberechtigte Bestellmails

Tests: - Geplant: fremder Auftrag und beliebiger Empfänger negativ; gemischte Signatur-/Auftrags-IDs negativ; legitimer Versand positiv.

Rollback: Versand sperren; kompromittierte Downloadcredentials gezielt widerrufen.

## lov_finding_773ec74739954988

Any signed-in user can copy another user's mail attachment

Ursache: Nach getUser wird der Mailanhang ausschließlich per ID mit Service-Role geladen und aus dessen Speicherpfad kopiert. Mailkonto-, Nachrichten-, Mandanten- und Zielobjektberechtigung fehlen. Das neue Dokument wird dem Aufrufer zugeschrieben.

Funktionen: - alixdocs-mail-import

Korrektur: Aktives Dokumentimportrecht, Zugriff auf Quellmailkonto und Nachricht sowie Zielkunde/-auftrag vor Download und Upload prüfen.

Auswirkung: - Kopieren fremder privater Anhänge
- Unberechtigte Dokumentzuordnung

Tests: - Geplant: fremdes Mailkonto, fremder Zielauftrag und deaktivierter Nutzer negativ; eigener erlaubter Anhang positiv.

Rollback: Import sperren; unberechtigte Kopien und Versionen kontrolliert entfernen, Audit behalten.

## lov_finding_7cfb49a133e44934

Anyone can run maintenance reminders

Ursache: Nach OPTIONS wird ohne Aufruferprüfung der Wartungs-/Garantiestatus aktualisiert und device_maintenance verarbeitet. Erinnerungslogs und Versandflags werden privilegiert geschrieben; Fälligkeit ersetzt keine Jobberechtigung.

Funktionen: - maintenance-reminder-daily
- public.refresh_warranty_and_maintenance_status

Korrektur: Maschinenauthentifizierung vor Statusrefresh und Reminderverarbeitung; interaktive Läufe nur für aktive Wartungsadministration.

Auswirkung: - Unberechtigte Wartungsläufe
- Manipulierte Erinnerungszustände

Tests: - Geplant: anonym ohne RPC oder Änderungen; autorisierter Job und Wiederholungsfestigkeit positiv.

Rollback: Scheduler und Endpoint sperren; Flags anhand Reminderlog korrigieren.

## lov_finding_80f949ebfeee1886

No-assignment users can generate all-tenant reminders

Ursache: getTenantScope weist Nutzer ohne user_tenant_access-Einträge ausdrücklich allen aktiven Mandanten zu: restricted wird ids.size > 0. Die Engine setzt dann scopedIds auf null. Es fehlt zusätzlich eine aktive Finanzrollenprüfung; der globale Zugriff ist somit nicht nur eine UI-Frage.

Funktionen: - finance-reminder-engine
- getTenantScope

Korrektur: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Rechte explizit modellieren und aktive Finanzrolle verlangen.

Auswirkung: - Mandantenübergreifende Mahnentwürfe
- Umgehung expliziter Mandantenzuweisung

Tests: - Geplant: Nutzer ohne Zuweisung negativ; einzelner Mandant isoliert; explizite globale Finanzrolle positiv.

Rollback: Engine sperren; gemeinsame Scopeänderung kontrolliert ausrollen und bei Problemen fail-closed halten.

## lov_finding_86d3d8b71cfd055f

Any finance user can create another tenant’s payment link

Ursache: Identität und eine erlaubte Finanzrolle werden geprüft. Der folgende collect_cases-Read erfolgt jedoch ausschließlich über caseId mit Adminclient; keine Mandanten- oder Fallzuordnung begrenzt die Anlage und Rückgabe eines Zahlungstokens.

Funktionen: - collect-payment-link

Korrektur: Aktiven Kontostatus und Fallmandant gegen verifizierten Nutzerscope prüfen, bevor Link oder Token erzeugt wird.

Auswirkung: - Zahlungslinks für fremde Mandanten
- Unberechtigte Fallkommunikation

Tests: - Geplant: erlaubte Finanzrolle mit fremdem caseId negativ; deaktiviertes Konto negativ; eigener Fall positiv.

Rollback: Linkanlage sperren; unberechtigt erzeugte Tokens widerrufen.

## lov_finding_88ebf49df7bfdf53

Any signed-in user can send reminders to any customer

Ursache: Nicht-Cron-Aufrufer werden authentifiziert, benötigen im Normalpfad aber keine Rolle. Nur body.override löst eine Super-Admin-Prüfung aus. reminder_ids werden anschließend über privilegierte REST-Requests ohne Mandantenscope geladen und verarbeitet.

Funktionen: - rz-reminder-send

Korrektur: Auch Normalversand an aktive Finanzrolle und Reminder-/Mandantenscope binden; Cronzugang strikt getrennt halten.

Auswirkung: - Unberechtigte Kundenmahnungen
- Mandantenübergreifender Versand

Tests: - Geplant: normaler Login ohne override negativ; fremde Reminder-ID negativ; berechtigter Versand und Cron positiv.

Rollback: Versand stoppen; Reminderzustände über Versandprotokoll abgleichen.

## lov_finding_8b7a66d6300430d8

Any signed-in user can text another team's case details

Ursache: Verifizierte Nutzerclaims genügen zum Service-Role-Read beliebiger as_cases_list_v-IDs. Keine aktive Fachrolle, Team- oder Mandantenzuordnung wird geprüft, bevor Falldaten in SMS und Reminder-/Timelineeinträge eingehen. Dies ist der objektbezogene Zugriffspfad, nicht lediglich freie Textwahl.

Funktionen: - as-send-sms-reminder

Korrektur: Fallzugriff im Nutzerkontext prüfen; aktive Team-/Fachrollen und Mandantenscope vor Fallread und Versand verlangen.

Auswirkung: - Fremde Falldaten per SMS
- Unberechtigte Fallhistorie

Tests: - Geplant: gültiger Login aus anderem Team/Mandanten negativ; eigener Fall mit erlaubter Rolle positiv.

Rollback: Fallbezogenen SMS-Versand sperren; unberechtigte Historieneinträge markieren.

## lov_finding_94ff829ba690f3f3

Anyone can run bank reconciliation

Ursache: Der Handler beginnt ohne Aufruferprüfung mit privilegierten Bank- und Rechnungsreads. Er ersetzt Vorschläge, aktualisiert Matchscores und kann Zuweisungen sowie Rechnungs- und Banktransaktionsstände verändern. verify_jwt ist false.

Funktionen: - bank-auto-reconcile

Korrektur: Maschinencredential oder aktive Bankabgleichrolle verlangen; Buchungskreis serverseitig begrenzen und automatische Buchungen gesondert freigeben.

Auswirkung: - Manipulierte Zahlungszuordnungen
- Veränderte Finanzsalden
- Mandantenübergreifender Abgleich

Tests: - Geplant: anonym und fremder Buchungskreis ohne Änderung; Vorschau ohne Writes; autorisierter Abgleich positiv.

Rollback: Abgleich sperren; Zuweisungen und Salden transaktionsbezogen aus Auditdaten rückführen.

## lov_finding_98d1a9730f1bf438_c0935e03

Anyone can trigger dunning runs across tenant invoices

Ursache: Der Mahnlauf prüft keine Identität. tenantId ist optionaler Requestfilter; ohne ihn werden fällige Dokumente mandantenübergreifend selektiert, Mahndokumente angelegt und gegebenenfalls Mails versendet.

Funktionen: - cmr-dunning-run

Korrektur: Globalen Job maschinell authentifizieren; interaktive Läufe nur für aktive Finanzrolle innerhalb erlaubter Mandanten.

Auswirkung: - Unberechtigte Mahndokumente
- Kundenmails
- Veränderte Mahnstände

Tests: - Geplant: anonym und fremde tenantId negativ; autorisierter Lauf und Replayfestigkeit positiv.

Rollback: Mahnlauf stoppen; Dokumente fachlich stornieren und Mahnstände abgleichen.

## lov_finding_9d9c7365b4cce7e8

Anyone can receive results from the paid AI service

Ursache: Ohne Authentifizierung werden beliebige Kontakte samt Nachrichteninhalt und Anrufdaten privilegiert gelesen und an kostenpflichtige KI übermittelt. Ergebnisse werden als Vorhersage gespeichert; verify_jwt ist false.

Funktionen: - ac-revenue-intel-v2

Korrektur: Aktive Vertriebs-/Analyseberechtigung und Kontaktmandant vor Reads, KI und Ergebniszugriff prüfen.

Auswirkung: - Fremde Kundenkommunikation in KI
- Unberechtigte Analyseergebnisse
- KI-Kosten

Tests: - Geplant: anonym, fremder Kontakt und deaktiviertes Konto negativ; erlaubte Analyse positiv.

Rollback: KI-Endpunkt sperren; unberechtigt erzeugte Vorhersagen kennzeichnen.

## lov_finding_a33d1e6c8240851c

Anyone can view company revenue forecasts

Ursache: Nach OPTIONS folgt ohne Identitätsprüfung ein Service-Role-Read von Umsatzattributionen. Zeitraum und Modell werden aus dem Request übernommen; durchschnittliche Tagesumsätze und 30-/60-/90-Tage-Prognosen werden ohne Rollen- oder Mandantengrenze zurückgegeben.

Funktionen: - ac-revenue-forecast

Korrektur: Aktive Umsatzanalyse-/Finanzrolle und Mandantenscope verlangen; Zeitraum begrenzen.

Auswirkung: - Offenlegung vertraulicher Unternehmensumsätze und Prognosen

Tests: - Geplant: anonym, unberechtigte Rolle und fremder Mandant negativ; erlaubter Forecast positiv.

Rollback: Forecastendpoint sperren; keine Datenrückführung erforderlich.

## lov_finding_a63e6a6f8b835b5d

Anyone can trigger customer shipping notices

Ursache: Vom Request gelieferte Seriennummern werden ohne Aufruferprüfung privilegiert zu Lagergeräten, Aufträgen und Kunden aufgelöst. Der Endpoint ruft danach den Transaktionsmailversand mit Servercredential auf.

Funktionen: - lager-bestand-notify

Korrektur: Aktive Lager-/Versandrolle oder vertrauenswürdiges Jobcredential prüfen; Seriennummern und Aufträge auf Mandanten- und Versandzustand begrenzen.

Auswirkung: - Unberechtigte Versandbenachrichtigungen
- Missbrauch interner Versandcredentials

Tests: - Geplant: anonym, fremde Seriennummer und nicht versandbereiter Auftrag negativ; legitimer Versand positiv.

Rollback: Benachrichtigungsendpoint sperren; versandte Mails nicht rückholbar.

## lov_finding_aab25c4aac0c36d0_c2bf6c3e

Anyone can evaluate and access call transcripts

Ursache: call_id und scorecard_id werden ohne Aufruferprüfung privilegiert aufgelöst. Das Gesprächstranskript wird an KI gesendet; Bewertungen und gegebenenfalls Coaching-Sessions werden angelegt und Bewertungsdaten zurückgegeben.

Funktionen: - ac-qm-auto-score

Korrektur: Aktive QM-Rolle und Zugriff auf Gespräch, Agent und Scorecard innerhalb des Mandanten vor KI-Verarbeitung prüfen.

Auswirkung: - Unberechtigte Verarbeitung von Gesprächstranskripten
- Manipulierte Mitarbeiterbewertungen
- KI-Kosten

Tests: - Geplant: fremdes Gespräch und falsche Rolle ohne KI oder Writes; erlaubte QM-Bewertung positiv.

Rollback: Scoring sperren; unberechtigte Bewertungen und Folgecoachings revisionssicher zurücknehmen.

## lov_finding_ae041d22cd49aa24

Ordinary users can send survey invitations

Ursache: Der Handler verlangt eine Nutzeridentität beziehungsweise akzeptiert seinen Servicepfad, aber prüft anschließend keine aktive Umfrageverwaltungsrolle. survey_id lädt Umfrage und Empfänger mit Adminclient; Einladungen und Versandlogs werden erzeugt.

Funktionen: - survey-send-invites

Korrektur: Aktive Umfrageverwaltungsrolle und Umfrage-/Mandantenzugriff prüfen; Servicezugang exakt und getrennt validieren.

Auswirkung: - Unberechtigte Einladungen
- Versandkosten
- Manipulierte Umfragehistorie

Tests: - Geplant: gewöhnlicher Login und fremde Umfrage negativ; berechtigter Versand sowie Wiederholung positiv.

Rollback: Einladungsversand sperren; unberechtigt erstellte Einladungstokens widerrufen.

## lov_finding_b59f50206d13ea0b

Service users can text any phone number

Ursache: Claims und erlaubte Rollen werden geprüft. Danach stammen customer_id, document_id, phone und message_text aus dem Request. Eine Bindung von Telefonnummer und Dokument an einen berechtigten Kunden fehlt vor Token-/Linkerzeugung und SMS-Versand; aktiver Kontostatus wird ebenfalls nicht geprüft.

Funktionen: - send-customer-sms

Korrektur: Aktives Versandkonto sowie Kunden-, Dokument- und Mandantenzugriff prüfen; Telefonnummer aus autorisiertem Kunden ableiten, Override gesondert berechtigen.

Auswirkung: - SMS an beliebige Telefonnummern
- Abfluss von Dokumentlinks
- Providerkosten

Tests: - Geplant: erlaubte Rolle mit fremdem Dokument oder abweichender Telefonnummer negativ; legitimer Versand positiv.

Rollback: SMS sperren und unberechtigt erzeugte Dokumenttokens widerrufen.

## lov_finding_b86c0cca0683482a

Anyone can create ticket appointments

Ursache: callerAuth wird gelesen, aber vor privilegiertem Ticketread und Eventanlage nicht authentifiziert oder autorisiert. Requestwerte können Abteilung, Bearbeiter, Ressource und Kundenangaben übersteuern; UUID-Validierung prüft keine Zugriffsrechte.

Funktionen: - ticket-create-appointment

Korrektur: Aktive Termin-/Ticketrolle und Ticketzugriff verlangen; sämtliche Ressourcen- und Abteilungsüberschreibungen auf erlaubten Scope prüfen.

Auswirkung: - Unberechtigte Termine
- Manipulierte Ressourcenbelegung
- Falsche Kundendaten

Tests: - Geplant: anonym, fremdes Ticket und fremde Ressource negativ; erlaubte Terminanlage positiv.

Rollback: Terminendpoint sperren; unberechtigte Termine stornieren und Bestätigungstokens widerrufen.

## lov_finding_ba7c311bb074fdc2_bd0ae6c3

Anyone can retrieve predictions for any contact

Ursache: Der Handler akzeptiert contact_id ohne Identitätsprüfung und liest Kontakt und Kommunikationshistorie privilegiert für die Vorhersage. Weder aktiver Nutzer noch Kontakt-/Mandantenscope sind vorgeschaltet; verify_jwt ist false.

Funktionen: - ac-predictive-engagement

Korrektur: Aktive Kontaktanalyseberechtigung und Kontaktmandant vor Datenzugriff und Vorhersage erzwingen.

Auswirkung: - Unberechtigte Kontaktanalysen
- Verarbeitung fremder Kommunikationshistorie

Tests: - Geplant: anonym und fremde Kontakt-ID ohne Analyse; berechtigter Kontakt positiv.

Rollback: Vorhersageendpoint sperren; unberechtigte Ergebnisse kennzeichnen.

## lov_finding_be09aadb01290773

Any signed-in user can export direct-debit details

Ursache: getUser validiert den Login. Der nachfolgende separate Adminclient lädt jedoch beliebige finance_sepa_runs und Laufpositionen nach runId ohne aktive Finanzrolle oder Mandantenzuordnung und setzt anschließend Exportstatus.

Funktionen: - finance-sepa-export

Korrektur: Aktive Lastschriftexportrolle und Zugriff auf Laufmandant vor Mandatsread und Export erzwingen.

Auswirkung: - Offenlegung fremder Lastschriftdaten
- Unberechtigte Exportstatusänderung

Tests: - Geplant: gewöhnlicher Login, deaktivierte Finanzrolle und fremder Lauf negativ; erlaubter Export positiv.

Rollback: Export sperren; Status anhand Exporthistorie korrigieren.

## lov_finding_c1f51fb90f414c65

Signed-in users can place calls to arbitrary destinations

Ursache: Nach erfolgreichem Login fehlt eine aktive Telefonierrolle. Der Adminclient fällt von Nutzereinstellungen auf globale PBX-Einstellungen zurück und sendet Requestfeld to als destination an makecall. Kontakt-/Gesprächsberechtigung und Zielrufnummernregeln fehlen.

Funktionen: - ac-3cx-call

Korrektur: Aktive Telefonierberechtigung, erlaubte Nebenstelle und Kontakt-/Mandantenscope prüfen; Rufnummernklassen, Kosten- und Ratenlimits erzwingen.

Auswirkung: - Unberechtigte Anrufe
- Telefoniekosten
- Missbrauch globaler PBX-Zugänge

Tests: - Geplant: normaler Login, gesperrtes Ziel und unberechtigter globaler Fallback negativ; erlaubter Anruf positiv.

Rollback: makecall-Pfad sperren; laufende Anrufe gegebenenfalls administrativ beenden.

## lov_finding_c45c9cbb478d7312

Anyone can trigger status notification emails to customers

Ursache: Die Action notify_customer_status besitzt anders als benachbarte interne Actions keinen eigenen Authblock. Frei gelieferte mp_id und new_status lösen privilegierten Kundenread, signierten Portallink, Mailversand und Historieneintrag aus; verify_jwt ist false.

Funktionen: - mediapaket-portal:notify_customer_status

Korrektur: Aktives Paketverwaltungsrecht und Paketzugriff vor dieser Action prüfen; Status aus bestätigtem Datenbankzustand ableiten.

Auswirkung: - Gefälschte Statusmails
- Unberechtigtes Erzeugen von Portallinks
- Manipulierte Historie

Tests: - Geplant: anonym, fremdes Paket und erfundener Status negativ; legitimer Statuswechsel positiv.

Rollback: Nur betroffene Action sperren; kompromittierte Portallinks widerrufen.

## lov_finding_c79ad01cbeb6bd2e

Anyone can run document hash maintenance

Ursache: Die Rollenprüfung läuft nur bei jwt && jwt !== serviceKey. Ein fehlender Authorization-Header überspringt sie vollständig. Danach werden Dokumentversionen privilegiert heruntergeladen und content_hash-Werte geschrieben.

Funktionen: - alixdocs-hash-backfill

Korrektur: Fehlendes Credential vor jedem Zugriff abweisen; Servicecredential exakt prüfen, sonst aktive Adminrolle verbindlich validieren.

Auswirkung: - Unberechtigte Dokumentwartung
- Speicher-/Rechenlast
- Globale Hashänderungen

Tests: - Geplant: leerer Header, ungültiger Token und gewöhnlicher Login negativ; aktiver Admin und Jobcredential positiv.

Rollback: Backfill sperren; Hashes nur aus verifizierten Originaldateien neu berechnen.

## lov_finding_d516be27dfccb6c8

Anyone can reassign another customer's ticket

Ursache: Ohne Aufruferprüfung wird ticket_id mit Service-Role geladen. Routing kann Ticketabteilung ergänzen, Bearbeiter bestimmen und tickets sowie ticket_history verändern. Ticket-, Mandanten- oder aktive Rollenautorisierung fehlt.

Funktionen: - ticket-router

Korrektur: Vertrauenswürdigen Routingjob oder aktive Ticketverwaltungsrolle mit Ticketzugriff verlangen; Zielbearbeiter und Abteilung im gleichen Scope prüfen.

Auswirkung: - Unberechtigte Ticketzuweisung
- Verfälschte Tickethistorie

Tests: - Geplant: anonym und fremdes Ticket negativ; berechtigter Routinglauf positiv.

Rollback: Routingendpoint sperren; Zuordnungen anhand Historie zurücksetzen.

## lov_finding_d86e3d3e3deb87d6

Anyone can message any email or phone number

Ursache: Im Handler fehlt eine eigene Aufruferprüfung vollständig. recipient, subject und body werden unmittelbar für E-Mail, SMS oder WhatsApp genutzt. verify_jwt = true ist nur ein Gateway-Tokencheck und ersetzt keine aktive Mitarbeiter-, Rollen-, Event- oder Mandantenberechtigung.

Funktionen: - esc-send-message
- sendEmail
- sendTwilio

Korrektur: Verifizierte aktive Mitarbeiteridentität, kanalspezifisches Versandrecht und Event-/Empfängerscope serverseitig erzwingen.

Auswirkung: - Beliebige Markenkommunikation
- Spam/Phishing
- Providerkosten

Tests: - Geplant: gültiger Token ohne Versandrolle negativ; fremdes Event und beliebiger Empfänger negativ; erlaubter Versand positiv.

Rollback: Nachrichtenendpoint sperren; Providerlimits und Missbrauchsmonitoring aktivieren.

## lov_finding_dae991b95413b3dd

Anyone can merge and delete customer records

Ursache: Ohne Identitäts- oder Rollenprüfung liest der Handler Kontakte privilegiert, verschiebt Nachrichten und Anrufe auf einen Master und löscht Duplikatkontakte. Es gibt vor dieser destruktiven Operation keine verifizierte Mandantengrenze.

Funktionen: - ac-omnichannel-merge

Korrektur: Aktive Datenadministrationsrolle oder enges Jobcredential verlangen; Kandidaten strikt mandantenbezogen bilden und Merge atomar freigeben.

Auswirkung: - Destruktive Kontaktzusammenführung
- Falsche Kommunikationszuordnung
- Mandantenvermischung

Tests: - Geplant: anonym und mandantenübergreifendes Kandidatenpaar negativ; atomarer erlaubter Merge; Fehlerrollbacks.

Rollback: Merge sofort sperren; Wiederherstellung benötigt gesicherte Kontakt- und Fremdschlüsselvorwerte.

## lov_finding_e2c148fb68294c0b_ef5f34ce

Any signed-in user can overwrite another user's document

Ursache: Nach getUser lädt ein separater Adminclient existing_document_id ohne Dokumentberechtigung und berechnet die nächste Version. upload verwendet zwar upsert:false und überschreibt damit nicht dieselben Speicherbytes; fremde Dokumente können dennoch durch neue Version und Aktualisierung ihres aktuellen Stands verändert werden.

Funktionen: - alixdocs-upload

Korrektur: Aktives Dokumentbearbeitungsrecht sowie Dokument-, Kunden-/Auftrags- und Mandantenscope vor privilegiertem Read und Upload prüfen; Versionierung atomar machen.

Auswirkung: - Manipulation fremder Dokumentversionen
- Verlust der Dokumentintegrität

Tests: - Geplant: fremdes Dokument und deaktivierter Nutzer negativ; erlaubte neue Version; parallele Versionierung und Fehlerbereinigung.

Rollback: Versionierungsupload sperren; current_version auf verifizierte Vorversion setzen und Fremdversion quarantänisieren.

## lov_finding_e9436bf2ec03c48f_2176d0bb

Anyone can update repair quote status and history

Ursache: quote_id führt ohne eigene Aufruferprüfung zu Service-Role-Reads, Versand und Status-/Historienupdates. Der gültige approval_token wird sogar als Link zurückgegeben. verify_jwt = true begrenzt den Gatewayzugang, prüft aber weder aktive Servicerolle noch Reparatur-/Mandantenzugriff.

Funktionen: - send-repair-quote

Korrektur: Aktive berechtigte Servicerolle und Zugriff auf Angebot/Reparatur prüfen; Versandstatus nur nach bestätigtem Erfolg setzen und Approvalcredentials nicht unnötig zurückgeben.

Auswirkung: - Unberechtigter Angebotsversand
- Manipulierte Angebotsstände
- Abfluss von Freigabelinks

Tests: - Geplant: gültiger fremder Login und fremdes Angebot negativ; Providerfehler ohne Status Versendet; legitimer Versand positiv.

Rollback: Versand sperren; kompromittierte Freigabetokens rotieren und Status fachlich abgleichen.

## lov_finding_eb3640852bce3732

Anyone can trigger payment reminders

Ursache: Der Handler liest Request und Mahnkonfiguration ohne Aufruferprüfung. Bei aktivierten Stufen und auto_enabled ungleich false verarbeitet er offene Anzahlungen privilegiert. dry_run sowie Konfigurationsschalter sind Betriebssteuerung, keine Authentifizierung; verify_jwt ist false.

Funktionen: - anzahlung-mahn-engine

Korrektur: Maschinenauthentifizierung oder aktive Finanzrolle mit Mandantenscope vor Konfigurations- und Finanzdatenzugriff verlangen.

Auswirkung: - Unberechtigte Anzahlungsmahnläufe
- Kundenkommunikationsmissbrauch

Tests: - Geplant: anonym und fremder Mandant negativ; deaktivierte Automatik bleibt wirkungslos; autorisierter Lauf positiv.

Rollback: Automatik und Endpoint sperren; Kommunikations- und Mahnstände abgleichen.

## lov_finding_01689a0ccfff4e89

Signed-in users can read arbitrary reminder records

Ursache: Der Benutzerpfad prüft lediglich die Anmeldung. Die Rollenprüfung betrifft nur override, nicht das normale Laden frei gewählter reminder_ids mit Service Role. Vorschau und Versand bleiben ohne Ressourcenberechtigung erreichbar.

Funktionen: - rz-reminder-send

Korrektur: Aktives Finanzkonto und Berechtigung für jede Erinnerung vor Service-Role-Abfragen prüfen; Maschinenpfad separat absichern.

Auswirkung: - Unberechtigter Zugriff auf Erinnerungsdaten
- Unberechtigter Versand und Statusänderungen

Tests: - Fremde Erinnerungs-ID und inaktives Konto müssen vor Datenabfrage und Versand abgewiesen werden; berechtigte Vorschau positiv prüfen.

Rollback: Bei Fehlern Versand sperren; Autorisierungsprüfung nicht entfernen.

## lov_finding_02f750951452daf6

Anyone can trigger processing of private journey runs

Ursache: Nach OPTIONS erfolgt ohne Handler-Authentifizierung die Service-Role-Abfrage fälliger Journey-Läufe samt Kontakten. Statusänderungen und Kommunikationsschritte sind erreichbar; die Antwort gibt vor allem Zähler zurück, nicht sämtliche gelesenen Kontaktdaten.

Funktionen: - ac-journey-tick

Korrektur: Vor allen Datenoperationen ausschließlich verifizierte Job-Zugangsdaten zulassen.

Auswirkung: - Unberechtigtes Auslösen von Kundenkommunikation
- Veränderung von Journey-Zuständen

Tests: - Fehlende, öffentliche und gefälschte Job-Zugangsdaten ohne Datenzugriff ablehnen; gültigen Job isoliert mit Versand-Mocks prüfen.

Rollback: Scheduler pausieren und Endpunkt gesperrt lassen.

## lov_finding_09ffea0c64262705

Anyone can create the Sobitsch account and commission records

Ursache: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Kontoanlage sowie Profil- und Provisionsänderungen aus. Die explizite Gateway-Einstellung ist verify_jwt=false. Fest vorgegebene Zieldaten sind keine Autorisierung.

Funktionen: - tmp-create-sobitsch

Korrektur: Temporären Produktionsendpunkt entfernen beziehungsweise vollständig sperren; erforderliche Migration ausschließlich kontrolliert administrativ ausführen.

Auswirkung: - Unberechtigte Kontoanlage
- Manipulation von Provisionszuordnungen

Tests: - Deployment ohne erreichbaren temporären Endpunkt prüfen; bestehende Provisionszuordnungen schreibgeschützt auf Wiederholungseffekte untersuchen.

Rollback: Endpunkt nicht reaktivieren; fachliche Datenkorrektur separat freigeben.

## lov_finding_10fba61adf821212 · PRODUCT HUB

Anyone can replace your product translations

Ursache: Der Handler startet Übersetzungs- und Requalifizierungsläufe ohne Aufruferberechtigung. overwrite beeinflusst bestehende Übersetzungen; Service-Role-Upserts sind erreichbar. ai_draft verhindert die unberechtigte Änderung gespeicherter Inhalte nicht. Keine controlled_modes-Voroperationssperre vorhanden.

Funktionen: - ph-en-batch
- runBatch
- requalify

Korrektur: Aktive Product-Hub-Bearbeitungsberechtigung beziehungsweise verifizierten Batch-Aufrufer vor Datenzugriff verlangen; Überschreiben separat berechtigen.

Auswirkung: - Manipulation von Produktübersetzungen und Qualitätsständen
- Unberechtigte KI-Kosten

Tests: - Unberechtigte Batch-, overwrite-, Requalifizierungs- und Hintergrundaufrufe ohne Upsert und KI-Aufruf ablehnen.

Rollback: Batchfunktion sperren; Übersetzungen nur aus geprüfter Historie wiederherstellen.

## lov_finding_13d6e91ec712f40a_604475b4

Anyone can view customer scores and routing details

Ursache: getUser wird aufgerufen, sein Ergebnis aber nicht als Zugriffssperre verwendet. Kundenbewertungen und Routingdaten werden privilegiert gelesen; save kann Simulationen speichern.

Funktionen: - ac-router-simulate

Korrektur: Fehlende Identität abweisen und aktive Routing-Berechtigung samt Mandantenbindung vor allen Service-Role-Abfragen prüfen.

Auswirkung: - Offenlegung von Kundenscores und Routinglogik
- Unberechtigte Simulationseinträge

Tests: - Leere Identität, fremden Kunden und fremden Mandanten ablehnen; save darf keine Nebenwirkung erzeugen.

Rollback: Simulator serverseitig deaktivieren.

## lov_finding_183ae0ad4cf721dc

Task IDs bypass compliance-task access policies

Ursache: Verifizierte Claims belegen nur die Identität. taskId führt anschließend zu Service-Role-Lesezugriffen auf Aufgabe, Projekt und Schritte ohne Aufgaben- oder Projektberechtigung; die Inhalte gelangen in die KI-Verarbeitung.

Funktionen: - compliance-ai-assist

Korrektur: Aufgabe und Projekt im berechtigten Benutzerkontext laden; aktive Projektberechtigung vor KI-Übermittlung prüfen.

Auswirkung: - Unberechtigte Verarbeitung vertraulicher Compliance-Inhalte
- Mögliche Offenlegung über KI-Antworten

Tests: - Fremde taskId und inaktives Konto vor KI-Aufruf ablehnen; erlaubte Aufgabe positiv prüfen.

Rollback: Aufgabenbasierte KI-Anreicherung sperren.

## lov_finding_1b423c4366778754_78e6bd31

Any signed-in user can see other sites' live visitor locations

Ursache: Die SECURITY-DEFINER-Funktion filtert nur nach frei gewählter Website-ID und Zeit. EXECUTE für authenticated enthält keine Website- oder Mandantenberechtigung. Ausgegeben werden Länderaggregate, keine präzisen Einzelstandorte.

Funktionen: - public.ac_web_live_map(uuid)

Korrektur: Aktive Website-Leseberechtigung innerhalb der SQL-Funktion erzwingen oder mit geeigneten RLS-Regeln SECURITY INVOKER verwenden.

Auswirkung: - Mandantenübergreifende Offenlegung von Live-Besucheraggregaten

Tests: - Direkten RPC-Aufruf für fremde Website, inaktiven Benutzer und berechtigten Benutzer isoliert prüfen.

Rollback: EXECUTE für Benutzer bis zur korrigierten Funktion entziehen.

## lov_finding_1deb9bcf8e2fe9db

Anyone can change any support ticket

Ursache: callerAuth wird übernommen und später weitergereicht, aber nicht vor dem privilegierten Laden des gewählten Tickets geprüft. Ereignisanlage, Ticketänderungen und Historieneinträge erfolgen vorher ohne Ressourcenberechtigung.

Funktionen: - ticket-create-appointment

Korrektur: Aktive Ticket- und Terminberechtigung vor Ticketabfrage und Ereignisanlage erzwingen.

Auswirkung: - Unberechtigte Termin- und Ticketänderungen
- Mögliche Kundenbenachrichtigungen

Tests: - Fremdes Ticket muss ohne Ereignis-, Historien- oder Mail-Nebenwirkung abgewiesen werden.

Rollback: Terminerstellung über diesen Handler sperren.

## lov_finding_217a6dfc717596f3_bfdcff55

Anyone can analyze private customer calls

Ursache: Der Handler lädt frei gewählte Anruftranskripte ohne Benutzerprüfung, verarbeitet sie und speichert beziehungsweise liefert Insights. verify_jwt=false ist explizit konfiguriert.

Funktionen: - ac-conv-intel-analyze

Korrektur: Aktive Gesprächsanalyse-Berechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff prüfen.

Auswirkung: - Offenlegung und externe Verarbeitung privater Gesprächsinhalte
- Unberechtigte Insight-Erstellung

Tests: - Anonyme, fremde und inaktive Aufrufer vor Transkript- und KI-Zugriff abweisen.

Rollback: Analyseendpunkt sperren.

## lov_finding_232765c9fa069fde

Any signed-in user can email another team's case details

Ursache: Der Benutzerpfad validiert Claims, prüft aber weder aktive Fallberechtigung noch Mandantenzugehörigkeit. Der gewählte Fall wird mit Service Role gelesen und dessen Inhalt versendet.

Funktionen: - as-send-email-reminder

Korrektur: Aktive Fall- und Versandberechtigung vor Fallabfrage erzwingen; Service-Role-Zugang exakt statt per Teilstring vergleichen.

Auswirkung: - Unberechtigter Versand fremder Falldaten
- Manipulation von Fallhistorien

Tests: - Fremden Fall und inaktives Konto ohne Versand oder Protokollmutation ablehnen.

Rollback: Erinnerungsversand serverseitig sperren.

## lov_finding_27ef54fe18b6bfc6

Anyone can inspect document matching feedback preview

Ursache: Die Authentifizierungsverzweigung lautet if (jwt && jwt !== serviceKey). Bei leerem JWT wird sie vollständig übersprungen; privilegierte Feedback-Abfragen und dryRun-Vorschauen bleiben im Handler erreichbar. Die vorhandenen Rollenprüfungen schließen diesen Leerpfad nicht.

Funktionen: - alixdocs-learn-rules

Korrektur: Leere Zugangsdaten ausdrücklich ablehnen; nur exakten nichtleeren Service-Schlüssel oder aktiven berechtigten Administrator zulassen.

Auswirkung: - Unberechtigter Zugriff auf Matching-Feedback
- Unberechtigte Regeländerungen außerhalb dryRun

Tests: - Fehlenden und leeren Authorization-Header sowie öffentliche Schlüssel vor sämtlichen Abfragen ablehnen.

Rollback: Regellernjob pausieren und Handler sperren.

## lov_finding_291229c8706e74d8

Anyone can change an event using a fake WhatsApp reply

Ursache: Der WhatsApp-Handler prüft vor Protokollierung und Statusänderung keine Provider-Signatur. Vom Aufrufer gelieferte Absender- und Antwortwerte steuern die Teilnehmerzuordnung und Ereignisänderung.

Funktionen: - esc-whatsapp-inbound

Korrektur: Provider-Signatur vor jeder Datenoperation verifizieren und Antwort an den erwarteten Teilnehmer und Vorgang binden.

Auswirkung: - Gefälschte Terminbestätigungen oder Ablehnungen
- Verfälschung von Kommunikationsprotokollen

Tests: - Fehlende, falsche und für andere URL gültige Signaturen ohne Mutation ablehnen; gültige Provider-Fixtures prüfen.

Rollback: Webhook-Eingang sperren und Antworten vorübergehend manuell bearbeiten.

## lov_finding_2c6eeae643a145a5

Any signed-in user can release another contract's invoices

Ursache: Die Anmeldung wird validiert, anschließend bestimmt profile_id jedoch ohne Vertrags- oder Finanzberechtigung den privilegierten Zugriff auf zurückgehaltene Rechnungen und deren Freigabeversand.

Funktionen: - pruefung-release

Korrektur: Aktive Freigabeberechtigung für Vertrag und Rechnungen vor dem Laden und Versenden prüfen.

Auswirkung: - Unberechtigte Rechnungsfreigabe
- Offenlegung von Vertrags- und Rechnungsdaten

Tests: - Unberechtigte Vertrags-ID und inaktives Finanzkonto ohne Versand oder Statusänderung ablehnen.

Rollback: Freigabeendpunkt sperren; bereits ausgelöste Freigaben separat fachlich prüfen.

## lov_finding_312fcf7bf6edca18_3be70c29

Anyone can send emails from your business

Ursache: Der Handler prüft nur das Präfix Bearer, nicht die Gültigkeit einer Identität oder Versandberechtigung. Empfänger, Betreff und Inhalt kommen vom Aufrufer. verify_jwt=false ist explizit konfiguriert.

Funktionen: - send-invoice-mail

Korrektur: Echte aktive Benutzer- beziehungsweise Maschinenberechtigung erzwingen; Versand an autorisierten Geschäftsvorgang binden.

Auswirkung: - Missbrauch geschäftlicher Absender
- Phishing, Spam und Versandkosten

Tests: - Beliebigen Bearer-Text, öffentliche Schlüssel und unberechtigte Benutzer ohne Provider-Aufruf ablehnen.

Rollback: Versandendpunkt sperren; keine Rückkehr zur Präfixprüfung.

## lov_finding_37d780060351d132

Anyone can send reminders containing a caller-chosen link

Ursache: Ohne Handler-Authentifizierung werden Pakete und Kontakte privilegiert geladen. base_url aus der Anfrage beeinflusst Kommunikationslinks. Tagesprotokolle begrenzen Wiederholungen, ersetzen aber keine Aufruferberechtigung.

Funktionen: - mediapaket-reminders

Korrektur: Verifizierten Job-Zugang vor Datenzugriff verlangen und Linkbasis ausschließlich aus vertrauenswürdiger Konfiguration beziehen.

Auswirkung: - Unberechtigter Erinnerungsversand
- Einbettung fremder Links in Geschäftskommunikation

Tests: - Unberechtigten Aufruf und fremde base_url ohne Mailversand prüfen; Idempotenz mit Mocks testen.

Rollback: Erinnerungsjob pausieren.

## lov_finding_39468467a3a1e242

Anyone can trigger quote emails to selected customers

Ursache: Der Handler besitzt keine eigene Identitäts- oder Angebotsberechtigungsprüfung vor Service-Role-Zugriff und Versand. verify_jwt=true begrenzt gegebenenfalls den Gateway-Einstieg, autorisiert aber keinen Zugriff auf das gewählte Angebot; die pauschale Behauptung anonymer Produktionserreichbarkeit ist damit nicht belegt.

Funktionen: - send-repair-quote

Korrektur: Aktive Reparaturangebots- und Versandberechtigung für quote_id erzwingen.

Auswirkung: - Unberechtigter Angebotsversand
- Unberechtigte Status- und Historienänderungen

Tests: - Authentifizierten Benutzer ohne Angebotsrecht ohne Versand und Mutation abweisen; Gateway-JWT separat prüfen.

Rollback: Angebotsversand sperren.

## lov_finding_3e001c78892db51d

Signed-in users can access other customers’ orders

Ursache: Die Benutzeridentität wird geprüft, aber der anschließende privilegierte Zugriff auf Signatur, Signaturanfrage und Bestellung ist nicht an deren Berechtigung gebunden.

Funktionen: - send-order-confirmation

Korrektur: Aktive Bestellberechtigung beziehungsweise streng getrennten Maschinenpfad vor jedem Bestell- und Signaturzugriff prüfen.

Auswirkung: - Unberechtigter Zugriff auf Bestell- und Kundendaten
- Unberechtigter Bestätigungsversand

Tests: - Fremde order_id und signatureId sowie inaktiven Benutzer ohne PDF- und Versandzugriff ablehnen.

Rollback: Bestätigungsversand dieses Endpunkts sperren.

## lov_finding_3f184b5b3878e895

Anyone can trigger your saved webhook integrations

Ursache: Der Handler verzweigt ohne Aufruferprüfung in privilegiertes Einreihen beziehungsweise Abarbeiten gespeicherter Webhook-Abonnements. Gespeicherte Zieladressen verhindern nicht das unberechtigte Auslösen.

Funktionen: - ac-webhook-dispatch

Korrektur: Einreihen und Dispatch getrennt autorisieren; Dispatch nur verifizierten Jobs, Einreihen nur berechtigten mandantengebundenen Produzenten erlauben.

Auswirkung: - Unberechtigtes Auslösen externer Integrationen
- Manipulation der Event-Warteschlange

Tests: - Beide Aktionspfade ohne gültige Berechtigung ohne Queue- oder Netzwerk-Nebenwirkung ablehnen.

Rollback: Dispatcher und Produzentenpfad pausieren.

## lov_finding_43bb2ddd0aab0e94

Anyone can search private customer conversations

Ursache: Die Suche liest ohne Aufruferprüfung mit privilegiertem Client Nachrichten, Tickets und Dokumentzusammenfassungen. Quellen werden in der Antwort zurückgegeben; verify_jwt=false ist explizit konfiguriert.

Funktionen: - ac-knowledge-rag

Korrektur: Aktive Suchberechtigung erzwingen und jede Quelle mit Benutzer-/Mandantenrechten filtern; RLS-fähigen Benutzerclient verwenden.

Auswirkung: - Offenlegung privater Kommunikation und Dokumentinhalte
- Unberechtigte KI-Verarbeitung

Tests: - Anonyme Suche und fremde Quellen ausschließen; Berechtigung für jede Quellenart separat prüfen.

Rollback: RAG-Suche sperren.

## lov_finding_47008b040e014166_817a2c19

Any signed-in user can send another user's catalog share

Ursache: Nach gültiger Anmeldung lädt der Admin-Client den gewählten Freigabelink ohne Besitzer- oder Mandantenabgleich. Ablauf und Widerruf werden geprüft, nicht die Versandberechtigung des Aufrufers.

Funktionen: - catalog-share-send

Korrektur: Aktive Freigabe- und Versandberechtigung für link_id vor dem privilegierten Laden prüfen.

Auswirkung: - Unberechtigter E-Mail-, SMS- oder WhatsApp-Versand
- Manipulation von Kommunikationsprotokollen

Tests: - Fremden gültigen Link und inaktiven Benutzer ohne Kanalaufruf ablehnen.

Rollback: Freigabelink-Versand sperren.

## lov_finding_4c7152ec5de2c1bc

Anyone can change tenants’ payment records

Ursache: Bankzeilen und Dokumente werden ohne Handler-Authentifizierung privilegiert geladen und abgeglichen. Ein übergebener tenantId-Filter ist keine verifizierte Mandantenzugehörigkeit.

Funktionen: - cmr-bank-automatch

Korrektur: Aktive Buchhaltungsberechtigung mit serverseitig verifiziertem Mandantenscope vor Matching und Zahlungsanlage verlangen.

Auswirkung: - Unberechtigte Zahlungsanlage
- Verfälschte Bankzuordnungen

Tests: - Fremden oder fehlenden Mandantenscope ohne Zahlungs- und Bankzeilenmutation ablehnen.

Rollback: Automatching sperren; Zuordnungen nur kontrolliert fachlich rückabwickeln.

## lov_finding_52b818a8bbb78eb6

Anyone can change another customer's showcase settings

Ursache: get_config und set_config verwenden callerbestimmte client_id ohne Verwaltungsberechtigung. Der spätere Tokencheck schützt nur öffentliche Inhaltsaktionen, nicht die vorangehenden Konfigurationszweige.

Funktionen: - social-showcase-public
- getConfig
- saveConfig

Korrektur: Konfigurationsaktionen von öffentlicher Darstellung trennen und aktive Kundenverwaltungsberechtigung verlangen.

Auswirkung: - Unberechtigte Konfigurationsänderung
- Offenlegung beziehungsweise Rotation von Freigabetokens

Tests: - Öffentliche get_config- und set_config-Aufrufe ohne Lese- oder Schreibzugriff ablehnen; Tokenansicht separat erhalten.

Rollback: Verwaltungsaktionen sperren, öffentliche Ansicht nur mit bestehenden gültigen Tokens erhalten.

## lov_finding_58c64b182fdc8abb_138f6013

Anyone can change your asset depreciation records

Ursache: Der angelegte userClient wird nicht zur Identitäts- oder Berechtigungsprüfung verwendet. Der Admin-Client lädt alle aktiven Anlagen und kann Abschreibungen sowie Anlagenstände verändern.

Funktionen: - finance-asset-depreciation-run

Korrektur: Verifizierten Job oder aktiven berechtigten Finanzbenutzer mit Anlagenscope vor jedem Zugriff prüfen.

Auswirkung: - Unberechtigte Abschreibungsbuchungen
- Manipulation von Anlagenwerten

Tests: - Unberechtigten dry_run und schreibenden Lauf vor Datenabfrage ablehnen; erlaubten Periodenlauf mit Datenbank-Mocks prüfen.

Rollback: Abschreibungslauf sperren; Buchungskorrektur getrennt freigeben.

## lov_finding_5e865420cc71ba0c

Finance users can text arbitrary phone numbers

Ursache: Der Benutzerpfad verlangt eine gültige Identität und erlaubte Rolle; dies ist kein anonymer SMS-Relay. Frei wählbare Zielnummer und Nachricht sind vorhanden. Aktiver Kontostatus und konkrete Fall-/Mandantenberechtigung werden aber vor dem Service-Role-Lesen nicht geprüft.

Funktionen: - collect-send-sms

Korrektur: Aktive Fall- und Versandberechtigung ergänzen; Nummernübersteuerung ausdrücklich berechtigen und protokollieren.

Auswirkung: - Rollenintern zu weitreichender Versand
- Möglicher Versand fremder Falldaten

Tests: - Inaktives Finanzkonto, fremden Fall und unberechtigte Nummernübersteuerung abweisen; erlaubten Fall positiv prüfen.

Rollback: Nummernübersteuerung beziehungsweise SMS-Versand sperren.

## lov_finding_60a9985b359fcaaf

Airtable import endpoint exposes connected data without sign-in

Ursache: Der Handler besitzt keine eigene Aufruferprüfung vor dem Zugriff auf die verbundene Airtable-Integration. list_bases, Tabellen- und Datensatzaktionen liefern angebundene Daten zurück. Eine mögliche Gateway-JWT-Prüfung stellt keine Integrationsberechtigung her.

Funktionen: - catalog-import-airtable

Korrektur: Aktive Integrations- und Katalogberechtigung vor jedem Aktionszweig erzwingen; Zugriff auf erlaubte Datenquellen begrenzen.

Auswirkung: - Unberechtigtes Lesen verbundener Airtable-Daten

Tests: - Alle Leseaktionen ohne Integrationsberechtigung ohne externen Aufruf ablehnen.

Rollback: Airtable-Endpunkt sperren.

## lov_finding_6820ef9219a29db8

Anyone can submit private knowledge articles for embedding

Ursache: article_id bestimmt ohne Handler-Berechtigungsprüfung den privilegierten Artikelzugriff, die Übermittlung an den Embedding-Dienst und das Speichern des Embeddings.

Funktionen: - ac-kb-embed

Korrektur: Aktive Wissensbasis-Bearbeitungsberechtigung für Artikel und Mandant vor Lesen und externer Verarbeitung prüfen.

Auswirkung: - Unberechtigte externe Verarbeitung privater Artikel
- Unberechtigte Embedding-Änderungen und Kosten

Tests: - Fremden Artikel und unberechtigten Benutzer ohne Embedding-Aufruf oder Update abweisen.

Rollback: Embedding-Endpunkt sperren.

## lov_finding_6cdb90a4e4b3d4f9

Any super admin can email reports to anyone

Ursache: Versand ist durch Cron-Secret oder getUser plus has_role beschränkt. Frei wählbare Empfänger sind daher nicht allein Beweis eines kritischen Relays. has_role lässt jedoch auch Admin zu und prüft keinen aktiven Kontostatus; diese Einschränkung fehlt im Handler ebenfalls.

Funktionen: - aic-send-report
- public.has_role(text)

Korrektur: Aktives Konto und ausdrücklich gewünschte Berichtsversandrolle prüfen; Empfängerfreiheit fachlich dokumentieren und gegebenenfalls begrenzen.

Auswirkung: - Zu breite administrative Versandberechtigung
- Berichtsversand durch nicht mehr aktive Rollenträger möglich

Tests: - Inaktive Administratoren abweisen; Admin-Vererbung und erlaubte Empfängerscopes ausdrücklich testen.

Rollback: Manuellen Versand sperren, verifizierten Scheduler separat erhalten.

## lov_finding_6feae31e06a64cf3

Anyone can run conversation automations

Ursache: Der Handler liest nach payload.event ohne Aufruferprüfung aktive Automationsregeln. Callergewählte Konversation und Mandantenwerte steuern Service-Role-Lesezugriffe, Nachrichten, Zuweisungen und Webhooks.

Funktionen: - ac-automation-run

Korrektur: Nur verifizierte Ereignisproduzenten zulassen; Konversation und Regeln serverseitig demselben Mandanten zuordnen.

Auswirkung: - Unberechtigte Nachrichten und Konversationsänderungen
- Auslösen externer Webhooks und KI-Kosten

Tests: - Gefälschten Event und widersprüchliche Mandanten-/Konversationswerte ohne Nebenwirkungen abweisen.

Rollback: Automationsausführung pausieren.

## lov_finding_74e13969233e5319

Any signed-in user can send payment reminders to customers

Ursache: Der Benutzerpfad authentifiziert den Aufrufer, bindet die nachfolgende privilegierte Zahlungsankündigung aber nicht an eine aktive Finanz- oder Kundenberechtigung. Die reguläre UI-Anfrage ist keine serverseitige Zugriffskontrolle.

Funktionen: - recurring-prenotification

Korrektur: Aktive Finanzversandberechtigung und erlaubten Kundenscope verlangen; Maschinenzugriff explizit trennen.

Auswirkung: - Unberechtigter Versand von Zahlungsankündigungen

Tests: - Angemeldeten Benutzer ohne Finanzrecht und inaktives Konto vor Kundenverarbeitung und Versand abweisen.

Rollback: Manuelle Zahlungsankündigungen sperren.

## lov_finding_7596267ca3ddaaea · PRODUCT HUB

Public import reads and writes the product catalog

Ursache: Der Importhandler besitzt keine ausreichende Aufruferautorisierung für privilegierte Product-Hub-Lese- und Schreiboperationen. Additives Importieren und Dublettenprüfung sind keine Zugriffskontrolle. Eine controlled_modes-Sperre der anderen Push-Handler schützt diesen Import nicht.

Funktionen: - product-hub-import

Korrektur: Aktive Product-Hub-Importberechtigung vor Vorschau, Quellzugriff und Import verlangen; Quellen und importierten Scope serverseitig begrenzen.

Auswirkung: - Unberechtigter Katalogzugriff
- Unberechtigte Produkt-, Medien- und Dokumentänderungen

Tests: - test, preview und import ohne passende Berechtigung vor Quellen- und Datenzugriff ablehnen; kontrollierte Modi separat prüfen.

Rollback: Importendpunkt sperren; Importe nur anhand geprüfter Historie rückabwickeln.

## lov_finding_77810b1b4b728af7

Any signed-in user can see other sites' goal results

Ursache: SECURITY DEFINER aggregiert Ziele und Umsatz für eine callergewählte Website-ID ohne interne Website- oder Mandantenberechtigung. EXECUTE für authenticated reicht dafür nicht aus.

Funktionen: - public.ac_web_goals_summary(uuid,timestamptz,timestamptz)

Korrektur: Aktive Websiteberechtigung innerhalb der Funktion prüfen und Funktionsrechte auf das notwendige Minimum reduzieren.

Auswirkung: - Mandantenübergreifende Offenlegung von Conversion- und Umsatzaggregaten

Tests: - Direkte RPC-Aufrufe mit fremder Website und inaktivem Konto müssen scheitern.

Rollback: EXECUTE bis zur abgesicherten Ersatzfunktion entziehen.

## lov_finding_7f26776bd0d3a68e

Anyone can turn signed offers into orders

Ursache: Der Handler sucht anhand offer_number nach unterschriebenen Anfragen und erzeugt Bestellpositionen beziehungsweise Finanzierungsdaten ohne eigene Aufruferberechtigung. Bereits vorhandene Unterschriften legitimieren nicht jeden Aufrufer zur Konvertierung.

Funktionen: - convert-signed-offer-to-order

Korrektur: Konvertierung nur verifizierten internen Aufrufern oder aktiv berechtigten Benutzern erlauben; Signatur und Auftrag serverseitig binden.

Auswirkung: - Unberechtigte Auftragserzeugung
- Unberechtigte Finanzierungsdatensätze

Tests: - Direkten unberechtigten Aufruf trotz existierendem unterschriebenem Angebot ablehnen; Idempotenz isoliert prüfen.

Rollback: Konvertierungsendpunkt sperren; Signaturannahme und Auftragsanlage getrennt behandeln.

## lov_finding_840f31fb29294dc7

Admins can send arbitrary test SMS messages to any number

Ursache: Die Test-SMS-Funktion validiert Claims und verlangt Admin oder Super Admin. Eine beliebige Testnummer ist damit nicht automatisch ein kritischer offener SMS-Relay. Eine aktive Kontoprüfung fehlt jedoch vor dem administrativen Providerzugriff.

Funktionen: - sms-config-test

Korrektur: Aktiven Administrator und explizite SMS-Konfigurationsberechtigung prüfen; Testempfänger und Ratenlimits fachlich festlegen.

Auswirkung: - Testversand durch inaktive Rollenträger
- Kostenmissbrauch innerhalb zu weit gefasster Administration

Tests: - Inaktiven Administrator abweisen; erlaubten Testversand ausschließlich mit Provider-Mock und gegebenenfalls Empfänger-Allowlist prüfen.

Rollback: Testversand deaktivieren, Statusanzeige separat schützen.

## lov_finding_8703f96241dee35e_4db211d4

Any signed-in user can sync a caller-selected protected ticket

Ursache: getUser validiert die Anmeldung. ticket_id wird danach mit privilegiertem Client ohne Ticketberechtigungsprüfung geladen und gegebenenfalls an AlixSmart synchronisiert. source_system- und external_ticket_id-Prüfungen sind nur fachliche Voraussetzungen.

Funktionen: - sync-to-alixsmart

Korrektur: Aktive Ticket- und Integrationsberechtigung vor Ticket-/Nachrichtenzugriff und externem Sync prüfen.

Auswirkung: - Unberechtigte Übermittlung geschützter Ticketdaten
- Unberechtigte Synchronisationszustände

Tests: - Fremdes synchronisierbares Ticket ohne externen Aufruf oder Logmutation ablehnen.

Rollback: Manuellen Sync sperren.

## lov_finding_8973eaa4d23c2465

Anyone can create invoices across customer accounts

Ursache: Der Handler verarbeitet Sammelpläne und Zeiteinträge ohne eigene Aufruferautorisierung und erzeugt privilegiert Rechnungen. Callergewählte Plan- oder Mandantenfilter begründen keine Zugriffsberechtigung.

Funktionen: - cmr-collective-run

Korrektur: Verifizierte Job-Berechtigung oder aktive mandantengebundene Fakturierungsberechtigung vor Verarbeitung verlangen.

Auswirkung: - Unberechtigte Rechnungserzeugung
- Veränderung von Zeiteinträgen und Planausführung

Tests: - Fremden Plan und Mandanten ohne Dokumentnummernvergabe oder Rechnungsanlage ablehnen.

Rollback: Sammellauf pausieren; Rechnungen nur fachlich kontrolliert stornieren.

## lov_finding_8a473438782bef1a

Anyone can replace another customer's signed document

Ursache: document_id steuert ohne Handler-Autorisierung das Laden von Signaturdokument und Signaturen, privilegierten Dateidownload, finales Rendering sowie Versions- und Dokumentänderungen. Der legitime interne Aufrufer schützt den direkt aufrufbaren Handler nicht.

Funktionen: - sig-render-final

Korrektur: Nur verifizierte Signaturjobs beziehungsweise explizit berechtigte aktive Benutzer zulassen; Dokumentstatus und Signaturvollständigkeit serverseitig prüfen.

Auswirkung: - Unberechtigte Änderung signierter Dokumentversionen
- Verletzung der Dokumentintegrität

Tests: - Unberechtigte document_id ohne Storage-Download, Upload und Versionsänderung ablehnen.

Rollback: Finalisierungsjob sperren; alte Versionen unverändert erhalten.

## lov_finding_8d76058b0444465c

Anyone can run your finance automations

Ursache: Finanzregeln und Belege werden ohne Handler-Authentifizierung privilegiert gelesen und verarbeitet; Ausführungsprotokolle und Belegänderungen sind erreichbar.

Funktionen: - finance-automations-engine

Korrektur: Verifizierte Jobs oder aktive Finanzautomationsberechtigung mit Mandantenscope vor Regelladen verlangen.

Auswirkung: - Unberechtigte Finanzautomationen
- Manipulation von Rechnungszuständen

Tests: - Unberechtigte Ausführung ohne Regelabfrage, Belegupdate und Run-Eintrag abweisen.

Rollback: Automationsengine pausieren.

## lov_finding_951b00a22a7089dc

Public workflow exposes privileged case processing

Ursache: Ohne Handler-Aufruferprüfung werden Fälle, Checklisten und Rückrufe privilegiert bearbeitet. Der interne Versandhelper verwendet Service Role und legitimiert den ursprünglichen Aufrufer nicht.

Funktionen: - as-workflows-run

Korrektur: Verifizierte Workflow-Jobs vor jeglichem Fallzugriff verlangen und Mandantenscope der Verarbeitung festlegen.

Auswirkung: - Unberechtigte Fallverarbeitung
- Erinnerungsversand und Timeline-Manipulation

Tests: - Fehlende und öffentliche Job-Zugangsdaten ohne Fallzugriff, Versand und Updates ablehnen.

Rollback: Workflow-Scheduler pausieren.

## lov_finding_98d1a9730f1bf438_c6ddf1e8

Anyone can create customer collection notices

Ursache: Der Mahnlauf besitzt keine Handler-Authentifizierung, liest Einstellungen und Dokumente privilegiert und erzeugt Mahndokumente. Optionaler E-Mail-Versand und Ausgangsbelegänderungen sind erreichbar; verify_jwt=false ist explizit konfiguriert.

Funktionen: - cmr-dunning-run

Korrektur: Aktive mandantengebundene Mahnberechtigung oder verifizierten Job vor dem Lauf erzwingen.

Auswirkung: - Unberechtigte Mahnungserzeugung und Kundenkommunikation
- Veränderung von Forderungszuständen

Tests: - Fremden Mandanten und unberechtigten Lauf ohne Nummernvergabe, Dokumente und Versand abweisen.

Rollback: Mahnlauf sperren; erzeugte Dokumente separat fachlich behandeln.

## lov_finding_9e661ffc56acce39

Anyone can read another visitor’s chat

Ursache: Die Website wird geprüft, aber poll bindet die Konversation nicht an einen authentisierten Besucher oder eine geheime Besuchercapability. Der öffentliche Widget-Schlüssel plus fremde Konversations-ID derselben Website genügt im Codepfad zum Lesen nichtinterner Nachrichten.

Funktionen: - ac-chat
- loadConversation

Korrektur: Bei start eine kryptografische konversationsgebundene Besuchercapability ausgeben und für send sowie poll verlangen.

Auswirkung: - Besucherübergreifendes Lesen von Chatnachrichten
- Mögliche fremde Nachrichteneinspeisung

Tests: - Zwei Besucher derselben Website müssen trotz bekannter fremder Konversations-ID strikt getrennt bleiben.

Rollback: send und poll sperren, Websitebindung erhalten.

## lov_finding_a344cf8be2820684

Anyone can enroll another customer in a journey

Ursache: event_type und contact_id bestimmen ohne Aufruferberechtigung die Suche nach Journeys und Anlage von Journey-Läufen. Eine Prüfung vorhandener Läufe ist nur Dublettenvermeidung.

Funktionen: - ac-journey-trigger

Korrektur: Verifizierte Eventproduzenten oder aktive kontaktbezogene Journey-Berechtigung verlangen; Journey und Kontakt mandantenseitig binden.

Auswirkung: - Unberechtigte Journey-Einschreibung
- Nachgelagerte Kundenkommunikation

Tests: - Gefälschten Event und fremden Kontakt ohne Run-Anlage abweisen.

Rollback: Journey-Trigger sperren.

## lov_finding_aaa4d2aa58de11e4_56f4ee5a

Any signed-in user can change another delivery route

Ursache: Claims werden geprüft, nicht die Berechtigung für tour_id. Der privilegierte Pfad lädt Tour und Stopps und verändert anschließend Termine, Reihenfolgen und Tourberechnungen.

Funktionen: - delivery-route-calc

Korrektur: Aktive Dispositionsberechtigung für Tour und Mandant vor Daten- und Routingzugriff verlangen.

Auswirkung: - Unberechtigte Routenänderungen
- Offenlegung von Liefer- und Kundendaten
- Externe Routingkosten

Tests: - Fremde Tour ohne Geocoding, Routingaufruf oder Datenmutation abweisen.

Rollback: Neuberechnung sperren; letzte freigegebene Tourstände erhalten.

## lov_finding_ac9f74df4aa376ea

Ordinary callers can apply the stored facsimile signature

Ursache: Der Handler akzeptiert PDF und Dokumenttyp ohne Aufruferberechtigung, lädt die konfigurierte Faksimilegrafik privilegiert und liefert das bearbeitete PDF zurück. Aktivierte Konfiguration ist eine Betriebsbedingung, keine Berechtigung des Aufrufers.

Funktionen: - sig-apply-facsimile

Korrektur: Nur verifizierte interne Dokumentprozesse oder explizit berechtigte aktive Signaturverantwortliche zulassen; Dokumentherkunft binden.

Auswirkung: - Unberechtigte Verwendung einer gespeicherten Unterschrift
- Erzeugung scheinbar autorisierter Dokumente

Tests: - Beliebiges callererzeugtes PDF ohne berechtigten Vorgang vor Grafikdownload abweisen.

Rollback: Faksimileanwendung deaktivieren; Grafik nicht öffentlich machen.

## lov_finding_ae5f39e7f20249fc

Unauthenticated requests can read push subscriptions

Ursache: Ohne Aufruferprüfung werden callergewählte Benutzer oder Rollen auf Push-Abonnements aufgelöst und benachrichtigt. Die Antwort enthält Zähler, nicht unmittelbar sämtliche Subscription-Daten; der unberechtigte privilegierte Zugriff und Versand bleiben bestehen.

Funktionen: - mobile-push-send

Korrektur: Verifizierte interne Produzenten oder aktive Push-Versandberechtigung mit Empfängerscope verlangen.

Auswirkung: - Unberechtigter Push-Versand
- Privilegierter Zugriff auf Subscription-Zuordnungen

Tests: - Unberechtigte direkte Benutzer- und Rollenadressierung ohne Subscription-Abfrage oder Push ablehnen.

Rollback: Push-Endpunkt sperren.

## lov_finding_b4d04ac4e0a048bd

Anyone can send a text from another customer’s missed call

Ursache: call_id wird ohne Aufruferprüfung privilegiert geladen. Einstellungen, Geschäftszeiten und Cooldown begrenzen den Versand fachlich, prüfen aber nicht die Autorität des Aufrufers.

Funktionen: - ac-missed-call-sms

Korrektur: Nur verifizierte Telefonie-Events oder berechtigte aktive Benutzer für den konkreten Anruf zulassen.

Auswirkung: - Unberechtigter SMS-Versand
- Veränderung von Anruf- und Kommunikationsprotokollen

Tests: - Fremde berechtigungslos gewählte missed-call-ID trotz erfüllter Geschäftsbedingungen ohne Versand ablehnen.

Rollback: Automatische Rückruf-SMS pausieren.

## lov_finding_b6ddd0c4b7e8a609

Anyone can email the approval report to arbitrary recipients

Ursache: Der Berichtshandler besitzt keine Aufruferprüfung vor Einstellungen, Freigabedaten und Mailversand. enabled- und Empfängerprüfungen sind fachliche Schalter, keine Job-Autorisierung.

Funktionen: - delivery-approval-monthly-report

Korrektur: Verifizierten Berichtsjob beziehungsweise aktive Freigabeberichtsberechtigung verlangen und Empfänger serverseitig begrenzen.

Auswirkung: - Unberechtigter Berichtsversand
- Offenlegung interner Freigabedaten

Tests: - Unberechtigten Aufruf bei aktiviertem Bericht ohne Datenabfrage und Mailversand ablehnen.

Rollback: Monatsberichtjob pausieren.

## lov_finding_b98203874ed68dbf

Public sign-return invocation can approve any linked document

Ursache: Eine callergewählte Signaturanfrage wird ohne verifizierte Aufruferberechtigung privilegiert geladen; der Pfad lädt signierte Dateien und erzeugt eine AlixDocs-Version. Die Existenz einer Dokumentverknüpfung ersetzt keine Berechtigung für den Rücklauf.

Funktionen: - alixdocs-sign-return

Korrektur: Verifizierten Signaturrücklauf vor Datenzugriff verlangen und Anfrage, abgeschlossenes Signaturereignis, Zieldokument und Version serverseitig binden.

Auswirkung: - Unberechtigte Übernahme von Signaturdateien
- Verletzung der AlixDocs-Dokumentintegrität

Tests: - Unberechtigte oder nicht abgeschlossene Signaturanfrage ohne Download, Upload und Versionsanlage ablehnen.

Rollback: Signaturrücklauf pausieren; bestehende Dokumentversionen erhalten.

## lov_finding_baa5414ce6fda013

Anyone can turn queued imports into orders

Ursache: Der Verarbeitungsendpunkt lädt Inbox-Einträge ohne eigene Aufruferprüfung und führt privilegierte Kunden-, Bestell- und Positionsänderungen aus. Ein legitimer vorgeschalteter Importaufrufer schützt direkte Aufrufe nicht; verify_jwt=false ist explizit konfiguriert.

Funktionen: - orders-inbox-process

Korrektur: Verifizierten internen Verarbeitungsjob verlangen; Einträge an erlaubte Quelle und Mandant binden.

Auswirkung: - Unberechtigte Bestell- und Kundenänderungen
- Unberechtigte Verarbeitung wartender Importe

Tests: - Direkten unberechtigten Aufruf mit und ohne onlyId ohne Verarbeitung oder Statusänderung ablehnen.

Rollback: Inbox-Verarbeitung pausieren, Eingänge unverändert aufbewahren.

## lov_finding_bf2b6a2d007ce4fc

Anyone can inspect another organization’s journey results

Ursache: journey_id steuert ohne Benutzer- oder Mandantenprüfung privilegierte Abfragen auf Journey, Schritte und Ergebnisse. Die Daten fließen in Optimierung und Antwort; verify_jwt=false ist explizit konfiguriert.

Funktionen: - ac-journey-optimize

Korrektur: Aktive Journey-Leseberechtigung und Mandantenzugehörigkeit vor Datenzugriff und KI-Verarbeitung prüfen.

Auswirkung: - Offenlegung fremder Journey-Ergebnisse
- Unberechtigte KI-Verarbeitung

Tests: - Fremde Journey ohne Daten- und KI-Aufruf abweisen.

Rollback: Optimierungsfunktion sperren.

## lov_finding_c26f3c6f2ff20f41

Anyone can export your accounting transactions

Ursache: Vor dem privilegierten DATEV-Export wird nur das Vorhandensein eines Authorization-Headers geprüft. Eine gültige Identität, ein aktives Konto und eine Finanzexportberechtigung werden nicht nachgewiesen.

Funktionen: - finance-datev-export

Korrektur: Aktive Finanzexportberechtigung und verifizierten Buchungs-/Mandantenscope vor jeder Transaktionsabfrage verlangen.

Auswirkung: - Unberechtigter Export privater Buchungsdaten

Tests: - Beliebigen nichtleeren Header und angemeldeten Benutzer ohne Exportrecht ohne CSV-Erzeugung ablehnen.

Rollback: DATEV-Export sperren.

## lov_finding_c4bcebcef88683c2

Caller controls reminder recipient and email content

Ursache: Zusätzlich zur fehlenden Fallberechtigung akzeptiert derselbe Handler recipient_email, custom_message und CTA-Werte und versendet sie mit privilegierten Versandzugangsdaten. Dieser Befund beschreibt eine eigenständige Empfänger-/Inhaltskontrolle und wird nicht allein wegen desselben Handlers als Duplikat markiert.

Funktionen: - as-send-email-reminder

Korrektur: Empfänger aus autorisiertem Fall ableiten; Übersteuerung und freie Inhalte separat berechtigen, validieren und protokollieren.

Auswirkung: - Weitergabe von Falldaten an fremde Empfänger
- Missbrauch geschäftlicher E-Mails

Tests: - Berechtigten Fallzugriff mit unberechtigter Empfänger- oder CTA-Übersteuerung ohne Versand ablehnen.

Rollback: Freie Empfänger- und Inhaltsübersteuerung deaktivieren.

## lov_finding_cac3d0218bcb0bbb

Anyone can change private deposit records

Ursache: Ohne Handler-Authentifizierung werden Rechnungen, Bestellungen und Anzahlungen privilegiert gelesen, finance_deposits geschrieben und Neuberechnungs-RPCs ausgelöst.

Funktionen: - sync-finance-deposits

Korrektur: Verifizierten Synchronisationsjob oder aktive Finanzberechtigung vor Datenzugriff verlangen; Datenumfang serverseitig begrenzen.

Auswirkung: - Unberechtigte Änderung privater Anzahlungsdaten
- Veränderung berechneter Finanzstände

Tests: - Unberechtigten Sync ohne Upsert und Neuberechnungs-RPC abweisen.

Rollback: Synchronisation pausieren; Finanzkorrekturen nur kontrolliert durchführen.

## lov_finding_d0449b3fd945f992

Anyone can trigger customer maintenance reminders

Ursache: Der Handler startet ohne Aufruferprüfung bereits eine Statusaktualisierungs-RPC und lädt anschließend Wartungsdaten für Erinnerungen. Protokoll- und Wartungsänderungen sind erreichbar.

Funktionen: - maintenance-reminder-daily

Korrektur: Verifizierte Job-Berechtigung vor der ersten RPC und sämtlichen Wartungszugriffen verlangen.

Auswirkung: - Unberechtigter Wartungserinnerungsversand
- Veränderung von Wartungs- und Erinnerungsständen

Tests: - Unberechtigten Aufruf bereits vor refresh_warranty_and_maintenance_status und Versand abweisen.

Rollback: Tagesjob pausieren.

## lov_finding_d51da742f6515a44

Any signed-in user can access another order’s review token

Ursache: Claims werden validiert; die zusätzliche Rollenprüfung gilt nur dem manuellen Sonderpfad. Der reguläre Pfad lädt eine callergewählte Bestellung privilegiert, erstellt beziehungsweise verwendet Bewertungsdaten und kann review_url zurückgeben, ohne Bestellberechtigung zu prüfen.

Funktionen: - send-review-invitation

Korrektur: Aktive Bestell- und Einladungsberechtigung auf allen Pfaden erzwingen; Bewertungstoken nicht unnötig an Aufrufer zurückgeben.

Auswirkung: - Unberechtigter Zugriff auf Bewertungscapabilities
- Unberechtigter Einladungsversand

Tests: - Regulären und manuellen Pfad mit fremder Bestellung ohne Tokenrückgabe oder Versand ablehnen.

Rollback: Einladungsfunktion sperren und gegebenenfalls betroffene Tokens separat widerrufen.

## lov_finding_d76d8adca9d2e204

Anyone can mark your management reports as sent

Ursache: pack_id und action steuern ohne Handler-Authentifizierung privilegierte Änderungen an Managementberichten. Der send-Pfad markiert Berichte als versendet; tatsächlicher E-Mail-Versand ist dadurch nicht belegt.

Funktionen: - finance-management-pack

Korrektur: Aktive berichtsbezogene Finanzberechtigung vor generate und send prüfen; Versandstatus nur an belegten Versand knüpfen.

Auswirkung: - Unberechtigte Manipulation von Berichts- und Versandzuständen

Tests: - Fremde pack_id für beide Aktionen ohne Update abweisen; bloße Statusänderung nicht als echten Mailversand testen.

Rollback: Berichtsaktionen sperren; Statuskorrekturen separat auditieren.

## lov_finding_d9dbde1372d10aa0_2fd2e69b

Public endpoint exposes private credit assessment data

Ursache: assessment_id bestimmt ohne Aufruferberechtigung privilegierte Bonitäts-, Bestell- und Finanzabfragen. Faktoren und Bewertung werden verändert; Antwort enthält Score und Entscheidungsergebnisse, nicht zwingend sämtliche Rohdaten.

Funktionen: - credit-score-calculate

Korrektur: Aktive Bonitätsbearbeitungsberechtigung für Bewertung und Kunde vor jeder Abfrage und Neuberechnung verlangen.

Auswirkung: - Offenlegung privater Bonitätsergebnisse
- Unberechtigte Veränderung von Kreditentscheidungsgrundlagen

Tests: - Fremde Bewertung ohne Rohdatenzugriff, Faktorenlöschung und Entscheidungsupdate abweisen.

Rollback: Neuberechnungsendpunkt sperren; Bewertungsstände historisch sichern.

## lov_finding_db88ec831c2a1cc7

Any catalog editor can run scripts in coworkers' browsers

Ursache: Gespeicherte HTML-Felder werden unverändert mit dangerouslySetInnerHTML in die Anwendung eingebettet. Die Katalogrolle darf Templates schreiben. Damit besteht ein gespeicherter XSS-Pfad über aktive HTML-Inhalte; eine erfolgreiche Browserausführung wurde nicht live getestet.

Funktionen: - KatalogPdfTemplates
- save
- HTML-Vorschau

Korrektur: HTML vor DOM-Einbettung mit geeigneter Allowlist sanitieren oder Vorschau in strikt isoliertem Sandbox-Kontext rendern; alle weiteren Template-Sinks prüfen.

Auswirkung: - Gespeicherte Skriptausführung im Anwendungskontext
- Aktionen mit den Rechten betrachtender Mitarbeiter

Tests: - Ereignisattribute, SVG-/URL-basierte aktive Inhalte und ungefährliche Formatierung in isolierten Renderingtests prüfen.

Rollback: HTML-Vorschau deaktivieren oder als Text anzeigen; keine Rückkehr zu unsanitiertem DOM-HTML.

## lov_finding_df054ee0d6a3c45f

Anyone can read another person's voicemail

Ursache: call_id steuert ohne Handler-Berechtigungsprüfung den privilegierten Zugriff auf die Voicemail-URL, Audioabruf, Transkription und Rückgabe des Texts.

Funktionen: - ac-voicemail-transcribe

Korrektur: Aktive anrufbezogene Hör- und Transkriptionsberechtigung vor Metadaten-, Audio- und KI-Zugriff verlangen.

Auswirkung: - Offenlegung fremder Voicemails
- Unberechtigte externe Audioverarbeitung und Kosten

Tests: - Fremden Anruf ohne Audioabruf, Statusupdate oder Transkriptionsaufruf abweisen.

Rollback: Voicemail-Transkription sperren.

## lov_finding_e9436bf2ec03c48f_41eebedc

Anyone can retrieve and expose repair-quote approval links

Ursache: Der unzureichend autorisierte Angebotsversand gibt zusätzlich den approvalLink direkt zurück. Diese Capability-Offenlegung ist über reinen Versandmissbrauch hinaus relevant und wird deshalb nicht automatisch als Duplikat eingestuft. Gateway-JWT allein schützt das gewählte Angebot nicht.

Funktionen: - send-repair-quote

Korrektur: Aktive Angebotsberechtigung prüfen und Freigabecapability aus Standardantwort und unnötigen Protokollen entfernen.

Auswirkung: - Offenlegung fremder Angebotsfreigabelinks
- Möglicher Missbrauch der damit verbundenen Freigaberechte

Tests: - Unberechtigter Benutzer darf weder Link noch tokenhaltige Historie erhalten; nachgelagerte Freigaberechte separat prüfen.

Rollback: Endpunkt sperren; kompromittierte Freigabetokens nur kontrolliert rotieren.

## lov_finding_ec3de0a630ccb72f_3f6f0b90

Any signed-in user can read another user's ticket

Ursache: getUser validiert nur die Identität. Derselbe Service-Role-Client liest anschließend frei gewähltes Ticket und interne Nachrichten ohne Ticket- oder Mandantenberechtigung; ähnliche Tickets werden ebenfalls privilegiert durchsucht.

Funktionen: - ticket-ai-assist

Korrektur: Aktive Ticketberechtigung vor Primär- und Ähnlichkeitssuche erzwingen; nur berechtigte Nachrichten an KI übermitteln.

Auswirkung: - Unberechtigte Verarbeitung fremder Tickets und interner Notizen
- Mögliche Offenlegung über KI-Ausgaben

Tests: - Fremdes Primärticket und unberechtigte ähnliche Tickets vor KI-Verarbeitung ausschließen.

Rollback: Ticket-KI-Anreicherung sperren.

## lov_finding_f04bfe8a3011dee3

Anyone can view another customer's contact details

Ursache: Der Handler liest callergewählte Kontaktdaten ohne Aufruferprüfung und verwendet diese in der KI-Verarbeitung. Die resultierende Antwort beziehungsweise Prediction kann daraus abgeleitete private Angaben enthalten; ein vollständiger Rohdatenexport ist nicht nachgewiesen.

Funktionen: - ac-voice-ai-studio

Korrektur: Aktive kontaktbezogene Voice-AI-Berechtigung und Mandantenbindung vor Kontaktzugriff und KI-Aufruf verlangen.

Auswirkung: - Unberechtigte Verarbeitung privater Kontaktdaten
- Unberechtigte KI-Kosten und Predictions

Tests: - Fremden contact_id ohne Kontaktabfrage, KI-Aufruf und Prediction-Anlage abweisen.

Rollback: Kontaktbasierte Voice-AI-Verarbeitung sperren.

## lov_finding_f4bd1fd6bf1a9511

Anyone can change existing catalog products through the import

Ursache: Neben den ungeschützten Airtable-Leseaktionen besitzt der Import einen eigenständigen privilegierten Schreibpfad: callerbeeinflusste Produktdaten werden anhand SKU auf vorhandene catalog_items angewendet. Die Datenlese- und Schreibwirkungen werden deshalb nicht ungeprüft zusammengelegt.

Funktionen: - catalog-import-airtable

Korrektur: Aktive Katalogimportberechtigung, erlaubte Quelle und Änderungsumfang vor Jobanlage und Produkt-Upsert prüfen.

Auswirkung: - Unberechtigte Änderung vorhandener Katalogprodukte
- Unberechtigte Medien- und Importjobänderungen

Tests: - Bekannte fremde SKU und unberechtigte Quelle ohne Jobanlage, Produktupdate und Medienupload abweisen.

Rollback: Schreibenden Import sperren; Änderungen anhand Importhistorie kontrolliert korrigieren.

## lov_finding_ff271ba19700e47f

Any signed-in user can send arbitrary approval PDFs to anyone

Ursache: Der Handler validiert die Benutzeridentität, bindet den nachfolgenden Versand aber nicht ausreichend an aktive Freigabe-, Ressourcen- und Empfängerberechtigungen. Eine gültige Anmeldung allein autorisiert weder beliebige Freigabeunterlagen noch beliebige Empfänger.

Funktionen: - delivery-approval-mail

Korrektur: Aktive Versandberechtigung für den konkreten Freigabevorgang verlangen; PDF serverseitig ableiten und Empfänger an autorisierte Vorgangskontakte binden.

Auswirkung: - Unberechtigter Versand von Freigabeunterlagen
- Missbrauch geschäftlicher Versandidentität

Tests: - Angemeldeten Benutzer ohne Vorgangsrecht sowie unberechtigte PDF-/Empfängerübersteuerung ohne Versand ablehnen.

Rollback: Freigabemail-Versand sperren.

## lov_finding_016dbf8483032e9a

Anyone can resend another customer's signing email

Ursache: Der Handler liest signature_id ohne Identitätsprüfung mit Service Role. Die verknüpfte Signaturanfrage wird ebenfalls privilegiert geladen. body.email überschreibt den Empfänger; die Antwort enthält zusätzlich download_url. Damit ist nicht nur erneuter Versand an den ursprünglichen Kunden möglich.

Funktionen: - alix-sign-resend

Korrektur: Identität und Berechtigung auf die konkrete Signaturanfrage vor jedem privilegierten Zugriff prüfen; Empfänger aus autorisierten Stammdaten ableiten und Overrides gesondert berechtigen.

Auswirkung: - Offenlegung signierter Unterlagen
- Unberechtigter E-Mail-Versand
- Storage- und Audit-Schreibzugriffe

Tests: - Anonymen Zugriff und fremde signature_id ablehnen; berechtigten Versand erlauben; fremden Empfänger ablehnen.

Rollback: Bei Regression Versand deaktivieren; fehlende Objektprüfung nicht wieder freigeben.

## lov_finding_040f79f8da123789 · PRODUCT HUB

Any signed-in user can change the product catalog

Ursache: getClaims bestätigt lediglich eine Identität. Danach wird unmittelbar ein Service-Role-Client für den gemeinsamen Katalog erstellt; eine administrative Importberechtigung fehlt vor dem Import.

Funktionen: - import-alix-lasers-de

Korrektur: Serverseitige Product-Hub-Importberechtigung vor Quellenabruf und sämtlichen Katalogänderungen verlangen.

Auswirkung: - Unberechtigter gemeinsamer Katalogimport
- Mögliche Überschreibung vorhandener Produktdaten

Tests: - Normalen Benutzer ablehnen; autorisierten Katalogadministrator zulassen; bei Ablehnung keinerlei Importzugriffe.

Rollback: Import sperren und betroffene Katalogänderungen aus gesichertem Stand gezielt wiederherstellen.

## lov_finding_0cd00d4445ad701e

SMS calls can create unauthorized case reminders

Ursache: Benutzer werden authentifiziert, der ausgewählte After-Sales-Fall aber ausschließlich über case_id privilegiert geladen. Weder Team- noch Mandantenberechtigung wird geprüft. Anschließend werden SMS und dauerhafte Erinnerungs-/Timeline-Einträge erzeugt.

Funktionen: - as-send-sms-reminder

Korrektur: Schreib- und Kommunikationsberechtigung auf den konkreten Fall prüfen; maschinelle Identität exakt statt per includes vergleichen.

Auswirkung: - Fremde Fälle verändern
- Kostenpflichtiger SMS-Versand
- Verfälschte Fallhistorie

Tests: - Fremde case_id mit gültigem Benutzer ablehnen; berechtigten Fall zulassen; keine Nebenwirkungen bei Ablehnung.

Rollback: SMS-Funktion sperren und fehlerhafte Historieneinträge nachvollziehbar korrigieren.

## lov_finding_113966ca22401a64

Anyone can trigger the finance sync with service-role access

Ursache: Zwischen OPTIONS-Behandlung und mandantenübergreifenden Service-Role-Abfragen liegt keine Aufruferprüfung. Kundenmapping und Zoho-Rechnungen werden direkt für den Finanzsync geladen.

Funktionen: - sync-zoho-to-finance

Korrektur: Verifizierte Jobidentität oder explizite administrative Finanzsync-Berechtigung vor jeglichem Datenzugriff verlangen.

Auswirkung: - Unberechtigte Auslösung des Finanzabgleichs
- Mandantenübergreifende Verarbeitung

Tests: - Fehlende und ungültige Jobidentität ablehnen; autorisierten Job zulassen; wiederholten Lauf auf Idempotenz prüfen.

Rollback: Job deaktivieren; durch den Lauf verursachte Finanzänderungen anhand von Referenzen abgleichen.

## lov_finding_1c06d10916b40cbc

Any finance user can export another company's tax data

Ursache: Die Finance-Rollenprüfung ist vorhanden. tenant_id stammt jedoch aus dem Request und wird nur als optionaler Abfragefilter verwendet; eine Zuordnung dieses Mandanten zum Benutzer fehlt. Ohne tenant_id werden alle passenden Finanztransaktionen der Region gelesen.

Funktionen: - finance-tax-export

Korrektur: Exportmandanten serverseitig aus Benutzerberechtigungen bestimmen; fremde und unzulässige leere Mandantenauswahl ablehnen.

Auswirkung: - Mandantenübergreifender Zugriff auf Finanzdaten
- Unberechtigte Steuerexportverarbeitung

Tests: - Finance-Benutzer aus Mandant A darf B und ungefilterten Gesamtexport nicht abrufen.

Rollback: Steuerexport vorübergehend sperren; bereits erzeugte Exporte überprüfen.

## lov_finding_1faf96e95ce2b494

Any CMR user can send another account's portal invitation

Ursache: CMR-Rolle wird geprüft, aber der per tokenId gewählte Portalzugang wird ohne Benutzer-Mandantenabgleich privilegiert geladen. Anschließend wird sein customer_email auf die gewählte Zieladresse geändert.

Funktionen: - cmr-portal-invite

Korrektur: Berechtigung auf tok.tenant_id und den konkreten Kunden prüfen; Empfängeränderungen gesondert autorisieren.

Auswirkung: - Mandantenfremder Einladungsversand
- Änderung fremder Portal-Kontaktadresse

Tests: - CMR-Benutzer aus A mit tokenId aus B ablehnen; keine E-Mail oder Adressänderung.

Rollback: Einladungsversand sperren; unberechtigte Kontaktänderungen nachvollziehbar zurücksetzen.

## lov_finding_217a6dfc717596f3_f43be5ff

Anyone can analyze private customer calls

Ursache: call_id wird ohne Authentifizierung verarbeitet. Der Service-Role-Client liest das zugehörige private Transkript ausschließlich anhand der übergebenen ID.

Funktionen: - ac-conv-intel-analyze

Korrektur: Identität, Analyseberechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff und KI-Verarbeitung prüfen.

Auswirkung: - Unberechtigte Verarbeitung privater Gesprächstranskripte

Tests: - Anonymen und mandantenfremden call_id-Zugriff ablehnen; KI-Aufruf darf dabei nicht erfolgen.

Rollback: Analyseendpunkt sperren; unberechtigt erzeugte Analysen überprüfen.

## lov_finding_23a279b4a5efc05a

Anyone can trigger recalculation of customer credit limits

Ursache: Der Analytics-Handler erstellt ohne Aufruferprüfung einen Service-Role-Client und lädt Inkassofälle, Kunden, Kreditlimits und Rechnungen mandantenübergreifend. Schon der geschützte Datenzugriff ist unmittelbar unautorisiert; der vollständige spätere Schreibpfad wurde nicht abschließend gelesen.

Funktionen: - collect-analytics

Korrektur: Verifizierte administrative Jobberechtigung vor sämtliche Datenzugriffe setzen und Verarbeitung auf autorisierte Mandanten begrenzen.

Auswirkung: - Unberechtigte Verarbeitung geschützter Inkasso- und Kreditdaten
- Behauptete Kreditlimitänderungen zusätzlich nachprüfen

Tests: - Unberechtigten Start vor dem ersten Datenzugriff ablehnen; berechtigten Lauf mandantenscharf prüfen.

Rollback: Analyticsjob deaktivieren; Kreditlimitänderungen separat abgleichen.

## lov_finding_2989a7a085c7a5ca_43adb61f

Signed-in users can send ETA texts to arbitrary customers

Ursache: getUser prüft nur die Identität. route_plan_id wird anschließend per Service Role ohne Dispositionsrolle, Mitarbeiterzuordnung oder Mandantenscope gelesen und die hinterlegte Telefonnummer für den SMS-Versand verwendet.

Funktionen: - dispatch-eta-sms

Korrektur: Dispositionsberechtigung auf den konkreten Einsatz vor Zugriff und Versand prüfen.

Auswirkung: - Unberechtigte Kunden-SMS
- Missbrauch kostenpflichtiger Kommunikationsdienste

Tests: - Fremden route_plan_id trotz gültigem Login ablehnen; berechtigte Disposition zulassen.

Rollback: ETA-SMS deaktivieren; bereits gesendete Nachrichten sind nicht rückholbar.

## lov_finding_2d96488747bd90ab

Unassigned approval states can be decided by any signed-in user

Ursache: Die Zuweisungsprüfung greift nur bei truthy current_approver. Bei NULL darf jeder authentifizierte Benutzer den ausgewählten pending-Zustand ändern und gegebenenfalls das Dokument freigeben.

Funktionen: - alixdocs-approval-decide

Korrektur: Fehlende Genehmigerzuordnung standardmäßig ablehnen; Rollenfreigaben explizit prüfen und Entscheidung atomar an Zustand und Berechtigung binden.

Auswirkung: - Unberechtigte Freigabe oder Ablehnung fremder Dokumente

Tests: - NULL-Genehmiger, fremder Genehmiger und konkurrierende Entscheidung; jeweils unveränderten Zustand prüfen.

Rollback: Freigabeentscheidungen sperren; betroffene Entscheidungen fachlich revidieren.

## lov_finding_321b0bea0163279e

Any finance user can create records across tenants

Ursache: Die Finanzrolle wird geprüft, nicht jedoch die Berechtigung auf den gewählten collect_cases-Datensatz. Fall und Rechnungspositionen werden ausschließlich über case_id mit Service Role geladen.

Funktionen: - collect-document-generate

Korrektur: Fallmandant und Kundenberechtigung vor Dokumenterstellung, Storagezugriff und optionalem Versand prüfen.

Auswirkung: - Mandantenfremde Verarbeitung von Forderungsdaten
- Unberechtigte Schriftverkehrserstellung

Tests: - Finance-Benutzer aus A darf Fall aus B weder erzeugen noch versenden.

Rollback: Generator sperren; unberechtigt erzeugte Dokumente gezielt widerrufen oder kennzeichnen.

## lov_finding_3e5d7e5d17036bf2

Anyone can create the Sobitsch account and commission records

Ursache: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Provisionierung, Profil-Upsert, Aktivierung der Provisionszuordnung und Provisionszuweisungen aus. Das Konto wird zwar gesperrt beziehungsweise inaktiv angelegt; dies verhindert die übrigen unberechtigten Änderungen nicht.

Funktionen: - tmp-create-sobitsch

Korrektur: Temporären Provisionierungsendpunkt entfernen oder ausschließlich als explizit berechtigten, nicht öffentlichen Wartungsjob betreiben.

Auswirkung: - Unberechtigte Kontoprovisionierung
- Unberechtigte Provisionsänderungen

Tests: - Öffentlichen Aufruf ausschließen; kontrollierten Wartungslauf auf Idempotenz und Änderungsumfang prüfen.

Rollback: Deployment des Endpunkts deaktivieren; Provisionszuweisungen anhand eines Vorherstands korrigieren.

## lov_finding_43edd4e59b516cae

Anyone can read customer chats through agent assistance

Ursache: conversation_id wird ohne Identitätsprüfung angenommen. Konversation und letzte Nachrichten werden privilegiert geladen und an die KI gegeben. agent_user_id ist ebenfalls frei vorgebbar und steuert das Speichern von Vorschlägen.

Funktionen: - ac-agent-assist-live

Korrektur: Konversationszugriff und Agentenrolle prüfen; agent_user_id aus der verifizierten Identität ableiten.

Auswirkung: - Verarbeitung fremder Chatnachrichten
- KI-Kosten
- Fremde Vorschlagseinträge

Tests: - Anonyme und fremde Konversation ablehnen; Identitäts-Spoofing über agent_user_id verhindern.

Rollback: Assistenzendpunkt sperren; fremd erzeugte Vorschläge überprüfen.

## lov_finding_48c15e5c018def20

No-assignment users can generate all-tenant reminders

Ursache: getTenantScope setzt bei einem authentifizierten Benutzer ohne user_tenant_access-Einträge restricted auf false und erlaubt alle aktiven Mandanten. Der Mahnlauf übernimmt diesen Wert und setzt scopedIds auf null. Die Ablehnung leerer eingeschränkter Scopes verhindert diese Fail-open-Konstellation nicht.

Funktionen: - finance-reminder-engine
- getTenantScope

Korrektur: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Berechtigung explizit über eine privilegierte Rolle abbilden.

Auswirkung: - Mandantenübergreifender Mahnlauf durch Benutzer ohne Zuweisung

Tests: - Benutzer ohne Zuweisung, mit einem Mandanten und mit expliziter globaler Rolle getrennt prüfen.

Rollback: Mahnlauf deaktivieren; Scope-Korrektur nicht durch Wiederherstellung des Fail-open-Verhaltens zurückrollen.

## lov_finding_4e8e8f0051d29984

Anyone can trigger calendar updates for staff

Ursache: Der Kalendersync nimmt user_id ohne Identitätsprüfung entgegen. Die Providerfunktionen schreiben externe Kalenderereignisse mit gespeicherten OAuth-Berechtigungen; die Benutzer-ID im Request ist kein Berechtigungsnachweis.

Funktionen: - esc-calendar-sync
- pushToGoogle
- pushToMicrosoft

Korrektur: Eigene Kalenderidentität oder explizite administrative Jobberechtigung prüfen; Auswahl fremder Benutzer serverseitig begrenzen.

Auswirkung: - Unberechtigte Auslösung externer Kalenderänderungen

Tests: - Anonymen Aufruf und fremde user_id ablehnen; eigenen beziehungsweise administrativen Sync zulassen.

Rollback: Kalendersync stoppen; erzeugte Providerereignisse anhand ihrer Referenzen abgleichen.

## lov_finding_5353120018933fbe

Signed-in users can change scores on unauthorized offers

Ursache: Nach getUser werden bis zu 25 frei gewählte Angebots-IDs direkt mit Service Role gelesen. Eine Angebots-, Vertriebs- oder Mandantenberechtigung fehlt vor der KI-Verarbeitung. Der spätere Score-Schreibpfad wurde nicht vollständig gelesen.

Funktionen: - offers-ai-score

Korrektur: Alle Angebots-IDs gegen den autorisierten Scope prüfen und nicht autorisierte Stapel vollständig ablehnen.

Auswirkung: - Unberechtigte Verarbeitung fremder Angebotsdaten
- KI-Kosten
- Scoreänderungen zusätzlich verifizieren

Tests: - Gemischten Stapel aus eigenen und fremden IDs ohne Teilverarbeitung ablehnen.

Rollback: Scoring sperren; betroffene Scores aus gesicherter Historie wiederherstellen.

## lov_finding_58c64b182fdc8abb_baa3b4af

Anyone can read and post asset depreciation records

Ursache: userClient wird lediglich erzeugt, aber nicht zur Identitätsprüfung verwendet. Alle aktiven Anlagen werden mit Service Role geladen; dry_run ist standardmäßig false und der Code schreibt Abschreibungen.

Funktionen: - finance-asset-depreciation-run

Korrektur: Verifizierte Finanzbuchungs- oder Jobberechtigung und Anlagenmandantenscope vor Lesen und Buchen verlangen.

Auswirkung: - Unberechtigte Anlagenverarbeitung
- Unberechtigte Abschreibungsbuchungen

Tests: - Anonymen Lauf einschließlich dry_run ablehnen; fremden Mandanten ablehnen; berechtigten Lauf idempotent prüfen.

Rollback: Abschreibungslauf sperren; Buchungen fachlich stornieren und Buchwerte abgleichen.

## lov_finding_5bcfc333ec4f9bc9

Anyone can post asset depreciation entries

Ursache: Vor dem Abschreibungs-Upsert findet keine wirksame Authentifizierung statt. Der angelegte userClient wird nicht abgefragt; der Schreibpfad verwendet admin und wird ohne dry_run explizit ausgeführt.

Funktionen: - finance-asset-depreciation-run

Korrektur: Buchungsrolle, Mandant und Periodenberechtigung vor dem Abschreibungs-Upsert prüfen.

Auswirkung: - Unberechtigte Abschreibungsbuchung

Tests: - Nicht authentifizierten und fachfremden Benutzer vor Upsert ablehnen.

Rollback: Lauf sperren; fehlerhafte Buchungen durch dokumentierte Stornos korrigieren.

## lov_finding_5e9ccda6a9cfe1b0

CMR users can send portal invites to arbitrary addresses

Ursache: Nach globaler CMR-Rollenprüfung werden to und portalUrl unverändert aus dem Request verwendet. Zusätzlich wird die hinterlegte Portal-Kundenadresse auf to geändert. Es fehlt eine konkrete Empfänger- und Änderungsberechtigung.

Funktionen: - cmr-portal-invite

Korrektur: Empfänger aus autorisiertem Kundenkontakt ableiten; URL serverseitig erzeugen; Kontaktänderungen getrennt berechtigen.

Auswirkung: - Missbrauch von Portal-Einladungen
- Unberechtigte Kontaktänderung
- Phishing über vorgegebene URL

Tests: - Fremde Empfängeradresse und externe portalUrl ablehnen.

Rollback: Einladungen stoppen; geänderte Kontaktadressen und versendete Links überprüfen.

## lov_finding_62db31108e6e90e3

Anyone can use the paid voice-script AI service

Ursache: Der Handler verarbeitet objective ohne Aufruferprüfung und ruft den kostenpflichtigen KI-Dienst auf. Bei contact_id liest er zusätzlich Name, E-Mail, Telefon und Tags per Service Role.

Funktionen: - ac-voice-ai-studio

Korrektur: Voice-Studio-Berechtigung, Kontaktzugriff und benutzerbezogene Quoten vor KI-Aufruf prüfen.

Auswirkung: - Unberechtigte KI-Kosten
- Verarbeitung fremder Kontaktdaten
- Unberechtigte Prediction-Einträge

Tests: - Anonymen Aufruf und fremden Kontakt ablehnen; Quoten und berechtigte Nutzung prüfen.

Rollback: Studio deaktivieren; unberechtigt erzeugte Predictions prüfen.

## lov_finding_6cf979d98c0592e9

Anyone can access customer records and trigger AI analyses

Ursache: contact_id wird ohne Authentifizierung angenommen. Kontakt, Nachrichten und Anrufe werden privilegiert geladen und als KI-Kontext übertragen.

Funktionen: - ac-customer-intel

Korrektur: Intelligence-Rolle und konkrete Kontakt-/Mandantenberechtigung vor Datenzugriff prüfen.

Auswirkung: - Unberechtigte Verarbeitung privater Kundenkommunikation
- KI-Kosten

Tests: - Anonyme und fremde contact_id vor sämtlichen Abfragen ablehnen.

Rollback: Intelligence-Endpunkt sperren; erzeugte Analysen prüfen.

## lov_finding_74e43b7ec94e2367_821fd4e7

Any signed-in user can export another customer's records

Ursache: Eine Kunden-Scope-Prüfung existiert tatsächlich vor dem Dokumentdownload. Sie ist jedoch für Benutzer ohne Mandantenzuweisung wirkungslos: getTenantScope setzt restricted=false, und customerInScope gibt dann sofort true zurück. Anschließend werden sämtliche Kundendokumente privilegiert exportiert.

Funktionen: - alixdocs-customer-export
- getTenantScope
- customerInScope

Korrektur: Scope ohne Zuweisung schließen und eigenständige Kundenexportberechtigung verlangen.

Auswirkung: - Komplettexport fremder Kundendokumente durch Benutzer ohne Zuweisung

Tests: - Benutzer ohne Zuweisung darf keine fremden Kunden exportieren; zugewiesene Benutzer nur ihren Scope.

Rollback: Kundenexport sperren; erzeugte Downloadartefakte widerrufen, soweit vorhanden.

## lov_finding_7663c8dfc8cfd611_1e2b5c22

Anyone can create recurring customer invoices

Ursache: Der Abrechnungslauf liest frei gewählte planId und tenantId ohne Aufruferprüfung und selektiert wiederkehrende Pläne per Service Role. planId umgeht zudem die Fälligkeitsauswahl; eine Berechtigung auf den Plan fehlt.

Funktionen: - cmr-recurring-run

Korrektur: Verifizierte Jobidentität oder berechtigte CMR-Abrechnungsrolle mit konkretem Mandantenscope verlangen; manuelle Planläufe gesondert autorisieren.

Auswirkung: - Unberechtigte Auslösung der wiederkehrenden Abrechnung

Tests: - Anonymen Lauf und fremde planId ablehnen; vorzeitigen manuellen Lauf nur explizit berechtigt zulassen.

Rollback: Abrechnungslauf stoppen; erzeugte Belege fachlich stornieren statt löschen.

## lov_finding_7845d0d7721ae86a

Anyone can send arbitrary push messages to selected users

Ursache: Der Handler prüft nur VAPID-Konfiguration und Eingabeformat. Frei gewählte user_ids beziehungsweise role bestimmen privilegiert geladene Push-Abonnements; eine Aufrufer- oder Empfängerberechtigung fehlt.

Funktionen: - mobile-push-send

Korrektur: Push-Senderrolle und erlaubten Empfängerscope vor Abonnementzugriff und Versand prüfen.

Auswirkung: - Unberechtigte Push-Nachrichten an ausgewählte Beschäftigte

Tests: - Anonymen und fachfremden Versand sowie fremden Empfängerscope ablehnen.

Rollback: Push-Versand sperren; bereits zugestellte Push-Nachrichten sind nicht zuverlässig rückholbar.

## lov_finding_80694480687b8731

Anyone can trigger internal ticket alerts

Ursache: Der Alarmhandler startet unmittelbar mit Service Role und übernimmt eine optionale lookback_minutes-Auswahl ohne Identitätsprüfung. Ein konfigurierter Empfänger und Cooldown begrenzen Auswirkungen, ersetzen aber keine Jobberechtigung.

Funktionen: - ticket-sync-alert

Korrektur: Verifizierte Job- oder administrative Syncberechtigung vor Logzugriff verlangen; Lookback begrenzen.

Auswirkung: - Unberechtigte Auslösung interner Ticketalarmverarbeitung

Tests: - Anonymen Start ablehnen; berechtigten Job und begrenztes Lookback prüfen.

Rollback: Alarmjob deaktivieren; Cooldown-Zustände gezielt prüfen.

## lov_finding_86a979bd8688c2a0

CMR users can send arbitrary invoice emails to any address

Ursache: CMR-Rolle wird geprüft, aber documentId wird danach ohne Benutzer-Mandantenabgleich per Service Role gelesen. Empfänger, Betreff, Nachricht und PDF-Inhalt stammen aus dem Request; das Versandprotokoll wird dem gewählten fremden Beleg zugeordnet.

Funktionen: - cmr-send-document

Korrektur: Belegmandant und Versandrecht prüfen; PDF serverseitig aus dem autorisierten Beleg erzeugen und Empfängeroverrides gesondert berechtigen.

Auswirkung: - Mandantenfremder Belegversand
- Fremde Versandprotokolle
- Missbrauch der Unternehmensidentität

Tests: - CMR-Benutzer mit fremdem documentId und manipuliertem PDF ablehnen.

Rollback: Belegversand sperren; fehlerhafte Protokolle kennzeichnen.

## lov_finding_8703f96241dee35e_aec296a4

Any signed-in user can send another customer's ticket details

Ursache: Der Handler authentifiziert den Benutzer, lädt ticket_id aber anschließend ohne Objektberechtigung mit Service Role. source_system=alixsmart ist lediglich eine fachliche Herkunftsprüfung. Eine optionale message_id wird außerdem unabhängig von ticket_id gelesen.

Funktionen: - sync-to-alixsmart

Korrektur: Syncberechtigung auf das konkrete Ticket prüfen; message_id zwingend an dasselbe autorisierte Ticket binden.

Auswirkung: - Unberechtigte Verarbeitung fremder Tickets
- Mögliche ticketübergreifende Nachrichtenübernahme

Tests: - Fremdes Ticket und Nachricht aus anderem Ticket ablehnen.

Rollback: Externen Sync sperren; betroffene externe Übertragungen abgleichen.

## lov_finding_89bba568925256f2_166f7873

Anyone can trigger playbook execution accessing customer data

Ursache: Der Einstieg prüft keine Identität und übernimmt playbook_id sowie customer_id nur als Filter. Aktive Playbooks und Kunden-Health-Daten werden privilegiert geladen; runAction kann unmittelbar E-Mail, SMS und WhatsApp auslösen.

Funktionen: - ac-playbook-run
- runAction

Korrektur: Verifizierte Jobidentität oder administrative Playbookberechtigung mit Kundenscope verlangen.

Auswirkung: - Unberechtigte Automationsausführung
- Externe Kundenkommunikation
- Verarbeitung geschützter Kundendaten

Tests: - Anonymen Start und fremde customer_id ablehnen; externe Dienste nur mocken.

Rollback: Playbookjob deaktivieren; erzeugte Aktionen anhand der Laufprotokolle abgleichen.

## lov_finding_9260563e406937fe

Bank statement import trusts any Bearer header

Ursache: Die einzige Aufruferprüfung ist startsWith('Bearer '). Der Token wird nicht verifiziert. Danach werden mit Service Role vorhandene Notifications gelesen und neue Bankmeldungen einschließlich raw_xml gespeichert.

Funktionen: - finance-camt054-import

Korrektur: Token verifizieren, Bankimportrolle und Kontomandant prüfen; beliebige Bearer-Zeichenfolgen ablehnen.

Auswirkung: - Unberechtigter Bankdatenimport
- Unberechtigter Zugriff auf Importmetadaten

Tests: - Beliebigen Bearer und fachfremden Benutzer vor Datenzugriff ablehnen.

Rollback: Import sperren; eingefügte Notifications und abhängige Zuordnungen abgleichen.

## lov_finding_98051a4a477129d7

Any signed-in user can request signatures on others' documents

Ursache: Nach getUser wird das frei gewählte Dokument ohne Objektprüfung privilegiert geladen. Seine private PDF-Version wird kopiert und für einen frei gewählten signer_email ein Signaturvorgang angelegt.

Funktionen: - alixdocs-sign-request

Korrektur: Leserecht und Signaturanforderungsrecht auf das konkrete Dokument sowie zulässige Unterzeichner prüfen.

Auswirkung: - Unberechtigte Nutzung fremder PDF-Dokumente
- Unberechtigte Signaturvorgänge

Tests: - Fremdes document_id ablehnen; keine Storagekopie oder Signaturzeile bei Ablehnung.

Rollback: Signaturbrücke sperren; unberechtigte Requests widerrufen und Kopien bereinigen.

## lov_finding_9a2e7a4d1dc3c9a6 · PRODUCT HUB

Anyone can inspect product catalog and validation reports

Ursache: Der Validierungseinstieg besitzt vor den Service-Role-Abfragen keine Identitäts- oder Katalogberechtigungsprüfung. Produkte, Medien, Dokumente und Konflikte werden global geladen. In diesem gelesenen Einstieg liegt keine controlled_modes-Sperre vor der Operation.

Funktionen: - product-hub-validate

Korrektur: Product-Hub-Prüfberechtigung vor sämtlichen Katalog- und URL-Zugriffen erzwingen; Berichte nach Berechtigung begrenzen.

Auswirkung: - Unberechtigte Katalog- und Konfliktverarbeitung
- Serverseitige URL-Prüfungen

Tests: - Anonymen und fachfremden Benutzer vor erster Abfrage ablehnen; erlaubten Prüfer zulassen.

Rollback: Validierungsendpunkt sperren; Betriebsmodus-Sperren gegebenenfalls zusätzlich beibehalten.

## lov_finding_9fcacb28cc4c5d46 · PRODUCT HUB

Public importer leaks key to caller-chosen URLs

Ursache: endpoint beziehungsweise source_url wird ohne Aufruferprüfung aus dem Body übernommen und an fetchSource gegeben. fetchSource sendet den serverseitigen Quellschlüssel als x-api-key an genau diesen Endpunkt. Vor diesem Fetch ist keine controlled_modes-Sperre vorhanden.

Funktionen: - product-hub-import
- fetchSource

Korrektur: Importberechtigung verlangen; Ziel-URL serverseitig festlegen beziehungsweise streng erlaubnislisten; Redirects zu nicht erlaubten Hosts verhindern; betroffenen Schlüssel nach Absicherung rotieren.

Auswirkung: - Abfluss eines serverseitigen Quellschlüssels
- Serverseitige Requests an frei gewählte Ziele
- Unberechtigter Importzugriff

Tests: - Fremden Host und hostwechselnden Redirect ohne echten Schlüssel oder Netzwerkaufruf ablehnen.

Rollback: Importer deaktivieren; Schlüsselrotation nicht rückgängig machen; nur abgesicherten Zielhost freigeben.

## lov_finding_a42c392d5c8dd1fd

Anyone can trigger Swiss payment reconciliation

Ursache: Der CH-Abgleich prüft nur das Bearer-Präfix. Ohne Tokenverifizierung oder Finanzrolle werden offene Schweizer Bankzeilen mit Service Role geladen und für QR-Matching verarbeitet.

Funktionen: - finance-ch-reconcile

Korrektur: Verifizierte Finanzabgleichs- oder Jobberechtigung und Kontomandantenscope vor Verarbeitung verlangen.

Auswirkung: - Unberechtigte Zahlungsabgleichsverarbeitung

Tests: - Beliebigen Bearer, fachfremden Benutzer und fremden Kontomandanten ablehnen.

Rollback: Abgleich stoppen; erzeugte Zahlungszuordnungen fachlich prüfen.

## lov_finding_b4dbe8c9ecfd794e_659534c3

Anyone can add bank activity to your finance records

Ursache: Beliebige Bearer-Zeichenfolgen bestehen die einzige Prüfung. Anschließend wird über den privilegierten Client eine finance_camt054_notifications-Zeile mit vom Aufrufer geliefertem XML angelegt.

Funktionen: - finance-camt054-import

Korrektur: Authentifizierung, Bankimportrolle und Kontomandant prüfen; unberechtigte Eingaben vor dem Insert ablehnen.

Auswirkung: - Unberechtigte dauerhafte Bankmeldungen

Tests: - Ungültiger Bearer darf keine Notification erzeugen; berechtigter Import bleibt idempotent.

Rollback: Import stoppen; manipulierte Notifications und Folgezuordnungen gezielt zurücknehmen.

## lov_finding_b740221af1bd20a5

Any signed-in user can export debit instructions

Ursache: getUser prüft die Identität. Danach wird jedoch ein separater uneingeschränkter admin-Client erstellt, der run_id sowie zugehörige Positionen einschließlich Mandaten ohne Rollen- oder Mandantenprüfung lädt.

Funktionen: - finance-sepa-export

Korrektur: SEPA-Exportrecht und Berechtigung auf den konkreten Laufmandanten prüfen, bevor Mandats- und Bankdaten geladen werden.

Auswirkung: - Unberechtigte Verarbeitung von Lastschrift- und Mandatsdaten

Tests: - Fachfremden Benutzer und fremde run_id ablehnen; autorisierten Export zulassen.

Rollback: SEPA-Export sperren; erzeugte Exportartefakte überprüfen.

## lov_finding_ba12e323f71e0fa4

Signed-in users can send return details to arbitrary addresses

Ursache: Nach getUser wird return_id ohne Objekt- oder Mandantenprüfung mit Service Role geladen. Die Zieladresse stammt frei aus body.email; die Syntaxprüfung ersetzt keine Berechtigung auf die Retourendaten.

Funktionen: - return-note-send

Korrektur: Retourenberechtigung auf den konkreten Datensatz prüfen und Empfängeroverrides explizit autorisieren.

Auswirkung: - Unberechtigte Verarbeitung fremder Retourendaten
- Potenzieller Versand an fremde Adressen

Tests: - Fremde return_id und nicht autorisierte Zieladresse ablehnen.

Rollback: Retourenversand deaktivieren; bereits gesendete Inhalte sind nicht rückholbar.

## lov_finding_bb420b3953e6ab20

Anyone can recompute health scores from customer records

Ursache: Der Scoringhandler nimmt ohne Identitätsprüfung einen Lauf entgegen und lädt Kunden, Aufträge, offene Rechnungen, Nachrichten und Kontaktsignale mit Service Role. Der Zugriff wird lediglich mengenmäßig begrenzt, nicht autorisiert.

Funktionen: - ac-health-score

Korrektur: Verifizierte Jobberechtigung oder Health-Scoringrolle mit Mandantenscope verlangen.

Auswirkung: - Unberechtigte Verarbeitung mandantenübergreifender Kundensignale

Tests: - Anonymen Start vor der ersten Abfrage ablehnen; berechtigten Lauf auf Mandantentrennung prüfen.

Rollback: Scoringjob sperren; erzeugte Scores bei Bedarf neu berechnen.

## lov_finding_c1970a6abcb44913

Anyone can access and add your bank statement records

Ursache: finance-bank-import verifiziert keinen Benutzer, sondern nur das Bearer-Präfix. Bereits die Suche nach vorhandenem file_hash und die Rückgabe von statement_id und Zählern erfolgen mit Service Role ohne Konto- oder Mandantenberechtigung.

Funktionen: - finance-bank-import

Korrektur: Verifizierte Importidentität, Finanzrolle und Berechtigung auf Bankkonto und Mandant vor Deduplizierung und Speicherung prüfen.

Auswirkung: - Unberechtigter Zugriff auf Bankimportmetadaten
- Ungeschützter privilegierter Importpfad

Tests: - Beliebigen Bearer vor Hashsuche ablehnen; fremden Kontomandanten ablehnen.

Rollback: Bankimport sperren; betroffene Importsätze und Zuordnungen fachlich abgleichen.

## lov_finding_c5b0e3d6a8f2e774

Anyone can download finance transactions

Ursache: Der DATEV-Export akzeptiert jede Zeichenfolge mit Bearer-Präfix. Danach liest er Finanztransaktionen und Kundennamen per Service Role, begrenzt nur durch frei gewählten Zeitraum und Region; eine Benutzer-, Rollen- oder Mandantenprüfung fehlt.

Funktionen: - finance-datev-export

Korrektur: Benutzer authentifizieren, DATEV-Exportrecht verlangen und erlaubte Mandanten serverseitig filtern.

Auswirkung: - Unberechtigter Zugriff auf Finanztransaktionen und Kundenzuordnungen

Tests: - Beliebigen Bearer, fachfremde Rolle und fremden Mandanten vor Abfrage ablehnen.

Rollback: DATEV-Export deaktivieren; bereits erzeugte Dateien überprüfen.

## lov_finding_d30e657eadd449e2

Anyone can submit stored call transcripts for analysis

Ursache: Der konkrete Transkriptzugriff erfolgt mit Service Role allein anhand der vom Request gelieferten call_id. Davor gibt es weder Identitäts- noch Anrufberechtigungsprüfung.

Funktionen: - ac-conv-intel-analyze

Korrektur: Analyse- und Anrufberechtigung vor Transkriptzugriff erzwingen; zugehörigen KI-Pfad mit derselben Prüfung schützen.

Auswirkung: - Unberechtigte Nutzung gespeicherter Gesprächstranskripte

Tests: - Anonymen und fremden call_id-Zugriff vor Abfrage und KI-Verarbeitung ablehnen.

Rollback: Gesprächsanalyse sperren.

## lov_finding_d788ed2671203a5e

Any signed-in user can text another team's case details

Ursache: Der authentifizierte Benutzer wird nicht mit dem per case_id geladenen After-Sales-Fall abgeglichen. recipient_phone und custom_text sind zusätzlich frei vorgebbar; der Kundenname aus dem fremden Fall wird in die Nachricht eingesetzt.

Funktionen: - as-send-sms-reminder

Korrektur: Team- und Mandantenzugriff auf den Fall sowie Berechtigung für Empfänger- und Textoverride prüfen.

Auswirkung: - Offenlegung fremder Falldetails per SMS
- Unberechtigter SMS-Versand

Tests: - Fremden Teamfall und externe recipient_phone ohne Override-Recht ablehnen.

Rollback: SMS-Versand sperren; Kommunikationshistorie prüfen.

## lov_finding_01b05992862b294b

Anyone can change a user's password

Ursache: Der HTTP-Handler erzeugt ohne vorgelagerte Identitäts- oder Rollenprüfung einen Service-Client, sucht ein festes Konto und setzt dessen Passwort auf einen im Quelltext festgelegten Wert. Die Gateway-Quellkonfiguration deaktiviert zusätzlich die JWT-Prüfung. Ein legitimer externer Aufrufer wurde nicht gefunden; das schützt den direkten Handler nicht.

Funktionen: - admin-reset-jerry

Korrektur: Einmal-Reset-Handler entfernen beziehungsweise sperren; betroffenes Kennwort und Sitzungen kontrolliert erneuern; administrative Wiederherstellung ausschließlich über einen autorisierten, protokollierten Prozess.

Auswirkung: - Kontoübernahme des fest hinterlegten Kontos

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_04b7323c4231ec65

Anyone can trigger the privileged Swiss order import

Ursache: Der Handler prüft nur, ob nach Bearer-Entfernung ein nichtleerer String übrig bleibt; eine Identitäts- oder Importberechtigungsprüfung fehlt. Danach werden mit Service-Rechten Kunden, Aufträge und Positionen verändert. Der Frontendaufruf ersetzt diese serverseitige Prüfung nicht. Anonyme Erreichbarkeit hängt zusätzlich vom nicht verifizierten Deployment-Gateway ab.

Funktionen: - import-all-orders-ch
- runImport

Korrektur: Verifizierte Benutzeridentität und explizite Importberechtigung beziehungsweise verifizierte interne Jobidentität vor Importstart erzwingen.

Auswirkung: - Unberechtigte Importläufe
- Änderung von Auftrags- und Kundendaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_0e9d121dc4ee77fc

Anyone can trigger bank statement imports

Ursache: Zwischen HTTP-Einstieg und Service-Zugriff auf Bankverbindungen, Abruf externer Bankdaten sowie Speicherung liegt keine Aufruferprüfung. Der Frontendaufruf übergibt eine connectionId, autorisiert den Handler aber nicht. verify_jwt ist in der Quelldatei deaktiviert.

Funktionen: - bank-api-fetch

Korrektur: Bankimportberechtigung und Verbindungsscope prüfen; automatische Läufe gesondert authentifizieren.

Auswirkung: - Unberechtigte Bankabrufe
- Import- und Storage-Seiteneffekte

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_12f184f4fe482d12

Anyone can trigger notices for another customer's package

Ursache: Die Aktion notify_customer_status verarbeitet eine frei übergebene Paket-ID unmittelbar mit dem Service-Client und ruft send-mail mit Service-Identität auf. Anders als andere Aktionen liegt hier weder eine Benutzerprüfung noch eine Paket-RLS-Abfrage vor. Der spätere Versandclient erhält daher nicht die ursprüngliche Aufruferidentität.

Funktionen: - mediapaket-portal:notify_customer_status
- send-mail

Korrektur: Vor Datenzugriff Paketberechtigung des verifizierten Aufrufers oder eine strikt verifizierte interne Ereignisidentität prüfen.

Auswirkung: - Unberechtigte Kundenbenachrichtigung
- Weitergabe paketbezogener Zugangslinks

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_1a410c3cce005159

Anyone can change every customer's competitor data

Ursache: Der Handler verwendet den Service-Client ohne Identitäts- und Kundenberechtigungsprüfung zum Lesen der Wettbewerber und Schreiben von Snapshots sowie Zeitstempeln. Der UI-Aufruf mit client_id ist nur eine Eingabequelle, kein serverseitiger Berechtigungsnachweis. Anonymer Gatewayzugang ist nicht abschließend belegt.

Funktionen: - social-competitors-sync

Korrektur: Verifizierten Aufrufer und Social-Kundenscope vor Synchronisierung prüfen; globale Läufe nur für verifizierte Jobs.

Auswirkung: - Unberechtigte Wettbewerber-Synchronisierung
- Datenmanipulation

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_1c6e8cfec49210c7

Anyone can analyze any contact’s private conversations

Ursache: Eine übergebene contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Aufruferprüfung. Die Daten werden an den KI-Dienst übertragen und Prognosen gespeichert. Der Frontendaufruf begrenzt direkte HTTP-Aufrufe nicht.

Funktionen: - ac-revenue-intel-v2

Korrektur: Kontakt- und Mandantenberechtigung vor jedem privilegierten Lesen und KI-Aufruf erzwingen.

Auswirkung: - Unberechtigte Verarbeitung privater Kommunikation
- KI-Kosten
- Prognoseschreibzugriffe

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_21a637de07028856

Public token permits unauthenticated employee-data access

Ursache: Ein im Quelltext festgelegter Triggerwert wird als alleiniger Zugriffsschutz verwendet. Danach werden Mitarbeiterdaten gelesen und Benachrichtigungen ausgelöst. Das einmalige app_settings-Flag begrenzt Wiederholungen, ersetzt aber keine geheime oder personenbezogene Autorisierung. Der aktuell gesetzte Flagzustand wurde nicht gelesen.

Funktionen: - announce-capa-cockpit

Korrektur: Einmalhandler entfernen oder ausschließlich verifizierter interner Identität zugänglich machen; veröffentlichten Triggerwert nicht weiter als Geheimnis behandeln.

Auswirkung: - Unberechtigte Mitarbeiterbenachrichtigung
- Privilegierte Verarbeitung von Mitarbeiterdaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_2989a7a085c7a5ca_bfcf4258

Signed-in users can overwrite ETA data for arbitrary route plans

Ursache: getUser validiert die Identität, danach erfolgen Route- und Auftragszugriffe sowie ETA-Update mit dem Service-Client. Eine Zuordnung der route_plan_id zum Aufrufer oder eine Dispositionsberechtigung ist nicht vorgeschaltet. Der mobile Aufrufer ist keine serverseitige Objektprüfung.

Funktionen: - dispatch-eta-sms

Korrektur: Route gegen Aufruferzuordnung und erforderliche Dispositionsrechte prüfen, bevor Kommunikation oder ETA-Änderung erfolgt.

Auswirkung: - Fremde ETA-Änderungen
- Unberechtigte Kundenkommunikation

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_2f496f49c8a0776a

Anyone can add your official signature to documents

Ursache: Der Handler akzeptiert ein PDF und einen Dokumenttyp, lädt anschließend Service-geschützte Faksimilekonfiguration und Signaturgrafik ohne Aufruferprüfung. Der legitime Aufruf aus zoho-invoice-pdf authentifiziert andere direkte Aufrufe nicht. Kein Duplikat des separaten Asset-Downloadbefunds: Hier ist die Konfigurationsoperation ausgewählt.

Funktionen: - sig-apply-facsimile

Korrektur: Nur verifizierte interne Aufrufer und nachweislich autorisierte Dokumentidentitäten zulassen; keine frei eingereichten PDFs pauschal stempeln.

Auswirkung: - Missbrauch einer offiziellen Unterschriftsdarstellung

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_3b50bf868a4ca4dc

Anyone can trigger another user's ticket email

Ursache: Eine notification_id reicht für Service-Zugriffe auf Benachrichtigung, Benutzerprofil und Ticket; eine Bindung des Aufrufers an den Empfänger fehlt. Danach wird der Provider direkt aufgerufen. Ein Datenbanktrigger als legitimer Aufrufer schützt den separat erreichbaren Handler nicht.

Funktionen: - ticket-user-notify

Korrektur: Nur verifizierte interne Benachrichtigungsereignisse akzeptieren; Versandzustand und Ereignisbindung vor Provideraufruf prüfen.

Auswirkung: - Unberechtigte Ticket-E-Mails
- Verarbeitung fremder Ticketdaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_3f6f96a860e513ff

Anyone can create and activate automation rules

Ursache: Der Handler unterscheidet Generierung, Validierung und Speicherung, prüft aber vor dem Service-Insert in ac_automation_rules keine Identität oder Administrationsberechtigung. Der WorkflowStudio-Aufrufer ist lediglich Clientcode; die Gateway-Quelldatei deaktiviert JWT-Prüfung.

Funktionen: - ac-workflow-studio

Korrektur: Workflow-Verwaltungsrecht und Mandantenscope vor Generierung, Speicherung und Aktivierung prüfen.

Auswirkung: - Unberechtigte Automationsregeln
- Mögliche nachgelagerte Kundenaktionen

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_4bc3611a6285a5f0

Anyone can send private conversations for quality review

Ursache: Der Handler wählt Konversationen und Nachrichten mit einem Service-Client aus, überträgt den Verlauf zur KI und schreibt QA-Ergebnisse, ohne den Aufrufer zu prüfen. Ein UI-Aufruf autorisiert diese Service-Zugriffe nicht.

Funktionen: - ac-conversation-qa

Korrektur: QA-Rolle und Konversationsscope vor Auswahl und KI-Übertragung erzwingen.

Auswirkung: - Unberechtigte Verarbeitung privater Gesprächsverläufe
- QA-Manipulation

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_4ea4f21737ef5149

Anyone can create completed QM evaluations

Ursache: call_id und scorecard_id steuern einen Service-Lesezugriff und anschließend das Anlegen einer abgeschlossenen QM-Bewertung ohne Aufrufer- oder Bewerterberechtigungsprüfung. Dies ist eine andere Operation als der separat gemeldete Transkriptzugriff.

Funktionen: - ac-qm-auto-score:Bewertung

Korrektur: QM-Bewerterrecht sowie Call- und Scorecard-Scope vor Verarbeitung und Abschluss prüfen.

Auswirkung: - Unberechtigte Mitarbeiterbewertungen
- Mögliche Coaching-Folgeaktionen

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_5eb7960ed2ed2229

Any signed-in user can run code through search

Ursache: Gegenprüfung korrigiert die erste Bewertung: Antwortfragmente sind zwar React-Textknoten (Zeilen 40–62), aber Quellen-Snippets werden separat unverändert über dangerouslySetInnerHTML gerendert (Zeilen 139–142). Die behauptete gespeicherte HTML-Einfügung bleibt damit vorhanden. Admin-Routenschutz entfernt das Risiko bei manipulierten autorisierten Quelldokumenten nicht; keine produktive Ausnutzung getestet.

Funktionen: - AlixDocsAiSearch.ask
- AlixDocsAiSearch.renderAnswer

Korrektur: Quellen-Snippets als sichere Text-/Highlight-Segmente rendern oder streng mit bestehendem Sanitizer auf notwendige Formatierung begrenzen; keine ungeprüften HTML-Ereignisattribute oder aktiven Inhalte.

Auswirkung: - Gespeicherte Quelltexte können aktive HTML-Inhalte in die administrative Suchansicht einschleusen.
- Formatierte Suchtreffer müssen erhalten bleiben, ohne aktives HTML auszuführen.

Tests: - Isolierte Quell-Snippets mit Ereignisattributen/aktiven Tags dürfen keine Ausführung auslösen; sichere Hervorhebungen und Links bleiben nutzbar.

Rollback: Nur eine nachweislich sichere Render-Version wiederherstellen; Roh-HTML-Darstellung nicht erneut freigeben. Keine produktive Quelldatenänderung.

## lov_finding_63a444f362255ddb

Anyone can change campaign results

Ursache: Der Handler verwendet die frei übergebene campaign_id für Service-Lesezugriffe auf Kampagne und Empfänger sowie ein anschließendes Kampagnenupdate ohne Identitäts- oder Kampagnenberechtigungsprüfung.

Funktionen: - ac-campaign-ab-decide

Korrektur: Kampagnenverwaltungsrecht und Mandantenscope vor Auswertung und Entscheidung erzwingen.

Auswirkung: - Manipulation von Kampagnenentscheidungen

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_675c4841c9be4f6b

Anyone can see internal routing and staffing details

Ursache: getUser wird aufgerufen, ein fehlender Benutzer führt aber nicht zum Abbruch. Routingregeln, Agentenfähigkeiten und Auslastung werden mit Service-Rechten verarbeitet; Ergebnis und Trace werden zurückgegeben. Optional kann sogar ohne Benutzer eine Simulation gespeichert werden.

Funktionen: - ac-router-simulate

Korrektur: Fehlende Identität ablehnen und Routing-/Personaldatenberechtigung samt Mandantenscope vor Service-Zugriffen prüfen.

Auswirkung: - Offenlegung interner Routing- und Personaldaten
- Unberechtigte Simulationsspeicherung

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_6a796ab89ffc66d5

Anyone can send private customer records outside

Ursache: contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Autorisierung. Die Daten gehen an den KI-Dienst; Prognosen und Customer-Health-Daten werden geschrieben. Der Clientaufruf ersetzt keine serverseitige Prüfung.

Funktionen: - ac-customer-intel

Korrektur: Kontaktberechtigung und Mandantenscope vor KI-Verarbeitung erzwingen.

Auswirkung: - Unberechtigte externe Verarbeitung privater Kundendaten
- Manipulation von Kundenanalysen

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_6eb5a3fe59d356e3

Anyone with a sign-in can copy another user's stored files

Ursache: Der Benutzerzweig prüft nur getUser. Frei übergebene source_bucket und source_path werden anschließend über den Service-Storageclient geladen, ohne den Dateizugriff des Benutzers mit dessen Identität zu prüfen. Die alternative interne Schlüsselprüfung schränkt diesen Benutzerzweig nicht ein.

Funktionen: - alixdocs-attach-from-storage

Korrektur: Quelldatei unter Benutzeridentität lesen oder den Zugriff serverseitig objektspezifisch prüfen; Buckets begrenzen und Zielobjekt separat autorisieren.

Auswirkung: - Unberechtigter Zugriff auf fremde Storage-Dateien

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_752434abd9742e22

Anyone can read and rewrite your financial forecasts

Ursache: Der Handler übernimmt tenant_id aus dem Body, liest Finanztransaktionen mit Service-Rechten, ruft die KI auf und upsertet finance_forecasts ohne Aufrufer- oder Finanzberechtigungsprüfung.

Funktionen: - finance-ai-forecast

Korrektur: Finanzprognoserecht und autorisierten Mandanten serverseitig bestimmen; KI- und Schreibzugriffe erst danach ausführen.

Auswirkung: - Unberechtigte Finanzdatenverarbeitung
- Prognosemanipulation
- KI-Kosten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_80702a087db69b7e

Anyone can read records for arbitrary contacts

Ursache: Der Handler liest für eine beliebige contact_id Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und verarbeitet sie per KI ohne Aufruferprüfung. Anschließend wird eine Prognose gespeichert. Ein tatsächlicher Nachrichtenversand wird hier nicht behauptet.

Funktionen: - ac-omnichannel-orchestrate

Korrektur: Kontakt- und Analyseberechtigung vor Datenauswahl und KI-Aufruf prüfen.

Auswirkung: - Unberechtigte Verarbeitung privater Kontaktdaten
- Prognoseschreibzugriffe

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_86d0bf0477028299

A fake bearer can export any direct-debit run

Ursache: Es wird nur das Präfix Bearer geprüft, nicht die Identität. Danach werden der frei gewählte Lastschriftlauf und dessen Detaildaten mit Service-Rechten gelesen. Ein gegebenenfalls vorgeschaltetes Gateway ersetzt keine Finanz- und Laufberechtigung. Der separate Statusupdatebefund ist keine identische Operation.

Funktionen: - finance-ch-dd-export:Lesen

Korrektur: Identität validieren und Exportrecht sowie Lauf-/Mandantenscope vor Datenabruf erzwingen.

Auswirkung: - Unberechtigter Zugriff auf Lastschrift- und Zahlungsdaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_98ce69bedfbee8e0

Anyone can trigger event creation in users’ Microsoft calendars

Ursache: Die Quelldatei konfiguriert Gateway-JWT-Prüfung, der Handler selbst bindet user_id jedoch nicht an die verifizierte Identität. Ohne user_id verarbeitet er alle aktiven Verbindungen. Gespeicherte OAuth-Zugänge werden für Kalender-POSTs genutzt. Damit bleibt mindestens ein objektbezogenes Autorisierungsdefizit; vollständig anonymer Zugriff ist nicht behauptet.

Funktionen: - esc-calendar-sync
- pushToMicrosoft
- pushToGoogle

Korrektur: Identität im Handler verifizieren und nur eigene Kalender zulassen; globale Synchronisierung ausschließlich für verifizierte Jobs.

Auswirkung: - Unberechtigte Erstellung fremder Kalenderereignisse
- Mögliche Mehrfachanlage

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_aab25c4aac0c36d0_10807eba

Anyone can analyze any call recording transcript

Ursache: Vor dem Service-Lesen des per call_id gewählten Transkripts findet keine Aufrufer- oder Callberechtigungsprüfung statt. Das Transkript wird anschließend zur KI übertragen. Dies ist keine identische Operation zum Anlegen einer QM-Bewertung.

Funktionen: - ac-qm-auto-score:Transkriptanalyse

Korrektur: QM-Analyseberechtigung und Call-Scope vor Transkriptzugriff prüfen.

Auswirkung: - Unberechtigte externe Verarbeitung privater Gesprächstranskripte

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_ad68a76e0a7dba39

Anyone can put your company signature on their documents

Ursache: Der Service-Storagedownload der offiziellen Signaturgrafik ist durch keine Identitäts- oder Dokumentberechtigungsprüfung geschützt. Übergebene PDFs können damit verarbeitet werden. Gegenüber dem Konfigurationslesebefund ist eine andere konkrete Operation ausgewählt; deshalb keine Dublettenklassifikation.

Funktionen: - sig-apply-facsimile:Assetdownload

Korrektur: Signaturasset nur nach verifizierter interner Identität und autorisierter Dokumentbindung laden.

Auswirkung: - Missbrauch offizieller Unterschriftsgrafik

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

## lov_finding_b4dbe8c9ecfd794e_7e264ad8

Bank statement import trusts any Bearer header

Ursache: Nur das Bearer-Präfix wird geprüft. Anschließend werden eingereichte Bankmeldungen mit Service-Rechten in finance_camt054_notifications und finance_camt054_entries gespeichert. Eine validierte Identität und Bankimportrolle fehlen.

Funktionen: - finance-camt054-import

Korrektur: Benutzer validieren und Bankimportberechtigung sowie Konten-/Mandantenscope vor Verarbeitung erzwingen.

Auswirkung: - Unberechtigte Anlage von Bankmeldungen und Buchungsdaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_b84cf71745089f7f

Anyone can submit private conversations to live assistant

Ursache: Eine conversation_id steuert Service-Lesezugriffe auf Konversation und Nachrichten ohne Aufruferprüfung. Gesprächsverlauf und Wissenskontext werden an die KI übertragen; Vorschläge werden gespeichert.

Funktionen: - ac-agent-assist-live

Korrektur: Agentenberechtigung und Konversationsscope vor jedem Lese- und KI-Zugriff prüfen.

Auswirkung: - Unberechtigte Verarbeitung privater Konversationen
- KI-Kosten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_ba7c311bb074fdc2_4edc88a2

Anyone can analyze any contact’s conversations

Ursache: Der Handler akzeptiert contact_id ohne Identitätsprüfung, liest Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und überträgt sie zur KI. Ergebnisse werden in ac_predictions gespeichert.

Funktionen: - ac-predictive-engagement

Korrektur: Kontaktberechtigung und Mandantenscope vor Analyse erzwingen.

Auswirkung: - Unberechtigte Verarbeitung privater Kontaktaktivitäten
- Prognosemanipulation

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_c3d615c0a49c15fb

Anyone can export debit instructions

Ursache: Nach einer bloßen Bearer-Präfixprüfung werden der gewählte Lastschriftlauf und seine Positionen mit Service-Rechten als exportiert markiert. Es fehlt eine validierte Identität und Laufberechtigung. Diese Mutation ist nicht identisch mit dem separaten Lesebefund.

Funktionen: - finance-ch-dd-export:Statusänderung

Korrektur: Exportrolle und Lauf-/Mandantenscope prüfen; Status erst nach autorisiertem, konsistentem Export ändern.

Auswirkung: - Unberechtigte Änderung finanzieller Exportzustände

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_d599eb858f23ab35_c16d2b6f

Any signed-in user can export direct-debit details

Ursache: Der erste Client validiert den Benutzer. Anschließend wird jedoch ein neuer Service-Client ohne Benutzerheader erzeugt und für den frei übergebenen run_id verwendet. Eine Exportrolle oder objektbezogene Laufberechtigung ist vor diesem Übergang nicht vorhanden.

Funktionen: - finance-sepa-export

Korrektur: SEPA-Exportrecht sowie Lauf-/Mandantenscope vor privilegiertem Datenzugriff prüfen.

Auswirkung: - Unberechtigter Zugriff auf Lastschriftexportdaten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

## lov_finding_d9ed56cd61cd46cd

Anyone can impersonate a social messaging contact

Ursache: Die GET-Verifikation verwendet einen Verifikationstoken, der POST-Eingang prüft dagegen keine kryptografische Provider-Signatur vor privilegierter Kontakt-/Konversations- und Nachrichtenerzeugung. Ein GET-Abonnementcheck authentifiziert keine späteren POST-Nachrichten.

Funktionen: - ac-webhook-meta

Korrektur: Provider-Signatur am unveränderten Requestbody prüfen, bevor JSON verarbeitet oder Daten geschrieben werden; Kanal-/Mandantenbindung und Ereignisdeduplizierung ergänzend prüfen.

Auswirkung: - Gefälschte eingehende Social-Nachrichten
- Kontakt- und Konversationsverfälschung

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Rollback: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

## lov_finding_e90b7b2049e0b2bb

Anyone can trigger paid journey optimization

Ursache: Eine frei übergebene journey_id steuert privilegierte Journey-Abfragen und einen KI-Aufruf ohne Aufruferprüfung. Der UI-Aufruf schützt den direkten HTTP-Einstieg nicht; verify_jwt ist in der Quelle deaktiviert.

Funktionen: - ac-journey-optimize

Korrektur: Journey-Analyseberechtigung und Mandantenscope vor Datenzugriff und kostenpflichtiger KI-Verarbeitung prüfen.

Auswirkung: - Unberechtigte Verarbeitung interner Journey-Daten
- KI-Kosten

Tests: - Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Rollback: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

