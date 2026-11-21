# Product Hub: direkte Webseitenfreigabe

## Ziel

Eine Freigabe durch einen aktiven Super Admin in AlixWork ist die einzige redaktionelle Freigabe. Die ausgewählten Webseiten übernehmen das Gerät unmittelbar und stellen es ohne weitere manuelle Zwischenprüfung online. Technische Validierung, Authentifizierung, Länderzuordnung und gesetzliche Anforderungen bleiben bestehen. Keine pauschale Freigabe aller bestehenden Geräte.

Aktueller Umstellungsumfang: **alix-lasers.de, alix-lasers.at, alix-lasers.ae und Alix-beauty.com**. **alix-lasers.us bleibt auf Nutzerwunsch vorerst ausgenommen**; keine Änderung oder Deaktivierung der bestehenden US-Anbindung. COM bleibt die vorhandene Referenz.

## Geprüfter Ausgangsstand (21.11.2026)

### Aktualisierung: GLOBAL COM/DE (Snapshot `4c242e67`)

- Neuer Vertrag im GLOBAL-Projekt: `docs/producthub-direct-website-release.md`. Empfänger: `POST https://www.alix-lasers.com/api/public/product-hub/direct-release` und `POST https://alix-lasers.de/api/public/product-hub/direct-release`; beide antworten bei unsignierten Anfragen mit 401.
- AlixWork nutzt `ph-global-publish-device`: aktive Super-Admin-/Kanalprüfung, bestätigte kanalbezogene IDs, HMAC über Zeitstempel und exakten Inhalt, eindeutige Veröffentlichungskennung, Probelauf und anschließender identischer Release. Keine Preise, kein Rückfall auf alte PATCH-Empfänger.
- COM verwendet freigegebene englische Texte, DE deutsche Mastertexte. Nur ein passender `ONLINE`-Nachweis zählt als Veröffentlichung. Unsichere Sendungen bleiben in den bestehenden Kanalständen zur Prüfung gesperrt, ohne automatischen Neuversand.
- Gemeinsamer Zugang `GLOBAL_PRODUCT_HUB_DIRECT_RELEASE_KEY` ist sicher hinterlegt. Hifu Pro besitzt die bestätigte eigene DE-ID aus dem GLOBAL-Vertrag; die bestehende COM-Zuordnung bleibt erhalten.
- **Echte Hifu-Pro-Abnahme offen:** COM-Übersetzung ist aktuell `outdated`; die aktive externe Super-Admin-Sitzung kann hier nicht automatisiert hergestellt werden. Erreichbarkeit ist kein signierter Live-Nachweis. Keine echte Freigabe ausgeführt.

Der nachfolgende Ausgangsstand dokumentiert die frühere Prüfung vor diesem Anschluss.

- AlixWork sendet über `supabase/functions/ph-com-publish-device/index.ts` nur an COM. Alle anderen Kanäle werden derzeit lediglich zum Abruf bereitgestellt.
- **Alix Lasers Global** (`6f9be453-1a13-42cd-90a9-5402b3cfbf8a`, Snapshot `a3c470d9`) hat die geschützten PATCH-Empfänger `/api/public/product-hub/translations` und `/api/public/product-hub/master-data`. Der Quellstand enthält zusätzlich `src/features/de-site/OriginalSite.tsx` und `resolver.ts`; deshalb vor DE-Anschluss prüfen, welcher Datenbestand auf der tatsächlichen DE-Domain ausgeliefert wird. Eine COM-Annahme beweist keine Veröffentlichung auf DE.
- **Alix Lasers DE- OLD 0511** (`c8cd4162-aa99-43c7-8e97-1a84a86c68bb`, Snapshot `e6d20bca`) hat einen älteren `/api/public/product-hub/update`-Empfänger. AlixWorks `product-hub-de-canary` adressiert dessen alte Lovable-Domain. Dieser Canary darf nicht ungeprüft als neuer DE-Live-Veröffentlichungsweg verwendet werden.
- **Alix Austria Launch** (`c3f9a5ed-4b6a-4cb7-9aec-45b56a071d01`, Snapshot `41a9a5f1`) enthält statische Gerätestammdaten in `src/data/products.ts`. In diesem Quellstand wurde kein Product-Hub-Direktempfänger gefunden.
- **ALIX Lasers UAE** (`f5ba6f4c-95ec-445a-8eb2-f2ba0a1b9338`, Snapshot `a2000359`) hat `/api/public/alixwork-webhook`; dieser prüft die Signatur und protokolliert nur eine Aktualisierungsanforderung. `src/lib/sync.functions.ts` setzt ausdrücklich keine Freigabeflags. `received: true` bedeutet weder übernommen noch online.
- **Alix Beauty New** (`9eccecfc-8185-454c-8500-b19c2cad9d9c`, Snapshot `9796ae36`) hat `/api/public/hooks/sync-alixwork`: erneuter Abruf mit Zehn-Minuten-Sperre, kein authentifizierter unmittelbarer Geräte-Push. Eine übersprungene Aktualisierung darf nicht als Veröffentlichung gelten.
- **US** ist vorerst nicht Teil dieses Auftrags; eine Projektzuordnung ist dafür derzeit nicht erforderlich.

Die anderen Projekte sind in diesem Chat ausschließlich lesbar. Keine Webseite, keine Gerätefreigabe und kein Zugang wurde durch diese Prüfung geändert. In AlixWork sind COM- und DE-Schreibzugänge vorhanden; eigenständige Direkt-Schreibzugänge für AT/AE/Beauty sind nicht nachgewiesen. Bestehende Zugänge niemals ungeprüft für einen anderen Host verwenden.

## Auftrag für jedes Webseiten-Projekt

> Stelle die Product-Hub-Anbindung so um, dass eine authentisch von AlixWork übermittelte Super-Admin-Freigabe für diese konkrete Webseite ein Gerät sofort übernimmt und online stellt, ohne zusätzliche redaktionelle Zwischenprüfung. Lies dazu den aktuellen AlixWork-Sendeweg `supabase/functions/ph-com-publish-device/index.ts` über einen read-only Cross-Project-Checkout und verwende dessen Texte-/Stammdatenvertrag als Referenz. Verwende vorhandene Gerätetabellen und eine bestätigte Alix-Produkt-ID; keine Zuordnung anhand von Namen. Baue einen geschützten serverseitigen Empfänger mit Probelauf, eindeutiger Veröffentlichungskennung und Wiederholschutz. Validierung, gesetzliche Anforderungen und Ländertrennung bleiben erhalten; keine Preise überschreiben. Übernimm Texte, technische Daten, Anwendungen und Bilder aus der freigegebenen Version. Aktualisiere tatsächlich die öffentlich ausgelieferte Gerätequelle und deren Cache, nicht nur eine interne Tabelle. Antworte erst nach erfolgreicher Übernahme und Veröffentlichung mit Geräte-ID, Version, Kanal und öffentlicher URL; Probelauf und bloßer Empfang dürfen niemals als online gelten. Fehlgeschlagene Übertragung erhält den letzten gültigen Stand. Unautorisierte oder fremde Kanalfreigaben müssen scheitern. Richte einen eigenen sicheren Schreibzugang ein und fordere den gemeinsamen Schlüssel über die sichere Eingabe an, niemals im Chat. Teste Sperrprüfungen, Wiederholung und öffentliche Anzeige auf der echten Domain. Melde den bestätigten Empfänger-Vertrag und benötigten Secret-Namen an das AlixWork-Projekt zurück. Keine anderen Geräte automatisch freischalten.

### Zusätze je Projekt

- **DE / Global:** Den tatsächlichen DE-Domain-Resolver und `de-site`-Gerätebestand anschließen; COM-Gerätebestand nicht als Ersatz ausgeben. DE-Schreibziel erst nach bestätigter Domainzuständigkeit umstellen.
- **AT:** Statische Gerätekataloge durch vorhandene persistente veröffentlichte Daten ersetzen oder entsprechend anbinden. Die öffentliche Geräteanzeige muss nach dem Empfängeraufruf denselben bestätigten Stand lesen.
- **AE:** Den vorhandenen signierten Webhook erweitern oder einen Direkt-Empfänger anschließen. Übernahme und Veröffentlichung müssen wirklich erfolgen; ein Sync-Log alleine reicht nicht. Fachliche Länder-/Sicherheitsanforderungen nicht aus ungeprüften Payload-Flags ableiten.
- **Beauty:** Den periodischen Abruf als Rückfall behalten, aber den neuen geschützten Veröffentlichungsvorgang nicht durch die Zehn-Minuten-Sperre verzögern. Direktfreigaben und vollständigen Cache aktualisieren.

## Anschließend in AlixWork

1. Bestätigte Empfänger-URLs und individuelle Zugänge sicher konfigurieren; keinen COM-Schlüssel an andere Domains senden.
2. Einen gemeinsamen serverseitigen Versandadapter für die bestätigten Webseiten bereitstellen. Aktiven Super Admin und konkrete Geräte-/Kanalberechtigung vor jedem Zugriff prüfen. Keine clientseitigen Schlüssel und keine frei eingebbaren Ziel-URLs.
3. Einzel-Freigabe im Geräteeditor, `BulkPublishButton`/`bulkPublish.ts` und die Webseite `/product-hub/webseiten` auf diesen Adapter umstellen. Nur tatsächlich ausgewählte Kanäle senden; Sammelfreigaben vollständig paginieren, sequenziell ausführen und pro Gerät/Kanal auswerten.
4. Erst bestätigte Veröffentlichung als erfolgreich protokollieren. Fehlende Empfänger, unbestätigte Identitäten oder unklarer Versand bleiben sichtbar offen/fehlerhaft; keine automatische Wiederholung unsicherer Schreibvorgänge.
5. Mit einem ausdrücklich ausgewählten Gerät pro Webseite Probelauf, Übernahme und öffentliche Anzeige prüfen. Aktuelle externe Supabase-Anmeldung ist für eine automatische angemeldete Prüfung hier nicht verfügbar.

## Offen

### Automatische Abschaltung bei Deaktivierung (21.11.2026)

Nutzerauftrag: Sobald ein Artikel in AlixWork für eine Webseite deaktiviert oder zurückgehalten wird, muss diese Webseite ihn automatisch deaktivieren, ohne weitere manuelle Freigabe. Keine Preise oder andere Länder ändern; US bleibt ausgenommen.

Nachprüfung des GLOBAL-Snapshots `61536d69`: Der bestehende `direct-release`-Vertrag unterstützt ausschließlich Veröffentlichung mit Pflichttexten/Bildern und `ONLINE`-Nachweis. Ein Abschaltvorgang oder `OFFLINE`-Nachweis ist nicht vorhanden. Deshalb keinen erfundenen `active:false`-Aufruf an diesen Empfänger schicken und keine Veröffentlichung als Abschaltung missbrauchen. AT/AE/Beauty besitzen ebenfalls keinen bestätigten Abschaltvertrag. Diese Projekte sind hier nur lesbar.

**Aktualisierung GLOBAL `c5a51f49`:** COM/DE unterstützen nun den strikten `action:deactivate`-Vertrag an denselben festen `direct-release`-POST-Zielen und mit demselben sicheren Zugang. AlixWork sendet ausschließlich `operation_id`, bestätigte Hub-/Remote-ID, Kanal, unveränderliche `source_version`, letzte bestätigte `expected_version`, `reason:inactive|withheld`, `dry_run` und serverseitig geprüfte `approval`. Keine Inhalte oder Preise. Probelauf benötigt `OFFLINE_READY`; Abschluss ausschließlich identitäts-/versionsgleiches `OFFLINE`, `offline:true` und Zielhost-geprüfte `public_urls`. Die bestehenden Kanalzustände reservieren den Vorgang; unsichere oder konkurrierende Vorgänge blockieren statt automatisch neu zu senden. Auswahl speichern, Zurückhalten und Offline-Aktion sind angebunden; lokale Deaktivierung bleibt bei Fehlern erhalten. Veröffentlichungen werden vor Versand erneut geprüft und ihre Finalisierung ist nach einer Deaktivierung gesperrt.

**Grenzen:** Veröffentlichung des GLOBAL-Abschaltempfängers und echte OFFLINE-Abnahme stehen noch aus. Kein echter Artikel wurde zur Abnahme deaktiviert. Reaktivierung ist ausdrücklich nicht Teil dieses Vertrags: eine bestätigte Abschaltsperre bleibt auch bei neuem Publish bestehen, bis ein eigener geschützter Reaktivierungsvertrag existiert. AT/AE/Beauty bleiben ohne bestätigten Abschaltanschluss; US wird bei der gesamten Offline-Aktion ausgelassen.

**Beauty-Aktualisierung `e24bcde2`:** Veröffentlichter Abschaltempfang `PATCH https://alix-beauty.com/api/public/product-hub/deactivate`, eigener `BEAUTY_PRODUCT_HUB_WRITE_KEY` jetzt sicher auch in AlixWork gespeichert. Der bestehende geschützte Sender unterstützt `beautyco` für Abschaltungen, nicht Veröffentlichungen. Er signiert exakt Beauty-Header und content-freien Vertrag mit Kanalentscheidungszeitpunkt inklusive Mikrosekunden. Probelauf `state:validated` ist kein Abschluss; nur passendes `state:OFFLINE`, `offline:true`, öffentliche Geräteadresse, 404/410 und unsichtbarer Katalog/Suche schließen die reservierte Abschaltung ab. Unklarer Versand wird nicht automatisch wiederholt.

Beauty verlangt zwingend die letzte bestätigte ONLINE-Bestandsversion. Diese muss in `remote_snapshot.beauty_online` als vollständiger passender ONLINE-Nachweis vorliegen; `live_version`, Produktdatum oder die Versionsangabe eines technischen Probelaufs sind kein Ersatz. Fehlt der Nachweis, bleibt die lokale Deaktivierung erhalten und der Sender stoppt vor jedem Beauty-Aufruf. Echte Beauty-Abnahme wartet auf diesen Bestandsnachweis, eine ausdrücklich für Beauty gewählte Testabschaltung und prüfbare aktive Super-Admin-Sitzung. Die Hifu-Pro-Auswahl bezog sich bisher auf COM/DE.

**Auftrag in GLOBAL und anschließend AT/AE/Beauty:**

> Ergänze einen signaturgeschützten, kanalbezogenen Abschaltvorgang zur bestehenden Product-Hub-Anbindung. AlixWork ist die einzige Entscheidungsstelle; vertraue ausschließlich einer serverseitig geprüften aktiven Super-Admin-Bestätigung und der verifizierten Zuordnung. Abschaltungen benötigen keine neuen Texte, Übersetzungen oder Bilder. Nutze eine eindeutige Vorgangskennung, erwartete Version und vorhandene geschützte Zustände; verhindere, dass ältere Veröffentlichungen einen deaktivierten Artikel erneut aktivieren. Deaktiviere den Artikel in der tatsächlich öffentlich ausgelieferten Quelle und entferne ihn aus Listen, Suche und direkter Geräteanzeige; aktualisiere betroffene Caches. Preise, Originalinhalte und andere Kanäle bleiben unverändert. Probelauf schreibt nichts. Melde Erfolg ausschließlich nach öffentlicher Prüfung mit einem eindeutigen OFFLINE-Nachweis und passender Artikel-/Kanal-/Vorgangsidentität. Unklare Übertragungen niemals automatisch erneut senden. Liefere den bestätigten Vertrag, feste Ziel-URL und Secret-Namen an AlixWork zurück. Teste fehlende Berechtigung, fremden Kanal, Versionenkonflikt, Wiederholung, Preisbestand und öffentliche Unsichtbarkeit. Keine echten Geräte ohne ausdrückliche Auswahl deaktivieren.

**Danach AlixWork:** Den bestätigten Abschaltvertrag an den gemeinsamen serverseitigen Sender anschließen und alle Deaktivierungswege (abgewählte Webseite beim Speichern, Zurückhalten, gesamte Offline-Aktion) automatisch bedienen. Lokale Deaktivierung muss erhalten bleiben, wenn die Webseite nicht erreichbar ist; Abschaltung bleibt sichtbar ausstehend und darf weder als Erfolg noch mit einem erfundenen Sync-Zeitpunkt dargestellt werden. Bereits laufende Veröffentlichungen vor Abschluss erneut auf Deaktivierung prüfen. Echte Abnahme erfordert eine verfügbare Super-Admin-Sitzung; für dieses externe Supabase-Projekt hier nicht automatisiert verfügbar.

COM/DE: echte signierte Hifu-Pro-Abnahme nach Prüfung/Freigabe der veralteten englischen Übersetzung und mit angemeldetem aktivem Super Admin. AT/AE/Beauty: Direkt-Empfänger und öffentliche Anzeige in den separaten Webseiten-Projekten, sichere gemeinsame Zugänge sowie anschließend AlixWork-Versandadapter und echte Ende-zu-Ende-Abnahme. US bleibt vorerst ausgenommen.