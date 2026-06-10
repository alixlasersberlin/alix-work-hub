import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { report_id } = await req.json();
    if (!report_id) return new Response(JSON.stringify({ error: 'report_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: report, error } = await supabase.from('finance_reports').select('*').eq('id', report_id).single();
    if (error || !report) throw new Error('Bericht nicht gefunden');

    // Demo aggregation against finance_transactions
    const dims = (report.dimensions ?? []) as string[];
    const metrics = (report.metrics ?? []) as string[];
    const { data: tx } = await supabase.from('finance_transactions').select('*').limit(1000);

    const rows = aggregate(tx ?? [], dims, metrics);

    return new Response(JSON.stringify({
      report: { id: report.id, name: report.name, visualization: report.visualization },
      dimensions: dims, metrics, rows, row_count: rows.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function aggregate(rows: any[], dims: string[], metrics: string[]) {
  const groups = new Map<string, any>();
  for (const r of rows) {
    const key = dims.map(d => {
      if (d === 'period_month' && r.transaction_date) return r.transaction_date.slice(0, 7);
      if (d === 'period_quarter' && r.transaction_date) {
        const m = parseInt(r.transaction_date.slice(5, 7), 10);
        return `${r.transaction_date.slice(0, 4)}-Q${Math.ceil(m / 3)}`;
      }
      return r[d] ?? r[`${d}_id`] ?? '—';
    }).join(' | ');
    const g = groups.get(key) ?? { key, ...Object.fromEntries(dims.map((d, i) => [d, key.split(' | ')[i]])) };
    for (const m of metrics) {
      g[m] = (g[m] ?? 0) + (m === 'invoice_count' ? 1 : Number(r.amount ?? 0));
    }
    groups.set(key, g);
  }
  return Array.from(groups.values());
}
