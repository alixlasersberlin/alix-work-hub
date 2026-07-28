// Public onboarding portal for social_clients. Auth via onboarding_token in body.
// GET-style (action=load) returns current data; action=save updates whitelisted fields.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jr(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'load');
    const token = String(body.token ?? '').trim();
    if (!token || token.length < 20) return jr({ error: 'invalid_token' }, 400);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: client, error } = await svc
      .from('social_clients')
      .select(
        'id, company_name, contact_person, email, phone, mobile, website, industry, locations, corporate_colors, corporate_fonts, logo_url, onboarding_token_expires_at, onboarding_completed_at, deleted_at',
      )
      .eq('onboarding_token', token)
      .maybeSingle();
    if (error || !client || client.deleted_at) return jr({ error: 'invalid_token' }, 404);
    if (client.onboarding_token_expires_at && new Date(client.onboarding_token_expires_at) < new Date()) {
      return jr({ error: 'expired' }, 410);
    }

    if (action === 'load') {
      const { deleted_at: _d, ...safe } = client as any;
      return jr({ client: safe });
    }

    if (action === 'save') {
      const p = body.patch ?? {};
      const patch: Record<string, unknown> = {};
      const strFields = ['contact_person', 'email', 'phone', 'mobile', 'website', 'industry'];
      for (const k of strFields) if (typeof p[k] === 'string') patch[k] = p[k].slice(0, 400);
      if (Array.isArray(p.locations)) patch.locations = p.locations.slice(0, 20);
      if (p.corporate_colors && typeof p.corporate_colors === 'object') patch.corporate_colors = p.corporate_colors;
      if (p.corporate_fonts && typeof p.corporate_fonts === 'object') patch.corporate_fonts = p.corporate_fonts;

      const completed = body.complete === true;
      if (completed) {
        patch.onboarding_status = 'completed';
        patch.onboarding_completed_at = new Date().toISOString();
      } else {
        patch.onboarding_status = 'in_progress';
      }

      const { error: upErr } = await svc.from('social_clients').update(patch).eq('id', (client as any).id);
      if (upErr) return jr({ error: upErr.message }, 500);

      await svc.from('social_activity_logs').insert({
        actor_id: null,
        action: completed ? 'onboarding_portal_complete' : 'onboarding_portal_save',
        entity_type: 'social_clients',
        entity_id: (client as any).id,
      }).then(() => null, () => null);

      return jr({ ok: true, completed });
    }

    return jr({ error: 'unknown_action' }, 400);
  } catch (e) {
    return jr({ error: String((e as Error).message ?? e) }, 500);
  }
});
