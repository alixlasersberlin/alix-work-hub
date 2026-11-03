# Auftrag im ALIXSMART-Projekt: geschützte Sales-Verbindung zu ALIXWORK

Die ALIXWORK-Seite ist ergänzt. Im am 03.11.2026 geprüften ALIXSMART-Quellstand (Commit `5911a688`) sind `alixwork-sales-bridge` und `alixwork-sales-dispatch` bereits vorhanden. Ihre produktive Bereitstellung, notwendige Datenbankfunktionen/-felder, bestätigte Zuordnungen und erfolgreiche Übertragung sind hier nicht nachgewiesen. Dieses Dokument ist eine Implementierungs- und Aktivierungsanweisung, keine Bestätigung einer aktiven Verbindung. Keine neue WhatsApp-Nummer, kein Providerwechsel. Bestehender Twilio-Sales-Chat bleibt führend. App erst nach Abnahme und ausdrücklicher Freigabe veröffentlichen.

## 1. Ereignisse zuverlässig aus bestehendem Chat senden

Nach erfolgreicher Speicherung in `twilio-whatsapp-webhook` vertriebsrelevante neue Kontakte als `sales.whatsapp.inbound` an den bestehenden ALIXWORK-Empfänger senden. Der Vertrag in `docs/alixsmart-leads-bridge-contract.md` bleibt maßgeblich. Die bestätigte ALIXWORK-Mandanten-ID muss einer administrativ festgelegten Zuordnung zur Sales-Nummer entstammen. Kein Default-Mandant, keine Ableitung aus Kundentext. Telefonnummer allein genügt nicht zur Verknüpfung bestehender Leads.

Danach sämtliche zugeordneten eingehenden und ausgehenden Chatnachrichten als `sales.whatsapp.message`, Zustelländerungen aus `twilio-whatsapp-status` als `sales.whatsapp.status` senden. Keine internen Notizen ungeprüft übertragen. Bestehende Audit-/Integrationstabellen für transaktionale Outbox und Fehlernachweise verwenden, keine neue unabhängige Chatdatenhaltung. Erst nach Speicherung quittieren; bei fehlender Bestätigung mit gleicher Event-/Nachrichten-ID wiederholen. Ein 409 gehört in die manuelle Prüfung, nicht in eine endlose Wiederholung.

Empfänger: `POST https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/alixsmart-webhook-inbound`.
Header: `x-alixsmart-timestamp` (Unixsekunden), `x-alixsmart-signature` (`sha256=` + HMAC-SHA256 über `${timestamp}.${rawBody}`), `x-alixsmart-event`.
Gemeinsames Secret: `ALIXSMART_WEBHOOK_SECRET`; sicher in beiden Projekten hinterlegen, nie Chat oder Browser.

Nachrichtenformat:

```json
{
  "event": "sales.whatsapp.message",
  "event_id": "stabile-eindeutige-event-id",
  "source": "alixsmart",
  "version": 1,
  "occurred_at": "2026-11-03T00:00:00Z",
  "data": {
    "tenant_id": "bestätigte-alixwork-mandanten-uuid",
    "contact_id": "alixsmart-contact-id",
    "conversation_id": "alixsmart-conversation-id",
    "message_id": "stabile-alixsmart-message-id",
    "area": "sales",
    "direction": "inbound",
    "text": "Kundennachricht",
    "status": "received",
    "media": [{ "id": "medien-id", "name": "Datei.pdf", "mime": "application/pdf" }]
  }
}
```

Statusereignisse verwenden dieselben Identitäten, `event: sales.whatsapp.status`, eigenen stabilen `event_id` und `status` aus `queued`, `sent`, `delivered`, `read`, `failed`, `undelivered`, optional `error` (maximal 500 Zeichen). Dateien haben ausschließlich IDs, Namen und MIME-Typen; keine Provider-Zugangsdaten oder öffentlichen Dauerlinks.

## 2. ALIXSMART-Endpunkt `alixwork-sales-bridge`

Server-only POST, HMAC-SHA256 mit demselben gemeinsamen Secret über `${x-alixwork-timestamp}.${rawBody}`, Header `x-alixwork-signature`, maximal fünf Minuten Zeitabweichung. Nonce einmalig in vorhandener Integrations-/Auditablage speichern. Signatur allein ist nicht die Nutzerberechtigung.

ALIXWORK sendet `protocol: alixwork-sales-v1`, `source: alixwork`, `nonce`, `user_id`, `lead_id`, `tenant_id`, `contact_id`, `conversation_id`, `action`. ALIXWORK verifiziert vor und nach dem Remote-Aufruf den aktuellen Leadzugriff. ALIXSMART muss zusätzlich die bestehende freigegebene Bindung zwischen Lead/Mandant/Kontakt/Konversation und Mitarbeiter prüfen; nicht anhand einer vom Aufrufer erfundenen Telefonnummer oder frei mitgesandten Rolle entscheiden. Nutzerzuordnung zwischen den getrennten Projekten explizit bestätigen, keine Identitätsgleichheit voraussetzen.

Aktionen:
- `status`: Verbindung, Freitextfenster und Senderecht.
- `read`, optional `before`: maximal 100 Nachrichten pro Seite, stabiles Cursorverfahren; nur Sales und exakt gebundene Konversation.
- `send`, `text` (1–4000 Zeichen), `request_id` (UUID): über einen gemeinsamen, aus dem bestehenden `send-whatsapp-message` extrahierten Versandkern senden. KEIN Service-Role-Token als Benutzer an den alten Handler weiterreichen. Versandabsicht und Hash vor Provideraufruf atomar in vorhandener Ablage sichern; parallele identische Requests liefern dasselbe Ergebnis. Geänderter Inhalt derselben ID Konflikt. Ungewisser Providerstatus niemals automatisch erneut senden.
- `mark_read`, `message_id`: personengebundene Lesemarkierung unter bestehenden Rechten, nicht alle Mitarbeiter als gelesen markieren.
- `media`, `message_id`, `media_id`: erst nach bestätigtem Dateivertrag aktivieren. ALIXWORK gibt aktuell keine externen Medien-URLs an den Browser weiter; Download/Upload benötigen noch einen autorisierten Dateistrom. Keine öffentlichen Dauerlinks.

Freitext nur innerhalb 24 Stunden nach letzter Kundennachricht, serverseitig erzwingen. Außerhalb freigegebene Vorlagen und passende Parameter notwendig; deren Auswahl ist vor Aktivierung separat zu implementieren. Angebots-PDFs erst nach Freigabeprüfung. Gesprächsinhalte lösen niemals automatisch Aufträge aus.

Erfolgsantwort muss `ok: true`, `protocol: alixwork-sales-v1` sowie dieselben vier IDs `lead_id`, `tenant_id`, `contact_id`, `conversation_id` enthalten. Optional `messages`, `next_cursor` (string/null), `can_send`, `freeform_until` (ISO/null), `message`. Nachrichtenfelder: `id`, `direction` (`inbound|outbound`), `text`, ISO-`at`, `status`, `media` wie oben. Nur bestätigte Providerzustellung als `delivered` ausgeben, Annahme als `queued` oder `sent`.

## 3. Abnahme vor Aktivierung

Zwei eigene Mitarbeiter mit getrennten Testleads/Chats, fremde Kontakt-/Konversations-ID, falscher Mandant, Neuzuweisung, inaktiver Nutzer, abgelaufene Signatur, doppelte Nonce/Events/Nachrichten, gleichzeitig versendete identische Request-ID, geänderter Inhalt, 24h-Grenze, Medienrechte und Statusreihenfolge prüfen. Ungewisse Sendungen dürfen nicht erneut gesendet werden. Reale Kunden nicht für Tests anschreiben. Automatischen Eingang durch eine kontrollierte Testnachricht an die bestehende Sales-Nummer prüfen und in beiden Anwendungen zurücklesen. Keine Änderung der bestehenden Technik- und Ticketkommunikation.

## Offene Grenzen

ALIXSMART kann aus dem ALIXWORK-Chat nur lesend untersucht werden. Implementierung und Bereitstellung dieses Endpunkts sowie der Ereignis-Outbox müssen im ALIXSMART-Projekt erfolgen. Danach ALIXWORK-Verbindung mit echten angemeldeten Mitarbeitern prüfen. Vollständige Medien-/Vorlagen-/Lesemarkierungsoberfläche folgt dem bestätigten Quellvertrag; aktuell nicht als funktionsfähig melden.

## 4. Bestehende Gespräche übernehmen (Auftrag vom 03.11.2026)

Die Gegenstelle und die Übernahme müssen im ALIXSMART-Projekt vorbereitet werden. Dieser Projektcheckout enthält keine privaten Gesprächsdaten und erlaubt keine Änderungen an ALIXSMART. Kein Abruf privater Datensätze mit Zugangsdaten aus einem Checkout.

### Konkreter Folgeauftrag im ALIXSMART-Chat

Bestehende `alixwork-sales-bridge` und `alixwork-sales-dispatch` vervollständigen und deren Bereitstellung prüfen, nicht nochmals neu anlegen. Die referenzierten `alixwork_sales_config`, `alixwork_sales_users`, `alixwork_sales_bindings` und `provider_webhook_events.bridge_attempts`/`bridge_next_attempt_at`/`bridge_error` gegen die echte Datenbank prüfen: die zugehörigen vollständigen Migrationen wurden im Snapshot nicht nachgewiesen. Fehlende Grundlagen nur nach den ALIXSMART-Projektregeln ergänzen. Mandant und Mitarbeiter-IDs beider Projekte ausdrücklich bestätigen; auch Super-Admin-Zugriff und Neuzuweisung prüfen, ohne Rollen aus dem Anfragetext zu übernehmen. Das gemeinsame Secret nur über sichere Secret-Verwaltung vergleichen/hinterlegen, niemals ausgeben. ALIXWORK erwartet `ALIXSMART_API_BASE_URL` als bestätigte HTTPS-Functions-Basisadresse ohne abschließendes `/alixwork-sales-bridge`.

Quellverlauf aus `whatsapp_conversations` (`area='sales'`, `channel='whatsapp'`) mit `whatsapp_contacts` und `whatsapp_messages` exportieren. Quelle: Kontakt `id`, `phone_e164`, `profile_name`; Gespräch `id`, `contact_id`, `status`, `assigned_user_id`, `last_customer_message_at`; Nachricht `id`, `conversation_id`, `direction`, `body`, `created_at`, `status`, `error_message`, `media_content_type`. `triage_state` ist ein separater Eingangszustand, kein Gesprächsstatus. `message_type='internal_note'` ausschließen. `twilio_message_sid` darf die verwendete stabile ALIXSMART-Nachrichten-ID nicht ersetzen. Der vorhandene `alixsmart-export-readonly`-Exporter gibt JSON aus und enthält diese WhatsApp-Tabellen nicht in seiner Allowlist; dafür einen gezielten geschützten CSV-Export ergänzen, keine allgemeine Exportfreigabe. Vollständig und stabil paginieren, CSV-Werte korrekt maskieren und Tabellenformeln sicher behandeln, ohne Originaltexte unbemerkt zu verändern.

Vor der Übernahme alle vorhandenen Sales-Gespräche paginiert inventarisieren, einschließlich geschlossener Sessions und aller tatsächlichen Quellstatus. Keine Einschränkung auf offene Sessions, keine Ableitung des Gesprächsstatus aus Zustellstatus oder Leadstatus. Technik-, Ticket-, Spam- und interne Kommunikation ausschließen beziehungsweise zur manuellen Prüfung vorlegen. Mandanten- und Mitarbeiterzuordnungen administrativ bestätigen; fehlende Zuordnungen nicht raten. Bestehende Leads nur über bestätigte externe Identitäten verknüpfen, Telefonnummern allein reichen nicht.

Für eine dateibasierte Übernahme im ALIXSMART-Chat drei vollständige UTF-8-CSV-Dateien exportieren und hier hochladen:

- `conversations.csv`: `conversation_id`, `contact_id`, bestätigte `alixwork_tenant_id`, optional bestätigte `alixwork_lead_id` und `alixwork_user_id`, `phone` (E.164), `name`, `area`, `relevance`, `session_status` (Originalwert), `created_at`, `updated_at`, `last_inbound_at`.
- `messages.csv`: `message_id`, `conversation_id`, `contact_id`, `direction`, `text`, `occurred_at` (ISO mit Zeitzone), `delivery_status`, optional `error`. Stabile tatsächliche Nachrichten-IDs verwenden; keine neuen IDs bei Wiederholung. Kein Nachrichtentext darf gekürzt werden.
- `media.csv`: `media_id`, `message_id`, `name`, `mime`. Keine öffentlichen Medien-URLs, Zugangsdaten oder Provider-Tokens exportieren. Dateien erst nach bestätigtem geschütztem Downloadvertrag übertragen.

Vor dem Import hier eine Vorschau mit Gesprächs-/Nachrichtenanzahl, Statusverteilung, Zeitraum, fehlenden Zuordnungen und Konflikten zeigen. Den Import über die bestehenden geschützten ALIXWORK-RPCs ausführen, nicht mit direkten Tabellenwrites oder künstlichen aktuellen Nachrichten. Historische Nachrichten behalten ihre Originalzeitpunkte; historischer Import darf keine automatischen Kundenantworten auslösen. Historische Benachrichtigungen und 24h-/Wiedervorlagenhinweise dürfen nicht ungeprüft durch Backfill ausgelöst werden. Dafür ist vor der ersten Übernahme ein explizit getesteter historischer Importmodus nötig; die vorhandenen Live-Ereignisfunktionen nicht blind als Backfill verwenden.

Nach der Übernahme dieselben Konversations- und Nachrichten-IDs für die Live-Ereignisse verwenden. Überlappung von Export und Live-Eingang muss dedupliziert werden; Status nur mit nachweisbarer Quellreihenfolge übernehmen. Zähler und Originaltexte in ALIXSMART und ALIXWORK abgleichen. Erst nach angemeldeter Prüfung eines offenen und eines geschlossenen Gesprächs sowie der Mitarbeitertrennung als aktive Verbindung melden; keine Kundennachricht zu Testzwecken senden.