# ALIX CONNECT – Phase 20 · 3CX Telefonie-Integration

## Umfang
- **Anrufjournal** (`ac_calls`) mit Richtung, Status, Nummern, Dauer, Aufzeichnung, Voicemail
- **PBX-Einstellungen** (`ac_pbx_settings`) – nur Admin / Super Admin
- **Click-to-Call** via Edge Function `ac-3cx-call` (3CX Call Control API + `tel:` Fallback)
- **Screen-Pop** in Echtzeit über Supabase Realtime auf `ac_calls`
- **Inbound Webhook** `ac-3cx-webhook` mit Kontakt-Zuordnung anhand Rufnummer + Agent-Zuordnung per E-Mail
- Neuer Menüpunkt **Telefonie (3CX)** in ALIX CONNECT (`/connect/telefonie`)

## Setup (Admin)
1. `/connect/telefonie` öffnen (Admin/Super Admin).
2. PBX Basis-URL, API-Token (Call Control), Standard-Nebenstelle und Webhook-Secret eintragen.
3. In 3CX Call Control API einen Webhook auf die angezeigte URL registrieren, Header `x-3cx-signature: <secret>` setzen. Events: `ringing`, `answered`, `ended`, `voicemail`.

## Payload-Beispiel (3CX → Webhook)
```json
{
  "event": "answered",
  "call_id": "abc123",
  "direction": "inbound",
  "from": "+493012345678",
  "to": "+491516000000",
  "extension": "100",
  "agent_email": "user@alix-lasers.com",
  "started_at": "2026-07-21T10:00:00Z",
  "answered_at": "2026-07-21T10:00:04Z"
}
```

## Sicherheit
- RLS: interne Rollen (Admin, Super Admin, Kundenservice, Vertrieb) + zugewiesener Agent sehen Anrufe
- Löschen nur Super Admin
- Webhook-Secret zwingend, wenn `PBX_3CX_WEBHOOK_SECRET` gesetzt

## Realtime
- Publication `supabase_realtime` enthält `ac_calls`
- Screen-Pop-Toast bei jedem neuen `direction=inbound` + `status=ringing`
