// Katalog: KI-Übersetzung von Artikelbeschreibungen via Lovable AI Gateway
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Payload {
  text: string;
  targetLangs: string[]; // ISO codes, e.g. ['en','fr','it']
  sourceLang?: string;   // default 'de'
  context?: string;      // e.g. article name for context
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body?.text || !Array.isArray(body?.targetLangs) || body.targetLangs.length === 0) {
      return new Response(JSON.stringify({ error: 'text und targetLangs erforderlich' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const src = body.sourceLang ?? 'de';
    const prompt = `Übersetze den folgenden Produkt-/Artikeltext von ${src} in diese Sprachen: ${body.targetLangs.join(', ')}.
Behalte Fachbegriffe, Marken, Maßeinheiten und Zahlen exakt bei. Kein Marketing-Fluff, sondern nüchterne, präzise B2B-Sprache.
${body.context ? `Kontext (Artikelname): ${body.context}\n` : ''}
Antworte ausschließlich als kompaktes JSON-Objekt, ohne Erklärungen, im Format:
{"translations":{"<iso>":"<Übersetzung>", ...}}

Text:
"""${body.text}"""`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Du bist ein präziser Fachübersetzer für Medizintechnik/Beauty-Geräte. Antworte immer nur mit gültigem JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'AI Gateway Fehler', status: res.status, details: t }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '{}';
    // Robustes JSON extrahieren
    const m = raw.match(/\{[\s\S]*\}/);
    let translations: Record<string, string> = {};
    try { translations = JSON.parse(m ? m[0] : raw).translations ?? {}; } catch { translations = {}; }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
