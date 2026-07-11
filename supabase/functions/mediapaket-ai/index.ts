// Phase 40 — Mediapaket AI Assistant
// Actions: 'summarize' (Was ist im Paket?), 'suggest' (Vorschläge zur Vervollständigung),
//          'diff' (Was hat sich zur letzten Version geändert?)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function loadFull(mpId: string) {
  const out: any = {};
  const { data: root } = await admin.from('media_packages').select('*').eq('id', mpId).maybeSingle();
  if (!root) return null;
  out.root = root;
  const tables = [
    'media_package_services','media_package_studio_data','media_package_devices',
    'media_package_prices','media_package_contact_data','media_package_opening_hours',
    'media_package_treatments','media_package_team_members','media_package_branding',
  ];
  for (const t of tables) {
    const { data } = await admin.from(t).select('*').eq('media_package_id', mpId);
    out[t.replace('media_package_', '')] = data || [];
  }
  return out;
}

async function callAi(system: string, user: string) {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const { mp_id, action } = body;
    if (!mp_id || !action) return json({ error: 'mp_id and action required' }, 400);
    const { data: allowed } = await userClient.from('media_packages').select('id').eq('id', mp_id).maybeSingle();
    if (!allowed) return json({ error: 'forbidden' }, 403);

    const data = await loadFull(mp_id);
    if (!data) return json({ error: 'not found' }, 404);

    const compact = JSON.stringify(data).slice(0, 12000);

    let system = '';
    let user = '';
    if (action === 'summarize') {
      system = 'Du bist ein Assistent für Marketing-Mediapakete deutscher Laser-Studios. Fasse das Mediapaket in 5-8 Bulletpoints prägnant zusammen (Studio, Services, Team, Highlights). Deutsch, klar.';
      user = `Mediapaket-Daten:\n${compact}`;
    } else if (action === 'suggest') {
      system = 'Du bist ein Assistent, der prüft ob ein Mediapaket vollständig ist. Nenne konkret welche Angaben fehlen oder verbessert werden sollten (max. 8 Punkte, priorisiert). Deutsch.';
      user = `Mediapaket-Daten:\n${compact}`;
    } else if (action === 'diff') {
      const { data: hist } = await admin.from('media_package_history')
        .select('created_at, new_value').eq('media_package_id', mp_id)
        .eq('action', 'submitted').order('created_at', { ascending: false }).limit(2);
      if (!hist || hist.length < 2) return json({ text: 'Noch keine zwei Versionen zum Vergleich vorhanden.' });
      system = 'Vergleiche zwei Versionen desselben Mediapakets und beschreibe konkret die Änderungen. Bulletpoints, Deutsch, max. 10 Punkte.';
      user = `Neu:\n${JSON.stringify(hist[0].new_value).slice(0,5000)}\n\nAlt:\n${JSON.stringify(hist[1].new_value).slice(0,5000)}`;
    } else {
      return json({ error: 'unknown action' }, 400);
    }

    const text = await callAi(system, user);
    await admin.from('media_package_history').insert({
      media_package_id: mp_id, user_id: userData.user.id, action: `ai_${action}`,
      new_value: { text: text.slice(0, 500) } as any,
    });
    return json({ text });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
