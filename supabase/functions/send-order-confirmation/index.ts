// Sends an "Auftragsbestätigung" email with a link to the stamped signed PDF
// OR a fallback PDF generated from order data when no Alix Sign signature exists.
// Body: { signature_id?, order_id, recipient_email?, cc_creator?: boolean }
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'Alix Lasers I Datacenter'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const FROM_DOMAIN = 'notify.alixlasers.ai'
const PUBLIC_BASE = 'https://alixwork.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function signOrderToken(orderId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`order-fallback:${orderId}`))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const apiKey = Deno.env.get('LOVABLE_API_KEY')!
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: ud } = await userClient.auth.getUser(auth.replace('Bearer ', ''))
  if (!ud?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const body = await req.json().catch(() => ({}))
  const signatureId: string | undefined = body.signature_id
  const orderId: string | undefined = body.order_id
  const recipientEmailOverride: string | undefined = body.recipient_email
  if (!signatureId && !orderId) {
    return new Response(JSON.stringify({ error: 'signature_id or order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let download_url: string
  let customer_name: string | undefined
  let customer_email_fallback: string | undefined
  let orderNumber: string | undefined
  let offerNumber: string | undefined
  let signedAt: string | undefined
  let totalAmountStr: string | undefined
  let createdBy: string | undefined
  const fmt = (n: number, c = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format(n)

  if (signatureId) {
    const { data: sig } = await admin
      .from('alix_sign_signatures')
      .select('id, sign_request_id, signer_email, signer_name, offer_number, created_at')
      .eq('id', signatureId).maybeSingle()
    if (!sig) return new Response(JSON.stringify({ error: 'Signature not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: r } = await admin
      .from('alix_sign_requests')
      .select('id, offer_number, offer_payload, customer_name, customer_email, token, created_by, signed_at')
      .eq('id', sig.sign_request_id).maybeSingle()
    if (!r) return new Response(JSON.stringify({ error: 'Sign request not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    download_url = `${PUBLIC_BASE}/pdf/ab?signature_id=${sig.id}&token=${encodeURIComponent(r.token)}`
    customer_name = r.customer_name || undefined
    customer_email_fallback = r.customer_email || sig.signer_email || undefined
    offerNumber = r.offer_number || sig.offer_number || undefined
    signedAt = r.signed_at ? new Date(r.signed_at).toLocaleString('de-DE') : new Date(sig.created_at).toLocaleString('de-DE')
    const gross = (r as any).offer_payload?.totals?.gross
    if (gross) totalAmountStr = fmt(Number(gross))
    createdBy = r.created_by || undefined

    if (orderId) {
      const { data: ord } = await admin.from('orders').select('order_number, internal_number').eq('id', orderId).maybeSingle()
      orderNumber = ord?.internal_number || ord?.order_number || undefined
    }
  } else {
    // Fallback: PDF from order data
    const { data: ord } = await admin.from('orders')
      .select('id, customer_id, order_number, internal_number, total_amount, currency, billing_address')
      .eq('id', orderId!).maybeSingle()
    if (!ord) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: cust } = ord.customer_id
      ? await admin.from('customers').select('company_name, contact_name, email').eq('id', ord.customer_id).maybeSingle()
      : { data: null as any }
    const token = await signOrderToken(ord.id, SUPABASE_SERVICE_ROLE_KEY)
    download_url = `${SUPABASE_URL}/functions/v1/order-fallback-pdf?order_id=${ord.id}&token=${token}`
    orderNumber = ord.internal_number || ord.order_number || undefined
    customer_name = cust?.company_name || cust?.contact_name || (ord.billing_address as any)?.name || undefined
    customer_email_fallback = cust?.email || undefined
    if (ord.total_amount != null) totalAmountStr = fmt(Number(ord.total_amount), ord.currency || 'EUR')
    signedAt = new Date().toLocaleString('de-DE')
  }

  const tpl = TEMPLATES['order-confirmation']
  const data = {
    customer_name,
    order_number: orderNumber,
    offer_number: offerNumber,
    signed_at: signedAt,
    total_amount: totalAmountStr,
    download_url,
  }
  const html = await renderAsync(React.createElement(tpl.component, data))
  const text = await renderAsync(React.createElement(tpl.component, data), { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject

  const primary = recipientEmailOverride || customer_email_fallback
  if (!primary) {
    return new Response(JSON.stringify({ error: 'No recipient email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const recipients: { email: string; subjectPrefix?: string; key: string }[] = [
    { email: primary, key: 'primary' },
    { email: 'rde@alix-lasers.com', subjectPrefix: '[Kopie] ', key: 'rde' },
  ]
  if (createdBy) {
    const { data: creator } = await admin.auth.admin.getUserById(createdBy)
    const ce = creator?.user?.email
    if (ce && ce.toLowerCase() !== primary.toLowerCase() && ce.toLowerCase() !== 'rde@alix-lasers.com') {
      recipients.push({ email: ce, subjectPrefix: '[Kopie] ', key: 'creator' })
    }
  }

  const results: any[] = []
  const stamp = Date.now()
  const idBase = signatureId || `order-${orderId}`
  for (const rec of recipients) {
    try {
      const tb = new Uint8Array(32); crypto.getRandomValues(tb)
      const u = Array.from(tb).map(b => b.toString(16).padStart(2, '0')).join('')
      await sendLovableEmail({
        to: rec.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `${rec.subjectPrefix ?? ''}${subject}`,
        html, text,
        purpose: 'transactional',
        idempotency_key: `order-conf-${idBase}-${rec.key}-${stamp}`,
        unsubscribe_token: u,
      }, { apiKey })
      results.push({ to: rec.email, status: 'sent' })
    } catch (e: any) {
      results.push({ to: rec.email, status: 'failed', error: e?.message })
    }
  }

  return new Response(JSON.stringify({ success: true, signature_id: signatureId, order_id: orderId, download_url, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
