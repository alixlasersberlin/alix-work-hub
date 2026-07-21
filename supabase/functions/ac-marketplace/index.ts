import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Phase 38 — Marketplace, Webhooks, Public API keys.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error } = await supabase.auth.getClaims(token);
    if (error || !claims?.claims) return j({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'overview');

    const APPS = [
      { id: 'zapier', name: 'Zapier', category: 'automation', description: 'Verbinde 6000+ Apps via Zapier.', status: 'ready' },
      { id: 'make', name: 'Make (Integromat)', category: 'automation', description: 'Visuelle Automationen.', status: 'ready' },
      { id: 'n8n', name: 'n8n', category: 'automation', description: 'Self-hosted Workflow-Engine.', status: 'ready' },
      { id: 'slack', name: 'Slack', category: 'messaging', description: 'Team-Benachrichtigungen.', status: 'ready' },
      { id: 'ms-teams', name: 'Microsoft Teams', category: 'messaging', description: 'MS Teams Notifications.', status: 'beta' },
      { id: 'hubspot', name: 'HubSpot', category: 'crm', description: 'CRM-Sync für Kontakte & Deals.', status: 'beta' },
      { id: 'salesforce', name: 'Salesforce', category: 'crm', description: 'Bidirektionaler Sync.', status: 'planned' },
      { id: 'shopify', name: 'Shopify', category: 'commerce', description: 'Bestellungen & Kunden.', status: 'planned' },
    ];

    if (action === 'overview') {
      return j({
        apps: APPS,
        stats: {
          total: APPS.length,
          ready: APPS.filter(a => a.status === 'ready').length,
          beta: APPS.filter(a => a.status === 'beta').length,
          planned: APPS.filter(a => a.status === 'planned').length,
        },
        webhooks: [
          { event: 'ticket.created', description: 'Neuer Ticket-Eingang' },
          { event: 'ticket.updated', description: 'Ticket-Status geändert' },
          { event: 'order.created', description: 'Neuer Auftrag' },
          { event: 'call.completed', description: 'Anruf beendet' },
          { event: 'message.received', description: 'Neue Nachricht' },
        ],
      });
    }

    if (action === 'test_webhook') {
      const url = String(body.url ?? '');
      if (!url.startsWith('https://')) return j({ error: 'https URL erforderlich' }, 400);
      const payload = { event: body.event ?? 'ping', ts: new Date().toISOString(), source: 'alix-connect' };
      const started = Date.now();
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Alix-Event': String(payload.event) },
          body: JSON.stringify(payload),
        });
        return j({ ok: res.ok, status: res.status, ms: Date.now() - started });
      } catch (e: any) {
        return j({ ok: false, error: e.message ?? 'fetch failed', ms: Date.now() - started }, 200);
      }
    }

    return j({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return j({ error: e.message ?? 'error' }, 500);
  }
});
function j(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
