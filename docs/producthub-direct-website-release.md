# Product Hub: direkte Webseitenfreigabe

## Ziel

Eine Freigabe durch einen aktiven Super Admin in AlixWork ist die einzige redaktionelle Freigabe. Die ausgewählten Webseiten übernehmen das Gerät unmittelbar und stellen es ohne weitere manuelle Zwischenprüfung online. Technische Validierung, Authentifizierung, Länderzuordnung und gesetzliche Anforderungen bleiben bestehen. Keine pauschale Freigabe aller bestehenden Geräte.

## Geprüfter Ausgangsstand (21.11.2026)

- AlixWork sendet über `supabase/functions/ph-com-publish-device/index.ts` nur an COM. Alle anderen Kanäle werden derzeit lediglich zum Abruf bereitgestellt.
- **Alix Lasers Global** (`6f9be453-1a13-42cd-90a9-5402b3cfbf8a`, Snapshot `a3c470d9`) hat die geschützten PATCH-Empfänger `/api/public/product-hub/translations` und `/api/public/product-hub/master-data`. Der Quellstand enthält zusätzlich `src/features/de-site/OriginalSite.tsx` und `resolver.ts`; deshalb vor DE-Anschluss prüfen, welcher Datenbestand auf der tatsächlichen DE-Domain ausgeliefert wird. Eine COM-Annahme beweist keine Veröffentlichung auf DE.
- **Alix Lasers DE- OLD 0511** (`c8cd4162-aa99-43c7-8e97-1a84a86c68bb`, Snapshot `e6d20bca`) hat einen älteren `/api/public/product-hub/update`-Empfänger. AlixWorks `product-hub-de-canary` adressiert dessen alte Lovable-Domain. Dieser Canary darf nicht ungeprüft als neuer DE-Live-Veröffentlichungsweg verwendet werden.
- **Alix Austria Launch** (`c3f9a5ed-4b6a-4cb7-9aec-45b56a071d01`, Snapshot `41a9a5f1`) enthält statische Gerätestammdaten in `src/data/products.ts`. In diesem Quellstand wurde kein Product-Hub-Direktempfänger gefunden.
- **ALIX Lasers UAE** (`f5ba6f4c-95ec-445a-8eb2-f2ba0a1b9338`, Snapshot `a2000359`) hat `/api/public/alixwork-webhook`; dieser prüft die Signatur und protokolliert nur eine Aktualisierungsanforderung. `src/lib/sync.functions.ts` setzt ausdrücklich keine Freigabeflags. `received: true` bedeutet weder übernommen noch online.
- **Alix Beauty New** (`9eccecfc-8185-454c-8500-b19c2cad9d9c`, Snapshot `9796ae36`) hat `/api/public/hooks/sync-alixwork`: erneuter Abruf mit Zehn-Minuten-Sperre, kein authentifizierter unmittelbarer Geräte-Push. Eine übersprungene Aktualisierung darf nicht als Veröffentlichung gelten.
- Das zuständige **US-Projekt** ist aus der vollständigen Liste der 17 zugänglichen Projekte nicht eindeutig bestimmbar.

Die anderen Projekte sind in diesem Chat ausschließlich lesbar. Keine Webseite, keine Gerätefreigabe und kein Zugang wurde durch diese Prüfung geändert. In AlixWork sind COM- und DE-Schreibzugänge vorhanden; eigenständige Direkt-Schreibzugänge für AT/US/AE/Beauty sind nicht nachgewiesen. Bestehende Zugänge niemals ungeprüft für einen anderen Host verwenden.

## Auftrag für jedes Webseiten-Projekt

> Stelle die Product-Hub-Anbindung so um, dass eine authentisch von AlixWork übermittelte Super-Admin-Freigabe für diese konkrete Webseite ein Gerät sofort übernimmt und online stellt, ohne zusätzliche redaktionelle Zwischenprüfung. Lies dazu den aktuellen AlixWork-Sendeweg `supabase/functions/ph-com-publish-device/index.ts` über einen read-only Cross-Project-Checkout und verwende dessen Texte-/Stammdatenvertrag als Referenz. Verwende vorhandene Gerätetabellen und eine bestätigte Alix-Produkt-ID; keine Zuordnung anhand von Namen. Baue einen geschützten serverseitigen Empfänger mit Probelauf, eindeutiger Veröffentlichungskennung und Wiederholschutz. Validierung, gesetzliche Anforderungen und Ländertrennung bleiben erhalten; keine Preise überschreiben. Übernimm Texte, technische Daten, Anwendungen und Bilder aus der freigegebenen Version. Aktualisiere tatsächlich die öffentlich ausgelieferte Gerätequelle und deren Cache, nicht nur eine interne Tabelle. Antworte erst nach erfolgreicher Übernahme und Veröffentlichung mit Geräte-ID, Version, Kanal und öffentlicher URL; Probelauf und bloßer Empfang dürfen niemals als online gelten. Fehlgeschlagene Übertragung erhält den letzten gültigen Stand. Unautorisierte oder fremde Kanalfreigaben müssen scheitern. Richte einen eigenen sicheren Schreibzugang ein und fordere den gemeinsamen Schlüssel über die sichere Eingabe an, niemals im Chat. Teste Sperrprüfungen, Wiederholung und öffentliche Anzeige auf der echten Domain. Melde den bestätigten Empfänger-Vertrag und benötigten Secret-Namen an das AlixWork-Projekt zurück. Keine anderen Geräte automatisch freischalten.

### Zusätze je Projekt

- **DE / Global:** Den tatsächlichen DE-Domain-Resolver und `de-site`-Gerätebestand anschließen; COM-Gerätebestand nicht als Ersatz ausgeben. DE-Schreibziel erst nach bestätigter Domainzuständigkeit umstellen.
- **AT:** Statische Gerätekataloge durch vorhandene persistente veröffentlichte Daten ersetzen oder entsprechend anbinden. Die öffentliche Geräteanzeige muss nach dem Empfängeraufruf denselben bestätigten Stand lesen.
- **AE:** Den vorhandenen signierten Webhook erweitern oder einen Direkt-Empfänger anschließen. Übernahme und Veröffentlichung müssen wirklich erfolgen; ein Sync-Log alleine reicht nicht. Fachliche Länder-/Sicherheitsanforderungen nicht aus ungeprüften Payload-Flags ableiten.
- **Beauty:** Den periodischen Abruf als Rückfall behalten, aber den neuen geschützten Veröffentlichungsvorgang nicht durch die Zehn-Minuten-Sperre verzögern. Direktfreigaben und vollständigen Cache aktualisieren.
- **US:** Projekt und produktive Domain zuerst eindeutig zuordnen, dann denselben Vertrag umsetzen.

## Anschließend in AlixWork

1. Bestätigte Empfänger-URLs und individuelle Zugänge sicher konfigurieren; keinen COM-Schlüssel an andere Domains senden.
2. Einen gemeinsamen serverseitigen Versandadapter für die bestätigten Webseiten bereitstellen. Aktiven Super Admin und konkrete Geräte-/Kanalberechtigung vor jedem Zugriff prüfen. Keine clientseitigen Schlüssel und keine frei eingebbaren Ziel-URLs.
3. Einzel-Freigabe im Geräteeditor, `BulkPublishButton`/`bulkPublish.ts` und die Webseite `/product-hub/webseiten` auf diesen Adapter umstellen. Nur tatsächlich ausgewählte Kanäle senden; Sammelfreigaben vollständig paginieren, sequenziell ausführen und pro Gerät/Kanal auswerten.
4. Erst bestätigte Veröffentlichung als erfolgreich protokollieren. Fehlende Empfänger, unbestätigte Identitäten oder unklarer Versand bleiben sichtbar offen/fehlerhaft; keine automatische Wiederholung unsicherer Schreibvorgänge.
5. Mit einem ausdrücklich ausgewählten Gerät pro Webseite Probelauf, Übernahme und öffentliche Anzeige prüfen. Aktuelle externe Supabase-Anmeldung ist für eine automatische angemeldete Prüfung hier nicht verfügbar.

## Offen

Direkt-Empfänger und öffentliche Anzeige in den separaten Webseiten-Projekten, US-Projektzuordnung, sichere gemeinsame Zugänge sowie anschließend AlixWork-Versandadapter und echte Ende-zu-Ende-Abnahme. Der bestehende COM-Versand bleibt bis dahin unverändert.