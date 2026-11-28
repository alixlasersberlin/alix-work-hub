# A4 – Dokumente und Signaturen

Stand: 28.11.2026; ausschließlich Vorbereitung.

## Bilanz

Gesamt 30; bestätigt kritisch 19; ungeklärt 10; Fehlkonfigurationen 0; Doppelmeldungen 1; im Code geschützt 0.

Abhängigkeiten: A1, A2, A3, A5, A7.

Dokument-, Version-, Kunden-/Auftrags- und Signaturberechtigung vor Servicezugriff und Linkerzeugung. Öffentliche Sign-Capability eng an Antrag/Datei binden, keine Faksimiles fremder Nutzer. Audit-/PDF-Hash und unveränderliche Finanz-/Signatursnapshots erhalten. Keine gespeicherten Geschäftsunterlagen überschreiben.

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

### lov_finding_773ec74739954988

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-mail-import`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `alixdocs-mail-import`.
- Belege: supabase/functions/alixdocs-mail-import/index.ts:23-41; supabase/functions/alixdocs-mail-import/index.ts:53-89; src/components/alixdocs/MailToAlixDocsButton.tsx:37.
- Ursache/Prüfgrenze: Nach getUser wird der Mailanhang ausschließlich per ID mit Service-Role geladen und aus dessen Speicherpfad kopiert. Mailkonto-, Nachrichten-, Mandanten- und Zielobjektberechtigung fehlen. Das neue Dokument wird dem Aufrufer zugeschrieben.
- Geplante konkrete Änderung: Aktives Dokumentimportrecht, Zugriff auf Quellmailkonto und Nachricht sowie Zielkunde/-auftrag vor Download und Upload prüfen.
- Betriebsfolgen: Kopieren fremder privater Anhänge; Unberechtigte Dokumentzuordnung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremdes Mailkonto, fremder Zielauftrag und deaktivierter Nutzer negativ; eigener erlaubter Anhang positiv..
- Sicherer Wiederherstellungsplan: Import sperren; unberechtigte Kopien und Versionen kontrolliert entfernen, Audit behalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_c79ad01cbeb6bd2e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-hash-backfill`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-hash-backfill`.
- Belege: supabase/functions/alixdocs-hash-backfill/index.ts:21-40; supabase/functions/alixdocs-hash-backfill/index.ts:46-75.
- Ursache/Prüfgrenze: Die Rollenprüfung läuft nur bei jwt && jwt !== serviceKey. Ein fehlender Authorization-Header überspringt sie vollständig. Danach werden Dokumentversionen privilegiert heruntergeladen und content_hash-Werte geschrieben.
- Geplante konkrete Änderung: Fehlendes Credential vor jedem Zugriff abweisen; Servicecredential exakt prüfen, sonst aktive Adminrolle verbindlich validieren.
- Betriebsfolgen: Unberechtigte Dokumentwartung; Speicher-/Rechenlast; Globale Hashänderungen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: leerer Header, ungültiger Token und gewöhnlicher Login negativ; aktiver Admin und Jobcredential positiv..
- Sicherer Wiederherstellungsplan: Backfill sperren; Hashes nur aus verifizierten Originaldateien neu berechnen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e2c148fb68294c0b_ef5f34ce

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-upload`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-upload`.
- Belege: supabase/functions/alixdocs-upload/index.ts:46-58; supabase/functions/alixdocs-upload/index.ts:94-98; supabase/functions/alixdocs-upload/index.ts:114-139.
- Ursache/Prüfgrenze: Nach getUser lädt ein separater Adminclient existing_document_id ohne Dokumentberechtigung und berechnet die nächste Version. upload verwendet zwar upsert:false und überschreibt damit nicht dieselben Speicherbytes; fremde Dokumente können dennoch durch neue Version und Aktualisierung ihres aktuellen Stands verändert werden.
- Geplante konkrete Änderung: Aktives Dokumentbearbeitungsrecht sowie Dokument-, Kunden-/Auftrags- und Mandantenscope vor privilegiertem Read und Upload prüfen; Versionierung atomar machen.
- Betriebsfolgen: Manipulation fremder Dokumentversionen; Verlust der Dokumentintegrität.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: fremdes Dokument und deaktivierter Nutzer negativ; erlaubte neue Version; parallele Versionierung und Fehlerbereinigung..
- Sicherer Wiederherstellungsplan: Versionierungsupload sperren; current_version auf verifizierte Vorversion setzen und Fremdversion quarantänisieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_ef8daa497c253e85

- Bewertung: verifizierte Doppelmeldung; Korrekturgruppe `CG.alixdocs-mail-import`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `alixdocs-mail-import`.
- Belege: supabase/functions/alixdocs-mail-import/index.ts:23-41; supabase/functions/alixdocs-mail-import/index.ts:53-89.
- Ursache/Prüfgrenze: Verifiziert dieselbe mail_attachment_id-basierte Service-Role-Kopie wie beim Referenzbefund, einschließlich Download, Upload und Anlage eines dem Aufrufer zugeschriebenen Dokuments.
- Geplante konkrete Änderung: Mit Referenzbefund beheben; Quellmail- und Zielobjektberechtigung verbindlich prüfen.
- Betriebsfolgen: Kopieren fremder Anhänge; Unberechtigte Dokumentanlage.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant: Mailkonto-/Mandanten-Negativtests des Referenzbefunds übernehmen..
- Sicherer Wiederherstellungsplan: Wie Referenzbefund: Import sperren und unberechtigte Kopien kontrolliert entfernen.
- Doppelmeldungsreferenz: lov_finding_773ec74739954988.

### lov_finding_27ef54fe18b6bfc6

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-learn-rules.matching-feedback-preview`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-learn-rules`.
- Belege: supabase/functions/alixdocs-learn-rules/index.ts:49-68; supabase/functions/alixdocs-learn-rules/index.ts:78-90; supabase/functions/alixdocs-learn-rules/index.ts:176-179.
- Ursache/Prüfgrenze: Die Authentifizierungsverzweigung lautet if (jwt && jwt !== serviceKey). Bei leerem JWT wird sie vollständig übersprungen; privilegierte Feedback-Abfragen und dryRun-Vorschauen bleiben im Handler erreichbar. Die vorhandenen Rollenprüfungen schließen diesen Leerpfad nicht.
- Geplante konkrete Änderung: Leere Zugangsdaten ausdrücklich ablehnen; nur exakten nichtleeren Service-Schlüssel oder aktiven berechtigten Administrator zulassen.
- Betriebsfolgen: Unberechtigter Zugriff auf Matching-Feedback; Unberechtigte Regeländerungen außerhalb dryRun.
- Geplante Regressionstests, noch nicht ausgeführt: Fehlenden und leeren Authorization-Header sowie öffentliche Schlüssel vor sämtlichen Abfragen ablehnen..
- Sicherer Wiederherstellungsplan: Regellernjob pausieren und Handler sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_3e001c78892db51d

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.send-order-confirmation`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `send-order-confirmation`.
- Belege: supabase/functions/send-order-confirmation/index.ts:41-49; supabase/functions/send-order-confirmation/index.ts:75-83; supabase/functions/send-order-confirmation/index.ts:106-116.
- Ursache/Prüfgrenze: Die Benutzeridentität wird geprüft, aber der anschließende privilegierte Zugriff auf Signatur, Signaturanfrage und Bestellung ist nicht an deren Berechtigung gebunden.
- Geplante konkrete Änderung: Aktive Bestellberechtigung beziehungsweise streng getrennten Maschinenpfad vor jedem Bestell- und Signaturzugriff prüfen.
- Betriebsfolgen: Unberechtigter Zugriff auf Bestell- und Kundendaten; Unberechtigter Bestätigungsversand.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde order_id und signatureId sowie inaktiven Benutzer ohne PDF- und Versandzugriff ablehnen..
- Sicherer Wiederherstellungsplan: Bestätigungsversand dieses Endpunkts sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_5a4b77537eec8b00

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-zip`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-zip`.
- Belege: supabase/functions/alixdocs-zip/index.ts:39-60; supabase/migrations/20260719100325_4dd2df07-fbc5-4436-9cd8-454a80006197.sql:11-18.
- Ursache/Prüfgrenze: Dokumente werden tatsächlich RLS-beschränkt im Benutzerkontext geladen. Danach vertraut der Admin-Download auf storage_path der aktuellen Version. Für den behaupteten Angriff muss ein unberechtigter Aufrufer diesen Versionspfad wirksam auf ein fremdes Objekt setzen können; diese vollständige Schreib- und Triggerkette wurde nicht abschließend verifiziert.
- Geplante konkrete Änderung: Alle Versions-Schreibpolicies und Trigger prüfen; Speicherobjekt serverseitig an Dokument, Version und Mandant binden oder mit Benutzerberechtigung herunterladen.
- Betriebsfolgen: Bedingter mandantenübergreifender Dateizugriff bei manipulierbarem Versionspfad.
- Geplante Regressionstests, noch nicht ausgeführt: Mit isolierten Fixtures prüfen, ob ein berechtigter Dokumentbearbeiter einen fremden storage_path setzen und dessen Objekt herunterladen könnte..
- Sicherer Wiederherstellungsplan: ZIP-Download bis zur Klärung sperren; RLS-Prüfung nicht entfernen.
- Doppelmeldungsreferenz: keine.

### lov_finding_7f26776bd0d3a68e

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.convert-signed-offer-to-order`; Abhängigkeiten A1, A2, A5, A3.
- Funktionen: `convert-signed-offer-to-order`.
- Belege: supabase/functions/convert-signed-offer-to-order/index.ts:10-42; supabase/functions/convert-signed-offer-to-order/index.ts:157-181; supabase/functions/alix-sign-submit/index.ts:234.
- Ursache/Prüfgrenze: Der Handler sucht anhand offer_number nach unterschriebenen Anfragen und erzeugt Bestellpositionen beziehungsweise Finanzierungsdaten ohne eigene Aufruferberechtigung. Bereits vorhandene Unterschriften legitimieren nicht jeden Aufrufer zur Konvertierung.
- Geplante konkrete Änderung: Konvertierung nur verifizierten internen Aufrufern oder aktiv berechtigten Benutzern erlauben; Signatur und Auftrag serverseitig binden.
- Betriebsfolgen: Unberechtigte Auftragserzeugung; Unberechtigte Finanzierungsdatensätze.
- Geplante Regressionstests, noch nicht ausgeführt: Direkten unberechtigten Aufruf trotz existierendem unterschriebenem Angebot ablehnen; Idempotenz isoliert prüfen..
- Sicherer Wiederherstellungsplan: Konvertierungsendpunkt sperren; Signaturannahme und Auftragsanlage getrennt behandeln.
- Doppelmeldungsreferenz: keine.

### lov_finding_8a473438782bef1a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sig-render-final`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sig-render-final`.
- Belege: supabase/functions/sig-render-final/index.ts:18-40; supabase/functions/sig-render-final/index.ts:125-137; supabase/functions/sig-submit/index.ts:141.
- Ursache/Prüfgrenze: document_id steuert ohne Handler-Autorisierung das Laden von Signaturdokument und Signaturen, privilegierten Dateidownload, finales Rendering sowie Versions- und Dokumentänderungen. Der legitime interne Aufrufer schützt den direkt aufrufbaren Handler nicht.
- Geplante konkrete Änderung: Nur verifizierte Signaturjobs beziehungsweise explizit berechtigte aktive Benutzer zulassen; Dokumentstatus und Signaturvollständigkeit serverseitig prüfen.
- Betriebsfolgen: Unberechtigte Änderung signierter Dokumentversionen; Verletzung der Dokumentintegrität.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte document_id ohne Storage-Download, Upload und Versionsänderung ablehnen..
- Sicherer Wiederherstellungsplan: Finalisierungsjob sperren; alte Versionen unverändert erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_ac9f74df4aa376ea

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sig-apply-facsimile.render-pdf`; Abhängigkeiten A1, A2, A5, A3.
- Funktionen: `sig-apply-facsimile`.
- Belege: supabase/functions/sig-apply-facsimile/index.ts:32-61; supabase/functions/sig-apply-facsimile/index.ts:110-117.
- Ursache/Prüfgrenze: Der Handler akzeptiert PDF und Dokumenttyp ohne Aufruferberechtigung, lädt die konfigurierte Faksimilegrafik privilegiert und liefert das bearbeitete PDF zurück. Aktivierte Konfiguration ist eine Betriebsbedingung, keine Berechtigung des Aufrufers.
- Geplante konkrete Änderung: Nur verifizierte interne Dokumentprozesse oder explizit berechtigte aktive Signaturverantwortliche zulassen; Dokumentherkunft binden.
- Betriebsfolgen: Unberechtigte Verwendung einer gespeicherten Unterschrift; Erzeugung scheinbar autorisierter Dokumente.
- Geplante Regressionstests, noch nicht ausgeführt: Beliebiges callererzeugtes PDF ohne berechtigten Vorgang vor Grafikdownload abweisen..
- Sicherer Wiederherstellungsplan: Faksimileanwendung deaktivieren; Grafik nicht öffentlich machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b6ddd0c4b7e8a609

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.delivery-approval-monthly-report`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `delivery-approval-monthly-report`.
- Belege: supabase/functions/delivery-approval-monthly-report/index.ts:21-56; supabase/functions/delivery-approval-monthly-report/index.ts:124-134.
- Ursache/Prüfgrenze: Der Berichtshandler besitzt keine Aufruferprüfung vor Einstellungen, Freigabedaten und Mailversand. enabled- und Empfängerprüfungen sind fachliche Schalter, keine Job-Autorisierung.
- Geplante konkrete Änderung: Verifizierten Berichtsjob beziehungsweise aktive Freigabeberichtsberechtigung verlangen und Empfänger serverseitig begrenzen.
- Betriebsfolgen: Unberechtigter Berichtsversand; Offenlegung interner Freigabedaten.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigten Aufruf bei aktiviertem Bericht ohne Datenabfrage und Mailversand ablehnen..
- Sicherer Wiederherstellungsplan: Monatsberichtjob pausieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_b98203874ed68dbf

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-sign-return`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-sign-return`.
- Belege: supabase/functions/alixdocs-sign-return/index.ts:19-50; supabase/migrations/20260719091800_25246b8d-312d-432f-909a-e95984ab6aac.sql:13.
- Ursache/Prüfgrenze: Eine callergewählte Signaturanfrage wird ohne verifizierte Aufruferberechtigung privilegiert geladen; der Pfad lädt signierte Dateien und erzeugt eine AlixDocs-Version. Die Existenz einer Dokumentverknüpfung ersetzt keine Berechtigung für den Rücklauf.
- Geplante konkrete Änderung: Verifizierten Signaturrücklauf vor Datenzugriff verlangen und Anfrage, abgeschlossenes Signaturereignis, Zieldokument und Version serverseitig binden.
- Betriebsfolgen: Unberechtigte Übernahme von Signaturdateien; Verletzung der AlixDocs-Dokumentintegrität.
- Geplante Regressionstests, noch nicht ausgeführt: Unberechtigte oder nicht abgeschlossene Signaturanfrage ohne Download, Upload und Versionsanlage ablehnen..
- Sicherer Wiederherstellungsplan: Signaturrücklauf pausieren; bestehende Dokumentversionen erhalten.
- Doppelmeldungsreferenz: keine.

### lov_finding_ff271ba19700e47f

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.delivery-approval-mail`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `delivery-approval-mail`.
- Belege: supabase/functions/delivery-approval-mail/index.ts:20-63.
- Ursache/Prüfgrenze: Der Handler validiert die Benutzeridentität, bindet den nachfolgenden Versand aber nicht ausreichend an aktive Freigabe-, Ressourcen- und Empfängerberechtigungen. Eine gültige Anmeldung allein autorisiert weder beliebige Freigabeunterlagen noch beliebige Empfänger.
- Geplante konkrete Änderung: Aktive Versandberechtigung für den konkreten Freigabevorgang verlangen; PDF serverseitig ableiten und Empfänger an autorisierte Vorgangskontakte binden.
- Betriebsfolgen: Unberechtigter Versand von Freigabeunterlagen; Missbrauch geschäftlicher Versandidentität.
- Geplante Regressionstests, noch nicht ausgeführt: Angemeldeten Benutzer ohne Vorgangsrecht sowie unberechtigte PDF-/Empfängerübersteuerung ohne Versand ablehnen..
- Sicherer Wiederherstellungsplan: Freigabemail-Versand sperren.
- Doppelmeldungsreferenz: keine.

### lov_finding_016dbf8483032e9a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alix-sign-resend`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `alix-sign-resend`.
- Belege: supabase/functions/alix-sign-resend/index.ts:19-44; supabase/functions/alix-sign-resend/index.ts:73-80; supabase/functions/alix-sign-resend/index.ts:110-128.
- Ursache/Prüfgrenze: Der Handler liest signature_id ohne Identitätsprüfung mit Service Role. Die verknüpfte Signaturanfrage wird ebenfalls privilegiert geladen. body.email überschreibt den Empfänger; die Antwort enthält zusätzlich download_url. Damit ist nicht nur erneuter Versand an den ursprünglichen Kunden möglich.
- Geplante konkrete Änderung: Identität und Berechtigung auf die konkrete Signaturanfrage vor jedem privilegierten Zugriff prüfen; Empfänger aus autorisierten Stammdaten ableiten und Overrides gesondert berechtigen.
- Betriebsfolgen: Offenlegung signierter Unterlagen; Unberechtigter E-Mail-Versand; Storage- und Audit-Schreibzugriffe.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen Zugriff und fremde signature_id ablehnen; berechtigten Versand erlauben; fremden Empfänger ablehnen..
- Sicherer Wiederherstellungsplan: Bei Regression Versand deaktivieren; fehlende Objektprüfung nicht wieder freigeben.
- Doppelmeldungsreferenz: keine.

### lov_finding_2d96488747bd90ab

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-approval-decide`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-approval-decide`.
- Belege: supabase/functions/alixdocs-approval-decide/index.ts:18-46.
- Ursache/Prüfgrenze: Die Zuweisungsprüfung greift nur bei truthy current_approver. Bei NULL darf jeder authentifizierte Benutzer den ausgewählten pending-Zustand ändern und gegebenenfalls das Dokument freigeben.
- Geplante konkrete Änderung: Fehlende Genehmigerzuordnung standardmäßig ablehnen; Rollenfreigaben explizit prüfen und Entscheidung atomar an Zustand und Berechtigung binden.
- Betriebsfolgen: Unberechtigte Freigabe oder Ablehnung fremder Dokumente.
- Geplante Regressionstests, noch nicht ausgeführt: NULL-Genehmiger, fremder Genehmiger und konkurrierende Entscheidung; jeweils unveränderten Zustand prüfen..
- Sicherer Wiederherstellungsplan: Freigabeentscheidungen sperren; betroffene Entscheidungen fachlich revidieren.
- Doppelmeldungsreferenz: keine.

### lov_finding_3b26108661a79fab

- Bewertung: ungeklärt; Korrekturgruppe `CG.convert-signed-offer-to-order`; Abhängigkeiten A1, A2, A5, A3.
- Funktionen: `convert-signed-offer-to-order`, `createOrderOnce`.
- Belege: supabase/functions/convert-signed-offer-to-order/index.ts:1-39.
- Ursache/Prüfgrenze: Der Handler liest signierte Angebote ohne Aufruferprüfung privilegiert nach offer_number. Die tatsächlich ausgelagerte Auftragsanlage createOrderOnce und ihre Autorisierungsabhängigkeiten wurden nicht vollständig gelesen; die Signaturstatusprüfung ist keine Benutzerautorisierung.
- Geplante konkrete Änderung: Konvertierungsberechtigung auf Angebot und Kunden vor Zugriff prüfen; order-identity.ts einschließlich Aufrufern vollständig auditieren.
- Betriebsfolgen: Unberechtigter Zugriff auf signierte Angebotsdaten; Mögliche unberechtigte Auftragsanlage.
- Geplante Regressionstests, noch nicht ausgeführt: Anonymen und mandantenfremden Konvertierungsversuch ablehnen; berechtigte Konvertierung idempotent prüfen..
- Sicherer Wiederherstellungsplan: Konvertierung sperren; erzeugte Aufträge fachlich prüfen statt pauschal löschen.
- Doppelmeldungsreferenz: keine.

### lov_finding_74e43b7ec94e2367_821fd4e7

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-customer-export`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-customer-export`, `getTenantScope`, `customerInScope`.
- Belege: supabase/functions/alixdocs-customer-export/index.ts:25-56; supabase/functions/_shared/tenant-scope.ts:55-75; supabase/functions/_shared/tenant-scope.ts:96-103.
- Ursache/Prüfgrenze: Eine Kunden-Scope-Prüfung existiert tatsächlich vor dem Dokumentdownload. Sie ist jedoch für Benutzer ohne Mandantenzuweisung wirkungslos: getTenantScope setzt restricted=false, und customerInScope gibt dann sofort true zurück. Anschließend werden sämtliche Kundendokumente privilegiert exportiert.
- Geplante konkrete Änderung: Scope ohne Zuweisung schließen und eigenständige Kundenexportberechtigung verlangen.
- Betriebsfolgen: Komplettexport fremder Kundendokumente durch Benutzer ohne Zuweisung.
- Geplante Regressionstests, noch nicht ausgeführt: Benutzer ohne Zuweisung darf keine fremden Kunden exportieren; zugewiesene Benutzer nur ihren Scope..
- Sicherer Wiederherstellungsplan: Kundenexport sperren; erzeugte Downloadartefakte widerrufen, soweit vorhanden.
- Doppelmeldungsreferenz: keine.

### lov_finding_98051a4a477129d7

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-sign-request`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `alixdocs-sign-request`.
- Belege: supabase/functions/alixdocs-sign-request/index.ts:18-59.
- Ursache/Prüfgrenze: Nach getUser wird das frei gewählte Dokument ohne Objektprüfung privilegiert geladen. Seine private PDF-Version wird kopiert und für einen frei gewählten signer_email ein Signaturvorgang angelegt.
- Geplante konkrete Änderung: Leserecht und Signaturanforderungsrecht auf das konkrete Dokument sowie zulässige Unterzeichner prüfen.
- Betriebsfolgen: Unberechtigte Nutzung fremder PDF-Dokumente; Unberechtigte Signaturvorgänge.
- Geplante Regressionstests, noch nicht ausgeführt: Fremdes document_id ablehnen; keine Storagekopie oder Signaturzeile bei Ablehnung..
- Sicherer Wiederherstellungsplan: Signaturbrücke sperren; unberechtigte Requests widerrufen und Kopien bereinigen.
- Doppelmeldungsreferenz: keine.

### lov_finding_c3733d2c215fc774

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-smart-match`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-smart-match`.
- Belege: supabase/functions/alixdocs-smart-match/index.ts:1-275.
- Ursache/Prüfgrenze: Der aktuelle Smart-Match-Handler, seine Dokumentauswahl und der konkrete Updatepfad wurden nicht abschließend gelesen. Eine Aussage über aktuelle Dokumentberechtigungen wäre spekulativ.
- Geplante konkrete Änderung: Alle Modi und Schreibpfade einschließlich Dokument-, Kunden- und Mandantenzuordnung prüfen.
- Betriebsfolgen: Potenzielle Änderung fremder Dokumentzuordnungen.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde Dokument-ID und mandantenfremde Matchziele in jedem Modus prüfen..
- Sicherer Wiederherstellungsplan: Schreibende Matchmodi sperren; Zuordnungen aus Historie wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_dbd4ea3dfc6fc0db

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-upload`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-upload`.
- Belege: supabase/functions/alixdocs-upload/index.ts:1-167.
- Ursache/Prüfgrenze: Der aktuelle Upload- und Überschreibpfad einschließlich Dokumentauswahl, Versionsanlage und Storageautorisierung wurde nicht abschließend gelesen. Eine fremde Dokumentüberschreibung ist deshalb noch nicht belegt.
- Geplante konkrete Änderung: Neuanlage und Versionsupload getrennt prüfen; vorhandene document_id vor Storage- und Metadatenänderungen auf Schreibrecht prüfen.
- Betriebsfolgen: Potenzielle Überschreibung fremder Dokumente.
- Geplante Regressionstests, noch nicht ausgeführt: Fremde document_id, manipulierten Storagepfad und parallelen Versionsupload prüfen..
- Sicherer Wiederherstellungsplan: Überschreibmodus sperren; letzte gültige Dokumentversion wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_24579cadca97b1b6

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-hash-backfill`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-hash-backfill`.
- Belege: supabase/functions/alixdocs-hash-backfill/index.ts:29-40; supabase/functions/alixdocs-hash-backfill/index.ts:47-75; src/pages/AlixDocsDuplicates.tsx:77.
- Ursache/Prüfgrenze: Die Bedingung if (jwt && jwt !== serviceKey) überspringt bei leerem oder fehlendem Token sämtliche Rollenprüfungen. Anschließend werden private Dateien mit Service-Rechten geladen und Dokumenthashes geschrieben. Ohne effektive Gatewaykonfiguration ist die vollständige anonyme Erreichbarkeit nicht geschlossen; nichtleere unprivilegierte Tokens werden dagegen geprüft.
- Geplante konkrete Änderung: Leere Identität ausdrücklich ablehnen; Service-Identität nur durch positive Gleichheitsprüfung akzeptieren; übrige Aufrufer vollständig authentifizieren und autorisieren.
- Betriebsfolgen: Bedingt unberechtigter Dokumentdownload und Hash-Backfill.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_28bb477650901ea0_7d236364

- Bewertung: ungeklärt; Korrekturgruppe `CG.delivery-approval-monthly-report`; Abhängigkeiten A1, A2, A5.
- Funktionen: `delivery-approval-monthly-report`.
- Belege: supabase/functions/delivery-approval-monthly-report/index.ts:21-31; supabase/functions/delivery-approval-monthly-report/index.ts:56; supabase/functions/delivery-approval-monthly-report/index.ts:122-124.
- Ursache/Prüfgrenze: Im Handler ist zwischen Einstieg, Service-Lesen der Freigaben und direktem Resend-Aufruf keine Aufruferprüfung erkennbar. Der vollständige Empfängerableitungspfad und die effektive Gatewayabsicherung wurden nicht abschließend verfolgt; die Behauptung beliebiger Zieladressen bleibt daher offen.
- Geplante konkrete Änderung: Berichtsberechtigung beziehungsweise interne Jobidentität erzwingen und Empfängerübersteuerungen explizit autorisieren.
- Betriebsfolgen: Möglicher unberechtigter Berichtsversand; Mögliche Offenlegung von Freigabedaten.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_2f496f49c8a0776a

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sig-apply-facsimile.read-configuration`; Abhängigkeiten A1, A2, A5, A3.
- Funktionen: `sig-apply-facsimile`.
- Belege: supabase/functions/sig-apply-facsimile/index.ts:32-61; supabase/functions/zoho-invoice-pdf/index.ts:166-168.
- Ursache/Prüfgrenze: Der Handler akzeptiert ein PDF und einen Dokumenttyp, lädt anschließend Service-geschützte Faksimilekonfiguration und Signaturgrafik ohne Aufruferprüfung. Der legitime Aufruf aus zoho-invoice-pdf authentifiziert andere direkte Aufrufe nicht. Kein Duplikat des separaten Asset-Downloadbefunds: Hier ist die Konfigurationsoperation ausgewählt.
- Geplante konkrete Änderung: Nur verifizierte interne Aufrufer und nachweislich autorisierte Dokumentidentitäten zulassen; keine frei eingereichten PDFs pauschal stempeln.
- Betriebsfolgen: Missbrauch einer offiziellen Unterschriftsdarstellung.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_5eb7960ed2ed2229

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocsaisearch.ask`; Abhängigkeiten A1, A2, A5.
- Funktionen: `AlixDocsAiSearch.ask`, `AlixDocsAiSearch.renderAnswer`.
- Belege: src/pages/AlixDocsAiSearch.tsx:26-32; src/pages/AlixDocsAiSearch.tsx:124-145.
- Ursache/Prüfgrenze: Gegenprüfung korrigiert die erste Bewertung: Antwortfragmente sind zwar React-Textknoten (Zeilen 40–62), aber Quellen-Snippets werden separat unverändert über dangerouslySetInnerHTML gerendert (Zeilen 139–142). Die behauptete gespeicherte HTML-Einfügung bleibt damit vorhanden. Admin-Routenschutz entfernt das Risiko bei manipulierten autorisierten Quelldokumenten nicht; keine produktive Ausnutzung getestet.
- Geplante konkrete Änderung: Quellen-Snippets als sichere Text-/Highlight-Segmente rendern oder streng mit bestehendem Sanitizer auf notwendige Formatierung begrenzen; keine ungeprüften HTML-Ereignisattribute oder aktiven Inhalte.
- Betriebsfolgen: Gespeicherte Quelltexte können aktive HTML-Inhalte in die administrative Suchansicht einschleusen.; Formatierte Suchtreffer müssen erhalten bleiben, ohne aktives HTML auszuführen..
- Geplante Regressionstests, noch nicht ausgeführt: Isolierte Quell-Snippets mit Ereignisattributen/aktiven Tags dürfen keine Ausführung auslösen; sichere Hervorhebungen und Links bleiben nutzbar..
- Sicherer Wiederherstellungsplan: Nur eine nachweislich sichere Render-Version wiederherstellen; Roh-HTML-Darstellung nicht erneut freigeben. Keine produktive Quelldatenänderung.
- Doppelmeldungsreferenz: keine.

### lov_finding_6eb5a3fe59d356e3

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.alixdocs-attach-from-storage`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-attach-from-storage`.
- Belege: supabase/functions/alixdocs-attach-from-storage/index.ts:34-46; supabase/functions/alixdocs-attach-from-storage/index.ts:60-65; src/components/alixdocs/AttachToOrderDialog.tsx:79.
- Ursache/Prüfgrenze: Der Benutzerzweig prüft nur getUser. Frei übergebene source_bucket und source_path werden anschließend über den Service-Storageclient geladen, ohne den Dateizugriff des Benutzers mit dessen Identität zu prüfen. Die alternative interne Schlüsselprüfung schränkt diesen Benutzerzweig nicht ein.
- Geplante konkrete Änderung: Quelldatei unter Benutzeridentität lesen oder den Zugriff serverseitig objektspezifisch prüfen; Buckets begrenzen und Zielobjekt separat autorisieren.
- Betriebsfolgen: Unberechtigter Zugriff auf fremde Storage-Dateien.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts; kein unmittelbarer Rollback erforderlich. Bei späterer Korrektur den Handler bei Problemen deaktivieren oder auf eine nachweislich geschützte Version zurücksetzen; keinen ungeschützten Zugriff wiederherstellen.
- Doppelmeldungsreferenz: keine.

### lov_finding_a0a466e697d09e51

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-learn-rules.write-matching-rules`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-learn-rules`.
- Belege: supabase/functions/alixdocs-learn-rules/index.ts:49-68; supabase/functions/alixdocs-learn-rules/index.ts:179-192; supabase/migrations/20260719114804_bfb6378f-a127-4bd8-849b-8f69935f44ab.sql:5.
- Ursache/Prüfgrenze: Nur nichtleere Tokens ungleich Service-Key durchlaufen Identitäts- und Rollenprüfung. Fehlende beziehungsweise leere Tokens überspringen diese vollständig; anschließend werden Matchingregeln mit Service-Rechten angelegt oder geändert. Ob das Gateway solche Requests zuverlässig abweist, ist nicht nachgewiesen.
- Geplante konkrete Änderung: Leere Identität ablehnen; Service-Aufruf ausdrücklich positiv verifizieren; sonst Benutzer und Rolle prüfen.
- Betriebsfolgen: Bedingt unberechtigte Änderung der Dokumentzuordnungsregeln.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

### lov_finding_ad68a76e0a7dba39

- Bewertung: kritische Quellcodelücke bestätigt; Korrekturgruppe `CG.sig-apply-facsimile.download-signature-asset`; Abhängigkeiten A1, A2, A5, A3.
- Funktionen: `sig-apply-facsimile:Assetdownload`.
- Belege: supabase/functions/sig-apply-facsimile/index.ts:32-61; supabase/functions/zoho-invoice-pdf/index.ts:168.
- Ursache/Prüfgrenze: Der Service-Storagedownload der offiziellen Signaturgrafik ist durch keine Identitäts- oder Dokumentberechtigungsprüfung geschützt. Übergebene PDFs können damit verarbeitet werden. Gegenüber dem Konfigurationslesebefund ist eine andere konkrete Operation ausgewählt; deshalb keine Dublettenklassifikation.
- Geplante konkrete Änderung: Signaturasset nur nach verifizierter interner Identität und autorisierter Dokumentbindung laden.
- Betriebsfolgen: Missbrauch offizieller Unterschriftsgrafik.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_b0bea2646e06d7cc

- Bewertung: ungeklärt; Korrekturgruppe `CG.sig-render-final.request-document-binding-unresolved`; Abhängigkeiten A1, A2, A5.
- Funktionen: `sig-render-final`, `sig-submit`.
- Belege: supabase/functions/sig-render-final/index.ts:18-40; supabase/functions/sig-render-final/index.ts:125-137; supabase/functions/sig-submit/index.ts:141.
- Ursache/Prüfgrenze: Der Finalisierer liest document_id und request_id unabhängig mit Service-Rechten; eine Identitätsprüfung, nachgewiesene Zusammengehörigkeit und vollständige Signaturfreigabe fehlen im gelesenen Einstieg. Ein legitimer Aufruf aus sig-submit existiert. Dessen vollständige Freigabekette sowie aktuelle Datenbankbedingungen wurden nicht abgeschlossen.
- Geplante konkrete Änderung: Finalisierer ausschließlich intern authentifiziert aufrufen; Request-Dokument-Bindung und erforderlichen Signaturabschluss serverseitig prüfen.
- Betriebsfolgen: Mögliche unberechtigte Dokumentfinalisierung; Mögliche falsche Zuordnung von Signaturen.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: ausschließlich explizit verifizierte interne Jobidentität zulassen; normale Benutzer und manipulierte Header ablehnen; wiederholte Ausführung auf Idempotenz prüfen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_cd2ce2ad522f11c1

- Bewertung: ungeklärt; Korrekturgruppe `CG.sig-create-request`; Abhängigkeiten A1, A2, A5, A7.
- Funktionen: `sig-create-request`, `sig_can_send`, `sig-bulk-create`.
- Belege: supabase/functions/sig-create-request/index.ts:47-57; supabase/functions/sig-create-request/index.ts:69-79; supabase/migrations/20260717044809_b8421246-0b25-4c9e-8f12-145c802c0365.sql:17-25; supabase/functions/sig-bulk-create/index.ts:84.
- Ursache/Prüfgrenze: Entgegen einer pauschalen Offenheitsannahme werden Benutzeridentität und sig_can_send geprüft. Die RPC erlaubt ausdrücklich mehrere Versandrollen. Ob diese Rollen frei gewählte Unterzeichner einladen dürfen oder zusätzlich eine Kunden-/Dokumentbindung erforderlich ist, ist fachlich nicht abschließend geklärt; vollständige Sender- und Mailabhängigkeiten fehlen ebenfalls.
- Geplante konkrete Änderung: Verbindliches Empfänger- und Dokumentberechtigungsmodell festlegen; keine zusätzliche Einschränkung ohne Prüfung legitimer Signaturworkflows einführen.
- Betriebsfolgen: Möglicher Missbrauch zulässiger Signaturversandrechte.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: Versandclients mocken; Empfängerbindung, erlaubte Übersteuerung und Autorisierung vor Datenaufbereitung und Versand prüfen; unklaren Versand nicht automatisch wiederholen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Änderungen an Versand- oder Signaturpfaden nur bei gestoppten Jobs zurücknehmen; bereits versandte Nachrichten, externe Kalenderereignisse und offengelegte Daten sind durch Code-Rollback nicht rückgängig zu machen.
- Doppelmeldungsreferenz: keine.

### lov_finding_e2c148fb68294c0b_0e12c928

- Bewertung: ungeklärt; Korrekturgruppe `CG.alixdocs-upload`; Abhängigkeiten A1, A2, A5.
- Funktionen: `alixdocs-upload`.
- Belege: supabase/functions/alixdocs-upload/index.ts:46-57; supabase/functions/alixdocs-upload/index.ts:100; supabase/functions/alixdocs-upload/index.ts:158.
- Ursache/Prüfgrenze: Der Upload prüft eine echte Benutzeridentität. Danach werden Dokumentoperationen mit Service-Rechten ausgeführt. Die vollständige Behandlung einer übergebenen bestehenden Dokument-ID, Versionsfortschreibung und aktueller Trigger wurde nicht abgeschlossen; deshalb keine endgültige Bestätigung der behaupteten Fremdversionierung.
- Geplante konkrete Änderung: Bestehende Dokumente vor Versionsanlage explizit auf Änderungsrecht prüfen; Versions- und Triggerkette vollständig auflösen.
- Betriebsfolgen: Mögliche unberechtigte Versionierung fremder Dokumente.
- Geplante Regressionstests, noch nicht ausgeführt: Geplant, isoliert mit gemockten Datenbank- und Providerclients: fehlende, leere und ungültige Identität ablehnen; berechtigte Identität zulassen; vor erfolgreicher Autorisierung keinerlei privilegierten Zugriff ausführen.; Geplant: eigene und fremde Objekte, fremde Mandanten sowie Konten ohne Mandantenzuweisung getrennt prüfen; negative Fälle dürfen weder Daten noch Seiteneffekte erzeugen.; Geplant: aktuelle Migrationen, Policies, Trigger, Grants und RPC-Implementierungen auf einer isolierten Testdatenbank vollständig durchlaufen..
- Sicherer Wiederherstellungsplan: Audit ändert nichts. Spätere Datenkorrekturen nur anhand gesicherter Vorzustände und geprüfter Änderungsprotokolle; keine pauschalen Lösch- oder Rückbuchungsaktionen.
- Doppelmeldungsreferenz: keine.

