import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE_NAME = 'Alix Lasers I Datacenter'
const APP_BASE_URL = 'https://www.alixwork.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sendInternalSmsNotification(admin: any, signRequestId: string, offerNumber: string, signerName: string, signedAt: string) {
  try {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const tok = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    let from = Deno.env.get('TWILIO_SMS_FROM_NUMBER') ?? ''
    if (!from) from = (Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER') ?? '').replace(/^whatsapp:/i, '')

    const { data: cfg } = await admin
      .from('sms_settings')
      .select('account_sid, auth_token, from_number')
      .eq('id', true)
      .maybeSingle()

    const finalSid = cfg?.account_sid?.trim() || sid
    const finalTok = cfg?.auth_token?.trim() || tok
    const finalFrom = cfg?.from_number?.trim() || from

    if (!finalSid || !finalTok || !finalFrom) {
      await admin.from('alix_sign_audit_log').insert({
        sign_request_id: signRequestId,
        action: 'sms_notify_skipped',
        details: { reason: 'Twilio credentials missing' },
      })
      return
    }

    const to = '+491711651000'
    const text = `Alix Sign: Angebot ${offerNumber} wurde von ${signerName} unterzeichnet (${new Date(signedAt).toLocaleString('de-DE')}).`
    const url = `https://api.twilio.com/2010-04-01/Accounts/${finalSid}/Messages.json`
    const auth = btoa(`${finalSid}:${finalTok}`)
    const form = new URLSearchParams({ To: to, From: finalFrom, Body: text })
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    await admin.from('alix_sign_audit_log').insert({
      sign_request_id: signRequestId,
      action: res.ok ? 'sms_notify_sent' : 'sms_notify_failed',
      details: {
        to,
        sid: data?.sid ?? null,
        status: data?.status ?? null,
        error: res.ok ? null : (data?.message ?? JSON.stringify(data)),
      },
    })
  } catch (e: any) {
    console.error('alix-sign-submit SMS notify failed', e?.message)
    try {
      await admin.from('alix_sign_audit_log').insert({
        sign_request_id: signRequestId,
        action: 'sms_notify_failed',
        details: { error: e?.message ?? String(e) },
      })
    } catch {}
  }
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
    .select('id, offer_number, offer_payload, customer_id, customer_email, customer_name, status, expires_at, created_by')
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

  // Wichtig: SMS sofort nach erfolgreicher Signatur senden.
  // Der spätere PDF-/E-Mail-Teil kann speicherintensiv sein; die SMS darf davon nicht abhängen.
  await sendInternalSmsNotification(admin, r.id, r.offer_number, signerName, now)

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

  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let emailError: string | undefined
  try {
    const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
    const bccList: string[] = ['rde@alix-lasers.com']
    try {
      if (r.created_by) {
        const { data: creator } = await admin.auth.admin.getUserById(r.created_by)
        const creatorEmail = creator?.user?.email
        if (creatorEmail && creatorEmail.toLowerCase() !== 'rde@alix-lasers.com' && creatorEmail.toLowerCase() !== signerEmail.toLowerCase()) {
          bccList.push(creatorEmail)
        }
      }
    } catch (e: any) {
      console.error('alix-sign-submit lookup creator email failed', e?.message)
    }

    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateName: 'alix-sign-confirmation',
        recipientEmail: signerEmail,
        idempotencyKey: `alix-sign-conf-${sig.id}`,
        bcc: bccList,
        skipDefaultCopies: true,
        templateData: {
          customer_name: r.customer_name,
          offer_number: r.offer_number,
          signer_name: signerName,
          signed_at: new Date(now).toLocaleString('de-DE'),
          total_amount: r.offer_payload?.totals?.gross ? fmt(Number(r.offer_payload.totals.gross)) : undefined,
          download_url: downloadUrl,
          pdf_hash: pdfHash,
        },
      }),
    })
    if (!emailRes.ok) {
      emailStatus = 'failed'
      emailError = (await emailRes.text()).slice(0, 500)
      console.error('alix-sign-submit confirmation email failed', emailError)
    } else {
      emailStatus = 'sent'
      console.log('alix-sign-submit confirmation email queued via send-transactional-email')
    }
  } catch (e: any) {
    emailStatus = 'failed'
    emailError = e?.message ?? String(e)
    console.error('alix-sign-submit confirmation email failed', emailError)
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
