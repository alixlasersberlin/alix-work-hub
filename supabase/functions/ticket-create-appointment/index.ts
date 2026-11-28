// Erstellt aus einem Ticket heraus einen Kalendertermin (esc_events) mit Bestätigungs-Token.
// Aufruf: POST { ticket_id, start_at, end_at?, event_kind, ... } – nur aktive Mitarbeiter mit Ticket-Änderungsrecht.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { handleAppointment } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) => handleAppointment(req, corsHeaders, {
  access: (r) => requireCallerAccess(r, corsHeaders),
  admin,
  sendMail: async (body, auth) => {
    const res = await fetch(`${url}/functions/v1/send-mail`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { error: !res.ok || data?.error ? (data?.error ?? `status ${res.status}`) : null };
  },
}));
