# ALIXWORK – CRITICAL SECURITY RESOLUTION v1.0

Prüfstand: 2026-11-28T04:46:18.621210+00:00

## Umfang und Entscheidung

266 kritische Scanner-IDs aus dem Scan vom 2026-11-28T04:14:20.068253158Z; Scanstatus `incomplete`. Die Einzelprüfung betrifft genau diese 266 ursprünglichen IDs. Andere Warnungen sind nicht automatisch einbezogen oder geschlossen. Keine Korrektur, Migration, Funktionsbereitstellung, Veröffentlichung oder Änderung von Scannerstatus ausgeführt. Paket A ist ausschließlich ein Freigabeentwurf.

**Keine vollständige Sicherheitsabnahme:** Quellcodebefunde sind von tatsächlich durchgeführten produktiven Benutzer-/Mandanten-/Providerprüfungen getrennt. Der neu gestartete Tiefenscan wird nach Abschluss separat bewertet; er wird nicht abgewartet oder als erfolgreich unterstellt.

## Veröffentlichung: Warnung versus tatsächliche Sperre

Die Prämisse „Veröffentlichung durch 266 Befunde blockiert“ ist aktuell nicht belegt. Publish Settings am 28.11.2026 04:38 UTC: is_published=true, published_at=2026-11-28T04:37:10.172715Z, Sichtbarkeit public. Die vorherige Veröffentlichungsanfrage wurde angenommen und meldete 266 offene kritische Sicherheitswarnungen, keine tatsächliche Ablehnung. Es wurde in dieser Prüfung bewusst kein neuer Publish ausgelöst. Daraus folgt weder eine erfolgreiche angemeldete Funktionsabnahme noch Sicherheit der Anwendung.

Es gibt derzeit **keine durch eine Veröffentlichungsablehnung belegte Liste zwingender Hosting-Blocker**. Alle 266 IDs bleiben aktive kritische Scannerwarnungen; falls eine spätere Workspace-Sicherheitsregel sie zwingend prüft, sind sie konservativ als potentielle Gate-Einträge zu behandeln. Technische Empfehlung: bestätigte kritische Lücken beheben, ungeklärte kritische Pfade auflösen und Ausnahmen einzeln begründen; keine pauschale Ignorierung.

## Einordnung der 266 IDs

- Bestätigte kritische Quellcodelücke: 187
- Bestätigte Fehlkonfiguration: 4
- Technisch zugeordnete Doppelmeldung: 9
- Im aktuellen Code bereits behoben: 1
- Technisch begründete Ausnahme: 0
- Technisch begründeter Fehlalarm: 0
- Nicht abschließend prüfbar: 65

Individuell dokumentierte Reviews: 266/266. Die Kategorien sind disjunkt pro ID. Kritische Scanner-IDs bleiben unabhängig von der technischen Kategorie unangetastet. Eine Doppelmeldung bedeutet nicht „Risiko behoben“. Keine Ausnahme oder Fehlalarmmarkierung wurde beim Scanner gespeichert.

## Rollen, RLS und privilegierte Nachweise – zusätzliche Metadatenprüfung

### Rollenvererbung / Privilegieneskalation (A-ROLE-001)

Aktuelle public.has_role(text)-Definition erlaubt bei angefragter Rolle Super Admin auch r.name=Admin. user_roles-INSERT/UPDATE-Policies verwenden diese Prüfung als erste OR-Alternative; damit kann Admin die nachfolgenden Einschränkungen (nicht sich selbst, nicht Super-Admin-Rolle) umgehen. Dies ist ein konkreter Policy-Angriffspfad aus den aktuellen Definitionen; keine tatsächliche Rollenzuweisung oder Ausnutzung ausgeführt. Auch DELETE-Policies auf roles/user_roles und verschiedenen Storage-Bereichen benutzen die geerbte Prüfung.

Geplant: exakte aktive Super-Admin-Identität und klare Admin-Fachrechte durch bestehende Fassade/Policies erzwingen; Vererbung erst nach vollständiger Abhängigkeitsinventur und ausdrücklicher Freigabe entfernen. Regression: Admin kann sich/anderen keine Super-Admin-Rolle geben, Super Admin darf freigegebene Rollenaktionen, inaktive Konten gesperrt, vorhandene Fachrollen unverändert. Keine produktiven Rollentests; isolierte Testidentitäten erforderlich. Rollback: versionierte Policy-/Funktionsdefinitionen, keine unsichere Vererbung wieder einführen.

### SECURITY DEFINER / öffentliche Datenbankflächen

942 öffentliche Tabellen besitzen RLS, 0 öffentliche Basistabellen ohne RLS laut aktuellem Katalog. Dies ist kein Sicherheitsgesamtbeweis: permissive Policies, Eigentümer-Views und privilegierte Funktionen können RLS umgehen. Aktuelle Definer-Definitionen und EXECUTE-Rechte wurden lesend inventarisiert; ihre Autorisierung muss operation- und rollenbezogen geprüft werden. Anon/authenticated SELECT-Grants allein sind keine Datenfreigabe bei RLS. security_policy_details liest jedoch pg_policy-Katalogmetadaten ohne eigenen Rollenfilter; die View ist für anon/authenticated lesbar.

### Service Role und Freigabeprotokolle (A-AUDIT-001)

security_audit_findings: sec_find_manage_super erlaubt ALL über geerbtes has_role('Super Admin'), der einzige Tabellen-Trigger pflegt updated_at. Revisionsgebundene Korrekturfreigaben können daher an der Tabelle durch Admin geändert werden; ein kontrollierter Handler allein schützt direkte Data-API-Schreibpfade nicht. Das WORM-audit_logs-Protokoll bleibt davon getrennt und hat UPDATE/DELETE-Sperrtrigger. Korrekturfreigabe ist trotzdem keine Ausführungsermächtigung für Product Hub.

Geplant: exakte aktive Super-Admin-Schreibrechte und unveränderliche Freigabeidentität/-revision in bestehenden Tabellen und Handlern, keine neue parallele Verwaltung. Regression: Admin/inaktiv/fremde Revision/zweite Änderung verweigert; berechtigte Korrekturfreigabe bleibt correction_only=true/execution=false; Audit-Log unveränderlich. Rollback kontrolliert ohne wieder offene Tabellenrechte.

### Product-Hub-Nachweise

ph2_release_admin und ph2_require_super_admin prüfen die exakte zugewiesene Rolle und aktiven angenommenen Kontostatus. ph2_record_release_proof ist für anon/authenticated nicht ausführbar. Reservierte ph2_-Protokolle und Einstellungen besitzen ph2_guard_reserved. Bestehende Release-Matrix verlangt frische konfigurationsgebundene Proofs; letzter Sicherheitsproof passed=false, complete=false. Kein Nachweis geschrieben. Diese Schutzschichten sind aus aktuellem Code/Katalog belegt, ersetzen aber keine reale angemeldete Ende-zu-Ende-Abnahme.

### Webhooks und Storage

Alle 31 Buckets sind aktuell private (public=false). Trotzdem können privilegierte Signier-/Downloadfunktionen Dateien an unberechtigte Aufrufer ausgeben. Storage-Policies wurden lesend geprüft; Backup-UPDATE erlaubt is_admin und damit das Ersetzen existierender Backupobjekte. Geplante Korrekturen müssen Dateiidentität, Besitz/Mandant, Feld-/Pfadbegrenzung und Service-Aufrufer prüfen, nicht nur den Bucket privat stellen. Webhooks benötigen unveränderten Rohtext, feste signierte Provider-URL, Zeitfenster und eindeutige Ereignisse; einfache Token-/JWT-Dekodierung ohne Verifikation genügt nicht. Vor Änderungen echte Provider-/Cron-Aufrufer und vorhandene geheime Zugänge erfassen, keine Schlüssel ändern.

## Bestandsschutz

44 Produkte mit unverändertem Fingerprint 936dc6209c4afc91c1d54dad8e28d773; 102 Zeitpläne mit Fingerprint cd3e3d31e6c55af14d5966f710aa90fa. DE/COM mode=blocked, enabled=false, emergency_stopped=true, revision=0. Keine Geräte, Produktdaten, Schlüssel, API-Verträge oder Zeitpläne geändert; keine Funktion gelöscht.

## Freigabebedingungen für Paket A

Ausdrücklicher Auftrag muss konkrete IDs/zusammengehörige Operationen nennen. Vor jeder Ausführung: Aufrufer- und Rollenmatrix, isolierte Testdaten, betroffene DB-/Funktionsdefinitionen und koordinierter Rücknahmeplan. Bereits behobene, doppelte oder ungeklärte IDs nicht blind korrigieren. Neue Quellen-/Versand-/Schlüsselverträge nur nach separater Freigabe; vorhandene produktive Schlüssel und API-Verträge bleiben unverändert. Nach Umsetzung gezielte Regression, bereitgestellte Version prüfen und nur tatsächlich gelöste ausgewählte Scanner-IDs als behoben melden.

## Einzelprüfung

### lov_finding_006a75d168f7259a

**Anyone can trigger global private mail relinking**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach OPTIONS folgt unmittelbar ein Service-Role-Scan unverknüpfter Mails. Kontakt- und Auftragszuordnung sowie Updates erfolgen ohne Identitäts-, Aktivitäts-, Rollen- oder Mandantenprüfung. Der UI-Aufrufer ersetzt keine Serverautorisierung.

Nachweise:
- supabase/functions/ac-email-autolink/index.ts:4-29
- src/pages/AlixConnect/EmailSync.tsx:29

Betroffene Funktionen:
- ac-email-autolink

Geplante Korrektur: Aktives internes Konto mit Mailverwaltungsrecht oder explizites Maschinencredential verlangen; Mails und Zielobjekte gemeinsam mandantenbezogen begrenzen.

Mögliche Auswirkungen: - Falsche Mailzuordnungen
- Mandantenübergreifende Verarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, deaktiviert und fremder Mandant abweisen; berechtigte Zuordnung positiv prüfen.

Wiederherstellung: Bei Regression Endpoint sperren; Änderungen anhand gesicherter Vorwerte zurücksetzen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_01c314f2b58b194b

**Anyone can change offer scores**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler selektiert offene Angebote privilegiert ohne Aufruferprüfung, sendet sie an KI und aktualisiert Scores anhand zurückgelieferter IDs. Ein Cron-Kommentar ist keine Zugangskontrolle.

Nachweise:
- supabase/functions/offers-ai-autoscore/index.ts:28-58
- supabase/functions/offers-ai-autoscore/index.ts:64-87

Betroffene Funktionen:
- offers-ai-autoscore
- scoreBatch

Geplante Korrektur: Maschinenauthentifizierung oder aktive autorisierte Vertriebsrolle vor Selektion; Mandantenscope und zurückgelieferte Angebots-IDs gegen den selektierten Batch prüfen.

Mögliche Auswirkungen: - Manipulierte Vertriebsbewertung
- KI-Kosten
- Verarbeitung privater Angebotsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: unberechtigte Requests ohne KI-Aufruf; fremde Batch-ID ohne Update; berechtigter Job erfolgreich.

Wiederherstellung: Scoringjob deaktivieren und frühere Scores wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_08c1beda03a5ef65

**Anyone can view customer scores and routing details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser wird aufgerufen, aber das Ergebnis sperrt die privilegierte Simulation nicht. Kundenscore, Routingregeln, Agentenskills und Auslastung werden unabhängig von einer autorisierten Identität verarbeitet und als Simulationsergebnis ausgegeben.

Nachweise:
- supabase/functions/ac-router-simulate/index.ts:21-42
- supabase/functions/ac-router-simulate/index.ts:54-70
- supabase/functions/ac-router-simulate/index.ts:92-103

Betroffene Funktionen:
- ac-router-simulate

Geplante Korrektur: Identität verbindlich validieren; aktives Routing-Administrationsrecht und Mandantenscope für Kunde, Regeln und Agenten verlangen.

Mögliche Auswirkungen: - Offenlegung interner Routinginformationen
- Auswertung fremder Kundenscores

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fehlende Identität, falsche Rolle und fremder Kunde abweisen; erlaubten Simulatorpfad prüfen.

Wiederherstellung: Simulator sperren, nicht auf ungeprüften Zugriff zurückfallen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_108fb37fdfeda925

**Anyone can send private customer records outside**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Beliebige contact_id führt ohne Authentifizierung zu Service-Role-Lesezugriffen auf Kontakt, Nachrichten und Anrufe. Die Daten werden an die KI weitergegeben und Vorhersagen gespeichert; verify_jwt ist explizit false.

Nachweise:
- supabase/functions/ac-customer-intel/index.ts:10-32
- supabase/functions/ac-customer-intel/index.ts:46-65
- supabase/config.toml:331-332

Betroffene Funktionen:
- ac-customer-intel

Geplante Korrektur: Aktive berechtigte Mitarbeiteridentität und kontaktbezogene Mandantenfreigabe vor allen Reads und KI-Aufrufen erzwingen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kundenkommunikation
- KI-Kosten
- Unberechtigte Vorhersagen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremde Kontakt-ID und deaktiviertes Konto ohne Daten- oder KI-Zugriff; erlaubten Kontakt prüfen.

Wiederherstellung: KI-Endpunkt deaktivieren; erzeugte Vorhersagen gezielt kennzeichnen oder entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1376815e4ca5950a

**Ticket IDs bypass the caller's ticket access policy**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser authentifiziert den Nutzer, danach liest ein separater Service-Role-Client beliebige ticket_id und repair_id sowie seriennummernbezogene Historien. Ticket-, Reparatur-, Rollen-, Aktivitäts- und Mandantenzugriff werden nicht geprüft.

Nachweise:
- supabase/functions/ai-service-analyze/index.ts:41-52
- supabase/functions/ai-service-analyze/index.ts:68-102
- supabase/functions/ai-service-analyze/index.ts:119-139

Betroffene Funktionen:
- ai-service-analyze

Geplante Korrektur: Aktives Servicekonto mit fachlicher Rolle verlangen; Ticket, Reparatur und gesamte Seriennummernhistorie im Aufruferscope laden.

Mögliche Auswirkungen: - IDOR auf Servicehistorien
- Weitergabe fremder Daten an KI
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: authentifizierter Fremdnutzer für Ticket, Reparatur und Seriennummer negativ; erlaubte Analyse positiv.

Wiederherstellung: Analysefeature sperren; keine Rückkehr zu privilegierten ungeprüften Reads.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1794cebaf2967832

**Production staff can grant their own QM approvals**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: plm_can_write erlaubt Produktion ausdrücklich. Die UPDATE-Policy schützt nur die Zeile über denselben breiten Helfer, nicht QM-Felder. qm_approved_by und qm_approved_at liegen in derselben Tabelle; der vorhandene Update-Trigger aktualisiert lediglich den Zeitstempel.

Nachweise:
- supabase/migrations/20260806155709_88726754-0a4b-4848-b094-20020221ff74.sql:2-11
- supabase/migrations/20260806155709_88726754-0a4b-4848-b094-20020221ff74.sql:338-369

Betroffene Funktionen:
- public.plm_can_write
- public.plm_changes
- public.plm_touch_updated_at

Geplante Korrektur: QM-Freigaben über atomare rollenbeschränkte Operation mit aktivem QM-Konto und Vieraugenprüfung führen; direkte Änderungen geschützter Felder verhindern.

Mögliche Auswirkungen: - Umgehung der QM-Freigabe
- Verlust der Funktionstrennung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Produktion darf Fachfelder, aber keine QM-Felder ändern; Selbstfreigabe negativ; unabhängige QM-Freigabe positiv.

Wiederherstellung: QM-Änderungen sperren; Freigabestatus aus revisionssicherer Historie rekonstruieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1aac574b83b92e0b

**Anyone can trigger recurring billing across tenants**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler prüft keinen Aufrufer. tenantId ist optional und stammt aus dem Request; ohne Wert werden aktive wiederkehrende Pläne mandantenübergreifend verarbeitet, Vorankündigungen versendet und Rechnungsdokumente angelegt.

Nachweise:
- supabase/functions/cmr-recurring-run/index.ts:25-58
- supabase/functions/cmr-recurring-run/index.ts:87-107
- supabase/functions/cmr-recurring-run/index.ts:120-173

Betroffene Funktionen:
- cmr-recurring-run

Geplante Korrektur: Globalen Lauf ausschließlich maschinell authentifizieren; interaktive Läufe auf aktive Finanzrolle und serverseitigen Mandantenscope begrenzen.

Mögliche Auswirkungen: - Unberechtigte Rechnungsanlage
- Mandantenübergreifender Mailversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonymer und fremdmandantiger Lauf negativ; autorisierter Job und Wiederholungsfestigkeit positiv.

Wiederherstellung: Job stoppen; erzeugte Dokumente fachlich stornieren statt unkontrolliert löschen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1cfc25c1a72b5091

**Anyone can trigger private ticket notifications**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: notification_id wird ohne Aufruferauthentifizierung privilegiert aufgelöst. Die Aktivitätsprüfung betrifft den Empfänger, nicht den Aufrufer. Ticketdaten werden für eine Mail genutzt und die Empfängeradresse wird zurückgegeben.

Nachweise:
- supabase/functions/ticket-user-notify/index.ts:39-88
- supabase/functions/ticket-user-notify/index.ts:109-114
- supabase/config.toml:264-265

Betroffene Funktionen:
- ticket-user-notify

Geplante Korrektur: Vertrauenswürdige Jobauthentifizierung oder aktive Ticketberechtigung verlangen; Notification an Ticket und erlaubten Versandzustand binden.

Mögliche Auswirkungen: - Unberechtigte Ticketbenachrichtigungen
- Offenlegung von Empfängerinformationen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremde Notification, anonym und Replay abweisen; berechtigte Zustellung prüfen.

Wiederherstellung: Versand sperren; bereits versandte Mails sind nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_214081f60b07281d

**Any signed-in user can add an internal note to any ticket**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: getUser ist verbindlich, und der Datenbankclient trägt trotz Service-Key den Nutzer-Authorization-Header: ein RLS-Bypass ist deshalb nicht belegt. Es bestehen mehrere INSERT-Policies, darunter alte breite Fachrollenregeln und neuere aktive interne Notizrechte. Die vollständige effektive Ticket-RLS und Helferauflösung wurde nicht abschließend verifiziert; ein Schreibrecht jedes eingeloggten Nutzers ist nicht nachgewiesen.

Nachweise:
- supabase/functions/mobile-voice-transcribe/index.ts:19-26
- supabase/functions/mobile-voice-transcribe/index.ts:49-52
- supabase/migrations/20260729154143_29b6a62a-b3c9-4e0f-b824-abf26969f96b.sql:3-23
- supabase/migrations/20261106144436_ad48ee78-8140-4bf3-af8e-fe45e81abcad.sql:1-22

Betroffene Funktionen:
- mobile-voice-transcribe
- public.can_create_internal_note
- public.can_manage_tickets

Geplante Korrektur: Effektive Ticket- und INSERT-Policies vollständig auflösen; aktive Notizberechtigung vor kostenpflichtiger Transkription explizit prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte interne Notizen
- Transkriptionskosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Portalnutzer, deaktivierte Fachrolle und fremder Mandant gegen echte RLS prüfen; Insertfehler dürfen keinen Erfolg vortäuschen.

Wiederherstellung: Ticketpersistierung separat deaktivieren; bestehende RLS nicht abschwächen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_22d2f74a8a4d2421

**Anyone can run the bank statement import**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Endpoint liest Bankverbindungen und startet deren Import ohne Aufruferprüfung; connectionId ist nur ein Zielauswahlfilter. Aktivierte Verbindung und vorhandener Provider-Token sind Betriebsvoraussetzungen, keine Autorisierung.

Nachweise:
- supabase/functions/bank-api-fetch/index.ts:31-52
- supabase/functions/bank-api-fetch/index.ts:66-82
- supabase/config.toml:429-430

Betroffene Funktionen:
- bank-api-fetch

Geplante Korrektur: Maschinencredential oder aktive Bankimportrolle erzwingen; Verbindungen an erlaubten Mandanten binden.

Mögliche Auswirkungen: - Unberechtigte Bankimporte
- Speicher- und Providerbelastung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, falsche Rolle und fremde Verbindung ohne Provideraufruf; autorisierten Import prüfen.

Wiederherstellung: Importverbindungen deaktivieren; neu erzeugte Importobjekte anhand des Laufprotokolls isolieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_27d2250b5b8790ba

**Anyone can modify delivery status without authentication**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der behauptete vollständig ungeschützte ID-Zugriff trifft nicht zu: Auftrag, Kunden-E-Mail und Rechnungs- oder Liefer-PLZ müssen zusammenpassen. Das sind jedoch bekannte Bestandsdaten statt eines Besitznachweises. Der Rate-Limiter arbeitet ausdrücklich fail-open. Ob dieses Wissensmodell für Lieferänderungen akzeptiert ist, ist nicht belegt.

Nachweise:
- supabase/functions/portal-delivery-actions/index.ts:14-18
- supabase/functions/portal-delivery-actions/index.ts:74-99
- supabase/functions/portal-delivery-actions/index.ts:106-128

Betroffene Funktionen:
- portal-delivery-actions

Geplante Korrektur: Kurzlebiges auftragsgebundenes Portalcredential oder verifizierte Sitzung einführen; Rate-Limit verbindlich machen und Änderungswünsche von finalen Änderungen trennen.

Mögliche Auswirkungen: - Liefermanipulation bei Kenntnis von Bestandsdaten
- Missbrauch öffentlicher Kundenaktionen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: jede falsche Merkmalskombination negativ; Rate-Limiter-Ausfall; Tokenbindung und Replay.

Wiederherstellung: Änderungsaktionen sperren, lesenden Portalbetrieb erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_28cb10380cb01816

**Anyone can alter every competitor's social reports**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Authentifizierung werden Wettbewerber privilegiert ausgewählt und Snapshots sowie last_snapshot_at verändert. Auch generierte Stubwerte sind dauerhafte Änderungen echter Berichtstabellen.

Nachweise:
- supabase/functions/social-competitors-sync/index.ts:25-46

Betroffene Funktionen:
- social-competitors-sync

Geplante Korrektur: Jobauthentifizierung oder aktive Social-Administrationsrolle mit Client-/Mandantenbindung verlangen; Stubdaten von Produktivberichten trennen.

Mögliche Auswirkungen: - Verfälschte Wettbewerbsberichte
- Mandantenübergreifende Änderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremder Client negativ; erlaubter Sync und eindeutige Stubkennzeichnung positiv.

Wiederherstellung: Sync sperren; betroffene Snapshots aus Vorbestand wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_29b6057cf3486198

**Anyone can force customer dunning emails**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Keine Aufruferprüfung vor dem globalen Rücklastschriftlauf. Besonders relevant: body.force setzt cfg.enabled auf true und umgeht damit eine konfigurierte Deaktivierung. Danach werden fällige Mahnfälle privilegiert verarbeitet.

Nachweise:
- supabase/functions/bank-return-dunning-escalate/index.ts:46-80
- supabase/config.toml:426-427

Betroffene Funktionen:
- bank-return-dunning-escalate

Geplante Korrektur: Maschinenauthentifizierung verlangen; force separat auf aktive privilegierte Finanzrolle begrenzen; mandantenbezogene Verarbeitung erzwingen.

Mögliche Auswirkungen: - Erzwungene Mahnläufe
- Umgehung des Abschaltschalters
- Kundenbelästigung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonymes force und dryRun negativ; deaktivierte Konfiguration bleibt gesperrt; autorisierten Lauf prüfen.

Wiederherstellung: Endpoint und Scheduler sperren; Mahnstände aus Laufhistorie fachlich korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_310b81ae9b51152a

**Unauthenticated requests can read push subscriptions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Identitätsprüfung werden Zielnutzer über IDs oder Rollen bestimmt, Push-Subscriptions samt Schlüsseln privilegiert gelesen und Pushnachrichten verschickt. Die Antwort enthält Zähler, nicht die Subscription-Schlüssel selbst; eine direkte Schlüsseloffenlegung wird nicht behauptet.

Nachweise:
- supabase/functions/mobile-push-send/index.ts:34-70
- supabase/functions/mobile-push-send/index.ts:79-94

Betroffene Funktionen:
- mobile-push-send

Geplante Korrektur: Maschinencredential oder aktive berechtigte Versandrolle prüfen; Empfängerscope, Payload und Versandrate begrenzen.

Mögliche Auswirkungen: - Unberechtigte Pushnachrichten
- Missbrauch privater Subscriptiondaten
- Löschung abgelaufener Subscriptions

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremde Nutzergruppe ohne Subscription-Read oder Push; erlaubten Versand prüfen.

Wiederherstellung: Pushversand deaktivieren; entfernte Subscriptions erfordern gegebenenfalls Neuregistrierung.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_374621ce0171a129

**Anyone can request another agent’s QM history**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: agent_user_id wird ohne Aufruferprüfung verwendet, um QM-Bewertungen privilegiert zu lesen, daraus KI-Coaching abzuleiten und eine Coaching-Session anzulegen. Weder Eigenzugriff noch QM-Rolle oder Mandant werden geprüft.

Nachweise:
- supabase/functions/ac-qm-coaching-recommend/index.ts:8-23
- supabase/functions/ac-qm-coaching-recommend/index.ts:25-48

Betroffene Funktionen:
- ac-qm-coaching-recommend

Geplante Korrektur: Aktives QM-/Führungsrecht und Agentenscope verlangen; berechtigten Eigenzugriff ausdrücklich modellieren.

Mögliche Auswirkungen: - Offenlegung von Mitarbeiterbewertungen
- Unberechtigte Coachingeinträge
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremder Agent, falsche Rolle und deaktiviertes Konto negativ; erlaubte QM-Auswertung positiv.

Wiederherstellung: Coachinggenerierung sperren; unberechtigte Sessions revisionssicher zurücknehmen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_38eef2927644a86c_47b6f826

**Anyone can change ticket SLA and escalation records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Jeder Nicht-OPTIONS-Request ruft die SLA-/Eskalations-RPC mit Service-Role auf. Es gibt keine Aufruferprüfung. Die Gateway-Konfiguration setzt verify_jwt an beiden vorhandenen Einträgen auf false; die doppelte TOML-Deklaration verhindert allerdings einen verlässlichen Deploymentnachweis.

Nachweise:
- supabase/functions/ticket-sla-check/index.ts:5-11
- supabase/config.toml:164-165
- supabase/config.toml:270-271

Betroffene Funktionen:
- ticket-sla-check
- public.ticket_sla_check_and_escalate

Geplante Korrektur: Maschinenauthentifizierung vor RPC einführen und doppelte Funktionskonfiguration bereinigen; RPC-Ausführungsrechte separat prüfen.

Mögliche Auswirkungen: - Unberechtigte SLA-/Eskalationsläufe

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fehlendes und falsches Jobcredential ohne RPC-Aufruf; autorisierter wiederholbarer Lauf.

Wiederherstellung: Scheduler und Endpoint sperren; Eskalationsänderungen anhand Auditdaten prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3b55d34b73b21e9d

**Public chat polling lacks caller authentication**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Polling prüft aktive Website und bindet die conversation_id an website_id. Eine individuelle Besucherberechtigung fehlt jedoch: öffentliche Website-api_key plus fremde Gesprächs-ID reichen zum Lesen nichtinterner Nachrichten.

Nachweise:
- supabase/functions/ac-chat/index.ts:12-24
- supabase/functions/ac-chat/index.ts:180-183
- supabase/functions/ac-chat/index.ts:254-266
- supabase/config.toml:307-308

Betroffene Funktionen:
- ac-chat
- getWebsite
- loadConversation

Geplante Korrektur: Beim Start ein kryptografisches gesprächsgebundenes Besuchercredential ausstellen und bei Polling prüfen; Website-Schlüssel nicht als Besucheridentität behandeln.

Mögliche Auswirkungen: - Lesen fremder Chatkommunikation innerhalb derselben Website

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Besucher A kann Gespräch B auch mit gültigem Website-Schlüssel nicht pollen; eigene Sitzung positiv.

Wiederherstellung: Polling für ungebundene Altgespräche sperren oder kontrollierte Sitzungserneuerung verlangen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3e98351e84204cdc

**Signed-in users can send arbitrary branded appointment emails**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser validiert die Identität, danach wird recipient_email aus dem Request für Markenmailversand genutzt. Eine aktive Mitarbeiterrolle, Terminberechtigung, Mandantenbindung oder Ableitung des Empfängers aus einem autorisierten Termin fehlt.

Nachweise:
- supabase/functions/esc-appointment-confirmation-mail/index.ts:40-76
- supabase/functions/esc-appointment-confirmation-mail/index.ts:100-123

Betroffene Funktionen:
- esc-appointment-confirmation-mail

Geplante Korrektur: Aktive Terminverwaltungsrolle und Eventscope prüfen; Empfänger serverseitig aus dem berechtigten Termin ableiten.

Mögliche Auswirkungen: - Branded Spam
- Phishing
- Versandkosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gewöhnlicher Login und Empfängerüberschreibung negativ; erlaubter Terminversand positiv.

Wiederherstellung: Versandfunktion deaktivieren; versandte Nachrichten nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_413dd4d3641d23bd

**AI endpoint updates cases without a staff-role check**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Signierte Claims werden geprüft, aber keine aktive Fachrolle oder Fallberechtigung. Der separate Adminclient lädt beliebige case_id samt Timeline und Checklisten und schreibt KI-Ergebnisse, Vorschläge und Ereignisse zurück.

Nachweise:
- supabase/functions/as-ai-suggest/index.ts:40-65
- supabase/functions/as-ai-suggest/index.ts:105-112
- supabase/functions/as-ai-suggest/index.ts:135-152

Betroffene Funktionen:
- as-ai-suggest

Geplante Korrektur: Aktives internes Fallbearbeitungsrecht und Fall-/Mandantenzugriff vor privilegiertem Lesen und Schreiben erzwingen.

Mögliche Auswirkungen: - Fremde Falldaten an KI
- Unberechtigte Falländerungen
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremder Fall, externe Rolle und deaktiviertes Konto negativ; erlaubte Fallanalyse positiv.

Wiederherstellung: KI-Schreibpfad sperren; Änderungen über Vorwerte und Timeline zurücknehmen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_452bd5908dcf2082

**Anyone can send caller-written emails to arbitrary recipients**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler akzeptiert event und recipient_email ohne Aufruferauthentifizierung, verschickt daraus eine Service-E-Mail und protokolliert privilegiert. verify_jwt ist false; weder Ticketzugriff noch Empfängerbindung werden erzwungen.

Nachweise:
- supabase/functions/ticket-customer-notify/index.ts:31-62
- supabase/config.toml:167-168

Betroffene Funktionen:
- ticket-customer-notify

Geplante Korrektur: Vertrauenswürdigen Job oder aktive Ticketberechtigung prüfen; Empfänger und Vorlagen aus autorisiertem Ticket ableiten.

Mögliche Auswirkungen: - Spoofing von Servicemails
- Spam
- Manipulierte Kommunikationsprotokolle

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, fremdes Ticket und beliebiger Empfänger negativ; legitimes Ereignis positiv.

Wiederherstellung: Endpoint sperren; missbräuchliche Logeinträge markieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_4bd5ac08511c8e04

**Caller controls SMS recipient and message text**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Endpoint erlaubt Servicecredential oder verifizierte Nutzerclaims, aber keine aktive Versandrolle oder Fallautorisierung. Nach beliebiger case_id werden SMS-Empfänger und Text verarbeitet und Twilio aufgerufen. Telefonnummernformat und vorhandener Fall sind keine Versandberechtigung.

Nachweise:
- supabase/functions/as-send-sms-reminder/index.ts:59-100
- supabase/functions/as-send-sms-reminder/index.ts:110-126

Betroffene Funktionen:
- as-send-sms-reminder

Geplante Korrektur: Servicecredential exakt vergleichen; aktive Fallrolle und Fallzugriff prüfen; freie Empfänger-/Textüberschreibung gesondert berechtigen.

Mögliche Auswirkungen: - Unberechtigter SMS-Versand
- Providerkosten
- Branded Spam

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gewöhnlicher Login, fremder Fall und Empfängerüberschreibung negativ; berechtigte Erinnerung positiv.

Wiederherstellung: SMS-Pfad sperren; bereits versandte SMS sind nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5289cf703f8ac14d

**Anyone can trigger reads of restricted sync logs**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Aufruferprüfung werden eingehende und ausgehende Ticket-Synclogs privilegiert gelesen, Alarmfälle verarbeitet und Alarmdatensätze angelegt. Eine direkte vollständige Rückgabe sämtlicher Rohlogs wird nicht behauptet; die unberechtigte Verarbeitung ist belegt.

Nachweise:
- supabase/functions/ticket-sync-alert/index.ts:47-67
- supabase/functions/ticket-sync-alert/index.ts:129-185
- supabase/config.toml:198-199

Betroffene Funktionen:
- ticket-sync-alert

Geplante Korrektur: Jobauthentifizierung oder aktive Sync-Administrationsrolle erzwingen; Mandantenscope und datensparsame Fehlerausgaben ergänzen.

Mögliche Auswirkungen: - Unberechtigte Logverarbeitung
- Alarm- und Mailmissbrauch

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym ohne Log-Read; falscher Mandant negativ; autorisierter Alarmjob positiv.

Wiederherstellung: Alarmjob stoppen; erzeugte Alarme revisionssicher kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_55eebf6531b0d797

**Anyone can overwrite catalog items through product importing**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Requestparameter steuern Mapping und Scraping ohne Aufruferprüfung. Scrapeergebnisse werden anhand SKU in catalog_items eingefügt oder aktualisiert; Importjobs und Quellenstatus werden privilegiert verändert.

Nachweise:
- supabase/functions/catalog-import-firecrawl/index.ts:9-38
- supabase/functions/catalog-import-firecrawl/index.ts:58-82

Betroffene Funktionen:
- catalog-import-firecrawl

Geplante Korrektur: Aktive Katalogimportrolle verlangen; Quellen erlaubnislistenbasiert beschränken, Vorschau von Freigabe trennen und Schreibscope prüfen.

Mögliche Auswirkungen: - Katalogmanipulation
- Scrapingkosten
- Unberechtigte Produktimporte

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, unerlaubte Quelle und fremder Katalog negativ; freigegebener Import positiv.

Wiederherstellung: Import deaktivieren; betroffene SKU-Versionen aus Vorbestand wiederherstellen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_59b7e25453966dd1

**OAuth callback saves attacker tokens under a chosen user**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der OAuth-Callback übernimmt state direkt als user_id. Nach erfolgreichem Provider-Codeaustausch werden Tokens privilegiert für diese frei gewählte ID gespeichert. Es fehlt eine serverseitig gespeicherte, einmalige State-Bindung an die initiierende Sitzung.

Nachweise:
- supabase/functions/esc-calendar-oauth/index.ts:24-31
- supabase/functions/esc-calendar-oauth/index.ts:35-75
- supabase/config.toml:257-258

Betroffene Funktionen:
- esc-calendar-oauth

Geplante Korrektur: Zufälligen einmaligen State mit Nutzer-, Provider-, Redirect- und Ablaufbindung speichern; vor Tokenpersistierung atomar verbrauchen, PKCE ergänzen.

Mögliche Auswirkungen: - Fremdverknüpfung von Kalenderkonten
- Verletzung der OAuth-Sitzungsintegrität

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremde user_id, manipuliertes State, Replay und abgelaufenes State negativ; legitimer Callback positiv.

Wiederherstellung: OAuth-Verknüpfung sperren; verdächtige Verbindungen widerrufen und neu autorisieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5e150bdaabc5e021

**Anyone can trigger mediapaket reminders and anonymization**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Reminderhandler besitzt keine Aufruferprüfung. Er verarbeitet Pakete global, versendet Erinnerungen und kann bei entsprechender Konfiguration Kontakt-/Teamdaten anonymisieren. Konfigurations- und Fälligkeitsprüfungen ersetzen keine Jobautorisierung.

Nachweise:
- supabase/functions/mediapaket-reminders/index.ts:49-62
- supabase/functions/mediapaket-reminders/index.ts:78-126
- supabase/functions/mediapaket-reminders/index.ts:223-238

Betroffene Funktionen:
- mediapaket-reminders

Geplante Korrektur: Maschinenauthentifizierung vor Verarbeitung erzwingen; Anonymisierung separat berechtigen und protokolliert freigeben.

Mögliche Auswirkungen: - Unberechtigte Erinnerungen
- Unbefugtes Auslösen irreversibler Anonymisierung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym ohne Reads oder Versand; Konfigurationsschalter und Anonymisierungsgrenzen; autorisierter Job.

Wiederherstellung: Job stoppen; echte Anonymisierung nicht ohne Datenschutzprüfung rückgängig machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_607c1e0633e683f5

**Anyone can download another person’s direct-debit details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die einzige Authprüfung ist startsWith('Bearer '); der Token wird nicht validiert. run_id lädt Service-Role-seitig Lastschriftlauf und Mandate einschließlich IBAN, erzeugt XML und setzt Exportstatus ohne Rollen-, Aktivitäts- oder Mandantenprüfung.

Nachweise:
- supabase/functions/finance-ch-dd-export/index.ts:9-25
- supabase/functions/finance-ch-dd-export/index.ts:40-47
- supabase/functions/finance-ch-dd-export/index.ts:81-92

Betroffene Funktionen:
- finance-ch-dd-export

Geplante Korrektur: Token verbindlich validieren; aktive Exportrolle und Laufmandant prüfen; Exportzustandsänderung atomar durchführen.

Mögliche Auswirkungen: - Offenlegung von Bank- und Mandatsdaten
- Unberechtigte Exportstatusänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: beliebiger Bearertext, fremder Lauf und falsche Rolle negativ; autorisierter XML-Export positiv.

Wiederherstellung: Export sperren; Exportstatus anhand Auditdaten korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_63fca018638248be_28891043

**Anyone can post messages into other chat conversations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: send bindet das Gespräch an die Website, nicht an den Besucher. visitor_hash wird nur als Metadatum gespeichert und nicht gegen das Gespräch geprüft. Mit öffentlichem Website-Schlüssel und fremder Gesprächs-ID lassen sich Nachrichten einschleusen.

Nachweise:
- supabase/functions/ac-chat/index.ts:20-24
- supabase/functions/ac-chat/index.ts:180-183
- supabase/functions/ac-chat/index.ts:232-250

Betroffene Funktionen:
- ac-chat
- loadConversation

Geplante Korrektur: Gesprächsgebundenes Besuchercredential vor jedem Send prüfen; Größen- und Ratenlimits sowie Replaykontrolle ergänzen.

Mögliche Auswirkungen: - Chat-Impersonation
- Manipulation fremder Kundenkommunikation
- Unberechtigte KI-Folgeaktionen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Besucher A kann nicht in Gespräch B schreiben; manipuliertes visitor_hash ohne Wirkung; eigener Send positiv.

Wiederherstellung: Ungebundene Sends sperren; eingeschleuste Nachrichten revisionssicher markieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_676a76c192d1c5c0

**Anyone can change an invoice's payment reference**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ein beliebiger Bearer-Präfix genügt. Ohne Tokenvalidierung lädt der Adminclient body.id und generiert bei fehlender QRR-Referenz einen vom reference_seed beeinflussten Wert; anschließend werden Referenz und gegebenenfalls Status gespeichert. Bestehende Referenzen werden nicht beliebig überschrieben.

Nachweise:
- supabase/functions/finance-qr-generate/index.ts:62-70
- supabase/functions/finance-qr-generate/index.ts:83-98

Betroffene Funktionen:
- finance-qr-generate

Geplante Korrektur: Aktives Finanzkonto mit Rechnungs-/Mandantenscope verlangen; Referenz ausschließlich serverseitig und atomar initialisieren.

Mögliche Auswirkungen: - Unberechtigte Referenzinitialisierung
- Offenlegung von QR-Zahlungsdaten
- Statusänderung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: ungültiger Bearer und fremde Rechnung negativ; bestehende Referenz unverändert; zulässige Initialisierung positiv.

Wiederherstellung: Persistierenden QR-Pfad sperren; Referenzänderungen nur nach Zahlungsabgleich zurücknehmen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6bdc45abf053d23e

**Anyone can create product records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Importhandler prüft keinen Aufrufer. Er verarbeitet Request-/Quelldaten privilegiert und erstellt oder aktualisiert ph_products samt Kanal-, Medien- und Dokumentdaten. body.user_id dient als Attribution, nicht als verifizierte Identität.

Nachweise:
- supabase/functions/product-hub-import/index.ts:129-145
- supabase/functions/product-hub-import/index.ts:178-230
- supabase/functions/product-hub-import/index.ts:263-347

Betroffene Funktionen:
- product-hub-import

Geplante Korrektur: Aktive Product-Hub-Importrolle und geprüfte Quelle erzwingen; importedBy aus verifizierter Identität ableiten; Vorschau und Schreibfreigabe trennen.

Mögliche Auswirkungen: - Unberechtigte Produktanlage und -änderung
- Manipulierte Herkunftszuordnung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, gefälschte user_id und unzulässige Quelle negativ; erlaubter Import mit korrekter Attribution positiv.

Wiederherstellung: Import sperren; Produkte und Kinddaten anhand Importlauf und Vorversionen zurücksetzen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6f686b06e95c91e0

**Anyone can send customer details to the analysis service**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Beliebige contact_id führt ohne Aufruferprüfung zu privilegierten Kontakt-, Nachrichten- und Anrufreads. Kontaktinformationen werden für die Kanalempfehlung an KI übertragen; verify_jwt ist false.

Nachweise:
- supabase/functions/ac-omnichannel-orchestrate/index.ts:9-31
- supabase/config.toml:337-338

Betroffene Funktionen:
- ac-omnichannel-orchestrate

Geplante Korrektur: Aktive autorisierte Kontaktrolle und kontaktbezogenen Mandantenscope vor jeder Analyse verlangen.

Mögliche Auswirkungen: - Unberechtigte Kundendatenverarbeitung
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremder Kontakt und anonym ohne KI-Aufruf; berechtigte Empfehlung positiv.

Wiederherstellung: Orchestrierungsanalyse deaktivieren; erzeugte Empfehlungen kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_742579dc7034b64e

**Anyone can change every customer's social metrics**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Authprüfung liegt ausschließlich im Zweig action ungleich sync und sync_one. Gerade die schreibenden Standardsyncs umgehen sie und aktualisieren Service-Role-seitig social_post_metrics mandantenübergreifend. Stubwerte werden dauerhaft gespeichert.

Nachweise:
- supabase/functions/social-metrics-sync/index.ts:36-65
- supabase/functions/social-metrics-sync/index.ts:68-81

Betroffene Funktionen:
- social-metrics-sync

Geplante Korrektur: Alle Actions vor Verzweigung authentifizieren; aktive Socialrolle und Post-/Clientscope prüfen; Berechtigungs-RPC im Nutzerkontext ausführen.

Mögliche Auswirkungen: - Manipulierte Kundenmetriken
- Mandantenübergreifende Berichtsschäden

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: sync und sync_one anonym negativ; fremder Post negativ; berechtigter Scope positiv.

Wiederherstellung: Sync stoppen; betroffene Tagesmetriken aus vertrauenswürdiger Quelle neu erstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_755a57788035e770

**Signed-in users can email order links to arbitrary addresses**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser ist vorhanden, aber danach werden beliebige Signatur-/Auftrags-IDs mit separatem Adminclient gelesen. recipient_email ist frei übersteuerbar; erzeugte Downloadlinks enthalten gültige Signatur- oder HMAC-Credentials. Eine Auftrags- oder Mandantenautorisierung fehlt.

Nachweise:
- supabase/functions/send-order-confirmation/index.ts:39-55
- supabase/functions/send-order-confirmation/index.ts:73-102
- supabase/functions/send-order-confirmation/index.ts:104-120

Betroffene Funktionen:
- send-order-confirmation
- signOrderToken

Geplante Korrektur: Aktive Auftragsversandrolle und Zugriff auf Auftrag sowie Signaturanfrage prüfen; Empfänger serverseitig binden, Overrides separat berechtigen.

Mögliche Auswirkungen: - Abfluss zugangsfähiger Auftragslinks
- Unberechtigte Bestellmails

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremder Auftrag und beliebiger Empfänger negativ; gemischte Signatur-/Auftrags-IDs negativ; legitimer Versand positiv.

Wiederherstellung: Versand sperren; kompromittierte Downloadcredentials gezielt widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_773ec74739954988

**Any signed-in user can copy another user's mail attachment**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach getUser wird der Mailanhang ausschließlich per ID mit Service-Role geladen und aus dessen Speicherpfad kopiert. Mailkonto-, Nachrichten-, Mandanten- und Zielobjektberechtigung fehlen. Das neue Dokument wird dem Aufrufer zugeschrieben.

Nachweise:
- supabase/functions/alixdocs-mail-import/index.ts:23-41
- supabase/functions/alixdocs-mail-import/index.ts:53-89
- src/components/alixdocs/MailToAlixDocsButton.tsx:37

Betroffene Funktionen:
- alixdocs-mail-import

Geplante Korrektur: Aktives Dokumentimportrecht, Zugriff auf Quellmailkonto und Nachricht sowie Zielkunde/-auftrag vor Download und Upload prüfen.

Mögliche Auswirkungen: - Kopieren fremder privater Anhänge
- Unberechtigte Dokumentzuordnung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremdes Mailkonto, fremder Zielauftrag und deaktivierter Nutzer negativ; eigener erlaubter Anhang positiv.

Wiederherstellung: Import sperren; unberechtigte Kopien und Versionen kontrolliert entfernen, Audit behalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7cfb49a133e44934

**Anyone can run maintenance reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach OPTIONS wird ohne Aufruferprüfung der Wartungs-/Garantiestatus aktualisiert und device_maintenance verarbeitet. Erinnerungslogs und Versandflags werden privilegiert geschrieben; Fälligkeit ersetzt keine Jobberechtigung.

Nachweise:
- supabase/functions/maintenance-reminder-daily/index.ts:15-33
- supabase/functions/maintenance-reminder-daily/index.ts:76-97

Betroffene Funktionen:
- maintenance-reminder-daily
- public.refresh_warranty_and_maintenance_status

Geplante Korrektur: Maschinenauthentifizierung vor Statusrefresh und Reminderverarbeitung; interaktive Läufe nur für aktive Wartungsadministration.

Mögliche Auswirkungen: - Unberechtigte Wartungsläufe
- Manipulierte Erinnerungszustände

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym ohne RPC oder Änderungen; autorisierter Job und Wiederholungsfestigkeit positiv.

Wiederherstellung: Scheduler und Endpoint sperren; Flags anhand Reminderlog korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_80f949ebfeee1886

**No-assignment users can generate all-tenant reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getTenantScope weist Nutzer ohne user_tenant_access-Einträge ausdrücklich allen aktiven Mandanten zu: restricted wird ids.size > 0. Die Engine setzt dann scopedIds auf null. Es fehlt zusätzlich eine aktive Finanzrollenprüfung; der globale Zugriff ist somit nicht nur eine UI-Frage.

Nachweise:
- supabase/functions/_shared/tenant-scope.ts:31-78
- supabase/functions/finance-reminder-engine/index.ts:24-40

Betroffene Funktionen:
- finance-reminder-engine
- getTenantScope

Geplante Korrektur: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Rechte explizit modellieren und aktive Finanzrolle verlangen.

Mögliche Auswirkungen: - Mandantenübergreifende Mahnentwürfe
- Umgehung expliziter Mandantenzuweisung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Nutzer ohne Zuweisung negativ; einzelner Mandant isoliert; explizite globale Finanzrolle positiv.

Wiederherstellung: Engine sperren; gemeinsame Scopeänderung kontrolliert ausrollen und bei Problemen fail-closed halten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_86d3d8b71cfd055f

**Any finance user can create another tenant’s payment link**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Identität und eine erlaubte Finanzrolle werden geprüft. Der folgende collect_cases-Read erfolgt jedoch ausschließlich über caseId mit Adminclient; keine Mandanten- oder Fallzuordnung begrenzt die Anlage und Rückgabe eines Zahlungstokens.

Nachweise:
- supabase/functions/collect-payment-link/index.ts:21-51
- supabase/functions/collect-payment-link/index.ts:104-114

Betroffene Funktionen:
- collect-payment-link

Geplante Korrektur: Aktiven Kontostatus und Fallmandant gegen verifizierten Nutzerscope prüfen, bevor Link oder Token erzeugt wird.

Mögliche Auswirkungen: - Zahlungslinks für fremde Mandanten
- Unberechtigte Fallkommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: erlaubte Finanzrolle mit fremdem caseId negativ; deaktiviertes Konto negativ; eigener Fall positiv.

Wiederherstellung: Linkanlage sperren; unberechtigt erzeugte Tokens widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_88ebf49df7bfdf53

**Any signed-in user can send reminders to any customer**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nicht-Cron-Aufrufer werden authentifiziert, benötigen im Normalpfad aber keine Rolle. Nur body.override löst eine Super-Admin-Prüfung aus. reminder_ids werden anschließend über privilegierte REST-Requests ohne Mandantenscope geladen und verarbeitet.

Nachweise:
- supabase/functions/rz-reminder-send/index.ts:174-201
- supabase/functions/rz-reminder-send/index.ts:203-230
- supabase/functions/rz-reminder-send/index.ts:273-322

Betroffene Funktionen:
- rz-reminder-send

Geplante Korrektur: Auch Normalversand an aktive Finanzrolle und Reminder-/Mandantenscope binden; Cronzugang strikt getrennt halten.

Mögliche Auswirkungen: - Unberechtigte Kundenmahnungen
- Mandantenübergreifender Versand

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: normaler Login ohne override negativ; fremde Reminder-ID negativ; berechtigter Versand und Cron positiv.

Wiederherstellung: Versand stoppen; Reminderzustände über Versandprotokoll abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_89e0261f504376eb

**Anyone can retrieve and alter another QR invoice**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Verifiziert derselbe Nicht-Preview-Pfad wie beim Referenzbefund: body.id lädt finance_qr_invoices privilegiert, erzeugt Payload und schreibt Referenz/Status. Offenlegung und Änderung sind Auswirkungen derselben Operation.

Nachweise:
- supabase/functions/finance-qr-generate/index.ts:62-98

Betroffene Funktionen:
- finance-qr-generate

Geplante Korrektur: Gemeinsam mit dem Referenzbefund beheben; aktive Finanzautorisierung und Rechnungsscope vor Read und Update.

Mögliche Auswirkungen: - Fremde QR-Zahlungsdaten
- Unberechtigte Referenz-/Statusänderung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Tests des Referenzbefunds einschließlich Datenrückgabe übernehmen.

Wiederherstellung: Wie Referenzbefund; persistierenden Pfad sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_676a76c192d1c5c0.

### lov_finding_8b7a66d6300430d8

**Any signed-in user can text another team's case details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Verifizierte Nutzerclaims genügen zum Service-Role-Read beliebiger as_cases_list_v-IDs. Keine aktive Fachrolle, Team- oder Mandantenzuordnung wird geprüft, bevor Falldaten in SMS und Reminder-/Timelineeinträge eingehen. Dies ist der objektbezogene Zugriffspfad, nicht lediglich freie Textwahl.

Nachweise:
- supabase/functions/as-send-sms-reminder/index.ts:63-85
- supabase/functions/as-send-sms-reminder/index.ts:98-126

Betroffene Funktionen:
- as-send-sms-reminder

Geplante Korrektur: Fallzugriff im Nutzerkontext prüfen; aktive Team-/Fachrollen und Mandantenscope vor Fallread und Versand verlangen.

Mögliche Auswirkungen: - Fremde Falldaten per SMS
- Unberechtigte Fallhistorie

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gültiger Login aus anderem Team/Mandanten negativ; eigener Fall mit erlaubter Rolle positiv.

Wiederherstellung: Fallbezogenen SMS-Versand sperren; unberechtigte Historieneinträge markieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_94ff829ba690f3f3

**Anyone can run bank reconciliation**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler beginnt ohne Aufruferprüfung mit privilegierten Bank- und Rechnungsreads. Er ersetzt Vorschläge, aktualisiert Matchscores und kann Zuweisungen sowie Rechnungs- und Banktransaktionsstände verändern. verify_jwt ist false.

Nachweise:
- supabase/functions/bank-auto-reconcile/index.ts:75-103
- supabase/functions/bank-auto-reconcile/index.ts:134-181
- supabase/config.toml:423-424

Betroffene Funktionen:
- bank-auto-reconcile

Geplante Korrektur: Maschinencredential oder aktive Bankabgleichrolle verlangen; Buchungskreis serverseitig begrenzen und automatische Buchungen gesondert freigeben.

Mögliche Auswirkungen: - Manipulierte Zahlungszuordnungen
- Veränderte Finanzsalden
- Mandantenübergreifender Abgleich

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremder Buchungskreis ohne Änderung; Vorschau ohne Writes; autorisierter Abgleich positiv.

Wiederherstellung: Abgleich sperren; Zuweisungen und Salden transaktionsbezogen aus Auditdaten rückführen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_98d1a9730f1bf438_c0935e03

**Anyone can trigger dunning runs across tenant invoices**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Mahnlauf prüft keine Identität. tenantId ist optionaler Requestfilter; ohne ihn werden fällige Dokumente mandantenübergreifend selektiert, Mahndokumente angelegt und gegebenenfalls Mails versendet.

Nachweise:
- supabase/functions/cmr-dunning-run/index.ts:34-67
- supabase/functions/cmr-dunning-run/index.ts:114-159
- supabase/functions/cmr-dunning-run/index.ts:164-197
- supabase/config.toml:420-421

Betroffene Funktionen:
- cmr-dunning-run

Geplante Korrektur: Globalen Job maschinell authentifizieren; interaktive Läufe nur für aktive Finanzrolle innerhalb erlaubter Mandanten.

Mögliche Auswirkungen: - Unberechtigte Mahndokumente
- Kundenmails
- Veränderte Mahnstände

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremde tenantId negativ; autorisierter Lauf und Replayfestigkeit positiv.

Wiederherstellung: Mahnlauf stoppen; Dokumente fachlich stornieren und Mahnstände abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9d9c7365b4cce7e8

**Anyone can receive results from the paid AI service**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Authentifizierung werden beliebige Kontakte samt Nachrichteninhalt und Anrufdaten privilegiert gelesen und an kostenpflichtige KI übermittelt. Ergebnisse werden als Vorhersage gespeichert; verify_jwt ist false.

Nachweise:
- supabase/functions/ac-revenue-intel-v2/index.ts:9-31
- supabase/functions/ac-revenue-intel-v2/index.ts:39-47
- supabase/config.toml:343-344

Betroffene Funktionen:
- ac-revenue-intel-v2

Geplante Korrektur: Aktive Vertriebs-/Analyseberechtigung und Kontaktmandant vor Reads, KI und Ergebniszugriff prüfen.

Mögliche Auswirkungen: - Fremde Kundenkommunikation in KI
- Unberechtigte Analyseergebnisse
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, fremder Kontakt und deaktiviertes Konto negativ; erlaubte Analyse positiv.

Wiederherstellung: KI-Endpunkt sperren; unberechtigt erzeugte Vorhersagen kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a33d1e6c8240851c

**Anyone can view company revenue forecasts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach OPTIONS folgt ohne Identitätsprüfung ein Service-Role-Read von Umsatzattributionen. Zeitraum und Modell werden aus dem Request übernommen; durchschnittliche Tagesumsätze und 30-/60-/90-Tage-Prognosen werden ohne Rollen- oder Mandantengrenze zurückgegeben.

Nachweise:
- supabase/functions/ac-revenue-forecast/index.ts:8-23
- supabase/functions/ac-revenue-forecast/index.ts:46-56

Betroffene Funktionen:
- ac-revenue-forecast

Geplante Korrektur: Aktive Umsatzanalyse-/Finanzrolle und Mandantenscope verlangen; Zeitraum begrenzen.

Mögliche Auswirkungen: - Offenlegung vertraulicher Unternehmensumsätze und Prognosen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, unberechtigte Rolle und fremder Mandant negativ; erlaubter Forecast positiv.

Wiederherstellung: Forecastendpoint sperren; keine Datenrückführung erforderlich.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a63e6a6f8b835b5d

**Anyone can trigger customer shipping notices**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Vom Request gelieferte Seriennummern werden ohne Aufruferprüfung privilegiert zu Lagergeräten, Aufträgen und Kunden aufgelöst. Der Endpoint ruft danach den Transaktionsmailversand mit Servercredential auf.

Nachweise:
- supabase/functions/lager-bestand-notify/index.ts:12-45
- supabase/functions/lager-bestand-notify/index.ts:45-56

Betroffene Funktionen:
- lager-bestand-notify

Geplante Korrektur: Aktive Lager-/Versandrolle oder vertrauenswürdiges Jobcredential prüfen; Seriennummern und Aufträge auf Mandanten- und Versandzustand begrenzen.

Mögliche Auswirkungen: - Unberechtigte Versandbenachrichtigungen
- Missbrauch interner Versandcredentials

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, fremde Seriennummer und nicht versandbereiter Auftrag negativ; legitimer Versand positiv.

Wiederherstellung: Benachrichtigungsendpoint sperren; versandte Mails nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a959243f59d4a590

**Anyone can send spoofed service email to chosen recipients**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Verifiziert dieselbe unautorisierte Requestverarbeitung und derselbe Resend-Aufruf wie beim Referenzbefund; frei gewählter Empfänger und Service-Mailinhalt beschreiben dieselbe Versandoperation.

Nachweise:
- supabase/functions/ticket-customer-notify/index.ts:31-62

Betroffene Funktionen:
- ticket-customer-notify

Geplante Korrektur: Mit Referenzbefund beheben; Authentifizierung, Ticketzugriff und serverseitige Empfängerbindung.

Mögliche Auswirkungen: - Service-Mailspoofing
- Spam

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Negativ- und Positivtests des Referenzbefunds übernehmen.

Wiederherstellung: Wie Referenzbefund: Versand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_452bd5908dcf2082.

### lov_finding_aab25c4aac0c36d0_c2bf6c3e

**Anyone can evaluate and access call transcripts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: call_id und scorecard_id werden ohne Aufruferprüfung privilegiert aufgelöst. Das Gesprächstranskript wird an KI gesendet; Bewertungen und gegebenenfalls Coaching-Sessions werden angelegt und Bewertungsdaten zurückgegeben.

Nachweise:
- supabase/functions/ac-qm-auto-score/index.ts:12-38
- supabase/functions/ac-qm-auto-score/index.ts:58-101

Betroffene Funktionen:
- ac-qm-auto-score

Geplante Korrektur: Aktive QM-Rolle und Zugriff auf Gespräch, Agent und Scorecard innerhalb des Mandanten vor KI-Verarbeitung prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung von Gesprächstranskripten
- Manipulierte Mitarbeiterbewertungen
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremdes Gespräch und falsche Rolle ohne KI oder Writes; erlaubte QM-Bewertung positiv.

Wiederherstellung: Scoring sperren; unberechtigte Bewertungen und Folgecoachings revisionssicher zurücknehmen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ae041d22cd49aa24

**Ordinary users can send survey invitations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verlangt eine Nutzeridentität beziehungsweise akzeptiert seinen Servicepfad, aber prüft anschließend keine aktive Umfrageverwaltungsrolle. survey_id lädt Umfrage und Empfänger mit Adminclient; Einladungen und Versandlogs werden erzeugt.

Nachweise:
- supabase/functions/survey-send-invites/index.ts:22-58
- supabase/functions/survey-send-invites/index.ts:71-119
- supabase/functions/survey-send-invites/index.ts:147-161

Betroffene Funktionen:
- survey-send-invites

Geplante Korrektur: Aktive Umfrageverwaltungsrolle und Umfrage-/Mandantenzugriff prüfen; Servicezugang exakt und getrennt validieren.

Mögliche Auswirkungen: - Unberechtigte Einladungen
- Versandkosten
- Manipulierte Umfragehistorie

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gewöhnlicher Login und fremde Umfrage negativ; berechtigter Versand sowie Wiederholung positiv.

Wiederherstellung: Einladungsversand sperren; unberechtigt erstellte Einladungstokens widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b25fdd69f8b74481

**Any signed-in user can approve another person’s invoice**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Client übernimmt den Nutzer-Authorization-Header; Service-Key allein belegt hier keinen RLS-Bypass. Die gelesene approvals-Policy verlangt Finanz-/Geschäftsführungsrechte, Mandantenzugriff und verhindert bestimmte Selbstfreigaben. Der Handler ignoriert jedoch Updatefehler und kann danach die Zielrechnung ändern; effektive Zieltabellen-RLS und alle späteren Policytransformationen sind nicht abschließend aufgelöst.

Nachweise:
- supabase/functions/finance-approval-action/index.ts:13-20
- supabase/functions/finance-approval-action/index.ts:35-91
- supabase/migrations/20260719143705_2820fec9-d902-4cd1-b273-ea0db8112696.sql:26-40
- src/pages/Finance/Freigaben.tsx:47

Betroffene Funktionen:
- finance-approval-action
- public.finance_approvals
- public.finance_incoming_invoices

Geplante Korrektur: Gesamte Freigabe atomar mit expliziter aktiver Genehmiger-, Mandanten- und Vieraugenprüfung durchführen; jeden Datenbankfehler verbindlich behandeln.

Mögliche Auswirkungen: - Mögliche inkonsistente Freigabe-/Rechnungszustände
- Mögliche Umgehung der Genehmigungskette

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gewöhnlicher Nutzer, Antragsteller, falscher Mandant und fehlgeschlagenes Approvalupdate; keine nachgelagerte Rechnungsänderung.

Wiederherstellung: Freigabeaktion sperren; inkonsistente Rechnungs- und Approvalstände abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b59f50206d13ea0b

**Service users can text any phone number**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Claims und erlaubte Rollen werden geprüft. Danach stammen customer_id, document_id, phone und message_text aus dem Request. Eine Bindung von Telefonnummer und Dokument an einen berechtigten Kunden fehlt vor Token-/Linkerzeugung und SMS-Versand; aktiver Kontostatus wird ebenfalls nicht geprüft.

Nachweise:
- supabase/functions/send-customer-sms/index.ts:77-130
- supabase/functions/send-customer-sms/index.ts:136-167
- src/components/CustomerSmsTab.tsx:162

Betroffene Funktionen:
- send-customer-sms

Geplante Korrektur: Aktives Versandkonto sowie Kunden-, Dokument- und Mandantenzugriff prüfen; Telefonnummer aus autorisiertem Kunden ableiten, Override gesondert berechtigen.

Mögliche Auswirkungen: - SMS an beliebige Telefonnummern
- Abfluss von Dokumentlinks
- Providerkosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: erlaubte Rolle mit fremdem Dokument oder abweichender Telefonnummer negativ; legitimer Versand positiv.

Wiederherstellung: SMS sperren und unberechtigt erzeugte Dokumenttokens widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b86c0cca0683482a

**Anyone can create ticket appointments**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: callerAuth wird gelesen, aber vor privilegiertem Ticketread und Eventanlage nicht authentifiziert oder autorisiert. Requestwerte können Abteilung, Bearbeiter, Ressource und Kundenangaben übersteuern; UUID-Validierung prüft keine Zugriffsrechte.

Nachweise:
- supabase/functions/ticket-create-appointment/index.ts:33-66
- supabase/functions/ticket-create-appointment/index.ts:68-94
- supabase/functions/ticket-create-appointment/index.ts:100-125

Betroffene Funktionen:
- ticket-create-appointment

Geplante Korrektur: Aktive Termin-/Ticketrolle und Ticketzugriff verlangen; sämtliche Ressourcen- und Abteilungsüberschreibungen auf erlaubten Scope prüfen.

Mögliche Auswirkungen: - Unberechtigte Termine
- Manipulierte Ressourcenbelegung
- Falsche Kundendaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, fremdes Ticket und fremde Ressource negativ; erlaubte Terminanlage positiv.

Wiederherstellung: Terminendpoint sperren; unberechtigte Termine stornieren und Bestätigungstokens widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ba7c311bb074fdc2_bd0ae6c3

**Anyone can retrieve predictions for any contact**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler akzeptiert contact_id ohne Identitätsprüfung und liest Kontakt und Kommunikationshistorie privilegiert für die Vorhersage. Weder aktiver Nutzer noch Kontakt-/Mandantenscope sind vorgeschaltet; verify_jwt ist false.

Nachweise:
- supabase/functions/ac-predictive-engagement/index.ts:9-18
- supabase/config.toml:346-347

Betroffene Funktionen:
- ac-predictive-engagement

Geplante Korrektur: Aktive Kontaktanalyseberechtigung und Kontaktmandant vor Datenzugriff und Vorhersage erzwingen.

Mögliche Auswirkungen: - Unberechtigte Kontaktanalysen
- Verarbeitung fremder Kommunikationshistorie

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremde Kontakt-ID ohne Analyse; berechtigter Kontakt positiv.

Wiederherstellung: Vorhersageendpoint sperren; unberechtigte Ergebnisse kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_be09aadb01290773

**Any signed-in user can export direct-debit details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser validiert den Login. Der nachfolgende separate Adminclient lädt jedoch beliebige finance_sepa_runs und Laufpositionen nach runId ohne aktive Finanzrolle oder Mandantenzuordnung und setzt anschließend Exportstatus.

Nachweise:
- supabase/functions/finance-sepa-export/index.ts:8-28
- supabase/functions/finance-sepa-export/index.ts:95-101

Betroffene Funktionen:
- finance-sepa-export

Geplante Korrektur: Aktive Lastschriftexportrolle und Zugriff auf Laufmandant vor Mandatsread und Export erzwingen.

Mögliche Auswirkungen: - Offenlegung fremder Lastschriftdaten
- Unberechtigte Exportstatusänderung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gewöhnlicher Login, deaktivierte Finanzrolle und fremder Lauf negativ; erlaubter Export positiv.

Wiederherstellung: Export sperren; Status anhand Exporthistorie korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c1f51fb90f414c65

**Signed-in users can place calls to arbitrary destinations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach erfolgreichem Login fehlt eine aktive Telefonierrolle. Der Adminclient fällt von Nutzereinstellungen auf globale PBX-Einstellungen zurück und sendet Requestfeld to als destination an makecall. Kontakt-/Gesprächsberechtigung und Zielrufnummernregeln fehlen.

Nachweise:
- supabase/functions/ac-3cx-call/index.ts:12-25
- supabase/functions/ac-3cx-call/index.ts:27-44
- supabase/functions/ac-3cx-call/index.ts:53-59

Betroffene Funktionen:
- ac-3cx-call

Geplante Korrektur: Aktive Telefonierberechtigung, erlaubte Nebenstelle und Kontakt-/Mandantenscope prüfen; Rufnummernklassen, Kosten- und Ratenlimits erzwingen.

Mögliche Auswirkungen: - Unberechtigte Anrufe
- Telefoniekosten
- Missbrauch globaler PBX-Zugänge

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: normaler Login, gesperrtes Ziel und unberechtigter globaler Fallback negativ; erlaubter Anruf positiv.

Wiederherstellung: makecall-Pfad sperren; laufende Anrufe gegebenenfalls administrativ beenden.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c45c9cbb478d7312

**Anyone can trigger status notification emails to customers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Action notify_customer_status besitzt anders als benachbarte interne Actions keinen eigenen Authblock. Frei gelieferte mp_id und new_status lösen privilegierten Kundenread, signierten Portallink, Mailversand und Historieneintrag aus; verify_jwt ist false.

Nachweise:
- supabase/functions/mediapaket-portal/index.ts:159-185
- supabase/functions/mediapaket-portal/index.ts:421-451
- supabase/config.toml:41-42

Betroffene Funktionen:
- mediapaket-portal:notify_customer_status

Geplante Korrektur: Aktives Paketverwaltungsrecht und Paketzugriff vor dieser Action prüfen; Status aus bestätigtem Datenbankzustand ableiten.

Mögliche Auswirkungen: - Gefälschte Statusmails
- Unberechtigtes Erzeugen von Portallinks
- Manipulierte Historie

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym, fremdes Paket und erfundener Status negativ; legitimer Statuswechsel positiv.

Wiederherstellung: Nur betroffene Action sperren; kompromittierte Portallinks widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c79ad01cbeb6bd2e

**Anyone can run document hash maintenance**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Rollenprüfung läuft nur bei jwt && jwt !== serviceKey. Ein fehlender Authorization-Header überspringt sie vollständig. Danach werden Dokumentversionen privilegiert heruntergeladen und content_hash-Werte geschrieben.

Nachweise:
- supabase/functions/alixdocs-hash-backfill/index.ts:21-40
- supabase/functions/alixdocs-hash-backfill/index.ts:46-75

Betroffene Funktionen:
- alixdocs-hash-backfill

Geplante Korrektur: Fehlendes Credential vor jedem Zugriff abweisen; Servicecredential exakt prüfen, sonst aktive Adminrolle verbindlich validieren.

Mögliche Auswirkungen: - Unberechtigte Dokumentwartung
- Speicher-/Rechenlast
- Globale Hashänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: leerer Header, ungültiger Token und gewöhnlicher Login negativ; aktiver Admin und Jobcredential positiv.

Wiederherstellung: Backfill sperren; Hashes nur aus verifizierten Originaldateien neu berechnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_cd621b68583af549

**Anyone can sync product content externally**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Vor Requestverarbeitung und Versand prüft der Handler ph2_activation: bei Lesefehler oder controlled_modes === true wird abgebrochen. Die Migration initialisiert kontrollierte Modi. Dauerhafte Aufrufer-, Aktivitäts- und Rollenautorisierung fehlt weiterhin; bei fehlender oder aufgehobener Modussperre wäre der alte Versandpfad zugänglich. Aktuelle externe Ausführung wird nicht behauptet.

Nachweise:
- supabase/functions/ph-com-lang-push/index.ts:134-152
- supabase/functions/ph-com-lang-push/index.ts:51-72
- supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:4

Betroffene Funktionen:
- ph-com-lang-push
- pushOne

Geplante Korrektur: controlled_modes-Sperre beibehalten; zusätzlich dauerhafte aktive Product-Hub-Publikationsrolle oder enges Maschinencredential und Freigabeprüfung einbauen.

Mögliche Auswirkungen: - Latenter unberechtigter externer Produktcontent-Push
- Freigaberisiko bei Moduswechsel

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: controlled_modes true ohne externe Calls; fehlende Konfiguration fail-closed; deaktivierte Sperre darf Auth nicht umgehen.

Wiederherstellung: controlled_modes und Notstopp aktiviert halten; Legacyversand nicht freischalten.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d516be27dfccb6c8

**Anyone can reassign another customer's ticket**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Aufruferprüfung wird ticket_id mit Service-Role geladen. Routing kann Ticketabteilung ergänzen, Bearbeiter bestimmen und tickets sowie ticket_history verändern. Ticket-, Mandanten- oder aktive Rollenautorisierung fehlt.

Nachweise:
- supabase/functions/ticket-router/index.ts:18-36
- supabase/functions/ticket-router/index.ts:48-55
- supabase/functions/ticket-router/index.ts:110-115

Betroffene Funktionen:
- ticket-router

Geplante Korrektur: Vertrauenswürdigen Routingjob oder aktive Ticketverwaltungsrolle mit Ticketzugriff verlangen; Zielbearbeiter und Abteilung im gleichen Scope prüfen.

Mögliche Auswirkungen: - Unberechtigte Ticketzuweisung
- Verfälschte Tickethistorie

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremdes Ticket negativ; berechtigter Routinglauf positiv.

Wiederherstellung: Routingendpoint sperren; Zuordnungen anhand Historie zurücksetzen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d599eb858f23ab35_e1c9b149

**Any signed-in user can export another company's payment details**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Verifiziert derselbe runId-basierte Adminread und SEPA-Export wie beim Referenzbefund. Die andere Mandantenbeschreibung benennt keinen separaten Operationspfad.

Nachweise:
- supabase/functions/finance-sepa-export/index.ts:12-28
- supabase/functions/finance-sepa-export/index.ts:95-101

Betroffene Funktionen:
- finance-sepa-export

Geplante Korrektur: Mit Referenzbefund beheben; aktive Exportrolle und Laufmandant prüfen.

Mögliche Auswirkungen: - Fremde Lastschriftdaten
- Exportstatusänderung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: mandantenübergreifenden Negativtest des Referenzbefunds übernehmen.

Wiederherstellung: Wie Referenzbefund: Export sperren und Status abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_be09aadb01290773.

### lov_finding_d86e3d3e3deb87d6

**Anyone can message any email or phone number**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Im Handler fehlt eine eigene Aufruferprüfung vollständig. recipient, subject und body werden unmittelbar für E-Mail, SMS oder WhatsApp genutzt. verify_jwt = true ist nur ein Gateway-Tokencheck und ersetzt keine aktive Mitarbeiter-, Rollen-, Event- oder Mandantenberechtigung.

Nachweise:
- supabase/functions/esc-send-message/index.ts:46-71
- supabase/config.toml:245-246

Betroffene Funktionen:
- esc-send-message
- sendEmail
- sendTwilio

Geplante Korrektur: Verifizierte aktive Mitarbeiteridentität, kanalspezifisches Versandrecht und Event-/Empfängerscope serverseitig erzwingen.

Mögliche Auswirkungen: - Beliebige Markenkommunikation
- Spam/Phishing
- Providerkosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gültiger Token ohne Versandrolle negativ; fremdes Event und beliebiger Empfänger negativ; erlaubter Versand positiv.

Wiederherstellung: Nachrichtenendpoint sperren; Providerlimits und Missbrauchsmonitoring aktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_dae991b95413b3dd

**Anyone can merge and delete customer records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Identitäts- oder Rollenprüfung liest der Handler Kontakte privilegiert, verschiebt Nachrichten und Anrufe auf einen Master und löscht Duplikatkontakte. Es gibt vor dieser destruktiven Operation keine verifizierte Mandantengrenze.

Nachweise:
- supabase/functions/ac-omnichannel-merge/index.ts:21-30
- supabase/functions/ac-omnichannel-merge/index.ts:72-77

Betroffene Funktionen:
- ac-omnichannel-merge

Geplante Korrektur: Aktive Datenadministrationsrolle oder enges Jobcredential verlangen; Kandidaten strikt mandantenbezogen bilden und Merge atomar freigeben.

Mögliche Auswirkungen: - Destruktive Kontaktzusammenführung
- Falsche Kommunikationszuordnung
- Mandantenvermischung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und mandantenübergreifendes Kandidatenpaar negativ; atomarer erlaubter Merge; Fehlerrollbacks.

Wiederherstellung: Merge sofort sperren; Wiederherstellung benötigt gesicherte Kontakt- und Fremdschlüsselvorwerte.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_dee2f25deaa8bfd7

**Anyone can call arbitrary COM API paths with the server key**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler bricht bei controlled_modes === true oder Konfigurationslesefehler vor Bodyverarbeitung und externen Registryoperationen ab. Eine dauerhafte Aufruferautorisierung fehlt. Nach Aufhebung der Sperre steuern endpoint/method den Discoverypfad bis zu Dryrun und Registrierung. Die aktuelle Sperre ist kein dauerhafter Authfix.

Nachweise:
- supabase/functions/ph-com-registry-push/index.ts:49-57
- supabase/functions/ph-com-registry-push/index.ts:146-174
- supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:4

Betroffene Funktionen:
- ph-com-registry-push
- discover
- call

Geplante Korrektur: Legacy-Modussperre erhalten; aktive Publikationsrolle oder dediziertes Maschinencredential erzwingen und API-Pfade/-Methoden strikt erlaubnislistenbasiert beschränken.

Mögliche Auswirkungen: - Latenter Missbrauch des serverseitigen COM-Credentials
- Unberechtigte externe Registryoperationen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: kontrollierter Modus ohne externe Calls; fehlende Settings fail-closed; unberechtigter Request auch bei freigegebenem Modus negativ.

Wiederherstellung: controlled_modes und Notstopp beibehalten; Legacyregistry nicht freigeben.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e2c148fb68294c0b_ef5f34ce

**Any signed-in user can overwrite another user's document**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach getUser lädt ein separater Adminclient existing_document_id ohne Dokumentberechtigung und berechnet die nächste Version. upload verwendet zwar upsert:false und überschreibt damit nicht dieselben Speicherbytes; fremde Dokumente können dennoch durch neue Version und Aktualisierung ihres aktuellen Stands verändert werden.

Nachweise:
- supabase/functions/alixdocs-upload/index.ts:46-58
- supabase/functions/alixdocs-upload/index.ts:94-98
- supabase/functions/alixdocs-upload/index.ts:114-139

Betroffene Funktionen:
- alixdocs-upload

Geplante Korrektur: Aktives Dokumentbearbeitungsrecht sowie Dokument-, Kunden-/Auftrags- und Mandantenscope vor privilegiertem Read und Upload prüfen; Versionierung atomar machen.

Mögliche Auswirkungen: - Manipulation fremder Dokumentversionen
- Verlust der Dokumentintegrität

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: fremdes Dokument und deaktivierter Nutzer negativ; erlaubte neue Version; parallele Versionierung und Fehlerbereinigung.

Wiederherstellung: Versionierungsupload sperren; current_version auf verifizierte Vorversion setzen und Fremdversion quarantänisieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e9436bf2ec03c48f_2176d0bb

**Anyone can update repair quote status and history**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: quote_id führt ohne eigene Aufruferprüfung zu Service-Role-Reads, Versand und Status-/Historienupdates. Der gültige approval_token wird sogar als Link zurückgegeben. verify_jwt = true begrenzt den Gatewayzugang, prüft aber weder aktive Servicerolle noch Reparatur-/Mandantenzugriff.

Nachweise:
- supabase/functions/send-repair-quote/index.ts:11-24
- supabase/functions/send-repair-quote/index.ts:46-72
- supabase/config.toml:203-204

Betroffene Funktionen:
- send-repair-quote

Geplante Korrektur: Aktive berechtigte Servicerolle und Zugriff auf Angebot/Reparatur prüfen; Versandstatus nur nach bestätigtem Erfolg setzen und Approvalcredentials nicht unnötig zurückgeben.

Mögliche Auswirkungen: - Unberechtigter Angebotsversand
- Manipulierte Angebotsstände
- Abfluss von Freigabelinks

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: gültiger fremder Login und fremdes Angebot negativ; Providerfehler ohne Status Versendet; legitimer Versand positiv.

Wiederherstellung: Versand sperren; kompromittierte Freigabetokens rotieren und Status fachlich abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_eb3640852bce3732

**Anyone can trigger payment reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler liest Request und Mahnkonfiguration ohne Aufruferprüfung. Bei aktivierten Stufen und auto_enabled ungleich false verarbeitet er offene Anzahlungen privilegiert. dry_run sowie Konfigurationsschalter sind Betriebssteuerung, keine Authentifizierung; verify_jwt ist false.

Nachweise:
- supabase/functions/anzahlung-mahn-engine/index.ts:48-70
- supabase/functions/anzahlung-mahn-engine/index.ts:75-85
- supabase/config.toml:489-490

Betroffene Funktionen:
- anzahlung-mahn-engine

Geplante Korrektur: Maschinenauthentifizierung oder aktive Finanzrolle mit Mandantenscope vor Konfigurations- und Finanzdatenzugriff verlangen.

Mögliche Auswirkungen: - Unberechtigte Anzahlungsmahnläufe
- Kundenkommunikationsmissbrauch

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonym und fremder Mandant negativ; deaktivierte Automatik bleibt wirkungslos; autorisierter Lauf positiv.

Wiederherstellung: Automatik und Endpoint sperren; Kommunikations- und Mahnstände abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ef8daa497c253e85

**Any signed-in user can copy another user's mail attachment**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Verifiziert dieselbe mail_attachment_id-basierte Service-Role-Kopie wie beim Referenzbefund, einschließlich Download, Upload und Anlage eines dem Aufrufer zugeschriebenen Dokuments.

Nachweise:
- supabase/functions/alixdocs-mail-import/index.ts:23-41
- supabase/functions/alixdocs-mail-import/index.ts:53-89

Betroffene Funktionen:
- alixdocs-mail-import

Geplante Korrektur: Mit Referenzbefund beheben; Quellmail- und Zielobjektberechtigung verbindlich prüfen.

Mögliche Auswirkungen: - Kopieren fremder Anhänge
- Unberechtigte Dokumentanlage

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: Mailkonto-/Mandanten-Negativtests des Referenzbefunds übernehmen.

Wiederherstellung: Wie Referenzbefund: Import sperren und unberechtigte Kopien kontrolliert entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_773ec74739954988.

### lov_finding_f257ec154dcb5f8f

**Anyone can retrieve imported Zoho invoice details**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Code enthält entgegen der pauschalen Befundbeschreibung einen Authentifizierungszweig mit getUser und Admin-/Super-Admin-Prüfung. Dessen vollständige Verzweigung und möglicher Maschinen-/Leercredentialpfad wurden nicht abschließend gelesen; deshalb weder globale Anonymität noch ausreichende dauerhafte Autorisierung bestätigt. Payload erlaubt zudem Quellen- und Empfängerüberschreibungen.

Nachweise:
- supabase/functions/zoho-invoices-auto-import/index.ts:10-25
- supabase/functions/zoho-invoices-auto-import/index.ts:229-256
- supabase/functions/zoho-invoices-auto-import/index.ts:409-444

Betroffene Funktionen:
- zoho-invoices-auto-import

Geplante Korrektur: Authzweig vollständig auf exakte Maschinencredentials, fail-closed Verhalten, aktive Adminrolle und Quellmandanten prüfen; Empfängerüberschreibung separat autorisieren.

Mögliche Auswirkungen: - Mögliche Offenlegung importierter Rechnungsdetails
- Mögliche mandantenübergreifende Imports und Berichtsmails

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: leerer/ungültiger Header, öffentliche Projektcredentials, gewöhnlicher Nutzer, deaktivierter Admin, fremde Quelle und Empfängeroverride.

Wiederherstellung: Autoimport und Berichtsmails bis zur Klärung sperren; Importzustände anhand Laufhistorie sichern.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_fddb348892872591

**Anyone can run bank-return reminders**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Verifiziert derselbe unautorisierte Rücklastschrift-Mahnlauf wie beim Referenzbefund. body.force aktiviert denselben cfg.enabled-Schalter vor derselben globalen Fallselektion; kein separater Operationspfad.

Nachweise:
- supabase/functions/bank-return-dunning-escalate/index.ts:46-80
- supabase/config.toml:426-427

Betroffene Funktionen:
- bank-return-dunning-escalate

Geplante Korrektur: Mit Referenzbefund beheben; Jobcredential und separat berechtigtes force erzwingen.

Mögliche Auswirkungen: - Erzwungene Mahnungen
- Umgehung der Deaktivierung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant: anonymer force-Request und deaktivierte Konfiguration wie beim Referenzbefund prüfen.

Wiederherstellung: Wie Referenzbefund: Endpoint und Scheduler sperren, Mahnstände abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_29b6057cf3486198.

### lov_finding_01689a0ccfff4e89

**Signed-in users can read arbitrary reminder records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Benutzerpfad prüft lediglich die Anmeldung. Die Rollenprüfung betrifft nur override, nicht das normale Laden frei gewählter reminder_ids mit Service Role. Vorschau und Versand bleiben ohne Ressourcenberechtigung erreichbar.

Nachweise:
- supabase/functions/rz-reminder-send/index.ts:181-187
- supabase/functions/rz-reminder-send/index.ts:212-228
- supabase/functions/rz-reminder-send/index.ts:332
- src/pages/Finance/WiederkehrendeZahlerErinnerungen.tsx:144

Betroffene Funktionen:
- rz-reminder-send

Geplante Korrektur: Aktives Finanzkonto und Berechtigung für jede Erinnerung vor Service-Role-Abfragen prüfen; Maschinenpfad separat absichern.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Erinnerungsdaten
- Unberechtigter Versand und Statusänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Erinnerungs-ID und inaktives Konto müssen vor Datenabfrage und Versand abgewiesen werden; berechtigte Vorschau positiv prüfen.

Wiederherstellung: Bei Fehlern Versand sperren; Autorisierungsprüfung nicht entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_02f750951452daf6

**Anyone can trigger processing of private journey runs**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach OPTIONS erfolgt ohne Handler-Authentifizierung die Service-Role-Abfrage fälliger Journey-Läufe samt Kontakten. Statusänderungen und Kommunikationsschritte sind erreichbar; die Antwort gibt vor allem Zähler zurück, nicht sämtliche gelesenen Kontaktdaten.

Nachweise:
- supabase/functions/ac-journey-tick/index.ts:44-72
- supabase/functions/ac-journey-tick/index.ts:78-107

Betroffene Funktionen:
- ac-journey-tick

Geplante Korrektur: Vor allen Datenoperationen ausschließlich verifizierte Job-Zugangsdaten zulassen.

Mögliche Auswirkungen: - Unberechtigtes Auslösen von Kundenkommunikation
- Veränderung von Journey-Zuständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fehlende, öffentliche und gefälschte Job-Zugangsdaten ohne Datenzugriff ablehnen; gültigen Job isoliert mit Versand-Mocks prüfen.

Wiederherstellung: Scheduler pausieren und Endpunkt gesperrt lassen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_09ffea0c64262705

**Anyone can create the Sobitsch account and commission records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Kontoanlage sowie Profil- und Provisionsänderungen aus. Die explizite Gateway-Einstellung ist verify_jwt=false. Fest vorgegebene Zieldaten sind keine Autorisierung.

Nachweise:
- supabase/functions/tmp-create-sobitsch/index.ts:8-19
- supabase/functions/tmp-create-sobitsch/index.ts:42-74

Betroffene Funktionen:
- tmp-create-sobitsch

Geplante Korrektur: Temporären Produktionsendpunkt entfernen beziehungsweise vollständig sperren; erforderliche Migration ausschließlich kontrolliert administrativ ausführen.

Mögliche Auswirkungen: - Unberechtigte Kontoanlage
- Manipulation von Provisionszuordnungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Deployment ohne erreichbaren temporären Endpunkt prüfen; bestehende Provisionszuordnungen schreibgeschützt auf Wiederholungseffekte untersuchen.

Wiederherstellung: Endpunkt nicht reaktivieren; fachliche Datenkorrektur separat freigeben.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_10fba61adf821212

**Anyone can replace your product translations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler startet Übersetzungs- und Requalifizierungsläufe ohne Aufruferberechtigung. overwrite beeinflusst bestehende Übersetzungen; Service-Role-Upserts sind erreichbar. ai_draft verhindert die unberechtigte Änderung gespeicherter Inhalte nicht. Keine controlled_modes-Voroperationssperre vorhanden.

Nachweise:
- supabase/functions/ph-en-batch/index.ts:130-148
- supabase/functions/ph-en-batch/index.ts:178-182
- supabase/functions/ph-en-batch/index.ts:195-216

Betroffene Funktionen:
- ph-en-batch
- runBatch
- requalify

Geplante Korrektur: Aktive Product-Hub-Bearbeitungsberechtigung beziehungsweise verifizierten Batch-Aufrufer vor Datenzugriff verlangen; Überschreiben separat berechtigen.

Mögliche Auswirkungen: - Manipulation von Produktübersetzungen und Qualitätsständen
- Unberechtigte KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte Batch-, overwrite-, Requalifizierungs- und Hintergrundaufrufe ohne Upsert und KI-Aufruf ablehnen.

Wiederherstellung: Batchfunktion sperren; Übersetzungen nur aus geprüfter Historie wiederherstellen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_13d6e91ec712f40a_604475b4

**Anyone can view customer scores and routing details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser wird aufgerufen, sein Ergebnis aber nicht als Zugriffssperre verwendet. Kundenbewertungen und Routingdaten werden privilegiert gelesen; save kann Simulationen speichern.

Nachweise:
- supabase/functions/ac-router-simulate/index.ts:24-43
- supabase/functions/ac-router-simulate/index.ts:91-103
- src/pages/AlixConnect/RoutingSimulator.tsx:70

Betroffene Funktionen:
- ac-router-simulate

Geplante Korrektur: Fehlende Identität abweisen und aktive Routing-Berechtigung samt Mandantenbindung vor allen Service-Role-Abfragen prüfen.

Mögliche Auswirkungen: - Offenlegung von Kundenscores und Routinglogik
- Unberechtigte Simulationseinträge

Vorgesehene Regressionstests (nicht durchgeführt):
- Leere Identität, fremden Kunden und fremden Mandanten ablehnen; save darf keine Nebenwirkung erzeugen.

Wiederherstellung: Simulator serverseitig deaktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_183ae0ad4cf721dc

**Task IDs bypass compliance-task access policies**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Verifizierte Claims belegen nur die Identität. taskId führt anschließend zu Service-Role-Lesezugriffen auf Aufgabe, Projekt und Schritte ohne Aufgaben- oder Projektberechtigung; die Inhalte gelangen in die KI-Verarbeitung.

Nachweise:
- supabase/functions/compliance-ai-assist/index.ts:40-46
- supabase/functions/compliance-ai-assist/index.ts:61-68
- supabase/functions/compliance-ai-assist/index.ts:90-109
- src/components/compliance/AiAssistField.tsx:37

Betroffene Funktionen:
- compliance-ai-assist

Geplante Korrektur: Aufgabe und Projekt im berechtigten Benutzerkontext laden; aktive Projektberechtigung vor KI-Übermittlung prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung vertraulicher Compliance-Inhalte
- Mögliche Offenlegung über KI-Antworten

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde taskId und inaktives Konto vor KI-Aufruf ablehnen; erlaubte Aufgabe positiv prüfen.

Wiederherstellung: Aufgabenbasierte KI-Anreicherung sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1b423c4366778754_78e6bd31

**Any signed-in user can see other sites' live visitor locations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die SECURITY-DEFINER-Funktion filtert nur nach frei gewählter Website-ID und Zeit. EXECUTE für authenticated enthält keine Website- oder Mandantenberechtigung. Ausgegeben werden Länderaggregate, keine präzisen Einzelstandorte.

Nachweise:
- supabase/migrations/20260720212030_9bf55c82-51cf-4ae2-b9f5-c0c3c167c120.sql:165-179

Betroffene Funktionen:
- public.ac_web_live_map(uuid)

Geplante Korrektur: Aktive Website-Leseberechtigung innerhalb der SQL-Funktion erzwingen oder mit geeigneten RLS-Regeln SECURITY INVOKER verwenden.

Mögliche Auswirkungen: - Mandantenübergreifende Offenlegung von Live-Besucheraggregaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Direkten RPC-Aufruf für fremde Website, inaktiven Benutzer und berechtigten Benutzer isoliert prüfen.

Wiederherstellung: EXECUTE für Benutzer bis zur korrigierten Funktion entziehen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1deb9bcf8e2fe9db

**Anyone can change any support ticket**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: callerAuth wird übernommen und später weitergereicht, aber nicht vor dem privilegierten Laden des gewählten Tickets geprüft. Ereignisanlage, Ticketänderungen und Historieneinträge erfolgen vorher ohne Ressourcenberechtigung.

Nachweise:
- supabase/functions/ticket-create-appointment/index.ts:33-63
- supabase/functions/ticket-create-appointment/index.ts:103-146
- supabase/functions/ticket-create-appointment/index.ts:195
- src/components/tickets/CreateAppointmentFromTicket.tsx:65

Betroffene Funktionen:
- ticket-create-appointment

Geplante Korrektur: Aktive Ticket- und Terminberechtigung vor Ticketabfrage und Ereignisanlage erzwingen.

Mögliche Auswirkungen: - Unberechtigte Termin- und Ticketänderungen
- Mögliche Kundenbenachrichtigungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremdes Ticket muss ohne Ereignis-, Historien- oder Mail-Nebenwirkung abgewiesen werden.

Wiederherstellung: Terminerstellung über diesen Handler sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_217a6dfc717596f3_bfdcff55

**Anyone can analyze private customer calls**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler lädt frei gewählte Anruftranskripte ohne Benutzerprüfung, verarbeitet sie und speichert beziehungsweise liefert Insights. verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/ac-conv-intel-analyze/index.ts:11-23
- supabase/functions/ac-conv-intel-analyze/index.ts:59-62
- src/pages/AlixConnect/ConversationalIntelligence.tsx:38

Betroffene Funktionen:
- ac-conv-intel-analyze

Geplante Korrektur: Aktive Gesprächsanalyse-Berechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff prüfen.

Mögliche Auswirkungen: - Offenlegung und externe Verarbeitung privater Gesprächsinhalte
- Unberechtigte Insight-Erstellung

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme, fremde und inaktive Aufrufer vor Transkript- und KI-Zugriff abweisen.

Wiederherstellung: Analyseendpunkt sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_232765c9fa069fde

**Any signed-in user can email another team's case details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Benutzerpfad validiert Claims, prüft aber weder aktive Fallberechtigung noch Mandantenzugehörigkeit. Der gewählte Fall wird mit Service Role gelesen und dessen Inhalt versendet.

Nachweise:
- supabase/functions/as-send-email-reminder/index.ts:33-54
- supabase/functions/as-send-email-reminder/index.ts:56-75
- src/pages/AfterSales/CaseDetail.tsx:281

Betroffene Funktionen:
- as-send-email-reminder

Geplante Korrektur: Aktive Fall- und Versandberechtigung vor Fallabfrage erzwingen; Service-Role-Zugang exakt statt per Teilstring vergleichen.

Mögliche Auswirkungen: - Unberechtigter Versand fremder Falldaten
- Manipulation von Fallhistorien

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Fall und inaktives Konto ohne Versand oder Protokollmutation ablehnen.

Wiederherstellung: Erinnerungsversand serverseitig sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_27ef54fe18b6bfc6

**Anyone can inspect document matching feedback preview**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Authentifizierungsverzweigung lautet if (jwt && jwt !== serviceKey). Bei leerem JWT wird sie vollständig übersprungen; privilegierte Feedback-Abfragen und dryRun-Vorschauen bleiben im Handler erreichbar. Die vorhandenen Rollenprüfungen schließen diesen Leerpfad nicht.

Nachweise:
- supabase/functions/alixdocs-learn-rules/index.ts:49-68
- supabase/functions/alixdocs-learn-rules/index.ts:78-90
- supabase/functions/alixdocs-learn-rules/index.ts:176-179

Betroffene Funktionen:
- alixdocs-learn-rules

Geplante Korrektur: Leere Zugangsdaten ausdrücklich ablehnen; nur exakten nichtleeren Service-Schlüssel oder aktiven berechtigten Administrator zulassen.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Matching-Feedback
- Unberechtigte Regeländerungen außerhalb dryRun

Vorgesehene Regressionstests (nicht durchgeführt):
- Fehlenden und leeren Authorization-Header sowie öffentliche Schlüssel vor sämtlichen Abfragen ablehnen.

Wiederherstellung: Regellernjob pausieren und Handler sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_291229c8706e74d8

**Anyone can change an event using a fake WhatsApp reply**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der WhatsApp-Handler prüft vor Protokollierung und Statusänderung keine Provider-Signatur. Vom Aufrufer gelieferte Absender- und Antwortwerte steuern die Teilnehmerzuordnung und Ereignisänderung.

Nachweise:
- supabase/functions/esc-whatsapp-inbound/index.ts:20-29
- supabase/functions/esc-whatsapp-inbound/index.ts:40-51

Betroffene Funktionen:
- esc-whatsapp-inbound

Geplante Korrektur: Provider-Signatur vor jeder Datenoperation verifizieren und Antwort an den erwarteten Teilnehmer und Vorgang binden.

Mögliche Auswirkungen: - Gefälschte Terminbestätigungen oder Ablehnungen
- Verfälschung von Kommunikationsprotokollen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fehlende, falsche und für andere URL gültige Signaturen ohne Mutation ablehnen; gültige Provider-Fixtures prüfen.

Wiederherstellung: Webhook-Eingang sperren und Antworten vorübergehend manuell bearbeiten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_2c6eeae643a145a5

**Any signed-in user can release another contract's invoices**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Anmeldung wird validiert, anschließend bestimmt profile_id jedoch ohne Vertrags- oder Finanzberechtigung den privilegierten Zugriff auf zurückgehaltene Rechnungen und deren Freigabeversand.

Nachweise:
- supabase/functions/pruefung-release/index.ts:31-37
- supabase/functions/pruefung-release/index.ts:51-67
- supabase/functions/pruefung-release/index.ts:108-122
- src/pages/Finance/RatenPruefung.tsx:88

Betroffene Funktionen:
- pruefung-release

Geplante Korrektur: Aktive Freigabeberechtigung für Vertrag und Rechnungen vor dem Laden und Versenden prüfen.

Mögliche Auswirkungen: - Unberechtigte Rechnungsfreigabe
- Offenlegung von Vertrags- und Rechnungsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte Vertrags-ID und inaktives Finanzkonto ohne Versand oder Statusänderung ablehnen.

Wiederherstellung: Freigabeendpunkt sperren; bereits ausgelöste Freigaben separat fachlich prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_312fcf7bf6edca18_3be70c29

**Anyone can send emails from your business**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler prüft nur das Präfix Bearer, nicht die Gültigkeit einer Identität oder Versandberechtigung. Empfänger, Betreff und Inhalt kommen vom Aufrufer. verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/send-invoice-mail/index.ts:25-39
- supabase/functions/send-invoice-mail/index.ts:83-120
- supabase/functions/collect-send-dunning/index.ts:118

Betroffene Funktionen:
- send-invoice-mail

Geplante Korrektur: Echte aktive Benutzer- beziehungsweise Maschinenberechtigung erzwingen; Versand an autorisierten Geschäftsvorgang binden.

Mögliche Auswirkungen: - Missbrauch geschäftlicher Absender
- Phishing, Spam und Versandkosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen Bearer-Text, öffentliche Schlüssel und unberechtigte Benutzer ohne Provider-Aufruf ablehnen.

Wiederherstellung: Versandendpunkt sperren; keine Rückkehr zur Präfixprüfung.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_37d780060351d132

**Anyone can send reminders containing a caller-chosen link**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Handler-Authentifizierung werden Pakete und Kontakte privilegiert geladen. base_url aus der Anfrage beeinflusst Kommunikationslinks. Tagesprotokolle begrenzen Wiederholungen, ersetzen aber keine Aufruferberechtigung.

Nachweise:
- supabase/functions/mediapaket-reminders/index.ts:49-56
- supabase/functions/mediapaket-reminders/index.ts:77-95
- supabase/functions/mediapaket-reminders/index.ts:124-126

Betroffene Funktionen:
- mediapaket-reminders

Geplante Korrektur: Verifizierten Job-Zugang vor Datenzugriff verlangen und Linkbasis ausschließlich aus vertrauenswürdiger Konfiguration beziehen.

Mögliche Auswirkungen: - Unberechtigter Erinnerungsversand
- Einbettung fremder Links in Geschäftskommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten Aufruf und fremde base_url ohne Mailversand prüfen; Idempotenz mit Mocks testen.

Wiederherstellung: Erinnerungsjob pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_39468467a3a1e242

**Anyone can trigger quote emails to selected customers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler besitzt keine eigene Identitäts- oder Angebotsberechtigungsprüfung vor Service-Role-Zugriff und Versand. verify_jwt=true begrenzt gegebenenfalls den Gateway-Einstieg, autorisiert aber keinen Zugriff auf das gewählte Angebot; die pauschale Behauptung anonymer Produktionserreichbarkeit ist damit nicht belegt.

Nachweise:
- supabase/functions/send-repair-quote/index.ts:11-21
- supabase/functions/send-repair-quote/index.ts:67-72
- src/pages/Reparatur/QuoteDetail.tsx:144

Betroffene Funktionen:
- send-repair-quote

Geplante Korrektur: Aktive Reparaturangebots- und Versandberechtigung für quote_id erzwingen.

Mögliche Auswirkungen: - Unberechtigter Angebotsversand
- Unberechtigte Status- und Historienänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Authentifizierten Benutzer ohne Angebotsrecht ohne Versand und Mutation abweisen; Gateway-JWT separat prüfen.

Wiederherstellung: Angebotsversand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3e001c78892db51d

**Signed-in users can access other customers’ orders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Benutzeridentität wird geprüft, aber der anschließende privilegierte Zugriff auf Signatur, Signaturanfrage und Bestellung ist nicht an deren Berechtigung gebunden.

Nachweise:
- supabase/functions/send-order-confirmation/index.ts:41-49
- supabase/functions/send-order-confirmation/index.ts:75-83
- supabase/functions/send-order-confirmation/index.ts:106-116

Betroffene Funktionen:
- send-order-confirmation

Geplante Korrektur: Aktive Bestellberechtigung beziehungsweise streng getrennten Maschinenpfad vor jedem Bestell- und Signaturzugriff prüfen.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Bestell- und Kundendaten
- Unberechtigter Bestätigungsversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde order_id und signatureId sowie inaktiven Benutzer ohne PDF- und Versandzugriff ablehnen.

Wiederherstellung: Bestätigungsversand dieses Endpunkts sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3f184b5b3878e895

**Anyone can trigger your saved webhook integrations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verzweigt ohne Aufruferprüfung in privilegiertes Einreihen beziehungsweise Abarbeiten gespeicherter Webhook-Abonnements. Gespeicherte Zieladressen verhindern nicht das unberechtigte Auslösen.

Nachweise:
- supabase/functions/ac-webhook-dispatch/index.ts:10-28
- supabase/functions/ac-webhook-dispatch/index.ts:33-82

Betroffene Funktionen:
- ac-webhook-dispatch

Geplante Korrektur: Einreihen und Dispatch getrennt autorisieren; Dispatch nur verifizierten Jobs, Einreihen nur berechtigten mandantengebundenen Produzenten erlauben.

Mögliche Auswirkungen: - Unberechtigtes Auslösen externer Integrationen
- Manipulation der Event-Warteschlange

Vorgesehene Regressionstests (nicht durchgeführt):
- Beide Aktionspfade ohne gültige Berechtigung ohne Queue- oder Netzwerk-Nebenwirkung ablehnen.

Wiederherstellung: Dispatcher und Produzentenpfad pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_43bb2ddd0aab0e94

**Anyone can search private customer conversations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Suche liest ohne Aufruferprüfung mit privilegiertem Client Nachrichten, Tickets und Dokumentzusammenfassungen. Quellen werden in der Antwort zurückgegeben; verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/ac-knowledge-rag/index.ts:9-21
- supabase/functions/ac-knowledge-rag/index.ts:60
- src/pages/AlixConnect/KnowledgeRag.tsx:19

Betroffene Funktionen:
- ac-knowledge-rag

Geplante Korrektur: Aktive Suchberechtigung erzwingen und jede Quelle mit Benutzer-/Mandantenrechten filtern; RLS-fähigen Benutzerclient verwenden.

Mögliche Auswirkungen: - Offenlegung privater Kommunikation und Dokumentinhalte
- Unberechtigte KI-Verarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme Suche und fremde Quellen ausschließen; Berechtigung für jede Quellenart separat prüfen.

Wiederherstellung: RAG-Suche sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_47008b040e014166_817a2c19

**Any signed-in user can send another user's catalog share**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach gültiger Anmeldung lädt der Admin-Client den gewählten Freigabelink ohne Besitzer- oder Mandantenabgleich. Ablauf und Widerruf werden geprüft, nicht die Versandberechtigung des Aufrufers.

Nachweise:
- supabase/functions/catalog-share-send/index.ts:63-95
- supabase/functions/catalog-share-send/index.ts:115-149
- src/pages/Katalog/Versand.tsx:146

Betroffene Funktionen:
- catalog-share-send

Geplante Korrektur: Aktive Freigabe- und Versandberechtigung für link_id vor dem privilegierten Laden prüfen.

Mögliche Auswirkungen: - Unberechtigter E-Mail-, SMS- oder WhatsApp-Versand
- Manipulation von Kommunikationsprotokollen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden gültigen Link und inaktiven Benutzer ohne Kanalaufruf ablehnen.

Wiederherstellung: Freigabelink-Versand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_4c7152ec5de2c1bc

**Anyone can change tenants’ payment records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Bankzeilen und Dokumente werden ohne Handler-Authentifizierung privilegiert geladen und abgeglichen. Ein übergebener tenantId-Filter ist keine verifizierte Mandantenzugehörigkeit.

Nachweise:
- supabase/functions/cmr-bank-automatch/index.ts:11-24
- supabase/functions/cmr-bank-automatch/index.ts:55-67
- src/pages/CMR/Buchhaltung.tsx:235

Betroffene Funktionen:
- cmr-bank-automatch

Geplante Korrektur: Aktive Buchhaltungsberechtigung mit serverseitig verifiziertem Mandantenscope vor Matching und Zahlungsanlage verlangen.

Mögliche Auswirkungen: - Unberechtigte Zahlungsanlage
- Verfälschte Bankzuordnungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden oder fehlenden Mandantenscope ohne Zahlungs- und Bankzeilenmutation ablehnen.

Wiederherstellung: Automatching sperren; Zuordnungen nur kontrolliert fachlich rückabwickeln.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_52b818a8bbb78eb6

**Anyone can change another customer's showcase settings**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: get_config und set_config verwenden callerbestimmte client_id ohne Verwaltungsberechtigung. Der spätere Tokencheck schützt nur öffentliche Inhaltsaktionen, nicht die vorangehenden Konfigurationszweige.

Nachweise:
- supabase/functions/social-showcase-public/index.ts:31-48
- supabase/functions/social-showcase-public/index.ts:65-93

Betroffene Funktionen:
- social-showcase-public
- getConfig
- saveConfig

Geplante Korrektur: Konfigurationsaktionen von öffentlicher Darstellung trennen und aktive Kundenverwaltungsberechtigung verlangen.

Mögliche Auswirkungen: - Unberechtigte Konfigurationsänderung
- Offenlegung beziehungsweise Rotation von Freigabetokens

Vorgesehene Regressionstests (nicht durchgeführt):
- Öffentliche get_config- und set_config-Aufrufe ohne Lese- oder Schreibzugriff ablehnen; Tokenansicht separat erhalten.

Wiederherstellung: Verwaltungsaktionen sperren, öffentliche Ansicht nur mit bestehenden gültigen Tokens erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_58c64b182fdc8abb_138f6013

**Anyone can change your asset depreciation records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der angelegte userClient wird nicht zur Identitäts- oder Berechtigungsprüfung verwendet. Der Admin-Client lädt alle aktiven Anlagen und kann Abschreibungen sowie Anlagenstände verändern.

Nachweise:
- supabase/functions/finance-asset-depreciation-run/index.ts:14-38
- supabase/functions/finance-asset-depreciation-run/index.ts:86-110
- src/pages/Finance/AfaLauf.tsx:30

Betroffene Funktionen:
- finance-asset-depreciation-run

Geplante Korrektur: Verifizierten Job oder aktiven berechtigten Finanzbenutzer mit Anlagenscope vor jedem Zugriff prüfen.

Mögliche Auswirkungen: - Unberechtigte Abschreibungsbuchungen
- Manipulation von Anlagenwerten

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten dry_run und schreibenden Lauf vor Datenabfrage ablehnen; erlaubten Periodenlauf mit Datenbank-Mocks prüfen.

Wiederherstellung: Abschreibungslauf sperren; Buchungskorrektur getrennt freigeben.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5a4b77537eec8b00

**ZIP download trusts caller-writable version storage paths**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Dokumente werden tatsächlich RLS-beschränkt im Benutzerkontext geladen. Danach vertraut der Admin-Download auf storage_path der aktuellen Version. Für den behaupteten Angriff muss ein unberechtigter Aufrufer diesen Versionspfad wirksam auf ein fremdes Objekt setzen können; diese vollständige Schreib- und Triggerkette wurde nicht abschließend verifiziert.

Nachweise:
- supabase/functions/alixdocs-zip/index.ts:39-60
- supabase/migrations/20260719100325_4dd2df07-fbc5-4436-9cd8-454a80006197.sql:11-18

Betroffene Funktionen:
- alixdocs-zip

Geplante Korrektur: Alle Versions-Schreibpolicies und Trigger prüfen; Speicherobjekt serverseitig an Dokument, Version und Mandant binden oder mit Benutzerberechtigung herunterladen.

Mögliche Auswirkungen: - Bedingter mandantenübergreifender Dateizugriff bei manipulierbarem Versionspfad

Vorgesehene Regressionstests (nicht durchgeführt):
- Mit isolierten Fixtures prüfen, ob ein berechtigter Dokumentbearbeiter einen fremden storage_path setzen und dessen Objekt herunterladen könnte.

Wiederherstellung: ZIP-Download bis zur Klärung sperren; RLS-Prüfung nicht entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5e865420cc71ba0c

**Finance users can text arbitrary phone numbers**

Bewertung: Bestätigte Fehlkonfiguration.

Technische Ursache: Der Benutzerpfad verlangt eine gültige Identität und erlaubte Rolle; dies ist kein anonymer SMS-Relay. Frei wählbare Zielnummer und Nachricht sind vorhanden. Aktiver Kontostatus und konkrete Fall-/Mandantenberechtigung werden aber vor dem Service-Role-Lesen nicht geprüft.

Nachweise:
- supabase/functions/collect-send-sms/index.ts:35-53
- supabase/functions/collect-send-sms/index.ts:58-72
- src/components/collect/CollectCaseActions.tsx:235

Betroffene Funktionen:
- collect-send-sms

Geplante Korrektur: Aktive Fall- und Versandberechtigung ergänzen; Nummernübersteuerung ausdrücklich berechtigen und protokollieren.

Mögliche Auswirkungen: - Rollenintern zu weitreichender Versand
- Möglicher Versand fremder Falldaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Inaktives Finanzkonto, fremden Fall und unberechtigte Nummernübersteuerung abweisen; erlaubten Fall positiv prüfen.

Wiederherstellung: Nummernübersteuerung beziehungsweise SMS-Versand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_60a9985b359fcaaf

**Airtable import endpoint exposes connected data without sign-in**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler besitzt keine eigene Aufruferprüfung vor dem Zugriff auf die verbundene Airtable-Integration. list_bases, Tabellen- und Datensatzaktionen liefern angebundene Daten zurück. Eine mögliche Gateway-JWT-Prüfung stellt keine Integrationsberechtigung her.

Nachweise:
- supabase/functions/catalog-import-airtable/index.ts:11-43
- src/pages/Katalog/ImportManaged.tsx:54

Betroffene Funktionen:
- catalog-import-airtable

Geplante Korrektur: Aktive Integrations- und Katalogberechtigung vor jedem Aktionszweig erzwingen; Zugriff auf erlaubte Datenquellen begrenzen.

Mögliche Auswirkungen: - Unberechtigtes Lesen verbundener Airtable-Daten

Vorgesehene Regressionstests (nicht durchgeführt):
- Alle Leseaktionen ohne Integrationsberechtigung ohne externen Aufruf ablehnen.

Wiederherstellung: Airtable-Endpunkt sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_63fca018638248be_53993ff0

**Visitors can read another site chat**

Bewertung: Im aktuellen Code bereits behoben.

Technische Ursache: Der behauptete websiteübergreifende Zugriff ist im aktuellen Code durch loadConversation eingeschränkt: conversation_id und website_id müssen gemeinsam passen. send und poll verwenden diesen Helfer. Die weiterhin fehlende Besucherbindung ist ein anderer, separat bewerteter Befund.

Nachweise:
- supabase/functions/ac-chat/index.ts:20-24
- supabase/functions/ac-chat/index.ts:180-183
- supabase/functions/ac-chat/index.ts:232-235
- supabase/functions/ac-chat/index.ts:254-257

Betroffene Funktionen:
- ac-chat
- loadConversation

Geplante Korrektur: Websitebindung erhalten; zusätzlich die separat erforderliche Besucher-Capability implementieren.

Mögliche Auswirkungen: - Behaupteter websiteübergreifender Zugriff im untersuchten Pfad blockiert
- Besucherübergreifendes Restrisiko bleibt separat bestehen

Vorgesehene Regressionstests (nicht durchgeführt):
- Website-A-Schlüssel mit Website-B-Konversation muss vor Nachrichtenabfrage und Insert abgewiesen werden.

Wiederherstellung: Bei Regression send und poll sperren; Websitefilter niemals entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6820ef9219a29db8

**Anyone can submit private knowledge articles for embedding**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: article_id bestimmt ohne Handler-Berechtigungsprüfung den privilegierten Artikelzugriff, die Übermittlung an den Embedding-Dienst und das Speichern des Embeddings.

Nachweise:
- supabase/functions/ac-kb-embed/index.ts:12-24
- supabase/functions/ac-kb-embed/index.ts:32
- src/pages/AlixConnect/KnowledgeBase.tsx:71

Betroffene Funktionen:
- ac-kb-embed

Geplante Korrektur: Aktive Wissensbasis-Bearbeitungsberechtigung für Artikel und Mandant vor Lesen und externer Verarbeitung prüfen.

Mögliche Auswirkungen: - Unberechtigte externe Verarbeitung privater Artikel
- Unberechtigte Embedding-Änderungen und Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Artikel und unberechtigten Benutzer ohne Embedding-Aufruf oder Update abweisen.

Wiederherstellung: Embedding-Endpunkt sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6cdb90a4e4b3d4f9

**Any super admin can email reports to anyone**

Bewertung: Bestätigte Fehlkonfiguration.

Technische Ursache: Versand ist durch Cron-Secret oder getUser plus has_role beschränkt. Frei wählbare Empfänger sind daher nicht allein Beweis eines kritischen Relays. has_role lässt jedoch auch Admin zu und prüft keinen aktiven Kontostatus; diese Einschränkung fehlt im Handler ebenfalls.

Nachweise:
- supabase/functions/aic-send-report/index.ts:80-100
- supabase/functions/aic-send-report/index.ts:105-128
- supabase/migrations/20260721115832_c60f3a32-4a51-4e58-9624-19ab1ffa85ac.sql:9-19
- src/pages/AIC/Berichte.tsx:30

Betroffene Funktionen:
- aic-send-report
- public.has_role(text)

Geplante Korrektur: Aktives Konto und ausdrücklich gewünschte Berichtsversandrolle prüfen; Empfängerfreiheit fachlich dokumentieren und gegebenenfalls begrenzen.

Mögliche Auswirkungen: - Zu breite administrative Versandberechtigung
- Berichtsversand durch nicht mehr aktive Rollenträger möglich

Vorgesehene Regressionstests (nicht durchgeführt):
- Inaktive Administratoren abweisen; Admin-Vererbung und erlaubte Empfängerscopes ausdrücklich testen.

Wiederherstellung: Manuellen Versand sperren, verifizierten Scheduler separat erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6feae31e06a64cf3

**Anyone can run conversation automations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler liest nach payload.event ohne Aufruferprüfung aktive Automationsregeln. Callergewählte Konversation und Mandantenwerte steuern Service-Role-Lesezugriffe, Nachrichten, Zuweisungen und Webhooks.

Nachweise:
- supabase/functions/ac-automation-run/index.ts:13-49
- supabase/functions/ac-automation-run/index.ts:64-82
- supabase/functions/ac-automation-run/index.ts:121-159

Betroffene Funktionen:
- ac-automation-run

Geplante Korrektur: Nur verifizierte Ereignisproduzenten zulassen; Konversation und Regeln serverseitig demselben Mandanten zuordnen.

Mögliche Auswirkungen: - Unberechtigte Nachrichten und Konversationsänderungen
- Auslösen externer Webhooks und KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Gefälschten Event und widersprüchliche Mandanten-/Konversationswerte ohne Nebenwirkungen abweisen.

Wiederherstellung: Automationsausführung pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_74e13969233e5319

**Any signed-in user can send payment reminders to customers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Benutzerpfad authentifiziert den Aufrufer, bindet die nachfolgende privilegierte Zahlungsankündigung aber nicht an eine aktive Finanz- oder Kundenberechtigung. Die reguläre UI-Anfrage ist keine serverseitige Zugriffskontrolle.

Nachweise:
- supabase/functions/recurring-prenotification/index.ts:92-120
- src/pages/Finance/WiederkehrendeZahler.tsx:554

Betroffene Funktionen:
- recurring-prenotification

Geplante Korrektur: Aktive Finanzversandberechtigung und erlaubten Kundenscope verlangen; Maschinenzugriff explizit trennen.

Mögliche Auswirkungen: - Unberechtigter Versand von Zahlungsankündigungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Angemeldeten Benutzer ohne Finanzrecht und inaktives Konto vor Kundenverarbeitung und Versand abweisen.

Wiederherstellung: Manuelle Zahlungsankündigungen sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7596267ca3ddaaea

**Public import reads and writes the product catalog**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Importhandler besitzt keine ausreichende Aufruferautorisierung für privilegierte Product-Hub-Lese- und Schreiboperationen. Additives Importieren und Dublettenprüfung sind keine Zugriffskontrolle. Eine controlled_modes-Sperre der anderen Push-Handler schützt diesen Import nicht.

Nachweise:
- supabase/functions/product-hub-import/index.ts:1-11
- supabase/functions/product-hub-import/index.ts:314-347
- supabase/functions/product-hub-import/index.ts:358-377

Betroffene Funktionen:
- product-hub-import

Geplante Korrektur: Aktive Product-Hub-Importberechtigung vor Vorschau, Quellzugriff und Import verlangen; Quellen und importierten Scope serverseitig begrenzen.

Mögliche Auswirkungen: - Unberechtigter Katalogzugriff
- Unberechtigte Produkt-, Medien- und Dokumentänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- test, preview und import ohne passende Berechtigung vor Quellen- und Datenzugriff ablehnen; kontrollierte Modi separat prüfen.

Wiederherstellung: Importendpunkt sperren; Importe nur anhand geprüfter Historie rückabwickeln.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_77810b1b4b728af7

**Any signed-in user can see other sites' goal results**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: SECURITY DEFINER aggregiert Ziele und Umsatz für eine callergewählte Website-ID ohne interne Website- oder Mandantenberechtigung. EXECUTE für authenticated reicht dafür nicht aus.

Nachweise:
- supabase/migrations/20260720205540_12d9e922-2380-414e-81fd-03062eda49ac.sql:111-143

Betroffene Funktionen:
- public.ac_web_goals_summary(uuid,timestamptz,timestamptz)

Geplante Korrektur: Aktive Websiteberechtigung innerhalb der Funktion prüfen und Funktionsrechte auf das notwendige Minimum reduzieren.

Mögliche Auswirkungen: - Mandantenübergreifende Offenlegung von Conversion- und Umsatzaggregaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Direkte RPC-Aufrufe mit fremder Website und inaktivem Konto müssen scheitern.

Wiederherstellung: EXECUTE bis zur abgesicherten Ersatzfunktion entziehen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7f26776bd0d3a68e

**Anyone can turn signed offers into orders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler sucht anhand offer_number nach unterschriebenen Anfragen und erzeugt Bestellpositionen beziehungsweise Finanzierungsdaten ohne eigene Aufruferberechtigung. Bereits vorhandene Unterschriften legitimieren nicht jeden Aufrufer zur Konvertierung.

Nachweise:
- supabase/functions/convert-signed-offer-to-order/index.ts:10-42
- supabase/functions/convert-signed-offer-to-order/index.ts:157-181
- supabase/functions/alix-sign-submit/index.ts:234

Betroffene Funktionen:
- convert-signed-offer-to-order

Geplante Korrektur: Konvertierung nur verifizierten internen Aufrufern oder aktiv berechtigten Benutzern erlauben; Signatur und Auftrag serverseitig binden.

Mögliche Auswirkungen: - Unberechtigte Auftragserzeugung
- Unberechtigte Finanzierungsdatensätze

Vorgesehene Regressionstests (nicht durchgeführt):
- Direkten unberechtigten Aufruf trotz existierendem unterschriebenem Angebot ablehnen; Idempotenz isoliert prüfen.

Wiederherstellung: Konvertierungsendpunkt sperren; Signaturannahme und Auftragsanlage getrennt behandeln.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_840f31fb29294dc7

**Admins can send arbitrary test SMS messages to any number**

Bewertung: Bestätigte Fehlkonfiguration.

Technische Ursache: Die Test-SMS-Funktion validiert Claims und verlangt Admin oder Super Admin. Eine beliebige Testnummer ist damit nicht automatisch ein kritischer offener SMS-Relay. Eine aktive Kontoprüfung fehlt jedoch vor dem administrativen Providerzugriff.

Nachweise:
- supabase/functions/sms-config-test/index.ts:50-65
- supabase/functions/sms-config-test/index.ts:87-104
- src/pages/operation/SmsKonfiguration.tsx:75

Betroffene Funktionen:
- sms-config-test

Geplante Korrektur: Aktiven Administrator und explizite SMS-Konfigurationsberechtigung prüfen; Testempfänger und Ratenlimits fachlich festlegen.

Mögliche Auswirkungen: - Testversand durch inaktive Rollenträger
- Kostenmissbrauch innerhalb zu weit gefasster Administration

Vorgesehene Regressionstests (nicht durchgeführt):
- Inaktiven Administrator abweisen; erlaubten Testversand ausschließlich mit Provider-Mock und gegebenenfalls Empfänger-Allowlist prüfen.

Wiederherstellung: Testversand deaktivieren, Statusanzeige separat schützen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8703f96241dee35e_4db211d4

**Any signed-in user can sync a caller-selected protected ticket**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser validiert die Anmeldung. ticket_id wird danach mit privilegiertem Client ohne Ticketberechtigungsprüfung geladen und gegebenenfalls an AlixSmart synchronisiert. source_system- und external_ticket_id-Prüfungen sind nur fachliche Voraussetzungen.

Nachweise:
- supabase/functions/sync-to-alixsmart/index.ts:46-86
- supabase/functions/sync-to-alixsmart/index.ts:134-167
- src/pages/Tickets/TicketDetail.tsx:158

Betroffene Funktionen:
- sync-to-alixsmart

Geplante Korrektur: Aktive Ticket- und Integrationsberechtigung vor Ticket-/Nachrichtenzugriff und externem Sync prüfen.

Mögliche Auswirkungen: - Unberechtigte Übermittlung geschützter Ticketdaten
- Unberechtigte Synchronisationszustände

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremdes synchronisierbares Ticket ohne externen Aufruf oder Logmutation ablehnen.

Wiederherstellung: Manuellen Sync sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8973eaa4d23c2465

**Anyone can create invoices across customer accounts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verarbeitet Sammelpläne und Zeiteinträge ohne eigene Aufruferautorisierung und erzeugt privilegiert Rechnungen. Callergewählte Plan- oder Mandantenfilter begründen keine Zugriffsberechtigung.

Nachweise:
- supabase/functions/cmr-collective-run/index.ts:21-48
- supabase/functions/cmr-collective-run/index.ts:94-116
- src/pages/CMR/Sammelrechnungen.tsx:110

Betroffene Funktionen:
- cmr-collective-run

Geplante Korrektur: Verifizierte Job-Berechtigung oder aktive mandantengebundene Fakturierungsberechtigung vor Verarbeitung verlangen.

Mögliche Auswirkungen: - Unberechtigte Rechnungserzeugung
- Veränderung von Zeiteinträgen und Planausführung

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Plan und Mandanten ohne Dokumentnummernvergabe oder Rechnungsanlage ablehnen.

Wiederherstellung: Sammellauf pausieren; Rechnungen nur fachlich kontrolliert stornieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8a473438782bef1a

**Anyone can replace another customer's signed document**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: document_id steuert ohne Handler-Autorisierung das Laden von Signaturdokument und Signaturen, privilegierten Dateidownload, finales Rendering sowie Versions- und Dokumentänderungen. Der legitime interne Aufrufer schützt den direkt aufrufbaren Handler nicht.

Nachweise:
- supabase/functions/sig-render-final/index.ts:18-40
- supabase/functions/sig-render-final/index.ts:125-137
- supabase/functions/sig-submit/index.ts:141

Betroffene Funktionen:
- sig-render-final

Geplante Korrektur: Nur verifizierte Signaturjobs beziehungsweise explizit berechtigte aktive Benutzer zulassen; Dokumentstatus und Signaturvollständigkeit serverseitig prüfen.

Mögliche Auswirkungen: - Unberechtigte Änderung signierter Dokumentversionen
- Verletzung der Dokumentintegrität

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte document_id ohne Storage-Download, Upload und Versionsänderung ablehnen.

Wiederherstellung: Finalisierungsjob sperren; alte Versionen unverändert erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8d76058b0444465c

**Anyone can run your finance automations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Finanzregeln und Belege werden ohne Handler-Authentifizierung privilegiert gelesen und verarbeitet; Ausführungsprotokolle und Belegänderungen sind erreichbar.

Nachweise:
- supabase/functions/finance-automations-engine/index.ts:10-36
- supabase/functions/finance-automations-engine/index.ts:84-97
- supabase/functions/finance-automations-engine/index.ts:126
- src/pages/Finance/Automations.tsx:88

Betroffene Funktionen:
- finance-automations-engine

Geplante Korrektur: Verifizierte Jobs oder aktive Finanzautomationsberechtigung mit Mandantenscope vor Regelladen verlangen.

Mögliche Auswirkungen: - Unberechtigte Finanzautomationen
- Manipulation von Rechnungszuständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte Ausführung ohne Regelabfrage, Belegupdate und Run-Eintrag abweisen.

Wiederherstellung: Automationsengine pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_951b00a22a7089dc

**Public workflow exposes privileged case processing**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Handler-Aufruferprüfung werden Fälle, Checklisten und Rückrufe privilegiert bearbeitet. Der interne Versandhelper verwendet Service Role und legitimiert den ursprünglichen Aufrufer nicht.

Nachweise:
- supabase/functions/as-workflows-run/index.ts:53-73
- supabase/functions/as-workflows-run/index.ts:87-135

Betroffene Funktionen:
- as-workflows-run

Geplante Korrektur: Verifizierte Workflow-Jobs vor jeglichem Fallzugriff verlangen und Mandantenscope der Verarbeitung festlegen.

Mögliche Auswirkungen: - Unberechtigte Fallverarbeitung
- Erinnerungsversand und Timeline-Manipulation

Vorgesehene Regressionstests (nicht durchgeführt):
- Fehlende und öffentliche Job-Zugangsdaten ohne Fallzugriff, Versand und Updates ablehnen.

Wiederherstellung: Workflow-Scheduler pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_98d1a9730f1bf438_c6ddf1e8

**Anyone can create customer collection notices**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Mahnlauf besitzt keine Handler-Authentifizierung, liest Einstellungen und Dokumente privilegiert und erzeugt Mahndokumente. Optionaler E-Mail-Versand und Ausgangsbelegänderungen sind erreichbar; verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/cmr-dunning-run/index.ts:34-62
- supabase/functions/cmr-dunning-run/index.ts:114-159
- supabase/functions/cmr-dunning-run/index.ts:173-197
- src/pages/CMR/Mahnwesen.tsx:46

Betroffene Funktionen:
- cmr-dunning-run

Geplante Korrektur: Aktive mandantengebundene Mahnberechtigung oder verifizierten Job vor dem Lauf erzwingen.

Mögliche Auswirkungen: - Unberechtigte Mahnungserzeugung und Kundenkommunikation
- Veränderung von Forderungszuständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Mandanten und unberechtigten Lauf ohne Nummernvergabe, Dokumente und Versand abweisen.

Wiederherstellung: Mahnlauf sperren; erzeugte Dokumente separat fachlich behandeln.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9e661ffc56acce39

**Anyone can read another visitor’s chat**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Website wird geprüft, aber poll bindet die Konversation nicht an einen authentisierten Besucher oder eine geheime Besuchercapability. Der öffentliche Widget-Schlüssel plus fremde Konversations-ID derselben Website genügt im Codepfad zum Lesen nichtinterner Nachrichten.

Nachweise:
- supabase/functions/ac-chat/index.ts:20-24
- supabase/functions/ac-chat/index.ts:180-183
- supabase/functions/ac-chat/index.ts:254-266
- supabase/functions/ac-widget/index.ts:16

Betroffene Funktionen:
- ac-chat
- loadConversation

Geplante Korrektur: Bei start eine kryptografische konversationsgebundene Besuchercapability ausgeben und für send sowie poll verlangen.

Mögliche Auswirkungen: - Besucherübergreifendes Lesen von Chatnachrichten
- Mögliche fremde Nachrichteneinspeisung

Vorgesehene Regressionstests (nicht durchgeführt):
- Zwei Besucher derselben Website müssen trotz bekannter fremder Konversations-ID strikt getrennt bleiben.

Wiederherstellung: send und poll sperren, Websitebindung erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a344cf8be2820684

**Anyone can enroll another customer in a journey**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: event_type und contact_id bestimmen ohne Aufruferberechtigung die Suche nach Journeys und Anlage von Journey-Läufen. Eine Prüfung vorhandener Läufe ist nur Dublettenvermeidung.

Nachweise:
- supabase/functions/ac-journey-trigger/index.ts:8-25

Betroffene Funktionen:
- ac-journey-trigger

Geplante Korrektur: Verifizierte Eventproduzenten oder aktive kontaktbezogene Journey-Berechtigung verlangen; Journey und Kontakt mandantenseitig binden.

Mögliche Auswirkungen: - Unberechtigte Journey-Einschreibung
- Nachgelagerte Kundenkommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Gefälschten Event und fremden Kontakt ohne Run-Anlage abweisen.

Wiederherstellung: Journey-Trigger sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a6af40d2b040e4a1

**Anyone can expose document summaries through knowledge search**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Manuell gleicher Einstieg und dieselbe unautorisierte RAG-Suche verifiziert. Die Dokumentzusammenfassungen werden im selben Promise-basierten Suchpfad gelesen und über dieselbe Quellenantwort ausgegeben wie die bereits bewerteten privaten Kommunikationsquellen.

Nachweise:
- supabase/functions/ac-knowledge-rag/index.ts:9-21
- supabase/functions/ac-knowledge-rag/index.ts:60

Betroffene Funktionen:
- ac-knowledge-rag

Geplante Korrektur: Gemeinsam mit dem Hauptbefund sämtliche Quellenarten benutzer- und mandantenbezogen autorisieren.

Mögliche Auswirkungen: - Offenlegung von Dokumentzusammenfassungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Dokumentquellen mit abweichenden ACLs separat in den RAG-Berechtigungstest aufnehmen.

Wiederherstellung: RAG-Suche sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_43bb2ddd0aab0e94.

### lov_finding_aaa4d2aa58de11e4_56f4ee5a

**Any signed-in user can change another delivery route**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Claims werden geprüft, nicht die Berechtigung für tour_id. Der privilegierte Pfad lädt Tour und Stopps und verändert anschließend Termine, Reihenfolgen und Tourberechnungen.

Nachweise:
- supabase/functions/delivery-route-calc/index.ts:213-253
- supabase/functions/delivery-route-calc/index.ts:306-346
- supabase/functions/delivery-route-calc/index.ts:408-421
- src/pages/Dispatch/Touren.tsx:124

Betroffene Funktionen:
- delivery-route-calc

Geplante Korrektur: Aktive Dispositionsberechtigung für Tour und Mandant vor Daten- und Routingzugriff verlangen.

Mögliche Auswirkungen: - Unberechtigte Routenänderungen
- Offenlegung von Liefer- und Kundendaten
- Externe Routingkosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Tour ohne Geocoding, Routingaufruf oder Datenmutation abweisen.

Wiederherstellung: Neuberechnung sperren; letzte freigegebene Tourstände erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ac9f74df4aa376ea

**Ordinary callers can apply the stored facsimile signature**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler akzeptiert PDF und Dokumenttyp ohne Aufruferberechtigung, lädt die konfigurierte Faksimilegrafik privilegiert und liefert das bearbeitete PDF zurück. Aktivierte Konfiguration ist eine Betriebsbedingung, keine Berechtigung des Aufrufers.

Nachweise:
- supabase/functions/sig-apply-facsimile/index.ts:32-61
- supabase/functions/sig-apply-facsimile/index.ts:110-117

Betroffene Funktionen:
- sig-apply-facsimile

Geplante Korrektur: Nur verifizierte interne Dokumentprozesse oder explizit berechtigte aktive Signaturverantwortliche zulassen; Dokumentherkunft binden.

Mögliche Auswirkungen: - Unberechtigte Verwendung einer gespeicherten Unterschrift
- Erzeugung scheinbar autorisierter Dokumente

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebiges callererzeugtes PDF ohne berechtigten Vorgang vor Grafikdownload abweisen.

Wiederherstellung: Faksimileanwendung deaktivieren; Grafik nicht öffentlich machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ae5f39e7f20249fc

**Unauthenticated requests can read push subscriptions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Aufruferprüfung werden callergewählte Benutzer oder Rollen auf Push-Abonnements aufgelöst und benachrichtigt. Die Antwort enthält Zähler, nicht unmittelbar sämtliche Subscription-Daten; der unberechtigte privilegierte Zugriff und Versand bleiben bestehen.

Nachweise:
- supabase/functions/mobile-push-send/index.ts:34-68
- supabase/functions/mobile-push-send/index.ts:92-94
- supabase/functions/alixsmart-reminders-cron/index.ts:99

Betroffene Funktionen:
- mobile-push-send

Geplante Korrektur: Verifizierte interne Produzenten oder aktive Push-Versandberechtigung mit Empfängerscope verlangen.

Mögliche Auswirkungen: - Unberechtigter Push-Versand
- Privilegierter Zugriff auf Subscription-Zuordnungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte direkte Benutzer- und Rollenadressierung ohne Subscription-Abfrage oder Push ablehnen.

Wiederherstellung: Push-Endpunkt sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b4d04ac4e0a048bd

**Anyone can send a text from another customer’s missed call**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: call_id wird ohne Aufruferprüfung privilegiert geladen. Einstellungen, Geschäftszeiten und Cooldown begrenzen den Versand fachlich, prüfen aber nicht die Autorität des Aufrufers.

Nachweise:
- supabase/functions/ac-missed-call-sms/index.ts:61-95
- supabase/functions/ac-missed-call-sms/index.ts:106-162

Betroffene Funktionen:
- ac-missed-call-sms

Geplante Korrektur: Nur verifizierte Telefonie-Events oder berechtigte aktive Benutzer für den konkreten Anruf zulassen.

Mögliche Auswirkungen: - Unberechtigter SMS-Versand
- Veränderung von Anruf- und Kommunikationsprotokollen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde berechtigungslos gewählte missed-call-ID trotz erfüllter Geschäftsbedingungen ohne Versand ablehnen.

Wiederherstellung: Automatische Rückruf-SMS pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b6ddd0c4b7e8a609

**Anyone can email the approval report to arbitrary recipients**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Berichtshandler besitzt keine Aufruferprüfung vor Einstellungen, Freigabedaten und Mailversand. enabled- und Empfängerprüfungen sind fachliche Schalter, keine Job-Autorisierung.

Nachweise:
- supabase/functions/delivery-approval-monthly-report/index.ts:21-56
- supabase/functions/delivery-approval-monthly-report/index.ts:124-134

Betroffene Funktionen:
- delivery-approval-monthly-report

Geplante Korrektur: Verifizierten Berichtsjob beziehungsweise aktive Freigabeberichtsberechtigung verlangen und Empfänger serverseitig begrenzen.

Mögliche Auswirkungen: - Unberechtigter Berichtsversand
- Offenlegung interner Freigabedaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten Aufruf bei aktiviertem Bericht ohne Datenabfrage und Mailversand ablehnen.

Wiederherstellung: Monatsberichtjob pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b98203874ed68dbf

**Public sign-return invocation can approve any linked document**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine callergewählte Signaturanfrage wird ohne verifizierte Aufruferberechtigung privilegiert geladen; der Pfad lädt signierte Dateien und erzeugt eine AlixDocs-Version. Die Existenz einer Dokumentverknüpfung ersetzt keine Berechtigung für den Rücklauf.

Nachweise:
- supabase/functions/alixdocs-sign-return/index.ts:19-50
- supabase/migrations/20260719091800_25246b8d-312d-432f-909a-e95984ab6aac.sql:13

Betroffene Funktionen:
- alixdocs-sign-return

Geplante Korrektur: Verifizierten Signaturrücklauf vor Datenzugriff verlangen und Anfrage, abgeschlossenes Signaturereignis, Zieldokument und Version serverseitig binden.

Mögliche Auswirkungen: - Unberechtigte Übernahme von Signaturdateien
- Verletzung der AlixDocs-Dokumentintegrität

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigte oder nicht abgeschlossene Signaturanfrage ohne Download, Upload und Versionsanlage ablehnen.

Wiederherstellung: Signaturrücklauf pausieren; bestehende Dokumentversionen erhalten.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_baa5414ce6fda013

**Anyone can turn queued imports into orders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Verarbeitungsendpunkt lädt Inbox-Einträge ohne eigene Aufruferprüfung und führt privilegierte Kunden-, Bestell- und Positionsänderungen aus. Ein legitimer vorgeschalteter Importaufrufer schützt direkte Aufrufe nicht; verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/orders-inbox-process/index.ts:267-310
- supabase/functions/orders-inbox-process/index.ts:171-257
- supabase/functions/orders-inbox/index.ts:96

Betroffene Funktionen:
- orders-inbox-process

Geplante Korrektur: Verifizierten internen Verarbeitungsjob verlangen; Einträge an erlaubte Quelle und Mandant binden.

Mögliche Auswirkungen: - Unberechtigte Bestell- und Kundenänderungen
- Unberechtigte Verarbeitung wartender Importe

Vorgesehene Regressionstests (nicht durchgeführt):
- Direkten unberechtigten Aufruf mit und ohne onlyId ohne Verarbeitung oder Statusänderung ablehnen.

Wiederherstellung: Inbox-Verarbeitung pausieren, Eingänge unverändert aufbewahren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_bf2b6a2d007ce4fc

**Anyone can inspect another organization’s journey results**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: journey_id steuert ohne Benutzer- oder Mandantenprüfung privilegierte Abfragen auf Journey, Schritte und Ergebnisse. Die Daten fließen in Optimierung und Antwort; verify_jwt=false ist explizit konfiguriert.

Nachweise:
- supabase/functions/ac-journey-optimize/index.ts:10-20
- supabase/functions/ac-journey-optimize/index.ts:53-57
- src/pages/AlixConnect/JourneyOptimizer.tsx:32

Betroffene Funktionen:
- ac-journey-optimize

Geplante Korrektur: Aktive Journey-Leseberechtigung und Mandantenzugehörigkeit vor Datenzugriff und KI-Verarbeitung prüfen.

Mögliche Auswirkungen: - Offenlegung fremder Journey-Ergebnisse
- Unberechtigte KI-Verarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Journey ohne Daten- und KI-Aufruf abweisen.

Wiederherstellung: Optimierungsfunktion sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c26f3c6f2ff20f41

**Anyone can export your accounting transactions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Vor dem privilegierten DATEV-Export wird nur das Vorhandensein eines Authorization-Headers geprüft. Eine gültige Identität, ein aktives Konto und eine Finanzexportberechtigung werden nicht nachgewiesen.

Nachweise:
- supabase/functions/finance-datev-export/index.ts:19-38
- supabase/functions/finance-datev-export/index.ts:96
- src/pages/Finance/DatevExport.tsx:26

Betroffene Funktionen:
- finance-datev-export

Geplante Korrektur: Aktive Finanzexportberechtigung und verifizierten Buchungs-/Mandantenscope vor jeder Transaktionsabfrage verlangen.

Mögliche Auswirkungen: - Unberechtigter Export privater Buchungsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen nichtleeren Header und angemeldeten Benutzer ohne Exportrecht ohne CSV-Erzeugung ablehnen.

Wiederherstellung: DATEV-Export sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c4bcebcef88683c2

**Caller controls reminder recipient and email content**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Zusätzlich zur fehlenden Fallberechtigung akzeptiert derselbe Handler recipient_email, custom_message und CTA-Werte und versendet sie mit privilegierten Versandzugangsdaten. Dieser Befund beschreibt eine eigenständige Empfänger-/Inhaltskontrolle und wird nicht allein wegen desselben Handlers als Duplikat markiert.

Nachweise:
- supabase/functions/as-send-email-reminder/index.ts:42-57
- supabase/functions/as-send-email-reminder/index.ts:74-75
- supabase/functions/as-send-email-reminder/index.ts:108

Betroffene Funktionen:
- as-send-email-reminder

Geplante Korrektur: Empfänger aus autorisiertem Fall ableiten; Übersteuerung und freie Inhalte separat berechtigen, validieren und protokollieren.

Mögliche Auswirkungen: - Weitergabe von Falldaten an fremde Empfänger
- Missbrauch geschäftlicher E-Mails

Vorgesehene Regressionstests (nicht durchgeführt):
- Berechtigten Fallzugriff mit unberechtigter Empfänger- oder CTA-Übersteuerung ohne Versand ablehnen.

Wiederherstellung: Freie Empfänger- und Inhaltsübersteuerung deaktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_cac3d0218bcb0bbb

**Anyone can change private deposit records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Ohne Handler-Authentifizierung werden Rechnungen, Bestellungen und Anzahlungen privilegiert gelesen, finance_deposits geschrieben und Neuberechnungs-RPCs ausgelöst.

Nachweise:
- supabase/functions/sync-finance-deposits/index.ts:6-56
- supabase/functions/sync-finance-deposits/index.ts:119-125
- supabase/functions/sync-finance-deposits/index.ts:169-175
- src/pages/Finance/OffeneAnzahlungen.tsx:151

Betroffene Funktionen:
- sync-finance-deposits

Geplante Korrektur: Verifizierten Synchronisationsjob oder aktive Finanzberechtigung vor Datenzugriff verlangen; Datenumfang serverseitig begrenzen.

Mögliche Auswirkungen: - Unberechtigte Änderung privater Anzahlungsdaten
- Veränderung berechneter Finanzstände

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten Sync ohne Upsert und Neuberechnungs-RPC abweisen.

Wiederherstellung: Synchronisation pausieren; Finanzkorrekturen nur kontrolliert durchführen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d0449b3fd945f992

**Anyone can trigger customer maintenance reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler startet ohne Aufruferprüfung bereits eine Statusaktualisierungs-RPC und lädt anschließend Wartungsdaten für Erinnerungen. Protokoll- und Wartungsänderungen sind erreichbar.

Nachweise:
- supabase/functions/maintenance-reminder-daily/index.ts:15-27
- supabase/functions/maintenance-reminder-daily/index.ts:76-91
- src/pages/Wartungsmanagement.tsx:149

Betroffene Funktionen:
- maintenance-reminder-daily

Geplante Korrektur: Verifizierte Job-Berechtigung vor der ersten RPC und sämtlichen Wartungszugriffen verlangen.

Mögliche Auswirkungen: - Unberechtigter Wartungserinnerungsversand
- Veränderung von Wartungs- und Erinnerungsständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten Aufruf bereits vor refresh_warranty_and_maintenance_status und Versand abweisen.

Wiederherstellung: Tagesjob pausieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d51da742f6515a44

**Any signed-in user can access another order’s review token**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Claims werden validiert; die zusätzliche Rollenprüfung gilt nur dem manuellen Sonderpfad. Der reguläre Pfad lädt eine callergewählte Bestellung privilegiert, erstellt beziehungsweise verwendet Bewertungsdaten und kann review_url zurückgeben, ohne Bestellberechtigung zu prüfen.

Nachweise:
- supabase/functions/send-review-invitation/index.ts:22-63
- supabase/functions/send-review-invitation/index.ts:102-155
- supabase/functions/send-review-invitation/index.ts:211

Betroffene Funktionen:
- send-review-invitation

Geplante Korrektur: Aktive Bestell- und Einladungsberechtigung auf allen Pfaden erzwingen; Bewertungstoken nicht unnötig an Aufrufer zurückgeben.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Bewertungscapabilities
- Unberechtigter Einladungsversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Regulären und manuellen Pfad mit fremder Bestellung ohne Tokenrückgabe oder Versand ablehnen.

Wiederherstellung: Einladungsfunktion sperren und gegebenenfalls betroffene Tokens separat widerrufen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d76d8adca9d2e204

**Anyone can mark your management reports as sent**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: pack_id und action steuern ohne Handler-Authentifizierung privilegierte Änderungen an Managementberichten. Der send-Pfad markiert Berichte als versendet; tatsächlicher E-Mail-Versand ist dadurch nicht belegt.

Nachweise:
- supabase/functions/finance-management-pack/index.ts:4-26
- src/pages/Finance/ManagementPack.tsx:73

Betroffene Funktionen:
- finance-management-pack

Geplante Korrektur: Aktive berichtsbezogene Finanzberechtigung vor generate und send prüfen; Versandstatus nur an belegten Versand knüpfen.

Mögliche Auswirkungen: - Unberechtigte Manipulation von Berichts- und Versandzuständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde pack_id für beide Aktionen ohne Update abweisen; bloße Statusänderung nicht als echten Mailversand testen.

Wiederherstellung: Berichtsaktionen sperren; Statuskorrekturen separat auditieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d9dbde1372d10aa0_2fd2e69b

**Public endpoint exposes private credit assessment data**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: assessment_id bestimmt ohne Aufruferberechtigung privilegierte Bonitäts-, Bestell- und Finanzabfragen. Faktoren und Bewertung werden verändert; Antwort enthält Score und Entscheidungsergebnisse, nicht zwingend sämtliche Rohdaten.

Nachweise:
- supabase/functions/credit-score-calculate/index.ts:6-28
- supabase/functions/credit-score-calculate/index.ts:200-214
- src/pages/Credit/New.tsx:99

Betroffene Funktionen:
- credit-score-calculate

Geplante Korrektur: Aktive Bonitätsbearbeitungsberechtigung für Bewertung und Kunde vor jeder Abfrage und Neuberechnung verlangen.

Mögliche Auswirkungen: - Offenlegung privater Bonitätsergebnisse
- Unberechtigte Veränderung von Kreditentscheidungsgrundlagen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Bewertung ohne Rohdatenzugriff, Faktorenlöschung und Entscheidungsupdate abweisen.

Wiederherstellung: Neuberechnungsendpunkt sperren; Bewertungsstände historisch sichern.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_db88ec831c2a1cc7

**Any catalog editor can run scripts in coworkers' browsers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Gespeicherte HTML-Felder werden unverändert mit dangerouslySetInnerHTML in die Anwendung eingebettet. Die Katalogrolle darf Templates schreiben. Damit besteht ein gespeicherter XSS-Pfad über aktive HTML-Inhalte; eine erfolgreiche Browserausführung wurde nicht live getestet.

Nachweise:
- src/pages/Katalog/PdfTemplates.tsx:27-32
- src/pages/Katalog/PdfTemplates.tsx:43-52
- src/pages/Katalog/PdfTemplates.tsx:153
- supabase/migrations/20260715014026_f7187fd4-af74-4729-b2e6-0d6020a10724.sql:84-85

Betroffene Funktionen:
- KatalogPdfTemplates
- save
- HTML-Vorschau

Geplante Korrektur: HTML vor DOM-Einbettung mit geeigneter Allowlist sanitieren oder Vorschau in strikt isoliertem Sandbox-Kontext rendern; alle weiteren Template-Sinks prüfen.

Mögliche Auswirkungen: - Gespeicherte Skriptausführung im Anwendungskontext
- Aktionen mit den Rechten betrachtender Mitarbeiter

Vorgesehene Regressionstests (nicht durchgeführt):
- Ereignisattribute, SVG-/URL-basierte aktive Inhalte und ungefährliche Formatierung in isolierten Renderingtests prüfen.

Wiederherstellung: HTML-Vorschau deaktivieren oder als Text anzeigen; keine Rückkehr zu unsanitiertem DOM-HTML.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_df054ee0d6a3c45f

**Anyone can read another person's voicemail**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: call_id steuert ohne Handler-Berechtigungsprüfung den privilegierten Zugriff auf die Voicemail-URL, Audioabruf, Transkription und Rückgabe des Texts.

Nachweise:
- supabase/functions/ac-voicemail-transcribe/index.ts:5-20
- supabase/functions/ac-voicemail-transcribe/index.ts:32-52
- src/pages/AlixConnect/Telephony.tsx:220

Betroffene Funktionen:
- ac-voicemail-transcribe

Geplante Korrektur: Aktive anrufbezogene Hör- und Transkriptionsberechtigung vor Metadaten-, Audio- und KI-Zugriff verlangen.

Mögliche Auswirkungen: - Offenlegung fremder Voicemails
- Unberechtigte externe Audioverarbeitung und Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Anruf ohne Audioabruf, Statusupdate oder Transkriptionsaufruf abweisen.

Wiederherstellung: Voicemail-Transkription sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e41206eaf4d35d0e

**Anyone can turn on another client's public showcase**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Manuell derselbe ungeschützte set_config-Zweig und dieselbe app_settings-Schreiboperation wie beim Hauptbefund verifiziert. Die Aktivierung einer fremden Showcase ist eine konkrete Wirkung derselben fehlenden Verwaltungsautorisierung.

Nachweise:
- supabase/functions/social-showcase-public/index.ts:44-48
- supabase/functions/social-showcase-public/index.ts:65-86

Betroffene Funktionen:
- social-showcase-public
- saveConfig

Geplante Korrektur: Gemeinsam mit dem Hauptbefund aktive clientbezogene Verwaltungsberechtigung vor set_config erzwingen.

Mögliche Auswirkungen: - Unberechtigte Veröffentlichung einer fremden Showcase

Vorgesehene Regressionstests (nicht durchgeführt):
- Aktivierung fremder client_id ohne Konfigurationsmutation abweisen.

Wiederherstellung: Öffentliche Konfigurationsänderungen sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_52b818a8bbb78eb6.

### lov_finding_e9436bf2ec03c48f_41eebedc

**Anyone can retrieve and expose repair-quote approval links**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der unzureichend autorisierte Angebotsversand gibt zusätzlich den approvalLink direkt zurück. Diese Capability-Offenlegung ist über reinen Versandmissbrauch hinaus relevant und wird deshalb nicht automatisch als Duplikat eingestuft. Gateway-JWT allein schützt das gewählte Angebot nicht.

Nachweise:
- supabase/functions/send-repair-quote/index.ts:14-21
- supabase/functions/send-repair-quote/index.ts:68-72
- src/pages/Reparatur/QuoteDetail.tsx:144

Betroffene Funktionen:
- send-repair-quote

Geplante Korrektur: Aktive Angebotsberechtigung prüfen und Freigabecapability aus Standardantwort und unnötigen Protokollen entfernen.

Mögliche Auswirkungen: - Offenlegung fremder Angebotsfreigabelinks
- Möglicher Missbrauch der damit verbundenen Freigaberechte

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigter Benutzer darf weder Link noch tokenhaltige Historie erhalten; nachgelagerte Freigaberechte separat prüfen.

Wiederherstellung: Endpunkt sperren; kompromittierte Freigabetokens nur kontrolliert rotieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ec3de0a630ccb72f_3f6f0b90

**Any signed-in user can read another user's ticket**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser validiert nur die Identität. Derselbe Service-Role-Client liest anschließend frei gewähltes Ticket und interne Nachrichten ohne Ticket- oder Mandantenberechtigung; ähnliche Tickets werden ebenfalls privilegiert durchsucht.

Nachweise:
- supabase/functions/ticket-ai-assist/index.ts:18-45
- supabase/functions/ticket-ai-assist/index.ts:62-71

Betroffene Funktionen:
- ticket-ai-assist

Geplante Korrektur: Aktive Ticketberechtigung vor Primär- und Ähnlichkeitssuche erzwingen; nur berechtigte Nachrichten an KI übermitteln.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung fremder Tickets und interner Notizen
- Mögliche Offenlegung über KI-Ausgaben

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremdes Primärticket und unberechtigte ähnliche Tickets vor KI-Verarbeitung ausschließen.

Wiederherstellung: Ticket-KI-Anreicherung sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_f04bfe8a3011dee3

**Anyone can view another customer's contact details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler liest callergewählte Kontaktdaten ohne Aufruferprüfung und verwendet diese in der KI-Verarbeitung. Die resultierende Antwort beziehungsweise Prediction kann daraus abgeleitete private Angaben enthalten; ein vollständiger Rohdatenexport ist nicht nachgewiesen.

Nachweise:
- supabase/functions/ac-voice-ai-studio/index.ts:9-18
- supabase/functions/ac-voice-ai-studio/index.ts:41-50

Betroffene Funktionen:
- ac-voice-ai-studio

Geplante Korrektur: Aktive kontaktbezogene Voice-AI-Berechtigung und Mandantenbindung vor Kontaktzugriff und KI-Aufruf verlangen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kontaktdaten
- Unberechtigte KI-Kosten und Predictions

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden contact_id ohne Kontaktabfrage, KI-Aufruf und Prediction-Anlage abweisen.

Wiederherstellung: Kontaktbasierte Voice-AI-Verarbeitung sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_f4bd1fd6bf1a9511

**Anyone can change existing catalog products through the import**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Neben den ungeschützten Airtable-Leseaktionen besitzt der Import einen eigenständigen privilegierten Schreibpfad: callerbeeinflusste Produktdaten werden anhand SKU auf vorhandene catalog_items angewendet. Die Datenlese- und Schreibwirkungen werden deshalb nicht ungeprüft zusammengelegt.

Nachweise:
- supabase/functions/catalog-import-airtable/index.ts:11-12
- supabase/functions/catalog-import-airtable/index.ts:50-79
- supabase/functions/catalog-import-airtable/index.ts:96-104

Betroffene Funktionen:
- catalog-import-airtable

Geplante Korrektur: Aktive Katalogimportberechtigung, erlaubte Quelle und Änderungsumfang vor Jobanlage und Produkt-Upsert prüfen.

Mögliche Auswirkungen: - Unberechtigte Änderung vorhandener Katalogprodukte
- Unberechtigte Medien- und Importjobänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Bekannte fremde SKU und unberechtigte Quelle ohne Jobanlage, Produktupdate und Medienupload abweisen.

Wiederherstellung: Schreibenden Import sperren; Änderungen anhand Importhistorie kontrolliert korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ff271ba19700e47f

**Any signed-in user can send arbitrary approval PDFs to anyone**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler validiert die Benutzeridentität, bindet den nachfolgenden Versand aber nicht ausreichend an aktive Freigabe-, Ressourcen- und Empfängerberechtigungen. Eine gültige Anmeldung allein autorisiert weder beliebige Freigabeunterlagen noch beliebige Empfänger.

Nachweise:
- supabase/functions/delivery-approval-mail/index.ts:20-63

Betroffene Funktionen:
- delivery-approval-mail

Geplante Korrektur: Aktive Versandberechtigung für den konkreten Freigabevorgang verlangen; PDF serverseitig ableiten und Empfänger an autorisierte Vorgangskontakte binden.

Mögliche Auswirkungen: - Unberechtigter Versand von Freigabeunterlagen
- Missbrauch geschäftlicher Versandidentität

Vorgesehene Regressionstests (nicht durchgeführt):
- Angemeldeten Benutzer ohne Vorgangsrecht sowie unberechtigte PDF-/Empfängerübersteuerung ohne Versand ablehnen.

Wiederherstellung: Freigabemail-Versand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_016dbf8483032e9a

**Anyone can resend another customer's signing email**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler liest signature_id ohne Identitätsprüfung mit Service Role. Die verknüpfte Signaturanfrage wird ebenfalls privilegiert geladen. body.email überschreibt den Empfänger; die Antwort enthält zusätzlich download_url. Damit ist nicht nur erneuter Versand an den ursprünglichen Kunden möglich.

Nachweise:
- supabase/functions/alix-sign-resend/index.ts:19-44
- supabase/functions/alix-sign-resend/index.ts:73-80
- supabase/functions/alix-sign-resend/index.ts:110-128

Betroffene Funktionen:
- alix-sign-resend

Geplante Korrektur: Identität und Berechtigung auf die konkrete Signaturanfrage vor jedem privilegierten Zugriff prüfen; Empfänger aus autorisierten Stammdaten ableiten und Overrides gesondert berechtigen.

Mögliche Auswirkungen: - Offenlegung signierter Unterlagen
- Unberechtigter E-Mail-Versand
- Storage- und Audit-Schreibzugriffe

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Zugriff und fremde signature_id ablehnen; berechtigten Versand erlauben; fremden Empfänger ablehnen.

Wiederherstellung: Bei Regression Versand deaktivieren; fehlende Objektprüfung nicht wieder freigeben.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_040f79f8da123789

**Any signed-in user can change the product catalog**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getClaims bestätigt lediglich eine Identität. Danach wird unmittelbar ein Service-Role-Client für den gemeinsamen Katalog erstellt; eine administrative Importberechtigung fehlt vor dem Import.

Nachweise:
- supabase/functions/import-alix-lasers-de/index.ts:18-35

Betroffene Funktionen:
- import-alix-lasers-de

Geplante Korrektur: Serverseitige Product-Hub-Importberechtigung vor Quellenabruf und sämtlichen Katalogänderungen verlangen.

Mögliche Auswirkungen: - Unberechtigter gemeinsamer Katalogimport
- Mögliche Überschreibung vorhandener Produktdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Normalen Benutzer ablehnen; autorisierten Katalogadministrator zulassen; bei Ablehnung keinerlei Importzugriffe.

Wiederherstellung: Import sperren und betroffene Katalogänderungen aus gesichertem Stand gezielt wiederherstellen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_0cd00d4445ad701e

**SMS calls can create unauthorized case reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Benutzer werden authentifiziert, der ausgewählte After-Sales-Fall aber ausschließlich über case_id privilegiert geladen. Weder Team- noch Mandantenberechtigung wird geprüft. Anschließend werden SMS und dauerhafte Erinnerungs-/Timeline-Einträge erzeugt.

Nachweise:
- supabase/functions/as-send-sms-reminder/index.ts:63-91
- supabase/functions/as-send-sms-reminder/index.ts:98-123

Betroffene Funktionen:
- as-send-sms-reminder

Geplante Korrektur: Schreib- und Kommunikationsberechtigung auf den konkreten Fall prüfen; maschinelle Identität exakt statt per includes vergleichen.

Mögliche Auswirkungen: - Fremde Fälle verändern
- Kostenpflichtiger SMS-Versand
- Verfälschte Fallhistorie

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde case_id mit gültigem Benutzer ablehnen; berechtigten Fall zulassen; keine Nebenwirkungen bei Ablehnung.

Wiederherstellung: SMS-Funktion sperren und fehlerhafte Historieneinträge nachvollziehbar korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_113966ca22401a64

**Anyone can trigger the finance sync with service-role access**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Zwischen OPTIONS-Behandlung und mandantenübergreifenden Service-Role-Abfragen liegt keine Aufruferprüfung. Kundenmapping und Zoho-Rechnungen werden direkt für den Finanzsync geladen.

Nachweise:
- supabase/functions/sync-zoho-to-finance/index.ts:27-58

Betroffene Funktionen:
- sync-zoho-to-finance

Geplante Korrektur: Verifizierte Jobidentität oder explizite administrative Finanzsync-Berechtigung vor jeglichem Datenzugriff verlangen.

Mögliche Auswirkungen: - Unberechtigte Auslösung des Finanzabgleichs
- Mandantenübergreifende Verarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Fehlende und ungültige Jobidentität ablehnen; autorisierten Job zulassen; wiederholten Lauf auf Idempotenz prüfen.

Wiederherstellung: Job deaktivieren; durch den Lauf verursachte Finanzänderungen anhand von Referenzen abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_16d3e37b9c8ba4ad

**Any signed-in user can view another website's funnel analytics**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die aktuelle SQL-Definition einschließlich späterer Ersetzungen, EXECUTE-Grants und Website-Berechtigungsabhängigkeiten wurde nicht vollständig gelesen. Der Fundstellenhinweis allein beweist den aktuellen SECURITY-DEFINER-Zugriff nicht.

Nachweise:
- supabase/migrations/20260720211642_0d5010b4-1c33-4de4-a985-051f29bfb91d.sql:107

Betroffene Funktionen:
- public.ac_web_funnel_stats

Geplante Korrektur: Aktuell wirksame Funktionsdefinition und Grants rekonstruieren; danach Websiteberechtigung innerhalb der Funktion erzwingen, falls sie fehlt.

Mögliche Auswirkungen: - Potenzielle Offenlegung fremder Websiteanalytik

Vorgesehene Regressionstests (nicht durchgeführt):
- Aufruf mit fremder funnel_id; Prüfung späterer Migrationen und Rollenrechte.

Wiederherstellung: EXECUTE für unberechtigte Rollen entziehen, falls der Verdacht bestätigt wird.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_193e452aa8130a17

**Anyone can send an announcement to every employee**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Ankündigungs-Einstieg und seine vollständige Autorisierungskette zum transaktionalen Mailversand wurden nicht abschließend gelesen. Der behauptete feste Trigger darf nicht ohne aktuelle Prüfung als wirksame Authentifizierung oder bestätigte Lücke bewertet werden.

Nachweise:
- supabase/functions/send-transactional-email/index.ts:376-391

Betroffene Funktionen:
- announce-capa-cockpit
- send-transactional-email

Geplante Korrektur: Triggerprüfung und Aufrufer vollständig prüfen; gegebenenfalls festen Trigger durch verifizierte Job- oder Administratoridentität ersetzen.

Mögliche Auswirkungen: - Potenzieller Massenversand an Beschäftigte

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme und unberechtigte Trigger ablehnen; berechtigten Versand ohne reale Zustellung simulieren.

Wiederherstellung: Ankündigungsjob deaktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1c06d10916b40cbc

**Any finance user can export another company's tax data**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Finance-Rollenprüfung ist vorhanden. tenant_id stammt jedoch aus dem Request und wird nur als optionaler Abfragefilter verwendet; eine Zuordnung dieses Mandanten zum Benutzer fehlt. Ohne tenant_id werden alle passenden Finanztransaktionen der Region gelesen.

Nachweise:
- supabase/functions/finance-tax-export/index.ts:73-96
- supabase/functions/finance-tax-export/index.ts:104-110

Betroffene Funktionen:
- finance-tax-export

Geplante Korrektur: Exportmandanten serverseitig aus Benutzerberechtigungen bestimmen; fremde und unzulässige leere Mandantenauswahl ablehnen.

Mögliche Auswirkungen: - Mandantenübergreifender Zugriff auf Finanzdaten
- Unberechtigte Steuerexportverarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Finance-Benutzer aus Mandant A darf B und ungefilterten Gesamtexport nicht abrufen.

Wiederherstellung: Steuerexport vorübergehend sperren; bereits erzeugte Exporte überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1faf96e95ce2b494

**Any CMR user can send another account's portal invitation**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: CMR-Rolle wird geprüft, aber der per tokenId gewählte Portalzugang wird ohne Benutzer-Mandantenabgleich privilegiert geladen. Anschließend wird sein customer_email auf die gewählte Zieladresse geändert.

Nachweise:
- supabase/functions/cmr-portal-invite/index.ts:26-56
- supabase/functions/cmr-portal-invite/index.ts:69-85

Betroffene Funktionen:
- cmr-portal-invite

Geplante Korrektur: Berechtigung auf tok.tenant_id und den konkreten Kunden prüfen; Empfängeränderungen gesondert autorisieren.

Mögliche Auswirkungen: - Mandantenfremder Einladungsversand
- Änderung fremder Portal-Kontaktadresse

Vorgesehene Regressionstests (nicht durchgeführt):
- CMR-Benutzer aus A mit tokenId aus B ablehnen; keine E-Mail oder Adressänderung.

Wiederherstellung: Einladungsversand sperren; unberechtigte Kontaktänderungen nachvollziehbar zurücksetzen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_217a6dfc717596f3_f43be5ff

**Anyone can analyze private customer calls**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: call_id wird ohne Authentifizierung verarbeitet. Der Service-Role-Client liest das zugehörige private Transkript ausschließlich anhand der übergebenen ID.

Nachweise:
- supabase/functions/ac-conv-intel-analyze/index.ts:11-20

Betroffene Funktionen:
- ac-conv-intel-analyze

Geplante Korrektur: Identität, Analyseberechtigung und Zugriff auf den konkreten Anruf vor Transkriptzugriff und KI-Verarbeitung prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Gesprächstranskripte

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und mandantenfremden call_id-Zugriff ablehnen; KI-Aufruf darf dabei nicht erfolgen.

Wiederherstellung: Analyseendpunkt sperren; unberechtigt erzeugte Analysen überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_23a279b4a5efc05a

**Anyone can trigger recalculation of customer credit limits**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Analytics-Handler erstellt ohne Aufruferprüfung einen Service-Role-Client und lädt Inkassofälle, Kunden, Kreditlimits und Rechnungen mandantenübergreifend. Schon der geschützte Datenzugriff ist unmittelbar unautorisiert; der vollständige spätere Schreibpfad wurde nicht abschließend gelesen.

Nachweise:
- supabase/functions/collect-analytics/index.ts:19-48

Betroffene Funktionen:
- collect-analytics

Geplante Korrektur: Verifizierte administrative Jobberechtigung vor sämtliche Datenzugriffe setzen und Verarbeitung auf autorisierte Mandanten begrenzen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung geschützter Inkasso- und Kreditdaten
- Behauptete Kreditlimitänderungen zusätzlich nachprüfen

Vorgesehene Regressionstests (nicht durchgeführt):
- Unberechtigten Start vor dem ersten Datenzugriff ablehnen; berechtigten Lauf mandantenscharf prüfen.

Wiederherstellung: Analyticsjob deaktivieren; Kreditlimitänderungen separat abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_28ad318b9fbc4915

**Any signed-in user can approve supplier invoices**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle finance-approval-action-Handler und die Autorisierung des konkret gewählten Genehmigungsschritts wurden nicht vollständig gelesen. Eine Bestätigung anhand der gelieferten Fundstelle allein wäre nicht belastbar.

Nachweise:
- supabase/functions/finance-approval-action/index.ts:80

Betroffene Funktionen:
- finance-approval-action

Geplante Korrektur: Aktuellen Handler, Genehmigerzuordnung und Mandantengrenze prüfen; gegebenenfalls transaktionale Genehmigungsprüfung ergänzen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Rechnungsfreigabe

Vorgesehene Regressionstests (nicht durchgeführt):
- Nicht zugewiesener Benutzer und fremder Mandant dürfen approval_id nicht entscheiden.

Wiederherstellung: Freigabeoperation sperren, falls fehlende Berechtigung bestätigt wird.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_2989a7a085c7a5ca_43adb61f

**Signed-in users can send ETA texts to arbitrary customers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser prüft nur die Identität. route_plan_id wird anschließend per Service Role ohne Dispositionsrolle, Mitarbeiterzuordnung oder Mandantenscope gelesen und die hinterlegte Telefonnummer für den SMS-Versand verwendet.

Nachweise:
- supabase/functions/dispatch-eta-sms/index.ts:42-64
- supabase/functions/dispatch-eta-sms/index.ts:100-107

Betroffene Funktionen:
- dispatch-eta-sms

Geplante Korrektur: Dispositionsberechtigung auf den konkreten Einsatz vor Zugriff und Versand prüfen.

Mögliche Auswirkungen: - Unberechtigte Kunden-SMS
- Missbrauch kostenpflichtiger Kommunikationsdienste

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden route_plan_id trotz gültigem Login ablehnen; berechtigte Disposition zulassen.

Wiederherstellung: ETA-SMS deaktivieren; bereits gesendete Nachrichten sind nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_2d96488747bd90ab

**Unassigned approval states can be decided by any signed-in user**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Zuweisungsprüfung greift nur bei truthy current_approver. Bei NULL darf jeder authentifizierte Benutzer den ausgewählten pending-Zustand ändern und gegebenenfalls das Dokument freigeben.

Nachweise:
- supabase/functions/alixdocs-approval-decide/index.ts:18-46

Betroffene Funktionen:
- alixdocs-approval-decide

Geplante Korrektur: Fehlende Genehmigerzuordnung standardmäßig ablehnen; Rollenfreigaben explizit prüfen und Entscheidung atomar an Zustand und Berechtigung binden.

Mögliche Auswirkungen: - Unberechtigte Freigabe oder Ablehnung fremder Dokumente

Vorgesehene Regressionstests (nicht durchgeführt):
- NULL-Genehmiger, fremder Genehmiger und konkurrierende Entscheidung; jeweils unveränderten Zustand prüfen.

Wiederherstellung: Freigabeentscheidungen sperren; betroffene Entscheidungen fachlich revidieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_321b0bea0163279e

**Any finance user can create records across tenants**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Finanzrolle wird geprüft, nicht jedoch die Berechtigung auf den gewählten collect_cases-Datensatz. Fall und Rechnungspositionen werden ausschließlich über case_id mit Service Role geladen.

Nachweise:
- supabase/functions/collect-document-generate/index.ts:69-99

Betroffene Funktionen:
- collect-document-generate

Geplante Korrektur: Fallmandant und Kundenberechtigung vor Dokumenterstellung, Storagezugriff und optionalem Versand prüfen.

Mögliche Auswirkungen: - Mandantenfremde Verarbeitung von Forderungsdaten
- Unberechtigte Schriftverkehrserstellung

Vorgesehene Regressionstests (nicht durchgeführt):
- Finance-Benutzer aus A darf Fall aus B weder erzeugen noch versenden.

Wiederherstellung: Generator sperren; unberechtigt erzeugte Dokumente gezielt widerrufen oder kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_38dc846b77303b8b

**Anyone can mark QR invoices paid via bank import**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Bankimport besitzt nachweislich nur eine Bearer-Präfixprüfung vor Service-Role-Zugriffen. Der für diesen Befund maßgebliche spätere QR-Rechnungsstatus-Updatepfad und dessen Datensatzbindung wurden jedoch nicht abschließend gelesen.

Nachweise:
- supabase/functions/finance-bank-import/index.ts:31-50

Betroffene Funktionen:
- finance-bank-import

Geplante Korrektur: Authentifizierung und Finanzimportrolle vorziehen; QR-Matching einschließlich Mandant, Konto, Betrag und Statusübergang vollständig prüfen.

Mögliche Auswirkungen: - Bestätigter ungeschützter privilegierter Einstieg
- Behauptetes unberechtigtes Bezahltsetzen noch offen

Vorgesehene Regressionstests (nicht durchgeführt):
- Ungültigen Bearer vor Datenzugriff ablehnen; manipulierte und mandantenfremde QR-Zuordnung prüfen.

Wiederherstellung: Import sperren; Zahlungsstatusänderungen anhand importierter Statements abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3b26108661a79fab

**Anyone can turn signed offers into orders**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler liest signierte Angebote ohne Aufruferprüfung privilegiert nach offer_number. Die tatsächlich ausgelagerte Auftragsanlage createOrderOnce und ihre Autorisierungsabhängigkeiten wurden nicht vollständig gelesen; die Signaturstatusprüfung ist keine Benutzerautorisierung.

Nachweise:
- supabase/functions/convert-signed-offer-to-order/index.ts:1-39

Betroffene Funktionen:
- convert-signed-offer-to-order
- createOrderOnce

Geplante Korrektur: Konvertierungsberechtigung auf Angebot und Kunden vor Zugriff prüfen; order-identity.ts einschließlich Aufrufern vollständig auditieren.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf signierte Angebotsdaten
- Mögliche unberechtigte Auftragsanlage

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und mandantenfremden Konvertierungsversuch ablehnen; berechtigte Konvertierung idempotent prüfen.

Wiederherstellung: Konvertierung sperren; erzeugte Aufträge fachlich prüfen statt pauschal löschen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3e5d7e5d17036bf2

**Anyone can create the Sobitsch account and commission records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der temporäre Handler besitzt keine Aufruferprüfung und führt Auth-Admin-Provisionierung, Profil-Upsert, Aktivierung der Provisionszuordnung und Provisionszuweisungen aus. Das Konto wird zwar gesperrt beziehungsweise inaktiv angelegt; dies verhindert die übrigen unberechtigten Änderungen nicht.

Nachweise:
- supabase/functions/tmp-create-sobitsch/index.ts:8-24
- supabase/functions/tmp-create-sobitsch/index.ts:42-74

Betroffene Funktionen:
- tmp-create-sobitsch

Geplante Korrektur: Temporären Provisionierungsendpunkt entfernen oder ausschließlich als explizit berechtigten, nicht öffentlichen Wartungsjob betreiben.

Mögliche Auswirkungen: - Unberechtigte Kontoprovisionierung
- Unberechtigte Provisionsänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Öffentlichen Aufruf ausschließen; kontrollierten Wartungslauf auf Idempotenz und Änderungsumfang prüfen.

Wiederherstellung: Deployment des Endpunkts deaktivieren; Provisionszuweisungen anhand eines Vorherstands korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3f531b21758d8b2f

**Authorized mail senders can email anyone**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Code enthält mindestens objektbezogene Prüfungen für order_id und customer_id. Die vollständige Mailberechtigung, alle alternativen Versandpfade und die Produktanforderung für freie Korrespondenz wurden nicht gelesen. Frei wählbare Empfänger allein beweisen bei einem berechtigten Mailclient keine kritische Lücke.

Nachweise:
- supabase/functions/send-mail/index.ts:146-148

Betroffene Funktionen:
- send-mail

Geplante Korrektur: Mailrolle, Absenderrechte, Objektpfade und zulässige freie Korrespondenz vollständig abgleichen; nur tatsächlich fehlende Grenzen ergänzen.

Mögliche Auswirkungen: - Potenzieller Mailmissbrauch; legitime freie Korrespondenz möglich

Vorgesehene Regressionstests (nicht durchgeführt):
- Benutzer ohne Mailrecht; fremder Auftrag; zulässige freie Korrespondenz; unzulässiger Absender.

Wiederherstellung: Nur betroffenen Versandpfad sperren; legitime Mailfunktion nicht pauschal entfernen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_43edd4e59b516cae

**Anyone can read customer chats through agent assistance**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: conversation_id wird ohne Identitätsprüfung angenommen. Konversation und letzte Nachrichten werden privilegiert geladen und an die KI gegeben. agent_user_id ist ebenfalls frei vorgebbar und steuert das Speichern von Vorschlägen.

Nachweise:
- supabase/functions/ac-agent-assist-live/index.ts:11-24
- supabase/functions/ac-agent-assist-live/index.ts:36-66

Betroffene Funktionen:
- ac-agent-assist-live

Geplante Korrektur: Konversationszugriff und Agentenrolle prüfen; agent_user_id aus der verifizierten Identität ableiten.

Mögliche Auswirkungen: - Verarbeitung fremder Chatnachrichten
- KI-Kosten
- Fremde Vorschlagseinträge

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme und fremde Konversation ablehnen; Identitäts-Spoofing über agent_user_id verhindern.

Wiederherstellung: Assistenzendpunkt sperren; fremd erzeugte Vorschläge überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_48c15e5c018def20

**No-assignment users can generate all-tenant reminders**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getTenantScope setzt bei einem authentifizierten Benutzer ohne user_tenant_access-Einträge restricted auf false und erlaubt alle aktiven Mandanten. Der Mahnlauf übernimmt diesen Wert und setzt scopedIds auf null. Die Ablehnung leerer eingeschränkter Scopes verhindert diese Fail-open-Konstellation nicht.

Nachweise:
- supabase/functions/_shared/tenant-scope.ts:55-75
- supabase/functions/finance-reminder-engine/index.ts:24-32

Betroffene Funktionen:
- finance-reminder-engine
- getTenantScope

Geplante Korrektur: Keine Zuweisung standardmäßig als keinen Zugriff behandeln; globale Berechtigung explizit über eine privilegierte Rolle abbilden.

Mögliche Auswirkungen: - Mandantenübergreifender Mahnlauf durch Benutzer ohne Zuweisung

Vorgesehene Regressionstests (nicht durchgeführt):
- Benutzer ohne Zuweisung, mit einem Mandanten und mit expliziter globaler Rolle getrennt prüfen.

Wiederherstellung: Mahnlauf deaktivieren; Scope-Korrektur nicht durch Wiederherstellung des Fail-open-Verhaltens zurückrollen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_4e8e8f0051d29984

**Anyone can trigger calendar updates for staff**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Kalendersync nimmt user_id ohne Identitätsprüfung entgegen. Die Providerfunktionen schreiben externe Kalenderereignisse mit gespeicherten OAuth-Berechtigungen; die Benutzer-ID im Request ist kein Berechtigungsnachweis.

Nachweise:
- supabase/functions/esc-calendar-sync/index.ts:62-97
- supabase/functions/esc-calendar-sync/index.ts:100-104

Betroffene Funktionen:
- esc-calendar-sync
- pushToGoogle
- pushToMicrosoft

Geplante Korrektur: Eigene Kalenderidentität oder explizite administrative Jobberechtigung prüfen; Auswahl fremder Benutzer serverseitig begrenzen.

Mögliche Auswirkungen: - Unberechtigte Auslösung externer Kalenderänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Aufruf und fremde user_id ablehnen; eigenen beziehungsweise administrativen Sync zulassen.

Wiederherstellung: Kalendersync stoppen; erzeugte Providerereignisse anhand ihrer Referenzen abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5353120018933fbe

**Signed-in users can change scores on unauthorized offers**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach getUser werden bis zu 25 frei gewählte Angebots-IDs direkt mit Service Role gelesen. Eine Angebots-, Vertriebs- oder Mandantenberechtigung fehlt vor der KI-Verarbeitung. Der spätere Score-Schreibpfad wurde nicht vollständig gelesen.

Nachweise:
- supabase/functions/offers-ai-score/index.ts:25-59

Betroffene Funktionen:
- offers-ai-score

Geplante Korrektur: Alle Angebots-IDs gegen den autorisierten Scope prüfen und nicht autorisierte Stapel vollständig ablehnen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung fremder Angebotsdaten
- KI-Kosten
- Scoreänderungen zusätzlich verifizieren

Vorgesehene Regressionstests (nicht durchgeführt):
- Gemischten Stapel aus eigenen und fremden IDs ohne Teilverarbeitung ablehnen.

Wiederherstellung: Scoring sperren; betroffene Scores aus gesicherter Historie wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_58c64b182fdc8abb_baa3b4af

**Anyone can read and post asset depreciation records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: userClient wird lediglich erzeugt, aber nicht zur Identitätsprüfung verwendet. Alle aktiven Anlagen werden mit Service Role geladen; dry_run ist standardmäßig false und der Code schreibt Abschreibungen.

Nachweise:
- supabase/functions/finance-asset-depreciation-run/index.ts:17-38
- supabase/functions/finance-asset-depreciation-run/index.ts:83-90

Betroffene Funktionen:
- finance-asset-depreciation-run

Geplante Korrektur: Verifizierte Finanzbuchungs- oder Jobberechtigung und Anlagenmandantenscope vor Lesen und Buchen verlangen.

Mögliche Auswirkungen: - Unberechtigte Anlagenverarbeitung
- Unberechtigte Abschreibungsbuchungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Lauf einschließlich dry_run ablehnen; fremden Mandanten ablehnen; berechtigten Lauf idempotent prüfen.

Wiederherstellung: Abschreibungslauf sperren; Buchungen fachlich stornieren und Buchwerte abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5bcfc333ec4f9bc9

**Anyone can post asset depreciation entries**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Vor dem Abschreibungs-Upsert findet keine wirksame Authentifizierung statt. Der angelegte userClient wird nicht abgefragt; der Schreibpfad verwendet admin und wird ohne dry_run explizit ausgeführt.

Nachweise:
- supabase/functions/finance-asset-depreciation-run/index.ts:22-29
- supabase/functions/finance-asset-depreciation-run/index.ts:83-90

Betroffene Funktionen:
- finance-asset-depreciation-run

Geplante Korrektur: Buchungsrolle, Mandant und Periodenberechtigung vor dem Abschreibungs-Upsert prüfen.

Mögliche Auswirkungen: - Unberechtigte Abschreibungsbuchung

Vorgesehene Regressionstests (nicht durchgeführt):
- Nicht authentifizierten und fachfremden Benutzer vor Upsert ablehnen.

Wiederherstellung: Lauf sperren; fehlerhafte Buchungen durch dokumentierte Stornos korrigieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5e9ccda6a9cfe1b0

**CMR users can send portal invites to arbitrary addresses**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach globaler CMR-Rollenprüfung werden to und portalUrl unverändert aus dem Request verwendet. Zusätzlich wird die hinterlegte Portal-Kundenadresse auf to geändert. Es fehlt eine konkrete Empfänger- und Änderungsberechtigung.

Nachweise:
- supabase/functions/cmr-portal-invite/index.ts:31-54
- supabase/functions/cmr-portal-invite/index.ts:60-85

Betroffene Funktionen:
- cmr-portal-invite

Geplante Korrektur: Empfänger aus autorisiertem Kundenkontakt ableiten; URL serverseitig erzeugen; Kontaktänderungen getrennt berechtigen.

Mögliche Auswirkungen: - Missbrauch von Portal-Einladungen
- Unberechtigte Kontaktänderung
- Phishing über vorgegebene URL

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Empfängeradresse und externe portalUrl ablehnen.

Wiederherstellung: Einladungen stoppen; geänderte Kontaktadressen und versendete Links überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_62db31108e6e90e3

**Anyone can use the paid voice-script AI service**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verarbeitet objective ohne Aufruferprüfung und ruft den kostenpflichtigen KI-Dienst auf. Bei contact_id liest er zusätzlich Name, E-Mail, Telefon und Tags per Service Role.

Nachweise:
- supabase/functions/ac-voice-ai-studio/index.ts:9-30
- supabase/functions/ac-voice-ai-studio/index.ts:41-50

Betroffene Funktionen:
- ac-voice-ai-studio

Geplante Korrektur: Voice-Studio-Berechtigung, Kontaktzugriff und benutzerbezogene Quoten vor KI-Aufruf prüfen.

Mögliche Auswirkungen: - Unberechtigte KI-Kosten
- Verarbeitung fremder Kontaktdaten
- Unberechtigte Prediction-Einträge

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Aufruf und fremden Kontakt ablehnen; Quoten und berechtigte Nutzung prüfen.

Wiederherstellung: Studio deaktivieren; unberechtigt erzeugte Predictions prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6708a45359831172

**Finance users can email arbitrary addresses**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Einstieg besitzt eine Benutzerprüfung. Fallautorisierung, zulässige Empfängerabweichungen und die gesamte Weitergabe an send-invoice-mail wurden nicht vollständig gelesen. Freie Empfänger bei berechtigten Finanzmitarbeitern sind ohne diese Prüfung nicht automatisch kritisch.

Nachweise:
- supabase/functions/collect-send-dunning/index.ts:22-26
- supabase/functions/send-invoice-mail/index.ts:120-138

Betroffene Funktionen:
- collect-send-dunning
- send-invoice-mail

Geplante Korrektur: Fall-, Mandanten- und Empfängerberechtigung entlang des internen Aufrufs prüfen; erforderliche Overrides explizit berechtigen.

Mögliche Auswirkungen: - Potenzieller unberechtigter Mahnversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremder Fall, abweichender Empfänger und legitimer Vertreterkontakt.

Wiederherstellung: Betroffenen Mahnversand sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_689b0326e896c2b9

**Anyone can see the collections morning report**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die vollständige Ausgabe des aktuellen Morgenberichts wurde nicht abschließend ausgewertet; Datenumfang, Antwort und mögliche Aufruferprüfung sind daher nicht ausreichend belegt.

Nachweise:
- supabase/functions/collect-morning-report/index.ts:1-94

Betroffene Funktionen:
- collect-morning-report

Geplante Korrektur: Berichtseinstieg, Finanzrolle, Mandantenfilter und Rückgabedaten vollständig prüfen.

Mögliche Auswirkungen: - Potenzielle Offenlegung von Inkassoberichten

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymer, fachfremder und mandantenfremder Abruf.

Wiederherstellung: Berichtsausgabe sperren, falls fehlende Autorisierung bestätigt wird.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6cf979d98c0592e9

**Anyone can access customer records and trigger AI analyses**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: contact_id wird ohne Authentifizierung angenommen. Kontakt, Nachrichten und Anrufe werden privilegiert geladen und als KI-Kontext übertragen.

Nachweise:
- supabase/functions/ac-customer-intel/index.ts:10-32

Betroffene Funktionen:
- ac-customer-intel

Geplante Korrektur: Intelligence-Rolle und konkrete Kontakt-/Mandantenberechtigung vor Datenzugriff prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kundenkommunikation
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme und fremde contact_id vor sämtlichen Abfragen ablehnen.

Wiederherstellung: Intelligence-Endpunkt sperren; erzeugte Analysen prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_718ef6275274a96d

**Anyone can trigger privileged user and commission provisioning**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Derselbe ungeschützte Einstieg führt dieselbe feste Benutzerprovisionierung und dieselben Provisions-Upserts aus wie der referenzierte Befund.

Nachweise:
- supabase/functions/tmp-create-sobitsch/index.ts:8-24
- supabase/functions/tmp-create-sobitsch/index.ts:42-74

Betroffene Funktionen:
- tmp-create-sobitsch

Geplante Korrektur: Gemeinsam mit dem Primärbefund den temporären Provisionierungsendpunkt entfernen oder streng als Wartungsjob schützen.

Mögliche Auswirkungen: - Dieselben Konto- und Provisionsänderungen wie beim Primärbefund

Vorgesehene Regressionstests (nicht durchgeführt):
- Gemeinsame Negativtests für öffentlichen Zugriff und unberechtigte Provisionierung.

Wiederherstellung: Endpunkt deaktivieren; Änderungen gezielt abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_3e5d7e5d17036bf2.

### lov_finding_74e43b7ec94e2367_821fd4e7

**Any signed-in user can export another customer's records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine Kunden-Scope-Prüfung existiert tatsächlich vor dem Dokumentdownload. Sie ist jedoch für Benutzer ohne Mandantenzuweisung wirkungslos: getTenantScope setzt restricted=false, und customerInScope gibt dann sofort true zurück. Anschließend werden sämtliche Kundendokumente privilegiert exportiert.

Nachweise:
- supabase/functions/alixdocs-customer-export/index.ts:25-56
- supabase/functions/_shared/tenant-scope.ts:55-75
- supabase/functions/_shared/tenant-scope.ts:96-103

Betroffene Funktionen:
- alixdocs-customer-export
- getTenantScope
- customerInScope

Geplante Korrektur: Scope ohne Zuweisung schließen und eigenständige Kundenexportberechtigung verlangen.

Mögliche Auswirkungen: - Komplettexport fremder Kundendokumente durch Benutzer ohne Zuweisung

Vorgesehene Regressionstests (nicht durchgeführt):
- Benutzer ohne Zuweisung darf keine fremden Kunden exportieren; zugewiesene Benutzer nur ihren Scope.

Wiederherstellung: Kundenexport sperren; erzeugte Downloadartefakte widerrufen, soweit vorhanden.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7663c8dfc8cfd611_1e2b5c22

**Anyone can create recurring customer invoices**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Abrechnungslauf liest frei gewählte planId und tenantId ohne Aufruferprüfung und selektiert wiederkehrende Pläne per Service Role. planId umgeht zudem die Fälligkeitsauswahl; eine Berechtigung auf den Plan fehlt.

Nachweise:
- supabase/functions/cmr-recurring-run/index.ts:25-41

Betroffene Funktionen:
- cmr-recurring-run

Geplante Korrektur: Verifizierte Jobidentität oder berechtigte CMR-Abrechnungsrolle mit konkretem Mandantenscope verlangen; manuelle Planläufe gesondert autorisieren.

Mögliche Auswirkungen: - Unberechtigte Auslösung der wiederkehrenden Abrechnung

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Lauf und fremde planId ablehnen; vorzeitigen manuellen Lauf nur explizit berechtigt zulassen.

Wiederherstellung: Abrechnungslauf stoppen; erzeugte Belege fachlich stornieren statt löschen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7845d0d7721ae86a

**Anyone can send arbitrary push messages to selected users**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler prüft nur VAPID-Konfiguration und Eingabeformat. Frei gewählte user_ids beziehungsweise role bestimmen privilegiert geladene Push-Abonnements; eine Aufrufer- oder Empfängerberechtigung fehlt.

Nachweise:
- supabase/functions/mobile-push-send/index.ts:34-74

Betroffene Funktionen:
- mobile-push-send

Geplante Korrektur: Push-Senderrolle und erlaubten Empfängerscope vor Abonnementzugriff und Versand prüfen.

Mögliche Auswirkungen: - Unberechtigte Push-Nachrichten an ausgewählte Beschäftigte

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und fachfremden Versand sowie fremden Empfängerscope ablehnen.

Wiederherstellung: Push-Versand sperren; bereits zugestellte Push-Nachrichten sind nicht zuverlässig rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_80694480687b8731

**Anyone can trigger internal ticket alerts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Alarmhandler startet unmittelbar mit Service Role und übernimmt eine optionale lookback_minutes-Auswahl ohne Identitätsprüfung. Ein konfigurierter Empfänger und Cooldown begrenzen Auswirkungen, ersetzen aber keine Jobberechtigung.

Nachweise:
- supabase/functions/ticket-sync-alert/index.ts:11-16
- supabase/functions/ticket-sync-alert/index.ts:47-60

Betroffene Funktionen:
- ticket-sync-alert

Geplante Korrektur: Verifizierte Job- oder administrative Syncberechtigung vor Logzugriff verlangen; Lookback begrenzen.

Mögliche Auswirkungen: - Unberechtigte Auslösung interner Ticketalarmverarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Start ablehnen; berechtigten Job und begrenztes Lookback prüfen.

Wiederherstellung: Alarmjob deaktivieren; Cooldown-Zustände gezielt prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_86a979bd8688c2a0

**CMR users can send arbitrary invoice emails to any address**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: CMR-Rolle wird geprüft, aber documentId wird danach ohne Benutzer-Mandantenabgleich per Service Role gelesen. Empfänger, Betreff, Nachricht und PDF-Inhalt stammen aus dem Request; das Versandprotokoll wird dem gewählten fremden Beleg zugeordnet.

Nachweise:
- supabase/functions/cmr-send-document/index.ts:26-71
- supabase/functions/cmr-send-document/index.ts:85-90

Betroffene Funktionen:
- cmr-send-document

Geplante Korrektur: Belegmandant und Versandrecht prüfen; PDF serverseitig aus dem autorisierten Beleg erzeugen und Empfängeroverrides gesondert berechtigen.

Mögliche Auswirkungen: - Mandantenfremder Belegversand
- Fremde Versandprotokolle
- Missbrauch der Unternehmensidentität

Vorgesehene Regressionstests (nicht durchgeführt):
- CMR-Benutzer mit fremdem documentId und manipuliertem PDF ablehnen.

Wiederherstellung: Belegversand sperren; fehlerhafte Protokolle kennzeichnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8703f96241dee35e_aec296a4

**Any signed-in user can send another customer's ticket details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler authentifiziert den Benutzer, lädt ticket_id aber anschließend ohne Objektberechtigung mit Service Role. source_system=alixsmart ist lediglich eine fachliche Herkunftsprüfung. Eine optionale message_id wird außerdem unabhängig von ticket_id gelesen.

Nachweise:
- supabase/functions/sync-to-alixsmart/index.ts:46-90

Betroffene Funktionen:
- sync-to-alixsmart

Geplante Korrektur: Syncberechtigung auf das konkrete Ticket prüfen; message_id zwingend an dasselbe autorisierte Ticket binden.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung fremder Tickets
- Mögliche ticketübergreifende Nachrichtenübernahme

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremdes Ticket und Nachricht aus anderem Ticket ablehnen.

Wiederherstellung: Externen Sync sperren; betroffene externe Übertragungen abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_89bba568925256f2_166f7873

**Anyone can trigger playbook execution accessing customer data**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Einstieg prüft keine Identität und übernimmt playbook_id sowie customer_id nur als Filter. Aktive Playbooks und Kunden-Health-Daten werden privilegiert geladen; runAction kann unmittelbar E-Mail, SMS und WhatsApp auslösen.

Nachweise:
- supabase/functions/ac-playbook-run/index.ts:19-54
- supabase/functions/ac-playbook-run/index.ts:82-109

Betroffene Funktionen:
- ac-playbook-run
- runAction

Geplante Korrektur: Verifizierte Jobidentität oder administrative Playbookberechtigung mit Kundenscope verlangen.

Mögliche Auswirkungen: - Unberechtigte Automationsausführung
- Externe Kundenkommunikation
- Verarbeitung geschützter Kundendaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Start und fremde customer_id ablehnen; externe Dienste nur mocken.

Wiederherstellung: Playbookjob deaktivieren; erzeugte Aktionen anhand der Laufprotokolle abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8ac8ea7d48393f28

**Anyone can enroll another customer in a journey**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Kontaktladung und externe Journey-Aktionen wurden gelesen, der konkrete Einschreibungs-Einstieg jedoch nicht abschließend. Die behauptete unberechtigte Anlage eines Journey-Runs ist deshalb nicht vollständig belegt.

Nachweise:
- supabase/functions/ac-journey-run/index.ts:29-31
- supabase/functions/ac-journey-run/index.ts:50-85

Betroffene Funktionen:
- ac-journey-run
- loadContact
- runAction

Geplante Korrektur: Einschreibungs- und Tick-Einstiege einschließlich Jobauthentifizierung, Kontakt- und Journeyberechtigung vollständig prüfen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Einschreibung und Kundenkommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme Einschreibung und fremden Kontakt ablehnen; berechtigten Tick simulieren.

Wiederherstellung: Journey-Ausführung pausieren; fremde Runs gezielt abbrechen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9260563e406937fe

**Bank statement import trusts any Bearer header**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die einzige Aufruferprüfung ist startsWith('Bearer '). Der Token wird nicht verifiziert. Danach werden mit Service Role vorhandene Notifications gelesen und neue Bankmeldungen einschließlich raw_xml gespeichert.

Nachweise:
- supabase/functions/finance-camt054-import/index.ts:21-57

Betroffene Funktionen:
- finance-camt054-import

Geplante Korrektur: Token verifizieren, Bankimportrolle und Kontomandant prüfen; beliebige Bearer-Zeichenfolgen ablehnen.

Mögliche Auswirkungen: - Unberechtigter Bankdatenimport
- Unberechtigter Zugriff auf Importmetadaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen Bearer und fachfremden Benutzer vor Datenzugriff ablehnen.

Wiederherstellung: Import sperren; eingefügte Notifications und abhängige Zuordnungen abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_98051a4a477129d7

**Any signed-in user can request signatures on others' documents**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach getUser wird das frei gewählte Dokument ohne Objektprüfung privilegiert geladen. Seine private PDF-Version wird kopiert und für einen frei gewählten signer_email ein Signaturvorgang angelegt.

Nachweise:
- supabase/functions/alixdocs-sign-request/index.ts:18-59

Betroffene Funktionen:
- alixdocs-sign-request

Geplante Korrektur: Leserecht und Signaturanforderungsrecht auf das konkrete Dokument sowie zulässige Unterzeichner prüfen.

Mögliche Auswirkungen: - Unberechtigte Nutzung fremder PDF-Dokumente
- Unberechtigte Signaturvorgänge

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremdes document_id ablehnen; keine Storagekopie oder Signaturzeile bei Ablehnung.

Wiederherstellung: Signaturbrücke sperren; unberechtigte Requests widerrufen und Kopien bereinigen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9a2e7a4d1dc3c9a6

**Anyone can inspect product catalog and validation reports**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Validierungseinstieg besitzt vor den Service-Role-Abfragen keine Identitäts- oder Katalogberechtigungsprüfung. Produkte, Medien, Dokumente und Konflikte werden global geladen. In diesem gelesenen Einstieg liegt keine controlled_modes-Sperre vor der Operation.

Nachweise:
- supabase/functions/product-hub-validate/index.ts:76-103

Betroffene Funktionen:
- product-hub-validate

Geplante Korrektur: Product-Hub-Prüfberechtigung vor sämtlichen Katalog- und URL-Zugriffen erzwingen; Berichte nach Berechtigung begrenzen.

Mögliche Auswirkungen: - Unberechtigte Katalog- und Konfliktverarbeitung
- Serverseitige URL-Prüfungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und fachfremden Benutzer vor erster Abfrage ablehnen; erlaubten Prüfer zulassen.

Wiederherstellung: Validierungsendpunkt sperren; Betriebsmodus-Sperren gegebenenfalls zusätzlich beibehalten.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9fcacb28cc4c5d46

**Public importer leaks key to caller-chosen URLs**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: endpoint beziehungsweise source_url wird ohne Aufruferprüfung aus dem Body übernommen und an fetchSource gegeben. fetchSource sendet den serverseitigen Quellschlüssel als x-api-key an genau diesen Endpunkt. Vor diesem Fetch ist keine controlled_modes-Sperre vorhanden.

Nachweise:
- supabase/functions/product-hub-import/index.ts:119-143

Betroffene Funktionen:
- product-hub-import
- fetchSource

Geplante Korrektur: Importberechtigung verlangen; Ziel-URL serverseitig festlegen beziehungsweise streng erlaubnislisten; Redirects zu nicht erlaubten Hosts verhindern; betroffenen Schlüssel nach Absicherung rotieren.

Mögliche Auswirkungen: - Abfluss eines serverseitigen Quellschlüssels
- Serverseitige Requests an frei gewählte Ziele
- Unberechtigter Importzugriff

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Host und hostwechselnden Redirect ohne echten Schlüssel oder Netzwerkaufruf ablehnen.

Wiederherstellung: Importer deaktivieren; Schlüsselrotation nicht rückgängig machen; nur abgesicherten Zielhost freigeben.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a42c392d5c8dd1fd

**Anyone can trigger Swiss payment reconciliation**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der CH-Abgleich prüft nur das Bearer-Präfix. Ohne Tokenverifizierung oder Finanzrolle werden offene Schweizer Bankzeilen mit Service Role geladen und für QR-Matching verarbeitet.

Nachweise:
- supabase/functions/finance-ch-reconcile/index.ts:33-57

Betroffene Funktionen:
- finance-ch-reconcile

Geplante Korrektur: Verifizierte Finanzabgleichs- oder Jobberechtigung und Kontomandantenscope vor Verarbeitung verlangen.

Mögliche Auswirkungen: - Unberechtigte Zahlungsabgleichsverarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen Bearer, fachfremden Benutzer und fremden Kontomandanten ablehnen.

Wiederherstellung: Abgleich stoppen; erzeugte Zahlungszuordnungen fachlich prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a7401cb3c80f2da9

**Any signed-in user can add internal notes to tickets**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Client wird zwar mit Service-Key erzeugt, erhält aber den Benutzer-Authorization-Header als globalen Header. Deshalb darf ein RLS-Bypass nicht allein aus dem Schlüssel abgeleitet werden. Der Insert in ticket_messages wurde gelesen; die tatsächlich wirksamen INSERT-Policies und Ticketzuordnungen wurden nicht vollständig geprüft.

Nachweise:
- supabase/functions/mobile-voice-transcribe/index.ts:19-26
- supabase/functions/mobile-voice-transcribe/index.ts:49-52

Betroffene Funktionen:
- mobile-voice-transcribe

Geplante Korrektur: Wirksame Benutzeridentität und ticket_messages-INSERT-Policies prüfen; falls nötig explizite Ticket-Schreibberechtigung vor Transkription und Insert ergänzen.

Mögliche Auswirkungen: - Potenzielles Schreiben interner Notizen in fremde Tickets

Vorgesehene Regressionstests (nicht durchgeführt):
- Mit Benutzer-JWT Insert auf fremdes Ticket unter den aktuellen RLS-Policies prüfen.

Wiederherstellung: Optionales Schreiben von Ticketnotizen deaktivieren; Transkription separat behandeln.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_aaa4d2aa58de11e4_c6e24d62

**Signed-in callers can recalculate any tour**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Identitätsprüfung und privilegierte Tourenänderungen wurden lokalisiert. Der vollständige Kontrollfluss zwischen Claimsprüfung, Tourauswahl und Updates wurde jedoch nicht abschließend gelesen; eine konkrete Zuordnungsprüfung darf deshalb weder angenommen noch ausgeschlossen werden.

Nachweise:
- supabase/functions/delivery-route-calc/index.ts:210-253
- supabase/functions/delivery-route-calc/index.ts:379-421

Betroffene Funktionen:
- delivery-route-calc

Geplante Korrektur: Tourenrolle, Mandant und Tourzuordnung entlang des vollständigen Berechnungspfads prüfen.

Mögliche Auswirkungen: - Potenzielle Änderung fremder Touren und Stopps

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Tour trotz gültiger Identität ablehnen; keinerlei Teilupdates.

Wiederherstellung: Neuberechnung sperren; letzte freigegebene Tourplanung wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_aca0bf1eb36bddcc

**Any signed-in user can access another order’s review token**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der normale Pfad prüft nur Claims und lädt fremd wählbare order_id mit Service Role. manual=true verlangt zwar Super Admin, manual=false jedoch nicht. Der spätere Pfad zur Rückgabe eines vorhandenen Reviewtokens wurde nicht abschließend gelesen.

Nachweise:
- supabase/functions/send-review-invitation/index.ts:22-69

Betroffene Funktionen:
- send-review-invitation

Geplante Korrektur: Auftragsberechtigung unabhängig von manual prüfen; vorhandene Tokens niemals ohne dieselbe Objektberechtigung zurückgeben.

Mögliche Auswirkungen: - Bestätigter ungeschützter Objektzugriff nach Login
- Behauptete Reviewtoken-Offenlegung noch offen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde order_id mit manual=false und true sowie vorhandenen Revieweintrag prüfen.

Wiederherstellung: Einladungsfunktion sperren; betroffene Reviewtokens gegebenenfalls rotieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b0851d9805f11435

**Anyone can guess links to customer invoices**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die aktuelle Token-Erzeugung, spätere mögliche Korrekturen und der od-download-Prüfpfad einschließlich Ablauf, Rate-Limits und Zugriffskontrolle wurden nicht vollständig gelesen. Der gelieferte Hinweis auf 40 Bit allein reicht nicht für eine aktuelle Kritikalitätsbestätigung.

Nachweise:
- src/components/AzInvoiceTab.tsx:891

Betroffene Funktionen:
- AzInvoiceTab.sendByEmail
- od-download

Geplante Korrektur: Alle Tokenproduzenten und den Downloadkonsumenten prüfen; bei bestätigter Kürzung mindestens 128 Bit zufällige Tokens mit Ablauf und Widerruf einsetzen.

Mögliche Auswirkungen: - Potenzielle Erratbarkeit privater Rechnungslinks

Vorgesehene Regressionstests (nicht durchgeführt):
- Tokenentropie, Alt-Tokens, Ablauf, Widerruf und Begrenzung erfolgloser Abrufe prüfen.

Wiederherstellung: Betroffene öffentliche Downloads sperren; schwache Alt-Tokens nicht wieder aktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b4dbe8c9ecfd794e_659534c3

**Anyone can add bank activity to your finance records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Beliebige Bearer-Zeichenfolgen bestehen die einzige Prüfung. Anschließend wird über den privilegierten Client eine finance_camt054_notifications-Zeile mit vom Aufrufer geliefertem XML angelegt.

Nachweise:
- supabase/functions/finance-camt054-import/index.ts:21-30
- supabase/functions/finance-camt054-import/index.ts:47-57

Betroffene Funktionen:
- finance-camt054-import

Geplante Korrektur: Authentifizierung, Bankimportrolle und Kontomandant prüfen; unberechtigte Eingaben vor dem Insert ablehnen.

Mögliche Auswirkungen: - Unberechtigte dauerhafte Bankmeldungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Ungültiger Bearer darf keine Notification erzeugen; berechtigter Import bleibt idempotent.

Wiederherstellung: Import stoppen; manipulierte Notifications und Folgezuordnungen gezielt zurücknehmen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b740221af1bd20a5

**Any signed-in user can export debit instructions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser prüft die Identität. Danach wird jedoch ein separater uneingeschränkter admin-Client erstellt, der run_id sowie zugehörige Positionen einschließlich Mandaten ohne Rollen- oder Mandantenprüfung lädt.

Nachweise:
- supabase/functions/finance-sepa-export/index.ts:12-31

Betroffene Funktionen:
- finance-sepa-export

Geplante Korrektur: SEPA-Exportrecht und Berechtigung auf den konkreten Laufmandanten prüfen, bevor Mandats- und Bankdaten geladen werden.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung von Lastschrift- und Mandatsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Fachfremden Benutzer und fremde run_id ablehnen; autorisierten Export zulassen.

Wiederherstellung: SEPA-Export sperren; erzeugte Exportartefakte überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ba12e323f71e0fa4

**Signed-in users can send return details to arbitrary addresses**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach getUser wird return_id ohne Objekt- oder Mandantenprüfung mit Service Role geladen. Die Zieladresse stammt frei aus body.email; die Syntaxprüfung ersetzt keine Berechtigung auf die Retourendaten.

Nachweise:
- supabase/functions/return-note-send/index.ts:41-58

Betroffene Funktionen:
- return-note-send

Geplante Korrektur: Retourenberechtigung auf den konkreten Datensatz prüfen und Empfängeroverrides explizit autorisieren.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung fremder Retourendaten
- Potenzieller Versand an fremde Adressen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde return_id und nicht autorisierte Zieladresse ablehnen.

Wiederherstellung: Retourenversand deaktivieren; bereits gesendete Inhalte sind nicht rückholbar.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_bb420b3953e6ab20

**Anyone can recompute health scores from customer records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Scoringhandler nimmt ohne Identitätsprüfung einen Lauf entgegen und lädt Kunden, Aufträge, offene Rechnungen, Nachrichten und Kontaktsignale mit Service Role. Der Zugriff wird lediglich mengenmäßig begrenzt, nicht autorisiert.

Nachweise:
- supabase/functions/ac-health-score/index.ts:17-34

Betroffene Funktionen:
- ac-health-score

Geplante Korrektur: Verifizierte Jobberechtigung oder Health-Scoringrolle mit Mandantenscope verlangen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung mandantenübergreifender Kundensignale

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen Start vor der ersten Abfrage ablehnen; berechtigten Lauf auf Mandantentrennung prüfen.

Wiederherstellung: Scoringjob sperren; erzeugte Scores bei Bedarf neu berechnen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c1970a6abcb44913

**Anyone can access and add your bank statement records**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: finance-bank-import verifiziert keinen Benutzer, sondern nur das Bearer-Präfix. Bereits die Suche nach vorhandenem file_hash und die Rückgabe von statement_id und Zählern erfolgen mit Service Role ohne Konto- oder Mandantenberechtigung.

Nachweise:
- supabase/functions/finance-bank-import/index.ts:31-52

Betroffene Funktionen:
- finance-bank-import

Geplante Korrektur: Verifizierte Importidentität, Finanzrolle und Berechtigung auf Bankkonto und Mandant vor Deduplizierung und Speicherung prüfen.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Bankimportmetadaten
- Ungeschützter privilegierter Importpfad

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen Bearer vor Hashsuche ablehnen; fremden Kontomandanten ablehnen.

Wiederherstellung: Bankimport sperren; betroffene Importsätze und Zuordnungen fachlich abgleichen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c3733d2c215fc774

**Anyone can change another user's document matches**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Smart-Match-Handler, seine Dokumentauswahl und der konkrete Updatepfad wurden nicht abschließend gelesen. Eine Aussage über aktuelle Dokumentberechtigungen wäre spekulativ.

Nachweise:
- supabase/functions/alixdocs-smart-match/index.ts:1-275

Betroffene Funktionen:
- alixdocs-smart-match

Geplante Korrektur: Alle Modi und Schreibpfade einschließlich Dokument-, Kunden- und Mandantenzuordnung prüfen.

Mögliche Auswirkungen: - Potenzielle Änderung fremder Dokumentzuordnungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Dokument-ID und mandantenfremde Matchziele in jedem Modus prüfen.

Wiederherstellung: Schreibende Matchmodi sperren; Zuordnungen aus Historie wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c5b0e3d6a8f2e774

**Anyone can download finance transactions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der DATEV-Export akzeptiert jede Zeichenfolge mit Bearer-Präfix. Danach liest er Finanztransaktionen und Kundennamen per Service Role, begrenzt nur durch frei gewählten Zeitraum und Region; eine Benutzer-, Rollen- oder Mandantenprüfung fehlt.

Nachweise:
- supabase/functions/finance-datev-export/index.ts:19-43

Betroffene Funktionen:
- finance-datev-export

Geplante Korrektur: Benutzer authentifizieren, DATEV-Exportrecht verlangen und erlaubte Mandanten serverseitig filtern.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Finanztransaktionen und Kundenzuordnungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Beliebigen Bearer, fachfremde Rolle und fremden Mandanten vor Abfrage ablehnen.

Wiederherstellung: DATEV-Export deaktivieren; bereits erzeugte Dateien überprüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_cc69b9a46e5b7c7e

**Anyone can trigger playbook execution accessing customer data**

Bewertung: Technisch zugeordnete Doppelmeldung.

Technische Ursache: Beide Befunde betreffen denselben nicht authentifizierten Deno.serve-Einstieg, dieselbe Auswahl aktiver Playbooks und dieselbe runAction-Ausführung für Kundendaten.

Nachweise:
- supabase/functions/ac-playbook-run/index.ts:19-54
- supabase/functions/ac-playbook-run/index.ts:82-109

Betroffene Funktionen:
- ac-playbook-run
- runAction

Geplante Korrektur: Gemeinsam mit dem Primärbefund Job- und Kundenscope-Autorisierung ergänzen.

Mögliche Auswirkungen: - Dieselbe unberechtigte Playbook- und Kommunikationsausführung

Vorgesehene Regressionstests (nicht durchgeführt):
- Gemeinsame Negativtests für anonymen Start und fremde Kunden.

Wiederherstellung: Playbookjob deaktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: lov_finding_89bba568925256f2_166f7873.

### lov_finding_d30e657eadd449e2

**Anyone can submit stored call transcripts for analysis**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der konkrete Transkriptzugriff erfolgt mit Service Role allein anhand der vom Request gelieferten call_id. Davor gibt es weder Identitäts- noch Anrufberechtigungsprüfung.

Nachweise:
- supabase/functions/ac-conv-intel-analyze/index.ts:11-20

Betroffene Funktionen:
- ac-conv-intel-analyze

Geplante Korrektur: Analyse- und Anrufberechtigung vor Transkriptzugriff erzwingen; zugehörigen KI-Pfad mit derselben Prüfung schützen.

Mögliche Auswirkungen: - Unberechtigte Nutzung gespeicherter Gesprächstranskripte

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und fremden call_id-Zugriff vor Abfrage und KI-Verarbeitung ablehnen.

Wiederherstellung: Gesprächsanalyse sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d56fcb31625300b3

**Anyone can retrieve private call transcripts**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die Hilfsfunktionen für Audioabruf, Transkription und KI-Analyse wurden gelesen. Der eigentliche Request-Einstieg und die Rückgabe privater Transkripte wurden nicht abschließend ausgewertet.

Nachweise:
- supabase/functions/ac-call-ai-process/index.ts:12-37

Betroffene Funktionen:
- ac-call-ai-process
- transcribe
- analyze

Geplante Korrektur: Request-Einstieg, Anrufautorisierung, Recording-URL-Herkunft und Rückgabedaten vollständig prüfen.

Mögliche Auswirkungen: - Potenzielle Offenlegung oder unberechtigte Verarbeitung privater Transkripte

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und fremden Anrufzugriff prüfen; Audio- und KI-Dienste mocken.

Wiederherstellung: Transkriptionsendpunkt sperren, falls fehlende Anrufberechtigung bestätigt wird.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d788ed2671203a5e

**Any signed-in user can text another team's case details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der authentifizierte Benutzer wird nicht mit dem per case_id geladenen After-Sales-Fall abgeglichen. recipient_phone und custom_text sind zusätzlich frei vorgebbar; der Kundenname aus dem fremden Fall wird in die Nachricht eingesetzt.

Nachweise:
- supabase/functions/as-send-sms-reminder/index.ts:63-91
- supabase/functions/as-send-sms-reminder/index.ts:98-102

Betroffene Funktionen:
- as-send-sms-reminder

Geplante Korrektur: Team- und Mandantenzugriff auf den Fall sowie Berechtigung für Empfänger- und Textoverride prüfen.

Mögliche Auswirkungen: - Offenlegung fremder Falldetails per SMS
- Unberechtigter SMS-Versand

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremden Teamfall und externe recipient_phone ohne Override-Recht ablehnen.

Wiederherstellung: SMS-Versand sperren; Kommunikationshistorie prüfen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d9dbde1372d10aa0_da1f1b29

**Anyone can recalculate a private credit assessment**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Kreditscoring-Einstieg, die Auswahl der betroffenen Bonitätsakte und sämtliche Schreibpfade wurden nicht abschließend gelesen.

Nachweise:
- supabase/functions/credit-score-calculate/index.ts:1-223

Betroffene Funktionen:
- credit-score-calculate

Geplante Korrektur: Bonitätsrolle, konkrete Kunden-/Aktenberechtigung und Mandantenscope entlang aller Modi prüfen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Neuberechnung privater Bonitätsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymer, fachfremder und mandantenfremder Scoringaufruf.

Wiederherstellung: Neuberechnung sperren; betroffene Scores aus fachlich validierten Daten neu erzeugen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_dbd4ea3dfc6fc0db

**Any signed-in user can overwrite another user's document**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Upload- und Überschreibpfad einschließlich Dokumentauswahl, Versionsanlage und Storageautorisierung wurde nicht abschließend gelesen. Eine fremde Dokumentüberschreibung ist deshalb noch nicht belegt.

Nachweise:
- supabase/functions/alixdocs-upload/index.ts:1-167

Betroffene Funktionen:
- alixdocs-upload

Geplante Korrektur: Neuanlage und Versionsupload getrennt prüfen; vorhandene document_id vor Storage- und Metadatenänderungen auf Schreibrecht prüfen.

Mögliche Auswirkungen: - Potenzielle Überschreibung fremder Dokumente

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde document_id, manipulierten Storagepfad und parallelen Versionsupload prüfen.

Wiederherstellung: Überschreibmodus sperren; letzte gültige Dokumentversion wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e0f5db0abd0fbc9a

**CMR users can send any customer's portal token**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die fehlende Tokenzeilen-/Mandantenprüfung ist bestätigt. Die spezifische Behauptung, der Handler lese und versende selbst den geheimen Portalzugangstoken, trifft im gelesenen Code jedoch nicht unmittelbar zu: Der versendete Link stammt aus body.portalUrl. Der Aufruferpfad, der diesen Link erzeugt oder offenlegt, wurde nicht geprüft.

Nachweise:
- supabase/functions/cmr-portal-invite/index.ts:38-64
- supabase/functions/cmr-portal-invite/index.ts:85

Betroffene Funktionen:
- cmr-portal-invite

Geplante Korrektur: Linkerzeugung und Tokenzugriff beim Aufrufer prüfen; Portal-URL serverseitig aus einem autorisierten Token erzeugen.

Mögliche Auswirkungen: - Bestätigter unberechtigter Einladungs-/Kontaktänderungspfad
- Spezifischer Tokenabfluss noch nicht bewiesen

Vorgesehene Regressionstests (nicht durchgeführt):
- Nachweisen, ob ein Benutzer den fremden Portal-Link erhalten kann; fremde tokenId unabhängig davon ablehnen.

Wiederherstellung: Portal-Einladungen sperren; nachweislich offengelegte Tokens rotieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e82b9976fc58ba0b

**Any signed-in user can change delivery routes**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Claimsprüfung und privilegierte Updates von Touren und Stopps wurden lokalisiert, aber der vollständige Auswahl- und Autorisierungspfad nicht gelesen. Eine Zusammenlegung mit dem anderen Tourenbefund wird ohne Nachweis derselben konkreten Operation nicht vorgenommen.

Nachweise:
- supabase/functions/delivery-route-calc/index.ts:210-253
- supabase/functions/delivery-route-calc/index.ts:336-421

Betroffene Funktionen:
- delivery-route-calc

Geplante Korrektur: Konkrete Tourauswahl, Mitarbeiterzuordnung und Mandantenscope vor allen Teilupdates vollständig prüfen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Tourenänderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Fremde Tour, fremde Stopps und unberechtigten Benutzer ohne Teilupdates ablehnen.

Wiederherstellung: Tourenneuberechnung sperren; vorherige freigegebene Planung zurückspielen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e9b23515a9652ef7

**Anyone can score protected collection cases**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle collect-ai-score-Einstieg und die Auswahl der geschützten Inkassofälle wurden nicht abschließend ausgewertet. Fehlende Authentifizierung wird nicht allein aus dem Befundtext übernommen.

Nachweise:
- supabase/functions/collect-ai-score/index.ts:1-114

Betroffene Funktionen:
- collect-ai-score

Geplante Korrektur: Identität, Inkassorolle und Berechtigung auf jeden ausgewählten Fall vor KI-Aufruf und Scoreänderung prüfen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Verarbeitung von Inkassofällen
- Potenzielle KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymer, fachfremder und mandantenfremder Fallzugriff; gemischte Stapel.

Wiederherstellung: Scoring sperren; betroffene Scores anhand fachlich validierter Daten erneuern.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ef43972ba6ab93b7_47ca5b03

**Unauthenticated requests execute the admin-only outreach queue**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Outreach-Einstieg und die tatsächliche administrative Queue-Autorisierung wurden nicht abschließend gelesen. Vorhandene gemeinsame Jobauthentifizierung darf nicht ohne Prüfung ihres konkreten Call-Sites als wirksam angenommen werden.

Nachweise:
- supabase/functions/ac-outreach-engine/index.ts:1-91
- supabase/functions/_shared/job-auth.ts:12-37

Betroffene Funktionen:
- ac-outreach-engine

Geplante Korrektur: Konkreten requireJobAccess-Aufruf beziehungsweise dessen Fehlen sowie Queueauswahl und Versandkette prüfen.

Mögliche Auswirkungen: - Potenzielle unberechtigte Ausführung der Outreach-Warteschlange

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und nicht administrativen Start vor Queue-Lesen und Versand ablehnen.

Wiederherstellung: Outreach-Worker pausieren; bereits beanspruchte Queueeinträge kontrolliert freigeben.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_f0b428fcfe8c9417_0b92b853

**Anyone can send test emails to any address**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Selftest-Einstieg und mögliche inzwischen ergänzte Zugriffsprüfungen wurden nicht abschließend gelesen. Der im Eingangsbefund genannte Versandaufruf genügt nicht zum Nachweis aktueller öffentlicher Erreichbarkeit.

Nachweise:
- supabase/functions/email-selftest/index.ts:58-69

Betroffene Funktionen:
- email-selftest

Geplante Korrektur: Aktuelle Selftest-Autorisierung prüfen; gegebenenfalls auf Administratoren und verifizierte Testempfänger begrenzen.

Mögliche Auswirkungen: - Potenzieller unberechtigter Testmailversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonymen und fachfremden Benutzer sowie nicht erlaubten Testempfänger prüfen.

Wiederherstellung: Selftest-Endpunkt deaktivieren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_f54ab7127848f856

**Anyone can look up customer details by device serial**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der aktuelle Seriennummern-Einstieg, Kundendatenumfang und die zugehörigen Rollen-/Mandantenprüfungen wurden nicht abschließend gelesen.

Nachweise:
- supabase/functions/lager-bestand-notify/index.ts:1-105

Betroffene Funktionen:
- lager-bestand-notify

Geplante Korrektur: Seriennummernsuche, Geräte-/Kundenberechtigung und Benachrichtigungspfad vollständig prüfen; Datenumfang minimieren.

Mögliche Auswirkungen: - Potenzielle Offenlegung von Kundendaten anhand einer Geräteseriennummer

Vorgesehene Regressionstests (nicht durchgeführt):
- Anonyme Suche und fremde Seriennummer bei gültigem Login prüfen; Enumeration begrenzen.

Wiederherstellung: Kundenbezogene Seriennummernausgabe sperren.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_01b05992862b294b

**Anyone can change a user's password**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der HTTP-Handler erzeugt ohne vorgelagerte Identitäts- oder Rollenprüfung einen Service-Client, sucht ein festes Konto und setzt dessen Passwort auf einen im Quelltext festgelegten Wert. Die Gateway-Quellkonfiguration deaktiviert zusätzlich die JWT-Prüfung. Ein legitimer externer Aufrufer wurde nicht gefunden; das schützt den direkten Handler nicht.

Nachweise:
- supabase/functions/admin-reset-jerry/index.ts:8-20
- supabase/config.toml:52-53

Betroffene Funktionen:
- admin-reset-jerry

Geplante Korrektur: Einmal-Reset-Handler entfernen beziehungsweise sperren; betroffenes Kennwort und Sitzungen kontrolliert erneuern; administrative Wiederherstellung ausschließlich über einen autorisierten, protokollierten Prozess.

Mögliche Auswirkungen: - Kontoübernahme des fest hinterlegten Kontos

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_04b7323c4231ec65

**Anyone can trigger the privileged Swiss order import**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler prüft nur, ob nach Bearer-Entfernung ein nichtleerer String übrig bleibt; eine Identitäts- oder Importberechtigungsprüfung fehlt. Danach werden mit Service-Rechten Kunden, Aufträge und Positionen verändert. Der Frontendaufruf ersetzt diese serverseitige Prüfung nicht. Anonyme Erreichbarkeit hängt zusätzlich vom nicht verifizierten Deployment-Gateway ab.

Nachweise:
- supabase/functions/import-all-orders-ch/index.ts:64-89
- supabase/functions/import-all-orders-ch/index.ts:219-230
- src/pages/ImportManagement.tsx:210

Betroffene Funktionen:
- import-all-orders-ch
- runImport

Geplante Korrektur: Verifizierte Benutzeridentität und explizite Importberechtigung beziehungsweise verifizierte interne Jobidentität vor Importstart erzwingen.

Mögliche Auswirkungen: - Unberechtigte Importläufe
- Änderung von Auftrags- und Kundendaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_0e9d121dc4ee77fc

**Anyone can trigger bank statement imports**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Zwischen HTTP-Einstieg und Service-Zugriff auf Bankverbindungen, Abruf externer Bankdaten sowie Speicherung liegt keine Aufruferprüfung. Der Frontendaufruf übergibt eine connectionId, autorisiert den Handler aber nicht. verify_jwt ist in der Quelldatei deaktiviert.

Nachweise:
- supabase/functions/bank-api-fetch/index.ts:31-42
- supabase/functions/bank-api-fetch/index.ts:66-82
- src/pages/Finance/Kontoauszuege/BankApi.tsx:71
- supabase/config.toml:429-430

Betroffene Funktionen:
- bank-api-fetch

Geplante Korrektur: Bankimportberechtigung und Verbindungsscope prüfen; automatische Läufe gesondert authentifizieren.

Mögliche Auswirkungen: - Unberechtigte Bankabrufe
- Import- und Storage-Seiteneffekte

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_12f184f4fe482d12

**Anyone can trigger notices for another customer's package**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Aktion notify_customer_status verarbeitet eine frei übergebene Paket-ID unmittelbar mit dem Service-Client und ruft send-mail mit Service-Identität auf. Anders als andere Aktionen liegt hier weder eine Benutzerprüfung noch eine Paket-RLS-Abfrage vor. Der spätere Versandclient erhält daher nicht die ursprüngliche Aufruferidentität.

Nachweise:
- supabase/functions/mediapaket-portal/index.ts:422-449
- supabase/functions/mediapaket-portal/index.ts:242-258
- supabase/config.toml:41-42

Betroffene Funktionen:
- mediapaket-portal:notify_customer_status
- send-mail

Geplante Korrektur: Vor Datenzugriff Paketberechtigung des verifizierten Aufrufers oder eine strikt verifizierte interne Ereignisidentität prüfen.

Mögliche Auswirkungen: - Unberechtigte Kundenbenachrichtigung
- Weitergabe paketbezogener Zugangslinks

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1774b4ac1795267a

**PDF commit can attach an order to any customer**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Identität und Zugriff auf den Import werden geprüft, nicht jedoch die separat übergebene bestehende Kunden-ID; diese fließt direkt in einen Service-Insert auf orders. Eine vollständige Prüfung aller aktuellen Order-Trigger und ihrer Autorisierungswirkung wurde nicht abgeschlossen. Deshalb ist die Handlerlücke belegt, die endgültige Datenbankwirkung bleibt offen.

Nachweise:
- supabase/functions/pdf-order-commit/index.ts:67-93
- supabase/functions/pdf-order-commit/index.ts:223-246
- src/pages/PdfOrderImport/Review.tsx:293

Betroffene Funktionen:
- pdf-order-commit:Auftrag

Geplante Korrektur: Kunden-ID mit benutzerspezifischem Client und erforderlicher Anlegeberechtigung validieren; zuvor verbleibende Triggerabhängigkeiten schließen.

Mögliche Auswirkungen: - Mögliche kundenscopeübergreifende Auftragserstellung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1a410c3cce005159

**Anyone can change every customer's competitor data**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verwendet den Service-Client ohne Identitäts- und Kundenberechtigungsprüfung zum Lesen der Wettbewerber und Schreiben von Snapshots sowie Zeitstempeln. Der UI-Aufruf mit client_id ist nur eine Eingabequelle, kein serverseitiger Berechtigungsnachweis. Anonymer Gatewayzugang ist nicht abschließend belegt.

Nachweise:
- supabase/functions/social-competitors-sync/index.ts:25-43
- src/pages/Social/Wettbewerber.tsx:60

Betroffene Funktionen:
- social-competitors-sync

Geplante Korrektur: Verifizierten Aufrufer und Social-Kundenscope vor Synchronisierung prüfen; globale Läufe nur für verifizierte Jobs.

Mögliche Auswirkungen: - Unberechtigte Wettbewerber-Synchronisierung
- Datenmanipulation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_1c6e8cfec49210c7

**Anyone can analyze any contact’s private conversations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine übergebene contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Aufruferprüfung. Die Daten werden an den KI-Dienst übertragen und Prognosen gespeichert. Der Frontendaufruf begrenzt direkte HTTP-Aufrufe nicht.

Nachweise:
- supabase/functions/ac-revenue-intel-v2/index.ts:9-31
- supabase/functions/ac-revenue-intel-v2/index.ts:43
- src/pages/AlixConnect/RevenueIntelligenceV2.tsx:30
- supabase/config.toml:343-344

Betroffene Funktionen:
- ac-revenue-intel-v2

Geplante Korrektur: Kontakt- und Mandantenberechtigung vor jedem privilegierten Lesen und KI-Aufruf erzwingen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kommunikation
- KI-Kosten
- Prognoseschreibzugriffe

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_209ac9df0e293f49

**Anyone can send arbitrary payloads to the remote translation API**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der probe-Zweig reicht frei übergebene Payloads an comFetch weiter, ohne Aufruferprüfung. Davor sperrt jedoch ein datenabhängiger controlled_modes-Schalter den gesamten Altversand. Ob dieser Schalter im relevanten Betriebsmodus zwingend aktiv ist und welcher Gatewaypfad deployt wurde, ist nicht nachgewiesen.

Nachweise:
- supabase/functions/ph-com-lang-push/index.ts:134-145
- supabase/functions/ph-com-lang-push/index.ts:34

Betroffene Funktionen:
- ph-com-lang-push:probe
- comFetch

Geplante Korrektur: Altpfad dauerhaft entfernen oder unabhängig vom Betriebsmodus autorisieren; freien Probe-Payload nicht als öffentlichen Versandpfad erhalten.

Mögliche Auswirkungen: - Bedingt unberechtigte Remote-API-Aufrufe

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_21a637de07028856

**Public token permits unauthenticated employee-data access**

Bewertung: Bestätigte Fehlkonfiguration.

Technische Ursache: Ein im Quelltext festgelegter Triggerwert wird als alleiniger Zugriffsschutz verwendet. Danach werden Mitarbeiterdaten gelesen und Benachrichtigungen ausgelöst. Das einmalige app_settings-Flag begrenzt Wiederholungen, ersetzt aber keine geheime oder personenbezogene Autorisierung. Der aktuell gesetzte Flagzustand wurde nicht gelesen.

Nachweise:
- supabase/functions/announce-capa-cockpit/index.ts:12-30
- supabase/functions/announce-capa-cockpit/index.ts:47-65
- supabase/config.toml:492-493

Betroffene Funktionen:
- announce-capa-cockpit

Geplante Korrektur: Einmalhandler entfernen oder ausschließlich verifizierter interner Identität zugänglich machen; veröffentlichten Triggerwert nicht weiter als Geheimnis behandeln.

Mögliche Auswirkungen: - Unberechtigte Mitarbeiterbenachrichtigung
- Privilegierte Verarbeitung von Mitarbeiterdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_24579cadca97b1b6

**Unauthenticated requests can hash private documents**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Die Bedingung if (jwt && jwt !== serviceKey) überspringt bei leerem oder fehlendem Token sämtliche Rollenprüfungen. Anschließend werden private Dateien mit Service-Rechten geladen und Dokumenthashes geschrieben. Ohne effektive Gatewaykonfiguration ist die vollständige anonyme Erreichbarkeit nicht geschlossen; nichtleere unprivilegierte Tokens werden dagegen geprüft.

Nachweise:
- supabase/functions/alixdocs-hash-backfill/index.ts:29-40
- supabase/functions/alixdocs-hash-backfill/index.ts:47-75
- src/pages/AlixDocsDuplicates.tsx:77

Betroffene Funktionen:
- alixdocs-hash-backfill

Geplante Korrektur: Leere Identität ausdrücklich ablehnen; Service-Identität nur durch positive Gleichheitsprüfung akzeptieren; übrige Aufrufer vollständig authentifizieren und autorisieren.

Mögliche Auswirkungen: - Bedingt unberechtigter Dokumentdownload und Hash-Backfill

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_28bb477650901ea0_7d236364

**Anyone can send approval reports to any address**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Im Handler ist zwischen Einstieg, Service-Lesen der Freigaben und direktem Resend-Aufruf keine Aufruferprüfung erkennbar. Der vollständige Empfängerableitungspfad und die effektive Gatewayabsicherung wurden nicht abschließend verfolgt; die Behauptung beliebiger Zieladressen bleibt daher offen.

Nachweise:
- supabase/functions/delivery-approval-monthly-report/index.ts:21-31
- supabase/functions/delivery-approval-monthly-report/index.ts:56
- supabase/functions/delivery-approval-monthly-report/index.ts:122-124

Betroffene Funktionen:
- delivery-approval-monthly-report

Geplante Korrektur: Berichtsberechtigung beziehungsweise interne Jobidentität erzwingen und Empfängerübersteuerungen explizit autorisieren.

Mögliche Auswirkungen: - Möglicher unberechtigter Berichtsversand
- Mögliche Offenlegung von Freigabedaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_2989a7a085c7a5ca_bfcf4258

**Signed-in users can overwrite ETA data for arbitrary route plans**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser validiert die Identität, danach erfolgen Route- und Auftragszugriffe sowie ETA-Update mit dem Service-Client. Eine Zuordnung der route_plan_id zum Aufrufer oder eine Dispositionsberechtigung ist nicht vorgeschaltet. Der mobile Aufrufer ist keine serverseitige Objektprüfung.

Nachweise:
- supabase/functions/dispatch-eta-sms/index.ts:42-69
- supabase/functions/dispatch-eta-sms/index.ts:100-116
- src/pages/Mobile/Einsatz.tsx:150

Betroffene Funktionen:
- dispatch-eta-sms

Geplante Korrektur: Route gegen Aufruferzuordnung und erforderliche Dispositionsrechte prüfen, bevor Kommunikation oder ETA-Änderung erfolgt.

Mögliche Auswirkungen: - Fremde ETA-Änderungen
- Unberechtigte Kundenkommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_2f496f49c8a0776a

**Anyone can add your official signature to documents**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler akzeptiert ein PDF und einen Dokumenttyp, lädt anschließend Service-geschützte Faksimilekonfiguration und Signaturgrafik ohne Aufruferprüfung. Der legitime Aufruf aus zoho-invoice-pdf authentifiziert andere direkte Aufrufe nicht. Kein Duplikat des separaten Asset-Downloadbefunds: Hier ist die Konfigurationsoperation ausgewählt.

Nachweise:
- supabase/functions/sig-apply-facsimile/index.ts:32-61
- supabase/functions/zoho-invoice-pdf/index.ts:166-168

Betroffene Funktionen:
- sig-apply-facsimile

Geplante Korrektur: Nur verifizierte interne Aufrufer und nachweislich autorisierte Dokumentidentitäten zulassen; keine frei eingereichten PDFs pauschal stempeln.

Mögliche Auswirkungen: - Missbrauch einer offiziellen Unterschriftsdarstellung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_32ab3ba23bc4c3c6

**Anyone can trigger changes to overdue cases**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der HTTP-Handler führt Service-Lese- und Schreibzugriffe auf Mahnfälle, Checklisten, Rückrufe und Timeline aus, ohne sichtbare Aufruferprüfung. Für die vollständige Kette zum nachgelagerten as-send-email-reminder wurden dessen eigene Autorisierung und die Jobkonfiguration nicht abschließend gelesen.

Nachweise:
- supabase/functions/as-workflows-run/index.ts:53-73
- supabase/functions/as-workflows-run/index.ts:110-135

Betroffene Funktionen:
- as-workflows-run
- as-send-email-reminder

Geplante Korrektur: Jobidentität am Einstieg positiv verifizieren; nachgelagerte Aufrufe und Fallberechtigungen vollständig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Falländerungen und Erinnerungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_38eef2927644a86c_2da0a87d

**Anyone can trigger private ticket SLA updates**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der öffentlich konfigurierte Handler ruft ohne Identitätsprüfung die RPC ticket_sla_check_and_escalate mit Service-Rechten auf. Die RPC-Definition wurde lokalisiert, ihre vollständige aktuelle Implementierung samt Grants und späteren Änderungen aber nicht abschließend verfolgt.

Nachweise:
- supabase/functions/ticket-sla-check/index.ts:5-9
- supabase/config.toml:270-271
- supabase/migrations/20260712150349_e610b87f-7cf1-4ace-b3da-86b58c657415.sql:66

Betroffene Funktionen:
- ticket-sla-check
- ticket_sla_check_and_escalate

Geplante Korrektur: Interne Jobidentität vor RPC-Aufruf erzwingen und vollständige RPC-Abhängigkeit separat abschließen.

Mögliche Auswirkungen: - Mögliche unberechtigte SLA-Eskalationen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3b50bf868a4ca4dc

**Anyone can trigger another user's ticket email**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine notification_id reicht für Service-Zugriffe auf Benachrichtigung, Benutzerprofil und Ticket; eine Bindung des Aufrufers an den Empfänger fehlt. Danach wird der Provider direkt aufgerufen. Ein Datenbanktrigger als legitimer Aufrufer schützt den separat erreichbaren Handler nicht.

Nachweise:
- supabase/functions/ticket-user-notify/index.ts:39-90
- supabase/migrations/20260712144259_6f081650-5483-4ad7-9bab-dff3fd854a81.sql:28
- supabase/config.toml:264-265

Betroffene Funktionen:
- ticket-user-notify

Geplante Korrektur: Nur verifizierte interne Benachrichtigungsereignisse akzeptieren; Versandzustand und Ereignisbindung vor Provideraufruf prüfen.

Mögliche Auswirkungen: - Unberechtigte Ticket-E-Mails
- Verarbeitung fremder Ticketdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3e6f3a3c10a40230

**Any signed-in user can release held invoices**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler prüft lediglich eine gültige Benutzeridentität und liest anschließend frei ausgewählte Profile sowie zurückgehaltene Rechnungen mit Service-Rechten. Eine Freigaberolle fehlt im gelesenen Pfad. Die vollständige Wirkung des nachgelagerten send-invoice-mail und verbleibender Schreiboperationen ist nicht abschließend geprüft.

Nachweise:
- supabase/functions/pruefung-release/index.ts:31-67
- supabase/functions/pruefung-release/index.ts:107-109
- src/pages/Finance/RatenPruefung.tsx:88

Betroffene Funktionen:
- pruefung-release
- send-invoice-mail

Geplante Korrektur: Explizite Freigabeberechtigung und profilspezifischen Zugriff vor Service-Lesen erzwingen; Mail- und Statuskette vollständig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Rechnungsfreigabe und Kommunikation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_3f6f96a860e513ff

**Anyone can create and activate automation rules**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler unterscheidet Generierung, Validierung und Speicherung, prüft aber vor dem Service-Insert in ac_automation_rules keine Identität oder Administrationsberechtigung. Der WorkflowStudio-Aufrufer ist lediglich Clientcode; die Gateway-Quelldatei deaktiviert JWT-Prüfung.

Nachweise:
- supabase/functions/ac-workflow-studio/index.ts:31-79
- src/pages/AlixConnect/WorkflowStudio.tsx:35-46
- supabase/config.toml:358-359

Betroffene Funktionen:
- ac-workflow-studio

Geplante Korrektur: Workflow-Verwaltungsrecht und Mandantenscope vor Generierung, Speicherung und Aktivierung prüfen.

Mögliche Auswirkungen: - Unberechtigte Automationsregeln
- Mögliche nachgelagerte Kundenaktionen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_44ddf2563f3b0bce

**CMR role can access any document ID**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Identität und eine erlaubte globale Rolle werden geprüft. Anschließend wird das Dokument ausschließlich per documentId mit Service-Rechten gelesen; eine Mandantenbindung fehlt. Ob die Rolle CMR fachlich mandantenübergreifend berechtigt sein soll und wie interne Aufrufer autorisiert werden, ist nicht abschließend belegt.

Nachweise:
- supabase/functions/cmr-send-document/index.ts:26-55
- supabase/functions/cmr-collective-run/index.ts:123
- src/pages/CMR/Dokumente.tsx:379

Betroffene Funktionen:
- cmr-send-document
- cmr-collective-run

Geplante Korrektur: Verbindliches CMR-Berechtigungsmodell klären und gegebenenfalls Dokument-/Mandantenprüfung vor Service-Lesen und Versand ergänzen.

Mögliche Auswirkungen: - Möglicher mandantenübergreifender Dokumentversand

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_4bc3611a6285a5f0

**Anyone can send private conversations for quality review**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler wählt Konversationen und Nachrichten mit einem Service-Client aus, überträgt den Verlauf zur KI und schreibt QA-Ergebnisse, ohne den Aufrufer zu prüfen. Ein UI-Aufruf autorisiert diese Service-Zugriffe nicht.

Nachweise:
- supabase/functions/ac-conversation-qa/index.ts:24-53
- supabase/functions/ac-conversation-qa/index.ts:72-79
- supabase/functions/ac-conversation-qa/index.ts:107
- src/pages/AlixConnect/ConversationQA.tsx:68

Betroffene Funktionen:
- ac-conversation-qa

Geplante Korrektur: QA-Rolle und Konversationsscope vor Auswahl und KI-Übertragung erzwingen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Gesprächsverläufe
- QA-Manipulation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_4ea4f21737ef5149

**Anyone can create completed QM evaluations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: call_id und scorecard_id steuern einen Service-Lesezugriff und anschließend das Anlegen einer abgeschlossenen QM-Bewertung ohne Aufrufer- oder Bewerterberechtigungsprüfung. Dies ist eine andere Operation als der separat gemeldete Transkriptzugriff.

Nachweise:
- supabase/functions/ac-qm-auto-score/index.ts:12-21
- supabase/functions/ac-qm-auto-score/index.ts:58-65
- src/pages/AlixConnect/QualityMgmt.tsx:64

Betroffene Funktionen:
- ac-qm-auto-score:Bewertung

Geplante Korrektur: QM-Bewerterrecht sowie Call- und Scorecard-Scope vor Verarbeitung und Abschluss prüfen.

Mögliche Auswirkungen: - Unberechtigte Mitarbeiterbewertungen
- Mögliche Coaching-Folgeaktionen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_55788009de5e6065

**Public endpoint runs internal adherence alerts**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler besitzt keine sichtbare Identitätsprüfung und nutzt Service-Rechte für ac_wfm_adherence_live sowie Benachrichtigungen. Die vollständige Implementierung und Sichtbarkeitslogik dieser RPC und die effektive Job-/Gatewaykonfiguration wurden nicht abschließend aufgelöst.

Nachweise:
- supabase/functions/ac-wfm-adherence-alerts/index.ts:10-23

Betroffene Funktionen:
- ac-wfm-adherence-alerts
- ac_wfm_adherence_live

Geplante Korrektur: Jobidentität prüfen; RPC und Empfängerableitung vollständig nachvollziehen.

Mögliche Auswirkungen: - Mögliche unberechtigte Mitarbeiter-Adherence-Alarme

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_597a547a91b6cb80

**Anyone can process pending customer orders**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Prozesshandler startet mit Service-Rechten ohne sichtbare eigene Aufruferprüfung. orders-inbox ruft ihn intern auf; dessen vollständige Autorisierung und die komplette Prozesskette einschließlich Datenbanknebenwirkungen wurden nicht abgeschlossen. Der interne Aufrufer allein schützt den separaten HTTP-Einstieg nicht.

Nachweise:
- supabase/functions/orders-inbox-process/index.ts:267-272
- supabase/functions/orders-inbox-process/index.ts:189-190
- supabase/functions/orders-inbox/index.ts:96
- supabase/config.toml:35-36

Betroffene Funktionen:
- orders-inbox-process
- orders-inbox

Geplante Korrektur: Prozesshandler auf verifizierte interne Aufrufe begrenzen; Inbox-Autorisierung und Verarbeitung vollständig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Verarbeitung eingehender Kundenaufträge

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5c7be8cb8b467dc0

**Finance users can email collection documents to any address**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Benutzeridentität und erlaubte Rollen werden geprüft. Der Fall wird anschließend mit Service-Rechten geladen und ein Dokument erzeugt; ein Versandpfad existiert. Ob freie Empfänger für diese Finanzrollen bewusst zulässig sind und ob ein engerer Fallscope gefordert ist, ist fachlich und entlang des gesamten Empfängerpfads nicht abgeschlossen.

Nachweise:
- supabase/functions/collect-document-generate/index.ts:69-95
- supabase/functions/collect-document-generate/index.ts:210-234
- src/components/collect/CollectCaseActions.tsx:64

Betroffene Funktionen:
- collect-document-generate

Geplante Korrektur: Fall- und Empfängerberechtigungsmodell festlegen; nur danach erforderliche Scope- und Übersteuerungsprüfungen implementieren.

Mögliche Auswirkungen: - Mögliche Weitergabe von Inkassodokumenten an unberechtigte Empfänger

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_5eb7960ed2ed2229

**Any signed-in user can run code through search**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Gegenprüfung korrigiert die erste Bewertung: Antwortfragmente sind zwar React-Textknoten (Zeilen 40–62), aber Quellen-Snippets werden separat unverändert über dangerouslySetInnerHTML gerendert (Zeilen 139–142). Die behauptete gespeicherte HTML-Einfügung bleibt damit vorhanden. Admin-Routenschutz entfernt das Risiko bei manipulierten autorisierten Quelldokumenten nicht; keine produktive Ausnutzung getestet.

Nachweise:
- src/pages/AlixDocsAiSearch.tsx:26-32
- src/pages/AlixDocsAiSearch.tsx:124-145

Betroffene Funktionen:
- AlixDocsAiSearch.ask
- AlixDocsAiSearch.renderAnswer

Geplante Korrektur: Quellen-Snippets als sichere Text-/Highlight-Segmente rendern oder streng mit bestehendem Sanitizer auf notwendige Formatierung begrenzen; keine ungeprüften HTML-Ereignisattribute oder aktiven Inhalte.

Mögliche Auswirkungen: - Gespeicherte Quelltexte können aktive HTML-Inhalte in die administrative Suchansicht einschleusen.
- Formatierte Suchtreffer müssen erhalten bleiben, ohne aktives HTML auszuführen.

Vorgesehene Regressionstests (nicht durchgeführt):
- Isolierte Quell-Snippets mit Ereignisattributen/aktiven Tags dürfen keine Ausführung auslösen; sichere Hervorhebungen und Links bleiben nutzbar.

Wiederherstellung: Nur eine nachweislich sichere Render-Version wiederherstellen; Roh-HTML-Darstellung nicht erneut freigeben. Keine produktive Quelldatenänderung.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_63a444f362255ddb

**Anyone can change campaign results**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler verwendet die frei übergebene campaign_id für Service-Lesezugriffe auf Kampagne und Empfänger sowie ein anschließendes Kampagnenupdate ohne Identitäts- oder Kampagnenberechtigungsprüfung.

Nachweise:
- supabase/functions/ac-campaign-ab-decide/index.ts:8-25
- supabase/functions/ac-campaign-ab-decide/index.ts:46
- src/pages/AlixConnect/OmnichannelCampaigns.tsx:72

Betroffene Funktionen:
- ac-campaign-ab-decide

Geplante Korrektur: Kampagnenverwaltungsrecht und Mandantenscope vor Auswertung und Entscheidung erzwingen.

Mögliche Auswirkungen: - Manipulation von Kampagnenentscheidungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_675c4841c9be4f6b

**Anyone can see internal routing and staffing details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: getUser wird aufgerufen, ein fehlender Benutzer führt aber nicht zum Abbruch. Routingregeln, Agentenfähigkeiten und Auslastung werden mit Service-Rechten verarbeitet; Ergebnis und Trace werden zurückgegeben. Optional kann sogar ohne Benutzer eine Simulation gespeichert werden.

Nachweise:
- supabase/functions/ac-router-simulate/index.ts:21-38
- supabase/functions/ac-router-simulate/index.ts:42-70
- supabase/functions/ac-router-simulate/index.ts:91-103
- src/pages/AlixConnect/RoutingSimulator.tsx:70

Betroffene Funktionen:
- ac-router-simulate

Geplante Korrektur: Fehlende Identität ablehnen und Routing-/Personaldatenberechtigung samt Mandantenscope vor Service-Zugriffen prüfen.

Mögliche Auswirkungen: - Offenlegung interner Routing- und Personaldaten
- Unberechtigte Simulationsspeicherung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6a796ab89ffc66d5

**Anyone can send private customer records outside**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: contact_id steuert Service-Lesezugriffe auf Kontakt, Nachrichten und Anrufe ohne Autorisierung. Die Daten gehen an den KI-Dienst; Prognosen und Customer-Health-Daten werden geschrieben. Der Clientaufruf ersetzt keine serverseitige Prüfung.

Nachweise:
- supabase/functions/ac-customer-intel/index.ts:10-32
- supabase/functions/ac-customer-intel/index.ts:46-56
- src/pages/AlixConnect/CustomerIntelligence.tsx:33
- supabase/config.toml:331-332

Betroffene Funktionen:
- ac-customer-intel

Geplante Korrektur: Kontaktberechtigung und Mandantenscope vor KI-Verarbeitung erzwingen.

Mögliche Auswirkungen: - Unberechtigte externe Verarbeitung privater Kundendaten
- Manipulation von Kundenanalysen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_6eb5a3fe59d356e3

**Anyone with a sign-in can copy another user's stored files**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Benutzerzweig prüft nur getUser. Frei übergebene source_bucket und source_path werden anschließend über den Service-Storageclient geladen, ohne den Dateizugriff des Benutzers mit dessen Identität zu prüfen. Die alternative interne Schlüsselprüfung schränkt diesen Benutzerzweig nicht ein.

Nachweise:
- supabase/functions/alixdocs-attach-from-storage/index.ts:34-46
- supabase/functions/alixdocs-attach-from-storage/index.ts:60-65
- src/components/alixdocs/AttachToOrderDialog.tsx:79

Betroffene Funktionen:
- alixdocs-attach-from-storage

Geplante Korrektur: Quelldatei unter Benutzeridentität lesen oder den Zugriff serverseitig objektspezifisch prüfen; Buckets begrenzen und Zielobjekt separat autorisieren.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf fremde Storage-Dateien

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_72ade965d435cb87

**Anyone can recalculate a private credit assessment**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler akzeptiert eine assessment_id und erzeugt unmittelbar einen Service-Client ohne sichtbare Identitätsprüfung. Die gesamte Berechnungs-, Dokument- und Schreibkette wurde nicht vollständig gelesen; deren konkrete Endwirkung bleibt daher unresolved.

Nachweise:
- supabase/functions/credit-score-calculate/index.ts:6-12
- src/pages/Credit/Detail.tsx:52
- src/pages/Credit/New.tsx:99

Betroffene Funktionen:
- credit-score-calculate

Geplante Korrektur: Kreditprüfberechtigung und Assessment-Scope vor Service-Zugriffen prüfen; verbleibende Berechnungsabhängigkeiten vollständig auditieren.

Mögliche Auswirkungen: - Mögliche unberechtigte Kreditbewertung und Verarbeitung sensibler Unterlagen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_752434abd9742e22

**Anyone can read and rewrite your financial forecasts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler übernimmt tenant_id aus dem Body, liest Finanztransaktionen mit Service-Rechten, ruft die KI auf und upsertet finance_forecasts ohne Aufrufer- oder Finanzberechtigungsprüfung.

Nachweise:
- supabase/functions/finance-ai-forecast/index.ts:13-24
- supabase/functions/finance-ai-forecast/index.ts:41-48
- supabase/functions/finance-ai-forecast/index.ts:66-72
- src/pages/Finance/Forecast.tsx:30

Betroffene Funktionen:
- finance-ai-forecast

Geplante Korrektur: Finanzprognoserecht und autorisierten Mandanten serverseitig bestimmen; KI- und Schreibzugriffe erst danach ausführen.

Mögliche Auswirkungen: - Unberechtigte Finanzdatenverarbeitung
- Prognosemanipulation
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7663c8dfc8cfd611_f8f951cf

**Anyone can trigger recurring billing across tenants**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Einstieg prüft keine Identität; tenantId ist optional und ohne diese Eingabe werden aktive Pläne mandantenübergreifend ausgewählt. Service-Schreib- und Versandpfade sind vorhanden. Nummern-RPC, vollständige Aboregeln und Jobauthentifizierung sind nicht abschließend aufgelöst.

Nachweise:
- supabase/functions/cmr-recurring-run/index.ts:25-39
- supabase/functions/cmr-recurring-run/index.ts:87-107
- supabase/functions/cmr-recurring-run/index.ts:120-147
- src/pages/CMR/Abos.tsx:136

Betroffene Funktionen:
- cmr-recurring-run
- cmr_next_document_number

Geplante Korrektur: Verifizierte Jobidentität oder explizite Abolaufberechtigung erzwingen; Mandantenscope, Idempotenz und Nummernvergabe vollständig prüfen.

Mögliche Auswirkungen: - Mögliche mandantenübergreifende Rechnungsanlage und Vorabmitteilungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_7c6fbb7e2e06dc5b

**Anyone can trigger inventory notices**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Übergebene Seriennummern steuern Service-Lesezugriffe auf Geräte, Aufträge und Kunden ohne sichtbare Identitätsprüfung. Der Handler ruft send-transactional-email privilegiert auf. Dessen tatsächliche Empfänger- und Autorisierungswirkung wurde nicht vollständig verfolgt.

Nachweise:
- supabase/functions/lager-bestand-notify/index.ts:12-47

Betroffene Funktionen:
- lager-bestand-notify
- send-transactional-email

Geplante Korrektur: Lagerberechtigung und Gerätescope prüfen; interne Mailkette vollständig auflösen.

Mögliche Auswirkungen: - Mögliche unberechtigte Lager-/Kundenbenachrichtigungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_80702a087db69b7e

**Anyone can read records for arbitrary contacts**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler liest für eine beliebige contact_id Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und verarbeitet sie per KI ohne Aufruferprüfung. Anschließend wird eine Prognose gespeichert. Ein tatsächlicher Nachrichtenversand wird hier nicht behauptet.

Nachweise:
- supabase/functions/ac-omnichannel-orchestrate/index.ts:9-31
- supabase/functions/ac-omnichannel-orchestrate/index.ts:42
- src/pages/AlixConnect/OmnichannelOrchestrator.tsx:39
- supabase/config.toml:337-338

Betroffene Funktionen:
- ac-omnichannel-orchestrate

Geplante Korrektur: Kontakt- und Analyseberechtigung vor Datenauswahl und KI-Aufruf prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kontaktdaten
- Prognoseschreibzugriffe

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_86d0bf0477028299

**A fake bearer can export any direct-debit run**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Es wird nur das Präfix Bearer geprüft, nicht die Identität. Danach werden der frei gewählte Lastschriftlauf und dessen Detaildaten mit Service-Rechten gelesen. Ein gegebenenfalls vorgeschaltetes Gateway ersetzt keine Finanz- und Laufberechtigung. Der separate Statusupdatebefund ist keine identische Operation.

Nachweise:
- supabase/functions/finance-ch-dd-export/index.ts:9-22
- src/pages/Finance/ChLastschriften.tsx:61

Betroffene Funktionen:
- finance-ch-dd-export:Lesen

Geplante Korrektur: Identität validieren und Exportrecht sowie Lauf-/Mandantenscope vor Datenabruf erzwingen.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Lastschrift- und Zahlungsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_87a129784e09ef5c

**Unassigned users can download invoices across Zoho tenants**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: zoho-invoice-pdf verwendet getTenantScope. Der Helper behandelt einen gültigen Benutzer ohne user_tenant_access-Einträge ausdrücklich als uneingeschränkt. Ob dies für die betroffenen Kontotypen beabsichtigte globale Berechtigung oder ein Fehler ist, erfordert das verbindliche Mandantenmodell. Die gesamte Remote-PDF-Kette wurde nicht abschließend geprüft.

Nachweise:
- supabase/functions/zoho-invoice-pdf/index.ts:98
- supabase/functions/_shared/tenant-scope.ts:49-67
- src/components/finance/InvoicePdfDialog.tsx:35

Betroffene Funktionen:
- zoho-invoice-pdf
- getTenantScope
- sourceInScope

Geplante Korrektur: Globale Berechtigung explizit modellieren; fehlende Zuweisung nicht ohne dokumentierte Ausnahme als Vollzugriff behandeln.

Mögliche Auswirkungen: - Möglicher mandantenübergreifender Rechnungsdownload

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_89bba568925256f2_d4756c15

**Anyone can trigger customer messaging playbooks**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler startet ohne sichtbare Aufruferprüfung und liest Playbooks sowie Kundenstatus mit Service-Rechten. Direkte SMS-/WhatsApp-Pfade und interne Aktionen sind vorhanden. Cronregistrierung wurde gefunden, aber die gesamte Auswahl-, Aktions- und Wiederholungskette nicht abschließend gelesen.

Nachweise:
- supabase/functions/ac-playbook-run/index.ts:34-70
- supabase/functions/ac-playbook-run/index.ts:82-121
- supabase/migrations/20260721130850_b2c18de2-ff0b-4288-a819-bb5e09ffc493.sql:21

Betroffene Funktionen:
- ac-playbook-run

Geplante Korrektur: Jobidentität positiv prüfen und jede Playbookaktion samt Mandantenscope und Wiederholungsschutz vollständig auditieren.

Mögliche Auswirkungen: - Mögliche unberechtigte Kundenansprache und interne Folgeaktionen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_8b2f741253363b3f

**PDF commit can link an offer to any customer**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler prüft Benutzer und Import, übernimmt aber eine bestehende Kunden-ID ungeprüft in das mit Service-Rechten angelegte Angebot. Aktuelle Angebotstrigger und deren vollständige Wechselwirkung wurden nicht abschließend aufgelöst. Nicht identisch mit der Auftragserstellung.

Nachweise:
- supabase/functions/pdf-order-commit/index.ts:67-93
- supabase/functions/pdf-order-commit/index.ts:188-215
- supabase/migrations/20261102185015_3b8dcad5-5d36-49a4-98f9-91191d4239ee.sql:10

Betroffene Funktionen:
- pdf-order-commit:Angebot

Geplante Korrektur: Kundenzugriff und Angebotserstellungsrecht explizit prüfen; Angebotstrigger vollständig einbeziehen.

Mögliche Auswirkungen: - Mögliche unberechtigte Angebotszuordnung zu fremden Kunden

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9328ed89c215056e

**Unassigned users can access and process every tenant’s offers**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler übernimmt die restricted-Semantik des gemeinsamen Helpers. Für gültige Benutzer ohne Zuweisungen liefert dieser restricted=false; die Angebotsabfrage wird dann nicht nach Mandanten eingeschränkt. Ob diese globalen Rechte fachlich zulässig sind und ob alle Folgeaktionen denselben Scope beachten, ist offen.

Nachweise:
- supabase/functions/offer-followup-engine/index.ts:28-51
- supabase/functions/_shared/tenant-scope.ts:49-67
- src/pages/Sales/AngebotsKalender.tsx:151

Betroffene Funktionen:
- offer-followup-engine
- getTenantScope

Geplante Korrektur: Explizite globale Berechtigung statt impliziter Freigabe durch fehlende Zuweisung; sämtliche Folgeabfragen und Mailpfade auf Scope prüfen.

Mögliche Auswirkungen: - Mögliche mandantenübergreifende Angebotsverarbeitung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_98ce69bedfbee8e0

**Anyone can trigger event creation in users’ Microsoft calendars**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die Quelldatei konfiguriert Gateway-JWT-Prüfung, der Handler selbst bindet user_id jedoch nicht an die verifizierte Identität. Ohne user_id verarbeitet er alle aktiven Verbindungen. Gespeicherte OAuth-Zugänge werden für Kalender-POSTs genutzt. Damit bleibt mindestens ein objektbezogenes Autorisierungsdefizit; vollständig anonymer Zugriff ist nicht behauptet.

Nachweise:
- supabase/functions/esc-calendar-sync/index.ts:100-127
- supabase/config.toml:254-255
- src/components/esc/CalendarConnectionsCard.tsx:59

Betroffene Funktionen:
- esc-calendar-sync
- pushToMicrosoft
- pushToGoogle

Geplante Korrektur: Identität im Handler verifizieren und nur eigene Kalender zulassen; globale Synchronisierung ausschließlich für verifizierte Jobs.

Mögliche Auswirkungen: - Unberechtigte Erstellung fremder Kalenderereignisse
- Mögliche Mehrfachanlage

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_9b6babee6e0739e2

**Any signed-in user can send another customer's payment reminder**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Normale Aufrufer werden authentifiziert; die Super-Admin-Prüfung gilt aber nur für Inhaltsübersteuerungen. Die übergebenen reminder_ids werden anschließend mit Service-Rechten ohne Benutzer-/Mandantenfilter gelesen. Der nachgelagerte send-invoice-mail-Pfad wurde nicht vollständig abgeschlossen.

Nachweise:
- supabase/functions/rz-reminder-send/index.ts:174-186
- supabase/functions/rz-reminder-send/index.ts:209-230
- supabase/functions/rz-reminder-send/index.ts:273-275
- src/pages/Finance/WiederkehrendeZahlerErinnerungen.tsx:144

Betroffene Funktionen:
- rz-reminder-send
- send-invoice-mail

Geplante Korrektur: Erinnerungsversandrecht und Datensatzscope unabhängig von Override-Rechten prüfen; Mailkette vollständig auditieren.

Mögliche Auswirkungen: - Möglicher unberechtigter Erinnerungsversand
- Fremde Erinnerungsvorschauen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a0a466e697d09e51

**Anyone can change document matching rules**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Nur nichtleere Tokens ungleich Service-Key durchlaufen Identitäts- und Rollenprüfung. Fehlende beziehungsweise leere Tokens überspringen diese vollständig; anschließend werden Matchingregeln mit Service-Rechten angelegt oder geändert. Ob das Gateway solche Requests zuverlässig abweist, ist nicht nachgewiesen.

Nachweise:
- supabase/functions/alixdocs-learn-rules/index.ts:49-68
- supabase/functions/alixdocs-learn-rules/index.ts:179-192
- supabase/migrations/20260719114804_bfb6378f-a127-4bd8-849b-8f69935f44ab.sql:5

Betroffene Funktionen:
- alixdocs-learn-rules

Geplante Korrektur: Leere Identität ablehnen; Service-Aufruf ausdrücklich positiv verifizieren; sonst Benutzer und Rolle prüfen.

Mögliche Auswirkungen: - Bedingt unberechtigte Änderung der Dokumentzuordnungsregeln

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a4d6dd0a251b82c0

**Anyone can run the security scan and alter findings**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler erstellt ohne sichtbare Aufruferprüfung einen Service-Client, liest interne Security-Views und verändert security_audit_findings. Die aktuellen Viewdefinitionen, vollständigen Schreibbedingungen und Gatewayabhängigkeiten wurden nicht abschließend aufgelöst.

Nachweise:
- supabase/functions/security-auto-scan/index.ts:4-18
- supabase/functions/security-auto-scan/index.ts:85-113
- src/pages/SecurityCenter/Findings.tsx:32

Betroffene Funktionen:
- security-auto-scan

Geplante Korrektur: Security-Adminrecht beziehungsweise Jobidentität vor Scan und Ergebnisschreiben prüfen; abhängige Views vollständig auditieren.

Mögliche Auswirkungen: - Mögliche Offenlegung interner Sicherheitsinformationen
- Mögliche Verfälschung von Befundzuständen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_a75e27ec4d54559d

**Anyone can change existing product records**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Importhandler akzeptiert Produktdaten ohne Aufruferprüfung und aktualisiert passende ph_products mit Service-Rechten. Aktuelle Product-Hub-Trigger und Betriebsmodusregeln existieren; ihre vollständige Wirkung auf diesen Altimport wurde nicht geschlossen. Nicht identisch mit dem Insert neuer Produkte.

Nachweise:
- supabase/functions/product-hub-import/index.ts:129-140
- supabase/functions/product-hub-import/index.ts:263
- supabase/migrations/20261127190858_5cfe627c-bb28-4926-ace4-41da63e1b4b7.sql:5

Betroffene Funktionen:
- product-hub-import:Update

Geplante Korrektur: Altimport deaktivieren oder mit explizitem Product-Hub-Importrecht und erlaubtem Feldsatz schützen; Betriebsmodus- und Triggerabhängigkeiten vollständig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Änderung bestehender Produktdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_aab25c4aac0c36d0_10807eba

**Anyone can analyze any call recording transcript**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Vor dem Service-Lesen des per call_id gewählten Transkripts findet keine Aufrufer- oder Callberechtigungsprüfung statt. Das Transkript wird anschließend zur KI übertragen. Dies ist keine identische Operation zum Anlegen einer QM-Bewertung.

Nachweise:
- supabase/functions/ac-qm-auto-score/index.ts:12-21
- supabase/functions/ac-qm-auto-score/index.ts:31-38
- src/pages/AlixConnect/QualityMgmt.tsx:64

Betroffene Funktionen:
- ac-qm-auto-score:Transkriptanalyse

Geplante Korrektur: QM-Analyseberechtigung und Call-Scope vor Transkriptzugriff prüfen.

Mögliche Auswirkungen: - Unberechtigte externe Verarbeitung privater Gesprächstranskripte

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ad68a76e0a7dba39

**Anyone can put your company signature on their documents**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Service-Storagedownload der offiziellen Signaturgrafik ist durch keine Identitäts- oder Dokumentberechtigungsprüfung geschützt. Übergebene PDFs können damit verarbeitet werden. Gegenüber dem Konfigurationslesebefund ist eine andere konkrete Operation ausgewählt; deshalb keine Dublettenklassifikation.

Nachweise:
- supabase/functions/sig-apply-facsimile/index.ts:32-61
- supabase/functions/zoho-invoice-pdf/index.ts:168

Betroffene Funktionen:
- sig-apply-facsimile:Assetdownload

Geplante Korrektur: Signaturasset nur nach verifizierter interner Identität und autorisierter Dokumentbindung laden.

Mögliche Auswirkungen: - Missbrauch offizieller Unterschriftsgrafik

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b0bea2646e06d7cc

**Anyone can finalize documents**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Finalisierer liest document_id und request_id unabhängig mit Service-Rechten; eine Identitätsprüfung, nachgewiesene Zusammengehörigkeit und vollständige Signaturfreigabe fehlen im gelesenen Einstieg. Ein legitimer Aufruf aus sig-submit existiert. Dessen vollständige Freigabekette sowie aktuelle Datenbankbedingungen wurden nicht abgeschlossen.

Nachweise:
- supabase/functions/sig-render-final/index.ts:18-40
- supabase/functions/sig-render-final/index.ts:125-137
- supabase/functions/sig-submit/index.ts:141

Betroffene Funktionen:
- sig-render-final
- sig-submit

Geplante Korrektur: Finalisierer ausschließlich intern authentifiziert aufrufen; Request-Dokument-Bindung und erforderlichen Signaturabschluss serverseitig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Dokumentfinalisierung
- Mögliche falsche Zuordnung von Signaturen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b4dbe8c9ecfd794e_7e264ad8

**Bank statement import trusts any Bearer header**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nur das Bearer-Präfix wird geprüft. Anschließend werden eingereichte Bankmeldungen mit Service-Rechten in finance_camt054_notifications und finance_camt054_entries gespeichert. Eine validierte Identität und Bankimportrolle fehlen.

Nachweise:
- supabase/functions/finance-camt054-import/index.ts:21-25
- supabase/functions/finance-camt054-import/index.ts:48-81
- src/pages/Finance/Camt054.tsx:37

Betroffene Funktionen:
- finance-camt054-import

Geplante Korrektur: Benutzer validieren und Bankimportberechtigung sowie Konten-/Mandantenscope vor Verarbeitung erzwingen.

Mögliche Auswirkungen: - Unberechtigte Anlage von Bankmeldungen und Buchungsdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_b84cf71745089f7f

**Anyone can submit private conversations to live assistant**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine conversation_id steuert Service-Lesezugriffe auf Konversation und Nachrichten ohne Aufruferprüfung. Gesprächsverlauf und Wissenskontext werden an die KI übertragen; Vorschläge werden gespeichert.

Nachweise:
- supabase/functions/ac-agent-assist-live/index.ts:11-20
- supabase/functions/ac-agent-assist-live/index.ts:37-56
- src/pages/AlixConnect/AgentAssistLive.tsx:35
- supabase/config.toml:328-329

Betroffene Funktionen:
- ac-agent-assist-live

Geplante Korrektur: Agentenberechtigung und Konversationsscope vor jedem Lese- und KI-Zugriff prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Konversationen
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ba7c311bb074fdc2_4edc88a2

**Anyone can analyze any contact’s conversations**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der Handler akzeptiert contact_id ohne Identitätsprüfung, liest Kontakt-, Nachrichten- und Anrufdaten mit Service-Rechten und überträgt sie zur KI. Ergebnisse werden in ac_predictions gespeichert.

Nachweise:
- supabase/functions/ac-predictive-engagement/index.ts:9-31
- supabase/functions/ac-predictive-engagement/index.ts:42
- src/pages/AlixConnect/PredictiveEngagement.tsx:30
- supabase/config.toml:346-347

Betroffene Funktionen:
- ac-predictive-engagement

Geplante Korrektur: Kontaktberechtigung und Mandantenscope vor Analyse erzwingen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung privater Kontaktaktivitäten
- Prognosemanipulation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_bdfe7bcb586d9539

**Anyone can create product records**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Produktdaten werden ohne Aufruferprüfung angenommen und bei fehlendem Match mit Service-Rechten in ph_products eingefügt. Die vollständige Wirkung aktueller Product-Hub-Trigger und Betriebsmodi auf diesen Insertpfad ist noch nicht aufgelöst. Der Updatebefund betrifft eine andere Operation.

Nachweise:
- supabase/functions/product-hub-import/index.ts:129-140
- supabase/functions/product-hub-import/index.ts:267-268

Betroffene Funktionen:
- product-hub-import:Insert

Geplante Korrektur: Importrecht, Herkunft und zulässigen Entwurfsstatus serverseitig prüfen; aktuelle Datenbankguards vollständig nachvollziehen.

Mögliche Auswirkungen: - Mögliche unberechtigte Produktanlage

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: ja. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c1b20729293ac269

**Unauthenticated caller can close tickets**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler besitzt keine eigene Aufruferprüfung und ruft ticket_auto_close_stale mit Service-Rechten auf; verify_jwt ist laut Quelle deaktiviert. Die vollständige aktuelle RPC-Implementierung und ihre Grants wurden nicht abschließend gelesen.

Nachweise:
- supabase/functions/ticket-auto-close/index.ts:11-20
- supabase/config.toml:267-268
- supabase/migrations/20260712145321_bc279ece-0c3e-4271-9422-a95e7cf00e92.sql:58

Betroffene Funktionen:
- ticket-auto-close
- ticket_auto_close_stale

Geplante Korrektur: Verifizierte Jobidentität vor RPC-Aufruf erzwingen; RPC-Autorisierung und Abschlussbedingungen vollständig prüfen.

Mögliche Auswirkungen: - Möglicher unberechtigter Ticketabschluss

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c3d615c0a49c15fb

**Anyone can export debit instructions**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Nach einer bloßen Bearer-Präfixprüfung werden der gewählte Lastschriftlauf und seine Positionen mit Service-Rechten als exportiert markiert. Es fehlt eine validierte Identität und Laufberechtigung. Diese Mutation ist nicht identisch mit dem separaten Lesebefund.

Nachweise:
- supabase/functions/finance-ch-dd-export/index.ts:9-18
- supabase/functions/finance-ch-dd-export/index.ts:81-85
- src/pages/Finance/ChLastschriften.tsx:61

Betroffene Funktionen:
- finance-ch-dd-export:Statusänderung

Geplante Korrektur: Exportrolle und Lauf-/Mandantenscope prüfen; Status erst nach autorisiertem, konsistentem Export ändern.

Mögliche Auswirkungen: - Unberechtigte Änderung finanzieller Exportzustände

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_c77c59c8e36d2de5

**Anyone can inspect other users’ calendar conflicts**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler akzeptiert ein Zeitfenster und liest esc_events mit einem Service-Client ohne sichtbare Identitätsprüfung. Die vollständige Projektions-, Filter- und Rückgabelogik sowie Gatewayabsicherung wurden nicht abschließend geprüft; Umfang der tatsächlich offengelegten Fremddaten bleibt offen.

Nachweise:
- supabase/functions/esc-conflict-check/index.ts:12-31

Betroffene Funktionen:
- esc-conflict-check

Geplante Korrektur: Kalenderberechtigung und zulässigen Benutzer-/Mandantenscope prüfen; Antwort auf erforderliche Konfliktinformationen minimieren.

Mögliche Auswirkungen: - Mögliche Offenlegung fremder Kalenderbelegung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_cd2ce2ad522f11c1

**Signature invitations target arbitrary recipients**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Entgegen einer pauschalen Offenheitsannahme werden Benutzeridentität und sig_can_send geprüft. Die RPC erlaubt ausdrücklich mehrere Versandrollen. Ob diese Rollen frei gewählte Unterzeichner einladen dürfen oder zusätzlich eine Kunden-/Dokumentbindung erforderlich ist, ist fachlich nicht abschließend geklärt; vollständige Sender- und Mailabhängigkeiten fehlen ebenfalls.

Nachweise:
- supabase/functions/sig-create-request/index.ts:47-57
- supabase/functions/sig-create-request/index.ts:69-79
- supabase/migrations/20260717044809_b8421246-0b25-4c9e-8f12-145c802c0365.sql:17-25
- supabase/functions/sig-bulk-create/index.ts:84

Betroffene Funktionen:
- sig-create-request
- sig_can_send
- sig-bulk-create

Geplante Korrektur: Verbindliches Empfänger- und Dokumentberechtigungsmodell festlegen; keine zusätzliche Einschränkung ohne Prüfung legitimer Signaturworkflows einführen.

Mögliche Auswirkungen: - Möglicher Missbrauch zulässiger Signaturversandrechte

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d50cef29292119e8

**Anyone can retrieve another customer's risk score**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler erzeugt ohne sichtbare Identitätsprüfung einen Service-Client und unterstützt Einzelkontakt- sowie Batchverarbeitung. Die gesamte Scoreherleitung, Datenauswahl und Rückgabe wurde nicht abschließend gelesen; die konkrete Datenoffenlegung bleibt unresolved.

Nachweise:
- supabase/functions/ac-churn-predict/index.ts:10-13
- supabase/functions/ac-churn-predict/index.ts:79
- src/pages/AlixConnect/ChurnDetection.tsx:40

Betroffene Funktionen:
- ac-churn-predict

Geplante Korrektur: Analyseberechtigung und Kontakt-/Batchscope prüfen; vollständige Score- und Rückgabekette auditieren.

Mögliche Auswirkungen: - Möglicher fremder Zugriff auf Kundenrisikodaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d599eb858f23ab35_c16d2b6f

**Any signed-in user can export direct-debit details**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Der erste Client validiert den Benutzer. Anschließend wird jedoch ein neuer Service-Client ohne Benutzerheader erzeugt und für den frei übergebenen run_id verwendet. Eine Exportrolle oder objektbezogene Laufberechtigung ist vor diesem Übergang nicht vorhanden.

Nachweise:
- supabase/functions/finance-sepa-export/index.ts:12-23
- src/pages/Finance/Sepa.tsx:144

Betroffene Funktionen:
- finance-sepa-export

Geplante Korrektur: SEPA-Exportrecht sowie Lauf-/Mandantenscope vor privilegiertem Datenzugriff prüfen.

Mögliche Auswirkungen: - Unberechtigter Zugriff auf Lastschriftexportdaten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d827e70493abbc17

**Any signed-in user can export restricted audit logs**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Anders als bei einem uneingeschränkten Service-Client setzt dieser Handler den Authorization-Header des Aufrufers auf demselben Client, mit dem audit_logs gelesen wird. Nach getUser bleibt daher eine benutzerspezifische Datenbankautorisierung relevant. Ohne vollständige aktuelle audit_logs-Policies und Grants ist weder der behauptete RLS-Bypass noch eine ausreichende Zugriffsbeschränkung belegt.

Nachweise:
- supabase/functions/finance-compliance-report/index.ts:13-23
- supabase/functions/finance-compliance-report/index.ts:36-43
- src/pages/Finance/Compliance.tsx:47

Betroffene Funktionen:
- finance-compliance-report

Geplante Korrektur: Aktuelle audit_logs-RLS vollständig auflösen; gegebenenfalls explizites Compliance-Exportrecht ergänzen, ohne einen nicht belegten Service-Bypass zu unterstellen.

Mögliche Auswirkungen: - Mögliche Auditdatenoffenlegung abhängig von RLS

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_d9ed56cd61cd46cd

**Anyone can impersonate a social messaging contact**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Die GET-Verifikation verwendet einen Verifikationstoken, der POST-Eingang prüft dagegen keine kryptografische Provider-Signatur vor privilegierter Kontakt-/Konversations- und Nachrichtenerzeugung. Ein GET-Abonnementcheck authentifiziert keine späteren POST-Nachrichten.

Nachweise:
- supabase/functions/ac-webhook-meta/index.ts:34-57
- supabase/functions/ac-webhook-meta/index.ts:12-30
- supabase/config.toml:319-320

Betroffene Funktionen:
- ac-webhook-meta

Geplante Korrektur: Provider-Signatur am unveränderten Requestbody prüfen, bevor JSON verarbeitet oder Daten geschrieben werden; Kanal-/Mandantenbindung und Ereignisdeduplizierung ergänzend prüfen.

Mögliche Auswirkungen: - Gefälschte eingehende Social-Nachrichten
- Kontakt- und Konversationsverfälschung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_de727ed9fb3a3be4

**Anyone can run bank matching**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler startet ohne sichtbare Identitätsprüfung mit einem Service-Client; tenantId ist optional. Bankzeilen und offene Dokumente werden dadurch potenziell global ausgewählt. Die vollständige Matching- und Buchungswirkung wurde nicht abschließend verfolgt.

Nachweise:
- supabase/functions/cmr-bank-automatch/index.ts:11-25
- supabase/functions/cmr-bank-automatch/index.ts:40-56

Betroffene Funktionen:
- cmr-bank-automatch

Geplante Korrektur: Bankmatchingrecht beziehungsweise Jobidentität prüfen; Mandantenscope und sämtliche Buchungsfolgen vollständig auditieren.

Mögliche Auswirkungen: - Mögliche unberechtigte Zahlungszuordnung

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e2c148fb68294c0b_0e12c928

**Upload advances any selected document’s version**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Upload prüft eine echte Benutzeridentität. Danach werden Dokumentoperationen mit Service-Rechten ausgeführt. Die vollständige Behandlung einer übergebenen bestehenden Dokument-ID, Versionsfortschreibung und aktueller Trigger wurde nicht abgeschlossen; deshalb keine endgültige Bestätigung der behaupteten Fremdversionierung.

Nachweise:
- supabase/functions/alixdocs-upload/index.ts:46-57
- supabase/functions/alixdocs-upload/index.ts:100
- supabase/functions/alixdocs-upload/index.ts:158

Betroffene Funktionen:
- alixdocs-upload

Geplante Korrektur: Bestehende Dokumente vor Versionsanlage explizit auf Änderungsrecht prüfen; Versions- und Triggerkette vollständig auflösen.

Mögliche Auswirkungen: - Mögliche unberechtigte Versionierung fremder Dokumente

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e90b7b2049e0b2bb

**Anyone can trigger paid journey optimization**

Bewertung: Bestätigte kritische Quellcodelücke.

Technische Ursache: Eine frei übergebene journey_id steuert privilegierte Journey-Abfragen und einen KI-Aufruf ohne Aufruferprüfung. Der UI-Aufruf schützt den direkten HTTP-Einstieg nicht; verify_jwt ist in der Quelle deaktiviert.

Nachweise:
- supabase/functions/ac-journey-optimize/index.ts:10-15
- supabase/functions/ac-journey-optimize/index.ts:45-46
- supabase/config.toml:325-326

Betroffene Funktionen:
- ac-journey-optimize

Geplante Korrektur: Journey-Analyseberechtigung und Mandantenscope vor Datenzugriff und kostenpflichtiger KI-Verarbeitung prüfen.

Mögliche Auswirkungen: - Unberechtigte Verarbeitung interner Journey-Daten
- KI-Kosten

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.

Wiederherstellung: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_e9bbf4a68ab93184

**Tax export trusts a caller-selected tenant**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Benutzeridentität und eine erlaubte Rolle werden geprüft. tenant_id stammt dennoch aus der Eingabe und filtert Service-Abfragen; bei fehlender ID entfällt der Filter. Ob die zugelassenen Steuer-/Finanzrollen bewusst globale Berechtigung besitzen, ist nicht belegt; vollständige Filing- und Datenbankabhängigkeiten bleiben offen.

Nachweise:
- supabase/functions/finance-tax-export/index.ts:64-96
- supabase/functions/finance-tax-export/index.ts:106-109
- supabase/functions/finance-tax-export/index.ts:248-254

Betroffene Funktionen:
- finance-tax-export

Geplante Korrektur: Verbindliche globale beziehungsweise mandantenbezogene Steuerexportrechte festlegen und tenant_id daraus ableiten.

Mögliche Auswirkungen: - Möglicher mandantenübergreifender Steuerdatenexport und Filing-Änderungen

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen.

Wiederherstellung: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_ef43972ba6ab93b7_81382866

**Anyone can queue customer outreach**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler erzeugt ohne sichtbare Aufruferprüfung einen Service-Client. Die vollständige Auswahl-, Warteschlangen- und Versandkette wurde nicht abschließend gelesen; eine konkrete unberechtigte Queueoperation und ihre Folgewirkung bleiben deshalb unresolved.

Nachweise:
- supabase/functions/ac-outreach-engine/index.ts:11-14

Betroffene Funktionen:
- ac-outreach-engine

Geplante Korrektur: Outreachrecht oder verifizierte Jobidentität vor Service-Zugriffen erzwingen; Queue-, Scope- und Versandabhängigkeiten vollständig prüfen.

Mögliche Auswirkungen: - Mögliche unberechtigte Kunden-Outreach-Aufträge

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_f0b428fcfe8c9417_dad9f717

**Anyone can send test emails to caller-chosen recipients**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Der Handler enthält keine sichtbare Identitätsprüfung vor einem Provideraufruf mit serverseitigem API-Key. Der gesamte Empfängerpfad, Beschränkungen der Testmail und die effektive Gatewayabsicherung wurden nicht abschließend gelesen; beliebige Zieladressen sind daher nicht abschließend bestätigt.

Nachweise:
- supabase/functions/email-selftest/index.ts:9-36
- supabase/functions/email-selftest/index.ts:67

Betroffene Funktionen:
- email-selftest

Geplante Korrektur: Administratives Testversandrecht prüfen und Testempfänger ausdrücklich begrenzen; vollständigen Versandpfad auditieren.

Mögliche Auswirkungen: - Möglicher Missbrauch des Mailproviders und der Absenderreputation

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.

### lov_finding_fa76ad0c8151f87b

**Any finance user can send demands across tenants**

Bewertung: Nicht abschließend prüfbar.

Technische Ursache: Identität und eine erlaubte Finanzrolle werden geprüft. Der Fall und seine Positionen werden danach nur über case_id mit Service-Rechten gelesen; ein Benutzer-/Mandantenfilter fehlt. Ob die zugelassenen Rollen fachlich globale Fallrechte besitzen und welche Empfängerübersteuerung erlaubt ist, bleibt offen.

Nachweise:
- supabase/functions/collect-send-dunning/index.ts:21-49

Betroffene Funktionen:
- collect-send-dunning

Geplante Korrektur: Fallzugriff und Empfängerübersteuerung anhand eines verbindlichen Finanzberechtigungsmodells explizit prüfen; nachgelagerte Versandkette abschließen.

Mögliche Auswirkungen: - Möglicher unberechtigter Mahnversand für fremde Fälle

Vorgesehene Regressionstests (nicht durchgeführt):
- Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.
- Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.
- Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.

Wiederherstellung: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.

Product Hub: kein direkter Bezug in diesem Review bestätigt. Doppelzuordnung: keine gesicherte Zuordnung.



## Abschluss der Gegenprüfung

Alle 266 Scanner-IDs wurden anhand einzelner Quellpfade bewertet; 251 referenzierte Quelldateien und gültige Zeilenpositionen nachkontrolliert. Die Bewertung ist eine statische Quellcode- und Metadatenanalyse, kein Nachweis der gegenwärtigen Live-Ausnutzbarkeit oder eine erfolgreiche Benutzer-/Provider-Ende-zu-Ende-Abnahme. Eine zunächst als Fehlalarm eingestufte AI-Suche wurde nach Gegenprüfung korrigiert: sichere Antwort-Textknoten verhindern nicht die separate ungeprüfte HTML-Einfügung der Quellen-Snippets in Zeilen 139–142. Dieser Befund ist daher Teil von Paket A.

Keine technisch begründete Ausnahme und kein Fehlalarm wurden abschließend angenommen. Ein Befund besitzt im aktuellen Code eine Websitebindung; eine historische Korrektur oder identische Live-Version ist dadurch nicht bewiesen. Die fehlende Besucherbindung wird unabhängig weiter als Risiko geführt. Neun Doppelmeldungen sind mit Haupt-ID und technischer Zuordnung dokumentiert; Hauptbefunde bleiben offen.

Katalogprüfung: 581 öffentliche SECURITY-DEFINER-Funktionen, davon 12 für anon und 476 für authenticated ausführbar. Diese Zahlen sind keine 581 zusätzlichen bestätigten Lücken; interne Guards und tatsächliche Datenwirkung entscheiden.

Die Leseprüfung der lokalen Gateway-Konfiguration fand doppelte TOML-Funktionsabschnitte (unter anderem ticket-sla-check); daraus wird keine tatsächliche Live-Gateway-Konfiguration abgeleitet. Deployment-/Gateway-Nachweise sind vor späterer Umsetzung separat zu verifizieren. Die Konfiguration wurde nicht verändert.

Letzte Publish-Settings-Nachkontrolle: is_published=true, published_at=2026-11-28T04:46:01.420887Z. Es wurde durch diesen Analyseauftrag kein Publish ausgelöst; eine aktuell durch dieses Werkzeug abgelehnte Veröffentlichung ist nicht bestätigt.

Bestandsnachkontrolle: 44 Produkte und 102 Jobs mit denselben vorstehend dokumentierten Fingerprints. enabled=false, emergency_stopped=true, DE/COM blocked, revision=0. Alle Scannerbefunde unverändert; keine Managementaktion zum Schließen oder Ignorieren ausgeführt.

## Noch offene Nachweise

65 kritische IDs sind nicht abschließend prüfbar: die jeweilige Zeile dokumentiert ungeklärte Berechtigungs-/Datenbank-/Aufrufer-/Gateway-Abhängigkeiten. Vor pauschaler Korrektur sind diese Abhängigkeiten einzeln aufzulösen. Ein neu gestarteter Tiefenscan läuft separat; Ergebnis und neuer Scannerstand sind in dieser 266-ID-Bilanz nicht vorweggenommen. Reale authentifizierte Multi-Benutzer-/Mandanten- und Providerprüfungen fehlen; keine Zugangsdaten wurden angefordert und keine erfolgreichen Prüfungen simuliert.
