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

  const body = await req.json().catch(() => ({}))
  const offerNumber: string = body.offer_number ?? 'ANG-2026-07405'

  const { data: r, error: rErr } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, offer_payload, customer_name, token, created_by, signed_at')
    .eq('offer_number', offerNumber)
    .not('signed_at', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rErr || !r) {
    return new Response(JSON.stringify({ error: 'Signed request not found', detail: rErr?.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: sig } = await admin
    .from('alix_sign_signatures')
    .select('id, signer_name, signer_email, pdf_hash, created_at')
    .eq('sign_request_id', r.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!sig) {
    return new Response(JSON.stringify({ error: 'Signature not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const tpl = TEMPLATES['alix-sign-confirmation']
  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
  const data = {
    customer_name: r.customer_name,
    offer_number: r.offer_number,
    signer_name: sig.signer_name,
    signed_at: new Date(r.signed_at!).toLocaleString('de-DE'),
    total_amount: (r as any).offer_payload?.totals?.gross ? fmt(Number((r as any).offer_payload.totals.gross)) : undefined,
    download_url: `${APP_BASE_URL}/sign/pdf/${sig.id}?token=${encodeURIComponent(r.token)}`,
    pdf_hash: sig.pdf_hash,
  }
  const html = await renderAsync(React.createElement(tpl.component, data))
  const text = await renderAsync(React.createElement(tpl.component, data), { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject

  const recipients: { email: string; subjectPrefix?: string; key: string }[] = [
    { email: sig.signer_email, key: 'primary' },
    { email: 'rde@alix-lasers.com', subjectPrefix: '[Kopie] ', key: 'rde' },
  ]
  if (r.created_by) {
    const { data: creator } = await admin.auth.admin.getUserById(r.created_by)
    const ce = creator?.user?.email
    if (ce) recipients.push({ email: ce, subjectPrefix: '[Kopie] ', key: 'creator' })
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
        idempotency_key: `alix-sign-resend-${sig.id}-${rec.key}-${stamp}`,
        unsubscribe_token: u,
      }, { apiKey })
      results.push({ to: rec.email, status: 'sent' })
    } catch (e: any) {
      results.push({ to: rec.email, status: 'failed', error: e?.message })
    }
  }

  return new Response(JSON.stringify({ success: true, offer_number: r.offer_number, signature_id: sig.id, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
