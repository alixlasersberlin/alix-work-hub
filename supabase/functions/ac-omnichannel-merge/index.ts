// ALIX CONNECT Phase 50 — Omnichannel-Merge
// Verbindet SMS + WhatsApp + Email desselben Kunden zu einer einzigen Unified Conversation.
// Match-Kriterien: gleiche E-Mail ODER gleiche normalisierte Telefonnummer (E.164, letzte 8 Ziffern).
// Kopiert alle ac_messages der Duplikat-Kontakte auf den Master und löscht die Duplikate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normPhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/[^0-9]/g, '');
  return digits.length >= 8 ? digits.slice(-8) : null;
}
function normEmail(e?: string | null): string | null {
  return e ? e.trim().toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { dry_run = true, limit = 500 } = body;

    const { data: contacts, error } = await sb.from('ac_contacts')
      .select('id, name, email, phone, whatsapp, created_at')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;

    // Gruppen bilden
    const byEmail = new Map<string, string[]>();
    const byPhone = new Map<string, string[]>();
    for (const c of contacts ?? []) {
      const e = normEmail(c.email);
      if (e) (byEmail.get(e) ?? byEmail.set(e, []).get(e)!).push(c.id);
      for (const p of [c.phone, c.whatsapp]) {
        const n = normPhone(p);
        if (n) (byPhone.get(n) ?? byPhone.set(n, []).get(n)!).push(c.id);
      }
    }

    // Union-Find
    const parent: Record<string, string> = {};
    const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    for (const c of contacts ?? []) parent[c.id] = c.id;
    for (const ids of [...byEmail.values(), ...byPhone.values()]) {
      for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    }

    // Groups > 1
    const groups = new Map<string, string[]>();
    for (const c of contacts ?? []) {
      const r = find(c.id);
      (groups.get(r) ?? groups.set(r, []).get(r)!).push(c.id);
    }
    const dupGroups = [...groups.values()].filter(g => g.length > 1);

    const results: any[] = [];
    for (const grp of dupGroups) {
      // Master = ältester Kontakt
      const master = grp[0];
      const dupes = grp.slice(1);
      if (dry_run) {
        results.push({ master, merged_count: dupes.length, dupes });
        continue;
      }
      // Move messages & calls
      await sb.from('ac_messages').update({ contact_id: master }).in('contact_id', dupes);
      await sb.from('ac_calls').update({ contact_id: master }).in('contact_id', dupes);
      // Delete duplicates
      await sb.from('ac_contacts').delete().in('id', dupes);
      results.push({ master, merged_count: dupes.length, dupes });
    }

    return new Response(JSON.stringify({ success: true, dry_run, groups: results.length, merges: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
