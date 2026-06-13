import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const FROM_DOMAIN = 'notify.alixlasers.ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const body = await req.json().catch(() => ({}))
  const signatureId: string | undefined = body?.signature_id
  const overrideEmail: string | undefined = body?.email
  if (!signatureId) {
    return new Response(JSON.stringify({ error: 'signature_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: sig, error: sigErr } = await admin
    .from('alix_sign_signatures')
    .select('id, sign_request_id, signer_name, signer_email, pdf_data, pdf_hash, created_at')
    .eq('id', signatureId).maybeSingle()
  if (sigErr || !sig) {
    return new Response(JSON.stringify({ error: 'signature not found', detail: sigErr?.message }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: r } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, customer_name, customer_email, offer_payload')
    .eq('id', sig.sign_request_id).maybeSingle()
  if (!r) {
    return new Response(JSON.stringify({ error: 'request not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Convert pdf_data (bytea -> hex string via PostgREST) into bytes
  let pdfBytes: Uint8Array | null = null
  try {
    const raw = sig.pdf_data as any
    if (typeof raw === 'string' && raw.startsWith('\\x')) {
      const hex = raw.slice(2)
      pdfBytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < pdfBytes.length; i++) pdfBytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    } else if (raw && typeof raw === 'object' && raw.type === 'Buffer') {
      pdfBytes = new Uint8Array(raw.data)
    }
  } catch (e) { console.error('decode pdf failed', e) }

  let downloadUrl: string | undefined
  if (pdfBytes && pdfBytes.length) {
    try {
      try { await admin.storage.createBucket('alix-sign-pdfs', { public: false }) } catch {}
      const objectPath = `${r.id}/${sig.id}.pdf`
      const { error: upErr } = await admin.storage
        .from('alix-sign-pdfs')
        .upload(objectPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const { data: signed } = await admin.storage
        .from('alix-sign-pdfs')
        .createSignedUrl(objectPath, 60 * 60 * 24 * 90)
      downloadUrl = signed?.signedUrl
    } catch (e: any) {
      console.error('upload failed', e?.message)
    }
  } else {
    console.warn('no pdf bytes recovered for', sig.id)
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const tpl = TEMPLATES['alix-sign-confirmation']
  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
  const data = {
    customer_name: r.customer_name,
    offer_number: r.offer_number,
    signer_name: sig.signer_name,
    signed_at: new Date(sig.created_at).toLocaleString('de-DE'),
    total_amount: r.offer_payload?.totals?.gross ? fmt(Number(r.offer_payload.totals.gross)) : undefined,
    download_url: downloadUrl,
    pdf_hash: sig.pdf_hash,
  }
  const html = await renderAsync(React.createElement(tpl.component, data))
  const text = await renderAsync(React.createElement(tpl.component, data), { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
  const tokenBytes = new Uint8Array(32); crypto.getRandomValues(tokenBytes)
  const unsub = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const recipient = overrideEmail || sig.signer_email
  try {
    await sendLovableEmail({
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html, text,
      purpose: 'transactional',
      idempotency_key: `alix-sign-conf-resend-${sig.id}-${Date.now()}`,
      unsubscribe_token: unsub,
    }, { apiKey })
    await admin.from('alix_sign_audit_log').insert({
      sign_request_id: r.id,
      action: 'confirmation_email_resent',
      details: { signature_id: sig.id, recipient, download_url_present: !!downloadUrl },
    })
    return new Response(JSON.stringify({ success: true, recipient, download_url: downloadUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    await admin.from('alix_sign_audit_log').insert({
      sign_request_id: r.id,
      action: 'confirmation_email_resend_failed',
      details: { signature_id: sig.id, recipient, error: e?.message ?? String(e) },
    })
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
