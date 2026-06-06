import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SendMailRequest {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
  reply_to?: string
  campaign_id?: string
  template_id?: string
  customer_id?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeRecipients(value: string | string[] | undefined): string[] {
  if (!value) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.map((e) => e.trim()).filter((e) => e.length > 0 && isValidEmail(e))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Require authenticated caller (JWT) to prevent open relay
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

  let userId: string | null = null
  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = data.user.id

    // Authorization: only mail-capable roles may send via MailCenter
    const { data: canMail } = await authClient.rpc('can_access_mail')
    if (!canMail) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse + validate body
  let body: SendMailRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const to = normalizeRecipients(body.to)
  const cc = normalizeRecipients(body.cc)
  const bcc = normalizeRecipients(body.bcc)
  const subject = (body.subject ?? '').toString().trim()
  const html = body.html?.toString()
  const text = body.text?.toString()
  const from = (body.from ?? 'Alix MailCenter <noreply@notify.alixlasers.ai>').toString()

  if (to.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one valid "to" recipient is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (subject.length === 0 || subject.length > 998) {
    return new Response(JSON.stringify({ error: 'Subject is required (max 998 chars)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!html && !text) {
    return new Response(JSON.stringify({ error: 'Either html or text body is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check suppression list
  const allRecipients = [...to, ...cc, ...bcc]
  const { data: unsubs } = await admin
    .from('mail_unsubscribes')
    .select('email')
    .in('email', allRecipients.map((e) => e.toLowerCase()))
  const suppressed = new Set((unsubs ?? []).map((u: any) => (u.email as string).toLowerCase()))
  const toFinal = to.filter((e) => !suppressed.has(e.toLowerCase()))
  if (toFinal.length === 0) {
    return new Response(
      JSON.stringify({ error: 'All primary recipients are on the unsubscribe list' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Send via Resend
  let providerId: string | null = null
  let providerError: string | null = null
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: toFinal,
        cc: cc.length > 0 ? cc.filter((e) => !suppressed.has(e.toLowerCase())) : undefined,
        bcc: bcc.length > 0 ? bcc.filter((e) => !suppressed.has(e.toLowerCase())) : undefined,
        reply_to: body.reply_to,
        subject,
        html,
        text,
      }),
    })
    const json = await resp.json()
    if (!resp.ok) {
      providerError = json?.message || `Provider error ${resp.status}`
    } else {
      providerId = json?.id ?? null
    }
  } catch (e: any) {
    providerError = e?.message || 'Unknown provider error'
  }

  // Persist recipient tracking rows
  const status = providerError ? 'failed' : 'sent'
  const sentAt = providerError ? null : new Date().toISOString()
  const recipientRows = toFinal.map((email) => ({
    email,
    campaign_id: body.campaign_id ?? null,
    customer_id: body.customer_id ?? null,
    status,
    sent_at: sentAt,
    provider_message_id: providerId,
    error_message: providerError,
  }))

  const { error: insErr } = await admin.from('mail_recipients').insert(recipientRows)
  if (insErr) {
    console.error('mail_recipients insert failed', insErr.message)
  }

  if (providerError) {
    return new Response(
      JSON.stringify({ ok: false, error: providerError }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      provider_message_id: providerId,
      sent_to: toFinal,
      suppressed: allRecipients.filter((e) => suppressed.has(e.toLowerCase())),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
