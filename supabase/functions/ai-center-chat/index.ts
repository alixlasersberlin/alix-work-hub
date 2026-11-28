// AI Center – generischer Chat/Analyse-Endpunkt für das AI Service Center.
// Nimmt {messages, response_format?, model?} entgegen, ruft Lovable AI Gateway
// und liefert die Antwort als Text/JSON zurück. KEINE Tools, KEINE Auto-Decisions.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { AiCenterBody, aiCenterMessages } from '../_shared/ai-center-messages.ts';
import { generateChatCompletion, GatewayError } from 'npm:@lovable.dev/ai-gateway@0.1.15';
import type {} from '../_shared/generated/ai-gateway/models.d.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin', 'Geschäftsführung', 'Serviceleitung', 'Service', 'Technik', 'Finance', 'Österreich']);
    if ('response' in access) return access.response;
    const parsed = AiCenterBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Ungültige Chatnachrichten; Systemanweisungen werden ausschließlich serverseitig festgelegt.' }, 400);
    const body = parsed.data;
    const model = 'google/gemini-3-flash-preview';
    const aiJson = await generateChatCompletion({ model, messages: aiCenterMessages(body), ...(body.response_format ? { response_format: body.response_format } : {}) }, { maxRetries: 0 });
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    return json({ content, usage: aiJson.usage ?? null, model });
  } catch (e) {
    if (e instanceof GatewayError) {
      const status = e.httpStatus === 429 ? 429 : e.httpStatus === 402 ? 402 : 502;
      return json({ error: status === 429 ? 'Rate Limit erreicht. Bitte später erneut versuchen.' : status === 402 ? 'AI-Guthaben aufgebraucht.' : 'KI-Anfrage fehlgeschlagen; keine automatische Wiederholung.' }, status);
    }
    return json({ error: (e as Error)?.message ?? "Unbekannter Fehler" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
