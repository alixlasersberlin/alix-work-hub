// KI-Content & Bildgenerator für Social Media Modul.
// Actions:
//   - 'caption': text + hashtags via Gemini (chat completions), nutzt Fragebogen als Kontext
//   - 'image': Bildgenerierung via gpt-image-2, Upload nach social-media-library
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Zugriffs-Check: nur Rollen mit Social-Manage-Rechten
    const { data: canManage } = await svc.rpc('can_admin_social');
    if (!canManage) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // ---- Kontext laden ----
    async function loadContext(clientId?: string) {
      if (!clientId) return { company: '', fragebogen: {} as Record<string, string> };
      const [{ data: client }, { data: q }] = await Promise.all([
        svc.from('social_clients').select('company_name, industry, website').eq('id', clientId).maybeSingle(),
        svc.from('social_questionnaire').select('answers').eq('client_id', clientId).is('deleted_at', null).maybeSingle(),
      ]);
      return { company: client?.company_name ?? '', industry: client?.industry ?? '', website: client?.website ?? '', fragebogen: (q?.answers as any) ?? {} };
    }

    // ==================== CAPTION + HASHTAGS ====================
    if (action === 'caption') {
      const { client_id, platform, prompt, tone } = body;
      if (!prompt) return json({ error: 'prompt required' }, 400);
      const ctx = await loadContext(client_id);

      const system = `Du bist Social-Media-Copywriter für "${ctx.company || 'ein Unternehmen'}"${ctx.industry ? ` (Branche: ${ctx.industry})` : ''}.
Plattform: ${platform || 'instagram'}. Tonalität: ${tone || ctx.fragebogen?.tone || 'professionell, sympathisch, klar'}.
Zielgruppe: ${ctx.fragebogen?.target_audience || 'unbekannt'}.
USP: ${ctx.fragebogen?.usp || '—'}.
Do/Don't: ${ctx.fragebogen?.do_dont || '—'}.
Content-Säulen: ${ctx.fragebogen?.content_pillars || '—'}.

Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Format:
{"title": "kurzer Titel", "caption": "Post-Text inkl. Emojis, plattformgerecht", "hashtags": ["#tag1","#tag2", ...]}`;

      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
        body: JSON.stringify({
          model: 'google/gemini-3.6-flash',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: String(prompt) },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return json({ error: `AI error ${res.status}`, details: t }, res.status);
      }
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? '{}';
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = { caption: raw }; }
      return json({
        title: parsed.title ?? '',
        caption: parsed.caption ?? '',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      });
    }

    // ==================== IMAGE ====================
    if (action === 'image') {
      const { client_id, prompt, size } = body;
      if (!client_id || !prompt) return json({ error: 'client_id + prompt required' }, 400);
      const ctx = await loadContext(client_id);

      const fullPrompt = `${prompt}\n\nMarke: ${ctx.company}. Stil: ${ctx.fragebogen?.tone || 'modern, hochwertig'}. Content-Säulen: ${ctx.fragebogen?.content_pillars || '—'}.`;

      const imgRes = await fetch(`${GATEWAY}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
        body: JSON.stringify({
          model: 'openai/gpt-image-2',
          prompt: fullPrompt,
          size: size || '1024x1024',
          quality: 'low',
          n: 1,
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text().catch(() => '');
        return json({ error: `Image error ${imgRes.status}`, details: t }, imgRes.status);
      }
      const imgJson = await imgRes.json();
      const b64 = imgJson?.data?.[0]?.b64_json;
      if (!b64) return json({ error: 'No image returned' }, 500);

      // Base64 → Uint8Array
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const path = `${client_id}/ai_${Date.now()}.png`;

      const { error: upErr } = await svc.storage.from('social-media-library').upload(path, bin, {
        contentType: 'image/png',
        upsert: false,
      });
      if (upErr) return json({ error: upErr.message }, 500);

      const { data: inserted, error: dbErr } = await svc.from('social_media_library').insert({
        client_id,
        file_name: `ai_${Date.now()}.png`,
        storage_path: path,
        mime_type: 'image/png',
        size_bytes: bin.byteLength,
        category: 'Kampagne',
        tags: ['ai-generated'],
        uploaded_by: userId,
      }).select('id').single();
      if (dbErr) return json({ error: dbErr.message }, 500);

      const { data: sig } = await svc.storage.from('social-media-library').createSignedUrl(path, 3600);
      return json({ asset_id: inserted.id, storage_path: path, signed_url: sig?.signedUrl ?? null });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
