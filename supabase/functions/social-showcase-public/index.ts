// Social-Media Public Showcase (1:1 zu mediapaket-public)
// Actions:
//   get_showcase_config { client_id }           → Admin liest Token/Enabled
//   toggle_showcase     { client_id, enabled }  → Admin schaltet Showcase ein/aus
//   get_showcase        { token }               → Öffentliche Showcase-Daten
//   create_lead         { token, lead }         → Legt sales_lead an

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const SETTINGS_PREFIX = 'social.showcase.';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function genToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function readCfg(clientId: string): Promise<{ token: string | null; enabled: boolean }> {
  const { data } = await admin.from('app_settings').select('value').eq('key', SETTINGS_PREFIX + clientId).maybeSingle();
  if (!data) return { token: null, enabled: false };
  try {
    const v = JSON.parse((data as any).value || '{}');
    return { token: v.token ?? null, enabled: !!v.enabled };
  } catch {
    return { token: null, enabled: false };
  }
}

async function writeCfg(clientId: string, cfg: { token: string; enabled: boolean }) {
  const key = SETTINGS_PREFIX + clientId;
  const value = JSON.stringify({ ...cfg, created_at: new Date().toISOString() });
  const { data: existing } = await admin.from('app_settings').select('key').eq('key', key).maybeSingle();
  if (existing) {
    await admin.from('app_settings').update({ value }).eq('key', key);
  } else {
    await admin.from('app_settings').insert({ key, value });
  }
}

async function resolveShowcaseToken(token: string): Promise<string | null> {
  const { data } = await admin.from('app_settings').select('key, value').like('key', SETTINGS_PREFIX + '%');
  for (const r of data || []) {
    try {
      const v = JSON.parse((r as any).value || '{}');
      if (v?.enabled && v?.token === token) {
        return (r as any).key.replace(SETTINGS_PREFIX, '');
      }
    } catch {}
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    // --- Admin actions --------------------------------------------------
    if (action === 'get_showcase_config') {
      const clientId = String(body.client_id ?? '');
      if (!clientId) return json({ error: 'client_id required' }, 400);
      const cfg = await readCfg(clientId);
      return json(cfg);
    }

    if (action === 'toggle_showcase') {
      const clientId = String(body.client_id ?? '');
      const enabled = !!body.enabled;
      if (!clientId) return json({ error: 'client_id required' }, 400);
      const existing = await readCfg(clientId);
      const token = existing.token ?? genToken();
      await writeCfg(clientId, { token, enabled });
      return json({ token, enabled });
    }

    // --- Public actions -------------------------------------------------
    const token = String(body.token ?? '');
    if (!token) return json({ error: 'token required' }, 400);
    const clientId = await resolveShowcaseToken(token);
    if (!clientId) return json({ error: 'Showcase nicht verfügbar oder deaktiviert' }, 404);

    if (action === 'get_showcase') {
      const { data: client } = await admin
        .from('social_clients')
        .select('id, company_name, industry, website, logo_url')
        .eq('id', clientId)
        .maybeSingle();
      if (!client) return json({ error: 'not found' }, 404);

      const [accounts, posts, q] = await Promise.all([
        admin.from('social_accounts').select('platform, username').eq('client_id', clientId).is('deleted_at', null),
        admin
          .from('social_posts')
          .select('id, title, content, platform, media_urls, published_at')
          .eq('client_id', clientId)
          .eq('status', 'published')
          .is('deleted_at', null)
          .order('published_at', { ascending: false })
          .limit(6),
        admin.from('social_questionnaire').select('answers').eq('client_id', clientId).is('deleted_at', null).maybeSingle(),
      ]);

      // Fragebogen-Highlights: kompakte Key/Value-Paare aus answers
      const answers = (q.data as any)?.answers ?? {};
      const highlights: { label: string; value: string }[] = [];
      const LABELS: Record<string, string> = {
        zielgruppe: 'Zielgruppe',
        target_audience: 'Zielgruppe',
        tonalitaet: 'Tonalität',
        tone: 'Tonalität',
        usps: 'USPs',
        unique_selling_points: 'USPs',
        ziele: 'Marketing-Ziele',
        goals: 'Marketing-Ziele',
        werte: 'Markenwerte',
        values: 'Markenwerte',
        stil: 'Bildsprache',
        visual_style: 'Bildsprache',
      };
      for (const [k, v] of Object.entries(answers)) {
        if (v == null || v === '') continue;
        const label = LABELS[k];
        if (!label) continue;
        const text = Array.isArray(v) ? v.join(', ') : String(v);
        if (text.trim().length === 0) continue;
        highlights.push({ label, value: text.slice(0, 400) });
      }

      return json({
        client: {
          company_name: client.company_name,
          industry: (client as any).industry ?? null,
          website: (client as any).website ?? null,
          logo_url: (client as any).logo_url ?? null,
        },
        accounts: (accounts.data ?? []).map((a: any) => ({ platform: a.platform, username: a.username })),
        posts: (posts.data ?? []).map((p: any) => ({
          id: p.id,
          title: p.title,
          content: (p.content ?? '').slice(0, 400),
          platform: p.platform,
          media_urls: Array.isArray(p.media_urls) ? p.media_urls.slice(0, 4) : [],
          published_at: p.published_at,
        })),
        highlights,
      });
    }

    if (action === 'create_lead') {
      const lead = body.lead ?? {};
      if (!lead?.name || !lead?.email) return json({ error: 'name & email required' }, 400);
      const { data: client } = await admin.from('social_clients').select('company_name').eq('id', clientId).maybeSingle();
      const parts = String(lead.name).trim().split(/\s+/);
      const first_name = parts[0] || lead.name;
      const last_name = parts.slice(1).join(' ') || null;
      const notes = `Anfrage über Social-Media-Showcase (${(client as any)?.company_name ?? clientId})`;
      const { error: leadErr } = await admin.from('sales_leads').insert({
        first_name,
        last_name,
        email: lead.email,
        phone: lead.phone || null,
        source: 'social_showcase',
        lead_status: 'new',
        message: lead.message || null,
        notes,
        interests: ['Social Media'],
      } as any);
      if (leadErr) return json({ error: leadErr.message }, 400);

      await admin.from('social_activity_logs').insert({
        actor_id: null,
        action: 'showcase_lead_created',
        entity_type: 'social_clients',
        entity_id: clientId,
      }).then(() => null, () => null);

      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
