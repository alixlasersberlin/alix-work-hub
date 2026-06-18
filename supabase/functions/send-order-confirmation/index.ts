// Sends an "Auftragsbestätigung" email with a link to the stamped signed PDF.
// Body: { signature_id, order_id, recipient_email?, cc_creator?: boolean }
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'Alix Lasers I Datacenter'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const FROM_DOMAIN = 'notify.alixlasers.ai'
const APP_BASE_URL = 'https://www.alixwork.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const apiKey = Deno.env.get('LOVABLE_API_KEY')!
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Auth check
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
  if (!signatureId) {
    return new Response(JSON.stringify({ error: 'signature_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: sig } = await admin
    .from('alix_sign_signatures')
    .select('id, sign_request_id, signer_email, signer_name, offer_number, created_at')
    .eq('id', signatureId)
    .maybeSingle()
  if (!sig) return new Response(JSON.stringify({ error: 'Signature not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { data: r } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, offer_payload, customer_name, customer_email, token, created_by, signed_at')
    .eq('id', sig.sign_request_id)
    .maybeSingle()
  if (!r) return new Response(JSON.stringify({ error: 'Sign request not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  let orderNumber: string | undefined
  if (orderId) {
    const { data: ord } = await admin.from('orders').select('order_number, internal_number').eq('id', orderId).maybeSingle()
    orderNumber = ord?.internal_number || ord?.order_number || undefined
  }

  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
  const tpl = TEMPLATES['order-confirmation']
  const download_url = `${SUPABASE_URL}/functions/v1/order-confirmation-pdf?signature_id=${sig.id}&token=${encodeURIComponent(r.token)}`
  const data = {
    customer_name: r.customer_name,
    order_number: orderNumber,
    offer_number: r.offer_number,
    signed_at: r.signed_at ? new Date(r.signed_at).toLocaleString('de-DE') : new Date(sig.created_at).toLocaleString('de-DE'),
    total_amount: (r as any).offer_payload?.totals?.gross ? fmt(Number((r as any).offer_payload.totals.gross)) : undefined,
    download_url,
  }
  const html = await renderAsync(React.createElement(tpl.component, data))
  const text = await renderAsync(React.createElement(tpl.component, data), { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject

  const primary = recipientEmailOverride || r.customer_email || sig.signer_email
  if (!primary) {
    return new Response(JSON.stringify({ error: 'No recipient email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const recipients: { email: string; subjectPrefix?: string; key: string }[] = [
    { email: primary, key: 'primary' },
    { email: 'rde@alix-lasers.com', subjectPrefix: '[Kopie] ', key: 'rde' },
  ]
  if (r.created_by) {
    const { data: creator } = await admin.auth.admin.getUserById(r.created_by)
    const ce = creator?.user?.email
    if (ce && ce.toLowerCase() !== primary.toLowerCase() && ce.toLowerCase() !== 'rde@alix-lasers.com') {
      recipients.push({ email: ce, subjectPrefix: '[Kopie] ', key: 'creator' })
    }
  }

  const results: any[] = []
  const stamp = Date.now()
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
        idempotency_key: `order-conf-${sig.id}-${rec.key}-${stamp}`,
        unsubscribe_token: u,
      }, { apiKey })
      results.push({ to: rec.email, status: 'sent' })
    } catch (e: any) {
      results.push({ to: rec.email, status: 'failed', error: e?.message })
    }
  }

  return new Response(JSON.stringify({ success: true, signature_id: sig.id, download_url, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
