// AlixDocs 2.0 — Workflow Scanner (Phase 7)
// Scans documents for expiry-relevant entities (Garantie/Wartung/Vertrag) and
// creates app_notifications for Admin & Super Admin when a deadline approaches.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  // ISO
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

type Kind = 'garantie' | 'wartung' | 'vertrag';
const FIELDS: { field: string; kind: Kind; label: string }[] = [
  { field: 'garantie_bis', kind: 'garantie', label: 'Garantie' },
  { field: 'garantie_ende', kind: 'garantie', label: 'Garantie' },
  { field: 'warranty_until', kind: 'garantie', label: 'Warranty' },
  { field: 'wartung_faellig', kind: 'wartung', label: 'Wartung' },
  { field: 'wartung_bis', kind: 'wartung', label: 'Wartung' },
  { field: 'next_service', kind: 'wartung', label: 'Wartung' },
  { field: 'vertrag_bis', kind: 'vertrag', label: 'Vertrag' },
  { field: 'vertrag_ende', kind: 'vertrag', label: 'Vertrag' },
  { field: 'contract_end', kind: 'vertrag', label: 'Vertrag' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);

    const { data: docs } = await admin
      .from('alixdocs2_documents')
      .select('id, title, ai_entities, nc_path')
      .not('ai_entities', 'is', null)
      .limit(2000);

    const { data: roles } = await admin
      .from('user_roles')
      .select('user_id, roles:role_id(name)');
    const targetUsers = Array.from(new Set(
      (roles ?? [])
        .filter((r: any) => ['Admin', 'Super Admin'].includes(r.roles?.name))
        .map((r: any) => r.user_id as string),
    ));

    const now = Date.now();
    let created = 0;
    let scanned = 0;

    for (const d of docs ?? []) {
      const ent: any = d.ai_entities ?? {};
      for (const f of FIELDS) {
        const raw = ent[f.field];
        const date = parseDate(raw);
        if (!date) continue;
        scanned++;
        const daysLeft = Math.round((date.getTime() - now) / 86400000);
        if (daysLeft > 30 || daysLeft < -1) continue;

        for (const uid of targetUsers) {
          const { data: recent } = await admin.from('app_notifications')
            .select('id').eq('user_id', uid).eq('category', 'alixdocs2_expiry')
            .contains('metadata', { document_id: d.id, kind: f.kind })
            .gte('created_at', new Date(now - 7 * 86400000).toISOString()).limit(1);
          if (recent && recent.length) continue;

          await admin.from('app_notifications').insert({
            user_id: uid,
            category: 'alixdocs2_expiry',
            priority: daysLeft <= 7 ? 'high' : 'normal',
            title: `${f.label} läuft ab: ${d.title}`,
            message: daysLeft < 0
              ? `${f.label} war vor ${Math.abs(daysLeft)} Tag(en) fällig (${date.toISOString().slice(0,10)}).`
              : `${f.label} in ${daysLeft} Tag(en) fällig (${date.toISOString().slice(0,10)}).`,
            action_url: `/alixdocs2/dokument/${d.id}`,
            metadata: { document_id: d.id, kind: f.kind, due: date.toISOString().slice(0,10), nc_path: d.nc_path },
          });
          created++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, docs: docs?.length ?? 0, scanned, created }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
