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

## 4. Ausschließlich API und Echtzeit (Klarstellung 03.11.2026)

Kein CSV-/Dateiimport, kein Backfill-Import und keine AlixWorld-Anbindung. Die frühere Exportanweisung ist aufgehoben. Bestehende offene und geschlossene Sales-Gespräche sollen direkt über die autorisierte ALIXSMART-API angezeigt werden; neue Nachrichten und Statusänderungen kommen über die vorhandenen signierten Echtzeitereignisse. ALIXSMART bleibt die führende Gesprächsquelle.

Im ALIXSMART-Projekt die vorhandenen `alixwork-sales-bridge` und `alixwork-sales-dispatch` prüfen und aktivieren, nicht erneut erstellen. Bereitstellung, referenzierte Datenbankgrundlagen und gemeinsames Secret sicher prüfen, ohne Schlüssel auszugeben. ALIXWORK erwartet `ALIXSMART_API_BASE_URL` als bestätigte HTTPS-Functions-Basisadresse. Direkte Mandanten-/Mitarbeiter-/Lead-/Konversationsberechtigungen zwischen beiden Anwendungen bestätigen; dafür keine AlixWorld-Identitäten oder CSV-Zuordnungen verlangen.

Die vorhandene Bridge verlangt bereits gebundene Lead-, Mandanten-, Kontakt-, Konversations- und Mitarbeiter-IDs. Für die Übersicht bestehender Gespräche fehlt damit noch ein nachweislich autorisierter paginierter Discovery-/Listenvertrag: Super Admin sieht alle berechtigten Sales-Gespräche einschließlich geschlossener Sessions, Mitarbeiter nur eigene. Diese Übersicht darf nicht von zuvor importierten Leads abhängen. Keine Berechtigungen aus frei übergebenen Rollen ableiten; keine Kundenkontakte allein anhand einer Telefonnummer verknüpfen. Erst nach bestätigtem Quellvertrag die ALIXWORK-Übersicht daran anschließen.

Änderungen und Aktivierung in ALIXSMART müssen in dessen Projektchat erfolgen; der Quellcheckout hier ist nur lesbar. Echte Live-Prüfung bleibt bis zur Bereitstellung und bestätigten Berechtigung offen. Kein Kunde wurde angeschrieben, keine Daten importiert.
