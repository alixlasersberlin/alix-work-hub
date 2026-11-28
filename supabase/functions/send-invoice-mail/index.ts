import "../_shared/global-bcc.ts";
// Sends an invoice email via Lovable Email (same pipeline as send-order-confirmation)
// Body: { to_email, to_name?, subject, body_text, body_html?, bcc?: string[], attachments?: [{filename, content(base64), contentType}] }
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import { requireProcessAccess } from '../_shared/process-access.ts'
import { InvoiceMailBody, INVOICE_SEND_ROLES, approvedInvoiceCopies } from '../_shared/security-v42-invoice.ts'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { maskEmail } from '../_shared/security-core.ts';

const SITE_NAME = 'Alix Lasers I Finance'
const SENDER_DOMAIN = 'alixwork.de'
const FROM_DOMAIN = 'alixwork.de'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  const access = await requireProcessAccess(req, corsHeaders, INVOICE_SEND_ROLES)
  if ('response' in access) return access.response
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const parsed = InvoiceMailBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const body = parsed.data
  const {
    to_email, to_name, subject, body_text, body_html,
    bcc, attachments, invoice_number,
  } = body ?? {}
  if (!access.machine) {
    if (!approvedInvoiceCopies(bcc)) return new Response(JSON.stringify({ error: 'Nicht freigegebene Kopieadresse' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: tenants, error: tenantError } = await access.client.from('tenants').select('zoho_source_system').in('id', access.tenantIds)
    const sources = (tenants ?? []).map((tenant: { zoho_source_system: string | null }) => tenant.zoho_source_system).filter((source: string | null): source is string => !!source)
    if (tenantError || !sources.length) return new Response('Forbidden', { status: 403, headers: corsHeaders })
    const { data: recipientsAllowed, error: recipientError } = await access.client.from('customers').select('id').eq('email', to_email).in('source_system', sources).limit(1)
    if (recipientError || !recipientsAllowed?.length) return new Response(JSON.stringify({ error: 'Empfänger ist kein zugänglicher Kunde der zugewiesenen Firma' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (!to_email || !subject || (!body_text && !body_html)) {
    return new Response(JSON.stringify({ error: 'to_email, subject und body erforderlich' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const html = body_html || `<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;margin:0">${
    String(body_text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
  }</pre>`

  const recipients: { email: string; subjectPrefix?: string; key: string }[] = [
    { email: to_email, key: 'primary' },
  ]
  if (Array.isArray(bcc)) {
    for (const b of bcc) {
      if (typeof b === 'string' && b.includes('@') && b.toLowerCase() !== to_email.toLowerCase()) {
        recipients.push({ email: b, subjectPrefix: '[Kopie] ', key: `bcc-${recipients.length}` })
      }
    }
  }

  const stamp = Date.now()
  const idBase = invoice_number || 'invoice'
  const results: any[] = []

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  // Das Lovable-Email-SDK unterstützt keine Anhänge -> bei Anhängen über den Resend-Gateway senden.
  if (hasAttachments) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured (für Anhänge erforderlich)' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const bccList: string[] = ['service@alix-lasers.com', 'k.trinh@alix-operation.de']
    if (Array.isArray(bcc)) {
      for (const b of bcc) {
        if (typeof b === 'string' && b.includes('@') &&
            b.toLowerCase() !== String(to_email).toLowerCase() &&
            !bccList.some((x) => x.toLowerCase() === b.toLowerCase())) bccList.push(b)
      }
    }
    const finalBcc = bccList.filter((b) => b.toLowerCase() !== String(to_email).toLowerCase())
    const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Connection-Api-Key': resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Alix Lasers ® <noreply@alixwork.de>',
        to: [to_name ? `${to_name} <${to_email}>` : to_email],
        bcc: finalBcc,
        subject,
        html,
        text: body_text ?? '',
        attachments: attachments.map((a: any) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType || a.content_type || 'application/pdf',
        })),
      }),
    })
    const txt = await res.text()
    if (!res.ok) {
      console.error('Invoice mail provider rejected request', res.status)
      return new Response(JSON.stringify({ success: false, error: `Mailversand fehlgeschlagen (${res.status}); nicht automatisch erneut senden` }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('send-invoice-mail via resend accepted')
    return new Response(JSON.stringify({ success: true, provider: 'resend', results: [{ to: to_email, status: 'sent', attachments: attachments.map((a: any) => a.filename) }] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }


  for (const rec of recipients) {
    try {
      const tb = new Uint8Array(32); crypto.getRandomValues(tb)
      const u = Array.from(tb).map((b) => b.toString(16).padStart(2, '0')).join('')
      await sendLovableEmail({
        to: rec.email,
        from: "Alix Lasers ® <noreply@alixwork.de>",
        bcc: ["service@alix-lasers.com", "k.trinh@alix-operation.de"].filter(
          (b) => b.toLowerCase() !== String(rec.email).toLowerCase(),
        ),
        sender_domain: SENDER_DOMAIN,
        subject: `${rec.subjectPrefix ?? ''}${subject}`,
        html,
        text: body_text ?? '',
        purpose: 'transactional',
        idempotency_key: `invoice-${idBase}-${rec.key}-${stamp}`,
        unsubscribe_token: u,
        attachments: Array.isArray(attachments) ? attachments.map((a: any) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType || a.content_type || 'application/octet-stream',
        })) : undefined,
      } as any, { apiKey })
      results.push({ to: rec.email, status: 'sent' })
    } catch (e: any) {
      console.error('send-invoice-mail failed for', maskEmail(rec.email), (e as Error)?.message ?? 'error')
      results.push({ to: rec.email, status: 'failed', error: e?.message })
    }
  }

  const anyOk = results.some((r) => r.status === 'sent')
  return new Response(JSON.stringify({ success: anyOk, results }), {
    status: anyOk ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})