
# ESC Ausbaustufe 3 – Umsetzung in 4 Phasen

Alle Phasen bauen auf dem bestehenden ESC-Kern (Events, Ressourcen, Teilnehmer, Audit-Log, ICS-Feed) auf. Jede Phase wird einzeln geliefert und kann sofort genutzt werden.

## Phase A – KI-Planung (Auto-Scheduling)

Ziel: „Termin am besten planen lassen" – die KI schlägt Datum, Uhrzeit, Techniker und Ressource vor.

- Neuer Button „🪄 KI-Vorschlag" im Termin-Erstellen-Dialog.
- Edge Function `esc-ai-suggest` ruft Lovable AI (`google/gemini-3-flash-preview`) mit Tool-Calling auf.
- Kontext, den die KI bekommt:
  - Termin-Typ, Dauer, Kunde/Adresse
  - Freie Slots pro Mitarbeiter (nächste 14 Tage, aus `esc_events` + `esc_employee_settings.working_hours`)
  - Skills/Abteilungen (`esc_employee_departments`)
  - Bereits geplante Touren am Zieltag (Region-Clustering aus `route_plans`)
  - Ressourcen-Auslastung (`esc_event_resources`)
- Rückgabe: 3 gerankte Vorschläge mit Begründung („Techniker X ist am 14.7. eh in PLZ 8010 unterwegs").
- UI: Vorschlagskarten mit „Übernehmen"-Button, füllt das Formular vor.

## Phase B – Tourenplanung + Ressourcen

- Neue Ansicht `/esc/touren`: Karte + Tages-Timeline pro Techniker.
- Reihenfolge-Optimierung per Nearest-Neighbor (clientseitig, PLZ-basiert) – kein externer Kartendienst nötig.
- Konflikt-Checker: Ressource doppelt gebucht → Warnbanner im Termin-Dialog (Edge Function `esc-conflict-check`).
- Overlay im Kalender: Termine derselben Tour bekommen gleiche Farbrand-Kennung.

## Phase C – QR-Check-in + digitale Unterschrift

- Jeder Termin bekommt QR-Code (`/esc/checkin/{token}` – nutzt bestehendes `esc_ics_tokens`-System, action=`checkin`).
- Public-Seite ohne Login: Kunde/Techniker sieht Terminübersicht, drückt „Check-in" → Zeitstempel + Geolocation optional.
- Signature-Pad (react-signature-canvas) → PNG in Storage `esc-signatures`, Referenz in neuer Tabelle `esc_signatures`.
- PDF-Protokoll (jsPDF) mit Termin + Signatur + Check-in-Zeit, per E-Mail versendbar.

## Phase D – WhatsApp/SMS + Google/Microsoft Two-Way-Sync

WhatsApp/SMS
- Nutzt vorhandene Twilio + GatewayAPI Connectoren.
- Erweitert `esc-send-email` zu generischem `esc-send-message` mit Kanal-Switch (`email` | `sms` | `whatsapp`).
- Templates in `esc_ech_templates` (Kanal-Feld existiert bereits).
- Eingehende Antworten (Twilio Webhook `esc-whatsapp-inbound`) → Status `confirmed` auf Termin.

Kalender Two-Way-Sync (Beides: pro Mitarbeiter + Firmenkalender)
- **Pro Mitarbeiter**: OAuth-Flow in `/esc/einstellungen` – Buttons „Google verbinden" / „Microsoft verbinden".
  - Google: eigene OAuth-App (User legt Client-ID/Secret als Projekt-Secret ab, alternativ Lovable-Connector `google_calendar` als Firmenkonto).
  - Microsoft: Graph API OAuth (Delegated `Calendars.ReadWrite`).
  - Tokens verschlüsselt in neuer Tabelle `esc_calendar_connections` (user_id, provider, access_token, refresh_token, expires_at, calendar_id).
- **Firmenkalender**: Ein zentrales Konto via Lovable Connector (`google_calendar` bereits verfügbar; für M365 den Connector `microsoft_outlook` bzw. neuen Graph-Zugang).
- Sync-Engine (Edge Function `esc-calendar-sync`, Cron alle 5 Min):
  - Outbound: neue/geänderte ESC-Events → Provider (INSERT/UPDATE/DELETE).
  - Inbound: Provider-Events (nur die vom Connector-User erstellten Tags/Kategorie „ESC") → ESC-Events.
  - Konflikt-Regel: ESC ist Source of Truth, Provider-Änderungen erzeugen `esc_audit_log` Eintrag.

## Technische Anmerkungen

- Keine neuen Basistabellen wo möglich; nur `esc_signatures` und `esc_calendar_connections` sind neu.
- RLS: Beide neuen Tabellen strikt user_id-scoped + Super Admin/Admin.
- Alle Edge Functions mit CORS + JWT-Validierung, außer `esc-checkin/*` und `esc-whatsapp-inbound` (public/webhook).
- Secrets, die evtl. angefragt werden: `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MS_OAUTH_CLIENT_ID/SECRET/TENANT` (nur wenn User pro-Mitarbeiter-Sync ohne Firmenkonto will).

## Vorgehen

Ich starte jetzt mit **Phase A (KI-Planung)** und liefere sie komplett. Nach Freigabe / Test der Phase folgen B, C, D nacheinander in eigenen Nachrichten. Das hält Migrations und Änderungen überschaubar und reviewbar.
