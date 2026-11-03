# ALIXSMART WhatsApp Sales: benötigte Verbindung für Meine Leads

ALIXSMART ist ein separates Projekt. Sein bestehender Twilio-Sales-Chat bleibt führend; ALIXWORK darf keinen zweiten Sender anschließen. Die aktuelle Sitzungsübergabe allein genügt nicht für eingebettetes Lesen und Antworten.

## Im ALIXSMART-Projekt zu ergänzen oder zu bestätigen

- Geschützte serverseitige Schnittstelle mit getrenntem Integrationszugang, kein Browser-Schlüssel und kein allgemeiner Zugriff auf alle Konversationen.
- Autorisierte Zuordnung zwischen ALIXWORK-Lead-ID, Mandant, Kontakt-ID und Sales-Konversations-ID. Ein Integrationsschlüssel allein ist kein ausreichender Nachweis für die Mitarbeiterberechtigung.
- Signierte, kurzlebige Anfragen mit Nutzeridentität, Lead-ID, Mandant und bestätigter Konversationszuordnung; Zeitstempel/Nonce gegen Wiederholung. ALIXWORK prüft bei jedem Aufruf die aktuelle Zuweisung, ALIXSMART die Konversationsberechtigung.
- Kontrollierte Kontaktzuordnung: Kontakt-ID bevorzugt, Telefonnummern normalisieren, Mehrdeutigkeiten zurückmelden, nicht den ersten Treffer wählen.
- Verlauf paginiert lesen und durchsuchen; Nachrichten mit stabiler externer ID, Richtung, Zeitpunkt, Medieninformationen, Zustellstatus und Fehlern zurückgeben.
- Neue Nachrichten/Statusänderungen über authentifizierte, deduplizierte Ereignisse mit überprüfbarer Signatur und Event-ID liefern. Erneute Zustellung darf keinen zweiten Historieneintrag erzeugen.
- Schreiben über den vorhandenen `send-whatsapp-message`-Versanddienst: Idempotenzschlüssel, autorisierter Empfänger, bestehende Twilio-Sales-Konfiguration.
- 24-Stunden-Fenster serverseitig anhand letzter Kundennachricht prüfen; außerhalb ausschließlich bestätigte Vorlagen mit passenden Parametern.
- Angebots-PDF nur nach ALIXWORK-Freigabeprüfung und mit temporärem, berechtigten Dateizugriff; keine öffentlichen Dauerlinks auf vertrauliche Dokumente.
- Medien abrufen/versenden, ungelesene Nachrichten markieren, Statusänderungen zurückgeben. Annahme durch Anbieter nicht als Zustellung ausgeben.
- Keine Auftragsannahme aus Chattext ableiten.

## Abnahme

Zwei kontrollierte Mitarbeiter mit getrennten Leads und Chats testen. Fremde Konversations-ID, geänderte Leadzuweisung, falscher Mandant, abgelaufene Signatur und doppelte Nachricht müssen sicher abgefangen werden. Echten Kundenversand erst nach gesonderter Freigabe.

ALIXWORK hat einen geschützten lokalen Chatabruf und den serverseitigen Adapter `alixsmart-sales-chat` ergänzt. Im ALIXSMART-Quellstand vom 03.11.2026 (Commit `5911a688`) sind `alixwork-sales-bridge` und `alixwork-sales-dispatch` vorhanden. Ihre produktive Bereitstellung, vollständige Datenbankgrundlagen, bestätigte Mandanten-/Mitarbeiterbindungen und tatsächliche Gesprächsübernahme sind hier nicht nachgewiesen. Bis zur Bestätigung zeigt Meine Leads „Nicht verbunden“. Änderungen am ALIXSMART-Projekt sind aus diesem Projekt nicht möglich; dessen Chat muss separat geöffnet werden. Klarstellung vom 03.11.2026: kein Import und keine AlixWorld-Anbindung; bestehende Gespräche direkt über eine autorisierte API lesen, neue Nachrichten über signierte Echtzeitereignisse anzeigen. Konkreter API-/Echtzeit-Aktivierungsauftrag: `docs/alixsmart-sales-bridge-implementation.md`.

## Automatischer Lead-Eingang: ALIXWORK-Empfänger

Bestehender Empfänger: `POST https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/alixsmart-webhook-inbound`.
Neue Ereignisart: `sales.whatsapp.inbound`, `source: "alixsmart"`, `version: 1`, `event_id` und ISO-`occurred_at`.
`data` enthält `tenant_id`, `contact_id`, `conversation_id`, `message_id`, `phone` im internationalen Format mit Pluszeichen, `text`, optional `name`/`language`, sowie `direction: "inbound"`, `area: "sales"` und `relevance: "sales"|"service"|"spam"|"internal"|"unknown"`.

Nur bestätigte vertriebsrelevante Anfragen erzeugen neue Leads. Die Relevanzprüfung muss ALIXSMART vor dem Ereignisversand durchführen; ungeklärte Fälle dürfen nicht als `sales` markiert werden. Mandanten-ID ist aus einer bestätigten Integrationszuordnung zu übernehmen, niemals aus Kundentext. Produktinteresse und Priorität ergänzt der ALIXWORK-Empfänger selbst.

Pflichtheader: `x-alixsmart-timestamp` (Unixsekunden) und `x-alixsmart-signature: sha256=<HMAC-SHA256>` über `${timestamp}.${unveränderter JSON-Body}` mit dem bestehenden `ALIXSMART_WEBHOOK_SECRET`; maximal fünf Minuten Zeitabweichung. Keine Signatur nur über den Body für diese Ereignisart. Optionaler `x-alixsmart-event` muss der Ereignisart entsprechen.

Antworten: `created`, `linked`, `ignored` oder `needs_review`, bei Wiederholung `deduped: true`. IDs bleiben bei Wiederholung unverändert, ebenso alle Originaldaten; abweichender Inhalt derselben ID wird zurückgewiesen. Erst nach bestätigter Übernahme quittieren; Fehler beim Speichern erlauben erneute Zustellung, da alle Änderungen gemeinsam zurückgerollt werden. Telefonnummern allein verknüpfen keine bestehenden Kunden/Leads automatisch, sondern führen zur Adminprüfung, damit weder Doppelakten noch falsche Kundenverknüpfungen entstehen.

`/vertrieb/whatsapp-eingang` ist ausschließlich für Admin/Super Admin zugänglich. Mitarbeiterzuweisung verlangt aktive freigeschaltete Benutzer und explizite Mandantenzuordnung. Zeitbezogene Benachrichtigungen werden stündlich geprüft (maximal eine Stunde Verzögerung). Der vollständige Chat samt Medien und Versand bleibt bis zur separaten bestätigten ALIXSMART-Chat-Schnittstelle nicht verbunden.