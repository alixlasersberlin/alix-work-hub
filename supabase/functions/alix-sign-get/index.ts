import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token || token.length < 16) {
    return new Response(JSON.stringify({ error: 'Token required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: r, error } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, offer_payload, customer_email, customer_name, status, expires_at, opened_at, signed_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !r) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let status = r.status as string
  const expired = new Date(r.expires_at).getTime() < Date.now()
  if (expired && status !== 'unterschrieben') {
    status = 'abgelaufen'
    await admin.from('alix_sign_requests').update({ status: 'abgelaufen' }).eq('id', r.id)
  }

  // Mark as opened (first time only)
  if (!r.opened_at && status !== 'unterschrieben' && status !== 'abgelaufen') {
    await admin.from('alix_sign_requests')
      .update({ opened_at: new Date().toISOString(), status: 'geöffnet' })
      .eq('id', r.id)
    await admin.from('alix_sign_audit_log').insert({
      sign_request_id: r.id,
      action: 'link_opened',
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    })
    status = 'geöffnet'
  }

  return new Response(JSON.stringify({
    id: r.id,
    offer_number: r.offer_number,
    offer_payload: r.offer_payload,
    customer_email: r.customer_email,
    customer_name: r.customer_name,
    status,
    expires_at: r.expires_at,
    signed_at: r.signed_at,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
