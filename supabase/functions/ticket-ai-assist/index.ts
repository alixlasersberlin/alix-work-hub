// Edge Function: ticket-ai-assist
// KI-Assistenz für die Ticketverwaltung:
//  - schlägt einen Antworttext für den Bearbeiter vor
//  - liefert Hinweise/Insights aus ähnlichen, bereits gelösten Fällen
// Schreibt NICHT in die DB. Das Frontend übernimmt den Text in das Antwortfeld.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'google/gemini-3-flash-preview';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return j({ error: 'LOVABLE_API_KEY fehlt' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userRes } = await supa.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!userRes?.user) return j({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const ticket_id = String(body?.ticket_id ?? '');
    const mode: 'reply' | 'insights' = body?.mode === 'insights' ? 'insights' : 'reply';
    const tone = typeof body?.tone === 'string' ? body.tone : 'freundlich, professionell, lösungsorientiert';
    const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 500) : '';
    if (!ticket_id) return j({ error: 'ticket_id required' }, 400);

    const { data: ticket } = await supa
      .from('tickets')
      .select('id, ticket_number, external_ticket_id, title, description, status, priority, department, auto_category, customer_name, company_name, device_name, serial_number, order_number, created_at')
      .eq('id', ticket_id)
      .maybeSingle();
    if (!ticket) return j({ error: 'Ticket nicht gefunden' }, 404);

    const { data: msgs } = await supa
      .from('ticket_messages')
      .select('message, sender_type, sender_name, is_internal, created_at')
      .eq('ticket_id', ticket_id)
      .order('created_at', { ascending: false })
      .limit(12);
    const history = (msgs ?? [])
      .reverse()
      .map((m: any) => `[${m.sender_type === 'customer' ? 'Kunde' : 'Agent'}${m.is_internal ? ' · intern' : ''}${m.sender_name ? ` · ${m.sender_name}` : ''}] ${String(m.message ?? '').slice(0, 900)}`)
      .join('\n');

    // --- Ähnliche, bereits abgeschlossene Fälle finden (Keyword-Retrieval) ---
    const rawText = `${ticket.title ?? ''} ${ticket.description ?? ''}`.toLowerCase();
    const stop = new Set(['und', 'oder', 'der', 'die', 'das', 'ist', 'nicht', 'ein', 'eine', 'mit', 'für', 'von', 'auf', 'bei', 'dem', 'den', 'wir', 'ich', 'sie', 'kann', 'wird', 'sich', 'auch', 'noch', 'sehr', 'aber', 'zum', 'zur', 'was', 'wie']);
    const keywords = Array.from(new Set(
      rawText.replace(/[^a-zäöüß0-9\s-]/gi, ' ').split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w)),
    )).slice(0, 6);

    const similar: any[] = [];
    if (keywords.length) {
      const or = keywords.map((k) => `title.ilike.%${k}%,description.ilike.%${k}%`).join(',');
      const { data: sim } = await supa
        .from('tickets')
        .select('id, ticket_number, title, description, status, department, auto_category, created_at, customer_name, company_name')
        .neq('id', ticket_id)
        .in('status', ['gelöst', 'geschlossen'])
        .or(or)
        .order('created_at', { ascending: false })
        .limit(6);
      for (const s of sim ?? []) {
        const { data: sm } = await supa
          .from('ticket_messages')
          .select('message, sender_type, is_internal, created_at')
          .eq('ticket_id', s.id)
          .eq('is_internal', false)
          .neq('sender_type', 'customer')
          .order('created_at', { ascending: false })
          .limit(2);
        similar.push({
          id: s.id,
          ticket_number: s.ticket_number,
          customer_name: s.customer_name,
          company_name: s.company_name,
          title: s.title,
          status: s.status,
          category: s.auto_category ?? s.department,
          created_at: s.created_at,
          resolution: (sm ?? []).map((m: any) => String(m.message ?? '').slice(0, 600)).join('\n---\n'),
        });
      }
    }

    const ticketBlock = `Ticket ${ticket.ticket_number ?? ticket.external_ticket_id ?? ticket.id.slice(0, 8)}
Betreff: ${ticket.title ?? '—'}
Beschreibung: ${String(ticket.description ?? '').slice(0, 2000)}
Status: ${ticket.status} · Priorität: ${ticket.priority} · Abteilung: ${ticket.department} · Kategorie: ${ticket.auto_category ?? '—'}
Kunde: ${ticket.customer_name ?? '—'}${ticket.company_name ? ` (${ticket.company_name})` : ''}
Gerät: ${ticket.device_name ?? '—'} · Seriennr.: ${ticket.serial_number ?? '—'} · Auftrag: ${ticket.order_number ?? '—'}`;

    const similarBlock = similar.length
      ? similar.map((s, i) => `#${i + 1} [${s.ticket_number ?? s.id.slice(0, 8)}] ${s.title ?? ''}\nLösung/Antwort: ${s.resolution || '(keine dokumentierte Antwort)'}`).join('\n\n')
      : '(keine ähnlichen abgeschlossenen Fälle gefunden)';

    const system = mode === 'reply'
      ? `Du bist Kundenservice-Assistent von Alix Lasers. Sprache: Deutsch. Ton: ${tone}.
Erstelle einen Antwortentwurf an den Kunden auf die letzte Kundennachricht. Regeln:
- Max. 8 Sätze, konkret, keine erfundenen Fakten, keine Preis- oder Terminzusagen ohne Deckung.
- Nutze Erkenntnisse aus ähnlichen abgeschlossenen Fällen, wenn sie passen.
- Wenn Informationen fehlen, stelle höchstens eine präzise Rückfrage.
Antworte NUR mit JSON: {"draft":string,"short_draft":string,"insights":[string],"missing_info":string|null,"suggested_status":string|null,"confidence":number}`
      : `Du bist Analyse-Assistent für ein Service-Ticketsystem von Alix Lasers. Sprache: Deutsch.
Analysiere das Ticket und die ähnlichen abgeschlossenen Fälle und gib dem Bearbeiter kompakte Hinweise.
Antworte NUR mit JSON: {"summary":string,"insights":[string],"next_steps":[string],"risk":"low"|"medium"|"high","confidence":number}`;

    const userMsg = `${ticketBlock}

Nachrichtenverlauf:
${history || '(nur die Beschreibung liegt vor)'}

Ähnliche abgeschlossene Fälle:
${similarBlock}${hint ? `\n\nHinweis des Bearbeiters: ${hint}` : ''}`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (res.status === 429) return j({ error: 'Rate Limit erreicht. Bitte kurz warten.' }, 429);
    if (res.status === 402) return j({ error: 'AI-Guthaben aufgebraucht. Bitte Credits aufladen.' }, 402);
    if (!res.ok) return j({ error: `AI-Fehler ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);

    const aiJson = await res.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? '{}';
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = { draft: String(content) }; }

    return j({
      ok: true,
      mode,
      ...parsed,
      similar: similar.map((s) => ({ id: s.id, ticket_number: s.ticket_number, customer_name: s.customer_name, company_name: s.company_name, title: s.title, status: s.status, category: s.category, created_at: s.created_at })),
      model: MODEL,
    });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
