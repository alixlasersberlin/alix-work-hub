// Sends an invoice email via Lovable Email (same pipeline as send-order-confirmation)
// Body: { to_email, to_name?, subject, body_text, body_html?, bcc?: string[], attachments?: [{filename, content(base64), contentType}] }
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'

const SITE_NAME = 'Alix Lasers I Finance'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const FROM_DOMAIN = 'notify.alixlasers.ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({} as any))
  const {
    to_email, to_name, subject, body_text, body_html,
    bcc, attachments, invoice_number,
  } = body ?? {}

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
  for (const rec of recipients) {
    try {
      const tb = new Uint8Array(32); crypto.getRandomValues(tb)
      const u = Array.from(tb).map((b) => b.toString(16).padStart(2, '0')).join('')
      await sendLovableEmail({
        to: rec.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
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
      console.error('send-invoice-mail failed for', rec.email, e)
      results.push({ to: rec.email, status: 'failed', error: e?.message })
    }
  }

  const anyOk = results.some((r) => r.status === 'sent')
  return new Response(JSON.stringify({ success: anyOk, results }), {
    status: anyOk ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
