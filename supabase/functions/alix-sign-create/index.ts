import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  let s = ''
  for (const b of buf) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace('Bearer ', ''))
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: canUse } = await userClient.rpc('can_use_alix_sign')
  if (!canUse) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const offerNumber: string | undefined = body?.offer_number
  const offerPayload = body?.offer_payload
  const customerId: string | null = body?.customer_id ?? null
  const customerEmail: string | undefined = body?.customer_email
  const customerName: string | undefined = body?.customer_name
  const baseUrl: string = body?.base_url || 'https://alixwork.de'
  const expiresDays: number = Math.min(Math.max(Number(body?.expires_days) || 14, 1), 60)

  if (!offerNumber || !offerPayload || !customerEmail) {
    return new Response(JSON.stringify({ error: 'offer_number, offer_payload, customer_email required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString()

  const { data: ins, error: insErr } = await admin
    .from('alix_sign_requests')
    .insert({
      offer_number: offerNumber,
      offer_payload: offerPayload,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: customerName,
      token,
      status: 'gesendet',
      expires_at: expiresAt,
      created_by: userData.user.id,
    })
    .select()
    .single()

  if (insErr || !ins) {
    console.error('alix-sign-create insert error', insErr)
    return new Response(JSON.stringify({ error: insErr?.message || 'Insert failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await admin.from('alix_sign_audit_log').insert({
    sign_request_id: ins.id,
    action: 'link_created',
    details: { offer_number: offerNumber, by: userData.user.email },
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: req.headers.get('user-agent'),
  })

  const signUrl = `${baseUrl.replace(/\/$/, '')}/sign/${token}`

  // Invite email — call existing send-transactional-email with user JWT
  try {
    const fmtEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
    const total = Number(offerPayload?.totals?.gross || 0)
    const payment = offerPayload?.payment?.type || ''
    const expiresFmt = new Date(expiresAt).toLocaleDateString('de-DE')

    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        templateName: 'alix-sign-invite',
        recipientEmail: customerEmail,
        idempotencyKey: `alix-sign-invite-${ins.id}`,
        templateData: {
          customer_name: customerName,
          offer_number: offerNumber,
          total_amount: total ? fmtEur(total) : undefined,
          payment_type: payment,
          sign_url: signUrl,
          expires_at: expiresFmt,
        },
      }),
    })
    if (!emailRes.ok) {
      const text = await emailRes.text()
      console.error('alix-sign-create email error', text)
      await admin.from('alix_sign_audit_log').insert({
        sign_request_id: ins.id,
        action: 'email_failed',
        details: { error: text.slice(0, 500) },
      })
    } else {
      await admin.from('alix_sign_audit_log').insert({
        sign_request_id: ins.id,
        action: 'email_sent',
        details: { to: customerEmail },
      })
    }
  } catch (e: any) {
    console.error('alix-sign-create email exception', e?.message)
  }

  return new Response(
    JSON.stringify({ id: ins.id, token, sign_url: signUrl, expires_at: expiresAt }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
