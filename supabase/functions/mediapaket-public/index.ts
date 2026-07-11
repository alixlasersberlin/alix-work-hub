// Phase 45 — Public Mediapaket Showcase Edge Function
// Actions:
//   get_showcase   { token }             → returns sanitized public package data
//   create_lead    { token, lead }       → creates sales_lead + history entry

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Showcase tokens live in app_settings.value as JSON:
// key = `mediapaket.showcase.<mpId>`, value = JSON.stringify({ token, enabled, created_at })
async function resolveShowcaseToken(token: string): Promise<string | null> {
  const { data } = await admin.from('app_settings').select('key, value').like('key', 'mediapaket.showcase.%');
  for (const r of data || []) {
    try {
      const v = JSON.parse((r as any).value || '{}');
      if (v?.enabled && v?.token === token) {
        return (r as any).key.replace('mediapaket.showcase.', '');
      }
    } catch {}
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, token } = body;
    if (!token) return json({ error: 'token required' }, 400);
    const mpId = await resolveShowcaseToken(token);
    if (!mpId) return json({ error: 'Showcase nicht verfügbar oder deaktiviert' }, 404);

    if (action === 'get_showcase') {
      const { data: mp } = await admin.from('media_packages').select('id, studio_name').eq('id', mpId).maybeSingle();
      if (!mp) return json({ error: 'not found' }, 404);
      const [services, treatments, team, branding] = await Promise.all([
        admin.from('media_package_services').select('service_name').eq('media_package_id', mpId),
        admin.from('media_package_treatments').select('treatment_name').eq('media_package_id', mpId),
        admin.from('media_package_team_members').select('first_name, last_name, role').eq('media_package_id', mpId),
        admin.from('media_package_branding').select('slogan, about_me, main_message').eq('media_package_id', mpId).maybeSingle(),
      ]);
      const br: any = branding.data || {};
      return json({
        package: {
          studio_name: mp.studio_name,
          tagline: br.slogan || br.main_message || null,
          brand_story: br.about_me || null,
          services: (services.data || []).map((r: any) => r.service_name).filter(Boolean),
          treatments: (treatments.data || []).map((r: any) => r.treatment_name).filter(Boolean),
          team: (team.data || []).map((r: any) => ({ name: [r.first_name, r.last_name].filter(Boolean).join(' '), role: r.role })).filter((t: any) => t.name),
        },
      });
    }

    if (action === 'create_lead') {
      const { lead } = body;
      if (!lead?.name || !lead?.email) return json({ error: 'name & email required' }, 400);
      const { data: mp } = await admin.from('media_packages').select('studio_name').eq('id', mpId).maybeSingle();
      const parts = String(lead.name).trim().split(/\s+/);
      const first_name = parts[0] || lead.name;
      const last_name = parts.slice(1).join(' ') || null;
      const notes = `Anfrage über Mediapaket-Showcase (${mp?.studio_name || mpId})`;
      const { error: leadErr } = await admin.from('sales_leads').insert({
        first_name, last_name, email: lead.email, phone: lead.phone || null,
        source: 'mediapaket_showcase', lead_status: 'new',
        message: lead.message || null, notes, interests: ['Mediapaket'],
      } as any);
      if (leadErr) return json({ error: leadErr.message }, 400);
      await admin.from('media_package_history').insert({
        media_package_id: mpId, action: 'showcase_lead_created',
        new_value: { name: lead.name, email: lead.email } as any,
      });
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
