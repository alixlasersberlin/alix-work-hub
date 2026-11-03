import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ChatRequest, RemoteReply, matchesChatScope, signChatBody } from './contract.ts';

const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const unavailable = (reason: string) => json({ ok: false, connected: false, error: reason });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ ok: false, error: 'Nur POST erlaubt.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const auth = req.headers.get('Authorization');
    if (!url || !anon) return unavailable('Anmeldung derzeit nicht prüfbar.');
    if (!auth?.startsWith('Bearer ')) return json({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: identity, error: authError } = await caller.auth.getUser(auth.slice(7));
    if (authError || !identity.user) return json({ ok: false, error: 'Ungültige Sitzung.' }, 401);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 12000) return json({ ok: false, error: 'Anfrage zu groß.' });
    const parsed = ChatRequest.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ ok: false, error: 'Ungültige Chatanfrage.' });
    const input = parsed.data;
    // Invoker facade verifies active profile, assignment and tenant before any remote access.
    const { data: scope, error } = await caller.rpc('ml_wa_chat', { _lead_id: input.lead_id, _limit: 1 });
    if (error || !scope) return json({ ok: false, error: 'Lead nicht zugänglich.' });
    const linked = scope as { linked: boolean; tenant_id: string; contact_id: string; conversation_id: string };
    if (!linked.linked || !linked.tenant_id || !linked.contact_id || !linked.conversation_id) return unavailable('Die ALIXSMART-Konversation ist diesem Lead noch nicht bestätigt zugeordnet.');
    const base = Deno.env.get('ALIXSMART_API_BASE_URL'); const secret = Deno.env.get('ALIXSMART_WEBHOOK_SECRET');
    if (!base || !secret) return unavailable('Die geschützte ALIXSMART-Verbindung ist nicht konfiguriert.');
    const destination = new URL(base.replace(/\/$/, '') + '/alixwork-sales-bridge');
    if (destination.protocol !== 'https:') return unavailable('Ungültige ALIXSMART-Adresse.');
    const nonce = crypto.randomUUID(); const timestamp = String(Math.floor(Date.now() / 1000));
    const request = JSON.stringify({ protocol: 'alixwork-sales-v1', source: 'alixwork', nonce, user_id: identity.user.id, lead_id: input.lead_id, tenant_id: linked.tenant_id, contact_id: linked.contact_id, conversation_id: linked.conversation_id, action: input.action, ...(input.action === 'send' ? { text: input.text, request_id: input.request_id } : {}), ...(input.action === 'read' && input.before ? { before: input.before } : {}), ...('message_id' in input ? { message_id: input.message_id } : {}), ...(input.action === 'media' ? { media_id: input.media_id } : {}) });
    const response = await fetch(destination, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'x-alixwork-timestamp': timestamp, 'x-alixwork-signature': await signChatBody(request, timestamp, secret) }, body: request, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      console.warn('ALIXSMART chat bridge rejected', { status: response.status });
      return unavailable(response.status === 404 ? 'ALIXSMART hat die Chat-Schnittstelle noch nicht bereitgestellt.' : `ALIXSMART hat die Anfrage abgewiesen (${response.status}).`);
    }
    const body = await response.text();
    if (body.length > 1500000) return unavailable('ALIXSMART-Antwort ist zu groß.');
    const remote = RemoteReply.safeParse(JSON.parse(body));
    if (!remote.success || remote.data.lead_id !== input.lead_id || !matchesChatScope(linked, remote.data)) return unavailable('ALIXSMART hat die sichere Chatzuordnung nicht bestätigt.');
    const { data: freshScope, error: permissionError } = await caller.rpc('ml_wa_chat', { _lead_id: input.lead_id, _limit: 1 });
    if (permissionError || !freshScope || !matchesChatScope(linked, freshScope as unknown as typeof linked)) return json({ ok: false, error: 'Die Leadzuweisung hat sich geändert.' });
    // External URLs are never passed straight to the browser; media download remains disabled until source contract is verified.
    if (input.action === 'media') return unavailable('Medienabruf wartet auf die bestätigte ALIXSMART-Dateischnittstelle.');
    return json({ ...remote.data, media_url: undefined, connected: true });
  } catch (e) {
    console.warn('ALIXSMART chat request interrupted', { type: e instanceof Error ? e.name : 'unknown' });
    return unavailable('Verbindung nicht bestätigt. Bei einem Versand nicht erneut senden, bis der Verlauf geprüft wurde.');
  }
});