import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: mails } = await sb.from('mail_messages' as any)
      .select('id,from_address,subject')
      .is('ac_contact_id', null)
      .limit(200);

    let linked = 0;
    for (const m of mails ?? []) {
      const from = (m as any).from_address as string | null;
      const subject = (m as any).subject as string | null;
      const patch: Record<string, unknown> = {};

      if (from) {
        const { data: c } = await sb.from('ac_contacts').select('id').eq('email', from.toLowerCase()).maybeSingle();
        if (c?.id) patch.ac_contact_id = c.id;
      }
      const orderMatch = subject?.match(/\b(20\d{2}-\d{4,6})\b/i);
      if (orderMatch) {
        const { data: o } = await sb.from('orders' as any).select('id').eq('order_number', orderMatch[1]).maybeSingle();
        if (o?.id) patch.linked_order_id = o.id;
      }
      if (Object.keys(patch).length) {
        await sb.from('mail_messages' as any).update(patch).eq('id', (m as any).id);
        linked++;
      }
    }
    return new Response(JSON.stringify({ linked, scanned: mails?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
