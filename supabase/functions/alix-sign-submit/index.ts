import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'Alixwork'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const FROM_DOMAIN = 'notify.alixlasers.ai'
const APP_BASE_URL = 'https://www.alixwork.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token: string | undefined = body?.token
  const signerName: string | undefined = body?.signer_name
  const signerEmail: string | undefined = body?.signer_email
  const signerLocation: string | undefined = body?.signer_location
  const acceptedOffer = !!body?.accepted_offer
  const acceptedTerms = !!body?.accepted_terms
  const acceptedPrivacy = !!body?.accepted_privacy
  const acceptedElectronicSignature = !!body?.accepted_electronic_signature
  const acceptedCreditCheck = body?.accepted_credit_check === undefined ? null : !!body?.accepted_credit_check
  const signatureImageData: string | undefined = body?.signature_image_data  // PNG data URL
  const pdfBase64: string | undefined = body?.pdf_base64

  if (!token || !signerName || !signerEmail || !signatureImageData || !pdfBase64) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!acceptedOffer || !acceptedTerms || !acceptedPrivacy || !acceptedElectronicSignature) {
    return new Response(JSON.stringify({ error: 'Bitte allen Zustimmungen zustimmen' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail) || signerName.length > 200) {
    return new Response(JSON.stringify({ error: 'Ungültige Eingaben' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: r } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, offer_payload, customer_id, customer_email, customer_name, status, expires_at')
    .eq('token', token).maybeSingle()
  if (!r) {
    return new Response(JSON.stringify({ error: 'Token ungültig' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (r.status === 'unterschrieben') {
    return new Response(JSON.stringify({ error: 'Bereits unterzeichnet' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (new Date(r.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'Signatur-Link abgelaufen' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Bonität required for financing/mietkauf
  const payType = r.offer_payload?.payment?.type
  const requiresCredit = payType && ['Ratenzahlung', 'Leasing', 'Mietkauf', 'Alix Flex'].includes(payType)
  if (requiresCredit && acceptedCreditCheck !== true) {
    return new Response(JSON.stringify({ error: 'Zustimmung zur Bonitätsprüfung erforderlich' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const pdfBytes = base64ToBytes(pdfBase64)
  if (pdfBytes.length > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'PDF zu groß' }), {
      status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const pdfHash = await sha256Hex(pdfBytes)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent')
  const now = new Date().toISOString()

  // Store base64 of pdf as bytea via PostgREST hex encoding workaround: use rpc? Simpler — store as text base64 in pdf_data
  // We declared pdf_data as bytea. PostgREST accepts \\x<hex> format. Build hex:
  let hex = '\\x'
  for (const b of pdfBytes) hex += b.toString(16).padStart(2, '0')

  const { data: sig, error: sigErr } = await admin.from('alix_sign_signatures').insert({
    sign_request_id: r.id,
    offer_number: r.offer_number,
    customer_id: r.customer_id,
    signer_name: signerName,
    signer_email: signerEmail,
    signer_location: signerLocation,
    signature_image_data: signatureImageData,
    ip_address: ip,
    user_agent: ua,
    accepted_offer: acceptedOffer,
    accepted_terms: acceptedTerms,
    accepted_privacy: acceptedPrivacy,
    accepted_electronic_signature: acceptedElectronicSignature,
    accepted_credit_check: acceptedCreditCheck,
    pdf_data: hex,
    pdf_hash: pdfHash,
  }).select('id').single()

  if (sigErr) {
    console.error('alix-sign-submit signature insert error', sigErr)
    return new Response(JSON.stringify({ error: sigErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await admin.from('alix_sign_requests').update({
    status: 'unterschrieben',
    signed_at: now,
  }).eq('id', r.id)

  await admin.from('alix_sign_audit_log').insert({
    sign_request_id: r.id,
    action: 'signed',
    details: {
      signature_id: sig.id,
      signer_name: signerName,
      signer_email: signerEmail,
      pdf_hash: pdfHash,
      accepted: {
        offer: acceptedOffer,
        terms: acceptedTerms,
        privacy: acceptedPrivacy,
        electronic_signature: acceptedElectronicSignature,
        credit_check: acceptedCreditCheck,
      },
    },
    ip_address: ip,
    user_agent: ua,
  })

  // Send customer confirmation email (no auth context — send directly)
  // Upload signed PDF to private storage bucket and create a 90-day signed URL
  let downloadUrl: string | undefined
  try {
    // ensure bucket exists (idempotent)
    try {
      await admin.storage.createBucket('alix-sign-pdfs', { public: false })
    } catch { /* already exists */ }
    const objectPath = `${r.id}/${sig.id}.pdf`
    const { error: upErr } = await admin.storage
      .from('alix-sign-pdfs')
      .upload(objectPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw upErr
    downloadUrl = `${APP_BASE_URL}/sign/pdf/${sig.id}?token=${encodeURIComponent(token)}`
  } catch (e: any) {
    console.error('alix-sign-submit storage upload failed', e?.message)
    await admin.from('alix_sign_audit_log').insert({
      sign_request_id: r.id,
      action: 'pdf_upload_failed',
      details: { error: e?.message ?? String(e), signature_id: sig.id },
    })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let emailError: string | undefined
  if (apiKey) {
    try {
      const tpl = TEMPLATES['alix-sign-confirmation']
      const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
      const data = {
        customer_name: r.customer_name,
        offer_number: r.offer_number,
        signer_name: signerName,
        signed_at: new Date(now).toLocaleString('de-DE'),
        total_amount: r.offer_payload?.totals?.gross ? fmt(Number(r.offer_payload.totals.gross)) : undefined,
        download_url: downloadUrl,
        pdf_hash: pdfHash,
      }
      const html = await renderAsync(React.createElement(tpl.component, data))
      const text = await renderAsync(React.createElement(tpl.component, data), { plainText: true })
      const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
      const tokenBytes = new Uint8Array(32); crypto.getRandomValues(tokenBytes)
      const unsub = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
      await sendLovableEmail({
        to: signerEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html, text,
        purpose: 'transactional',
        idempotency_key: `alix-sign-conf-${sig.id}`,
        unsubscribe_token: unsub,
      }, { apiKey })
      emailStatus = 'sent'
      console.log('alix-sign-submit confirmation email sent to', signerEmail)
    } catch (e: any) {
      emailStatus = 'failed'
      emailError = e?.message ?? String(e)
      console.error('alix-sign-submit confirmation email failed', emailError)
    }
  } else {
    emailError = 'LOVABLE_API_KEY missing'
    console.error(emailError)
  }
  await admin.from('alix_sign_audit_log').insert({
    sign_request_id: r.id,
    action: `confirmation_email_${emailStatus}`,
    details: {
      signature_id: sig.id,
      recipient: signerEmail,
      error: emailError,
      download_url_present: !!downloadUrl,
    },
  })

  // Internal notification via mail_internal_messages
  try {
    await admin.from('mail_internal_messages').insert({
      subject: `Alix Sign: Angebot ${r.offer_number} unterschrieben`,
      body: `Das Angebot ${r.offer_number} wurde elektronisch von ${signerName} (${signerEmail}) unterzeichnet.`,
      from_mailbox: 'system',
      to_mailbox: 'vertrieb',
      priority: 'normal',
      status: 'unread',
    } as any)
  } catch { /* table column mismatch tolerated */ }

  return new Response(JSON.stringify({
    success: true,
    signature_id: sig.id,
    pdf_hash: pdfHash,
    signed_at: now,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
