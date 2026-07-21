import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'list');

    if (action === 'list') {
      const { data: convos } = await supabase
        .from('ac_conversations')
        .select('id, subject, status, priority, channel_type, assigned_to, sla_deadline, last_message_at, contact_id')
        .order('last_message_at', { ascending: false })
        .limit(200);
      const now = Date.now();
      const buckets = { new: [] as any[], overdue: [] as any[], waiting: [] as any[], mine: [] as any[], all: convos ?? [] };
      for (const c of convos ?? []) {
        const sla = c.sla_deadline ? new Date(c.sla_deadline).getTime() : null;
        if (!c.assigned_to) buckets.new.push(c);
        if (sla && sla < now && c.status !== 'closed') buckets.overdue.push(c);
        if (c.status === 'waiting_customer') buckets.waiting.push(c);
        if (c.assigned_to === claims.claims.sub) buckets.mine.push(c);
      }
      return json({ buckets, total: convos?.length ?? 0 });
    }
    if (action === 'bulk_assign') {
      const ids: string[] = body.ids ?? [];
      const user_id: string = body.user_id;
      if (!ids.length || !user_id) return json({ error: 'ids und user_id erforderlich' }, 400);
      const { error } = await supabase.from('ac_conversations').update({ assigned_to: user_id }).in('id', ids);
      if (error) throw error;
      return json({ updated: ids.length });
    }
    if (action === 'bulk_status') {
      const ids: string[] = body.ids ?? [];
      const status: string = body.status;
      if (!ids.length || !status) return json({ error: 'ids und status erforderlich' }, 400);
      const { error } = await supabase.from('ac_conversations').update({ status }).in('id', ids);
      if (error) throw error;
      return json({ updated: ids.length });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? 'error' }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
