import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

interface CheckPayload {
  id?: string;
  start_at: string;
  end_at: string;
  employee_ids?: string[];
  resource_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as CheckPayload;
    if (!body?.start_at || !body?.end_at) {
      return new Response(JSON.stringify({ error: 'start_at/end_at required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch overlapping events in the window
    const { data: events, error } = await supabase
      .from('esc_events')
      .select('id, title, start_at, end_at, assigned_user_id, resource_id, status')
      .lt('start_at', body.end_at)
      .gt('end_at', body.start_at)
      .not('status', 'in', '("storniert","abgelehnt")');

    if (error) throw error;

    const conflicts: { kind: string; refId: string; label: string; other: any }[] = [];
    for (const ev of events || []) {
      if (body.id && ev.id === body.id) continue;
      // Employee conflict
      if (ev.assigned_user_id && body.employee_ids?.includes(ev.assigned_user_id)) {
        conflicts.push({
          kind: 'employee',
          refId: ev.assigned_user_id,
          label: `Mitarbeiter belegt: ${ev.title}`,
          other: ev,
        });
      }
      // Resource conflict
      if (body.resource_id && ev.resource_id === body.resource_id) {
        conflicts.push({
          kind: 'resource',
          refId: body.resource_id,
          label: `Ressource belegt: ${ev.title}`,
          other: ev,
        });
      }
    }

    return new Response(JSON.stringify({ conflicts, count: conflicts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('esc-conflict-check', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
