import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    if (!token || token.length < 16) return json({ error: 'invalid_token' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: review } = await admin
      .from('reviews')
      .select('id, customer_name, order_number, product_name, delivery_date, token_expires_at, submitted_at, status')
      .eq('review_token', token)
      .maybeSingle()

    if (!review) return json({ error: 'invalid_token' }, 404)
    if (review.status === 'archived') return json({ error: 'invalid_token' }, 410)
    if (review.token_expires_at && new Date(review.token_expires_at) < new Date()) {
      return json({ error: 'expired' }, 410)
    }
    if (review.submitted_at) return json({ error: 'already_submitted' }, 409)

    return json({
      ok: true,
      customer_name: review.customer_name,
      order_number: review.order_number,
      product_name: review.product_name,
      delivery_date: review.delivery_date,
    })
  } catch (e: any) {
    return json({ error: e?.message || 'error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
