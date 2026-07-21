import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * POST { filter } | { segment_id }
 * Berechnet die Kontaktmenge eines Segments und aktualisiert contact_count.
 * filter: { min_engagement?, max_churn?, segment_label?, has_tag?, country? }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    let filter = body.filter as Record<string, any> | undefined;
    let segmentId = body.segment_id as string | undefined;

    if (segmentId && !filter) {
      const { data } = await sb.from('ac_segments').select('filter').eq('id', segmentId).maybeSingle();
      filter = (data as any)?.filter ?? {};
    }
    if (!filter) return json({ error: 'filter or segment_id required' }, 400);

    // Basis: ac_contacts joined mit customer_scores (LEFT via zwei Queries)
    let q = sb.from('ac_contacts').select('id,email,phone,country,tags', { count: 'exact' }).limit(500);
    if (filter.country) q = q.eq('country', filter.country);
    if (filter.has_tag) q = q.contains('tags', [filter.has_tag]);
    const { data: contacts, count } = await q;

    let ids = (contacts ?? []).map((c: any) => c.id);

    // Score-Filter
    if ((filter.min_engagement != null) || (filter.max_churn != null) || filter.segment_label) {
      const { data: scores } = await sb.from('ac_customer_scores')
        .select('contact_id,engagement_score,churn_score,segment')
        .in('contact_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      const scoreMap = new Map((scores ?? []).map((s: any) => [s.contact_id, s]));
      ids = ids.filter((id: string) => {
        const s = scoreMap.get(id);
        if (filter!.min_engagement != null && (!s || s.engagement_score < filter!.min_engagement)) return false;
        if (filter!.max_churn != null && (!s || s.churn_score > filter!.max_churn)) return false;
        if (filter!.segment_label && (!s || s.segment !== filter!.segment_label)) return false;
        return true;
      });
    }

    if (segmentId) {
      await sb.from('ac_segments').update({
        contact_count: ids.length, last_computed_at: new Date().toISOString(),
      }).eq('id', segmentId);
    }
    return json({ count: ids.length, sample: ids.slice(0, 20), total_scanned: count ?? contacts?.length ?? 0 });
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
