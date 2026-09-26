import "../_shared/global-bcc.ts";
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'



const SITE_NAME = "Alix Lasers Datacenter"

/**
 * Automatische Absender-Umschaltung: Schlägt der Versand wegen eines
 * Absender-/Domain-Problems (gesperrt, nicht verifiziert, Rate-Limit) fehl,
 * wird automatisch die nächste verfügbare Absenderadresse verwendet.
 */
const SENDER_CHAIN: Array<{ domain: string; from: string }> = [
  { domain: "alixwork.de", from: "Alix Lasers ® <noreply@alixwork.de>" },
]
// Für Anhänge läuft der Versand über Resend – dort ist nur alixwork.de verifiziert
const ATTACHMENT_SENDER_CHAIN: string[] = [
  "Alix Lasers ® <noreply@alixwork.de>",
]
const SENDER_DOMAIN = SENDER_CHAIN[0].domain
const FROM_ADDRESS = SENDER_CHAIN[0].from
const FROM_ADDRESS_ATTACHMENTS = ATTACHMENT_SENDER_CHAIN[0]

/** Fehler, bei denen ein Absenderwechsel sinnvoll ist. */
export function isSenderProblem(msg?: string): boolean {
  if (!msg) return false
  return /domain[_ -]?(suspended|not[_ -]?verified|blocked)|not verified|unverified|forbidden|403|422|sender|from address|rate.?limit|429|quota|throttl/i.test(msg)
}


/** Einfache Plausibilitätsprüfung für Empfängeradressen (verhindert Rückläufer). */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const email = value.trim()
  if (email.length < 6 || email.length > 254) return false
  if (/[\s,;<>()\[\]\\"]/.test(email)) return false
  if (!/^[^@]+@[^@]+$/.test(email)) return false
  const [local, domain] = email.split('@')
  if (!local || local.length > 64) return false
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(domain)) return false
  const tld = domain.split('.').pop() || ''
  if (!/^[a-zA-Z]{2,24}$/.test(tld)) return false
  if (/^(example|test|localhost|invalid|beispiel)\./i.test(domain) || /^(example|test|localhost|invalid)$/i.test(domain.split('.')[0])) return false
  return true
}
const FROM_DOMAIN = "alixwork.de"

// Globaler Archiv-BCC: erhält automatisch eine Kopie JEDER ausgehenden Mail
const GLOBAL_ARCHIVE_BCC = ['rde@alix-lasers.com']

// Echte Antwortadresse – "noreply" ohne Reply-To gilt bei Spamfiltern als Negativsignal
const REPLY_TO = 'buchhaltung@alix-operation.de'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Require authenticated caller (JWT) to prevent open email relay
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  try {
    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Server-to-server bypass: edge functions invoking this one pass the service role key
    if (token && token === serviceRoleKey) {
      // trusted internal caller, skip user/role checks
    } else {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } },
      )
      const { data, error } = await authClient.auth.getUser(token)
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: isAdmin } = await authClient.rpc('is_admin')
      let allowed = !!isAdmin
      if (!allowed) {
        const { data: canManage } = await authClient.rpc('can_manage_orders')
        allowed = !!canManage
      }
      if (!allowed) {
        const { data: canFinance } = await authClient.rpc('can_access_finance')
        allowed = !!canFinance
      }
      if (!allowed) {
        const { data: canQm } = await authClient.rpc('can_access_qm')
        allowed = !!canQm
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    console.error('Missing LOVABLE_API_KEY')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let templateData: Record<string, any> = {}
  let extraCc: string[] = []
  let bccEmails: string[] = []
  let skipDefaultCopies = false
  let attachments: Array<{ filename: string; content: string; contentType?: string; content_type?: string }> = []
  let trackingPixelUrl = ''

  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    idempotencyKey = body.idempotencyKey || body.idempotency_key || crypto.randomUUID()
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
    if (Array.isArray(body.extraCc)) {
      extraCc = body.extraCc.filter((e: any) => typeof e === 'string' && e.includes('@'))
    }
    if (Array.isArray(body.bcc)) {
      bccEmails = body.bcc.filter((e: any) => typeof e === 'string' && e.includes('@'))
    }
    if (body.skipDefaultCopies === true) skipDefaultCopies = true
    if (typeof body.trackingPixelUrl === 'string' && body.trackingPixelUrl.startsWith('https://')) {
      trackingPixelUrl = body.trackingPixelUrl
    }
    if (Array.isArray(body.attachments)) {
      attachments = body.attachments.filter((a: any) => a && typeof a.filename === 'string' && typeof a.content === 'string')
    }

  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isDunning = /mahn|dunning|reminder|collect/i.test(templateName ?? '')

  // Globalen Archiv-BCC mit aufnehmen (bei Mahnungen NICHT)
  if (!isDunning) {
    for (const archive of GLOBAL_ARCHIVE_BCC) {
      const norm = archive.trim().toLowerCase()
      if (!bccEmails.some(e => e.trim().toLowerCase() === norm)) bccEmails.push(archive)
    }
  }

  // Systemweit: alle Mahnungen ausschliesslich in BCC an k.trinh
  if (isDunning) {
    const dunningBcc = 'k.trinh@alix-operation.de'
    bccEmails = bccEmails.filter(e => !/service@alix-lasers\.com|buchhaltung@alix-lasers\.com|rde@alix-lasers\.com/i.test(e))
    extraCc = extraCc.filter(e => !/service@alix-lasers\.com|buchhaltung@alix-lasers\.com/i.test(e))
    if (!bccEmails.some(e => e.trim().toLowerCase() === dunningBcc)) bccEmails.push(dunningBcc)
    // Zusätzlich immer in Kopie (CC)
    const dunningCc = 'k.trinh@alix-operation.de'
    if (!extraCc.some(e => e.trim().toLowerCase() === dunningCc)) extraCc.push(dunningCc)
  }



  if (!templateName) {
    return new Response(JSON.stringify({ error: 'templateName is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const effectiveRecipient = (template as any).to || recipientEmail
  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({ error: 'recipientEmail is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  if (!isValidEmail(effectiveRecipient)) {
    console.warn('invalid recipient rejected', { templateName })
    return new Response(
      JSON.stringify({ error: 'invalid_recipient', message: `Ungültige Empfängeradresse: ${effectiveRecipient}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Render template
  let html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Optionales Lesesignal (1x1-Pixel) – nur wenn der Aufrufer eine URL mitgibt.
  // Wichtig: Das Pixel kommt ausschliesslich in die Mail an den eigentlichen
  // Empfänger, nicht in interne Kopien (CC/BCC) – sonst würde eine intern
  // geöffnete Kopie fälschlich als "vom Kunden gelesen" gelten.
  const pixelTag = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none" />`
    : ''


  // Einheitlicher deutscher Hinweis-Footer (ersetzt den englischen Standardtext)
  const FOOTER_TEXT =
    'Sie erhalten diese Nachricht über Ihren Account der Alix Lasers ®. Bitte lesen Sie den Inhalt aufmerksam, damit es zu keiner weiteren Maßnahme kommt.'
  const confirmLink = ''
  const UNSUBSCRIBE_URL = 'https://www.alix-lasers.de'
  // Vollständige Absenderangabe im Footer (Pflichtangaben + Vertrauenssignal für Spamfilter)
  const IMPRINT_TEXT =
    'Alix Lasers GmbH · Zeppelinstrasse 3 · 12529 Schönefeld-Waltersdorf · Deutschland · ' +
    `Antworten an: ${REPLY_TO}`
  const footerHtml =
    `${confirmLink}<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;color:#8a8a8a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px">${FOOTER_TEXT}` +
    ` <a href="${UNSUBSCRIBE_URL}" style="color:#8a8a8a;text-decoration:underline">${UNSUBSCRIBE_URL.replace('https://', '')}</a>` +
    `<br />${IMPRINT_TEXT}</div>`
  html = html.includes('</body>') ? html.replace('</body>', `${footerHtml}</body>`) : html + footerHtml
  const htmlPrimary = pixelTag
    ? (html.includes('</body>') ? html.replace('</body>', `${pixelTag}</body>`) : html + pixelTag)
    : html
  const htmlFor = (r: { keySuffix: string }) => (r.keySuffix === 'primary' ? htmlPrimary : html)
  const plainTextWithFooter = `${plainText}\n\n${FOOTER_TEXT} ${UNSUBSCRIBE_URL}\n${IMPRINT_TEXT}`


  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Send directly via Lovable email API
  try {
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const unsubscribeToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const baseSubject = resolvedSubject
    const recipients: Array<{ email: string; subjectPrefix?: string; keySuffix: string }> = [
      { email: effectiveRecipient, keySuffix: 'primary' },
    ]
    const seen = new Set<string>([effectiveRecipient.toLowerCase()])
    extraCc.forEach((email, idx) => {
      const k = email.toLowerCase()
      if (seen.has(k)) return
      seen.add(k)
      recipients.push({ email, subjectPrefix: '[Kopie] ', keySuffix: `copy-extra-${idx}` })
    })
    bccEmails.forEach((email, idx) => {
      const k = email.toLowerCase()
      if (seen.has(k)) return
      seen.add(k)
      recipients.push({ email, keySuffix: `bcc-${idx}` })
    })

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const isRateLimited = (msg?: string) => !!msg && /429|rate.?limit|high demand/i.test(msg)

    // Aktueller Absender-Index – wird bei Absenderproblemen automatisch erhöht
    // und gilt dann für alle weiteren Empfänger dieses Aufrufs.
    let senderIdx = 0
    let attachmentSenderIdx = 0
    let resendDisabled = false
    const usedSenders: string[] = []

    // Versand über den Resend-Gateway: hier bestimmen wir den kompletten
    // Inhalt selbst – ohne fremden Abmelde-Hinweis/Abmeldelink.
    const sendWithAttachments = async (r: typeof recipients[number]) => {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (!resendKey) throw new Error('RESEND_API_KEY not configured (für Anhänge erforderlich)')
      const from = ATTACHMENT_SENDER_CHAIN[attachmentSenderIdx] ?? ATTACHMENT_SENDER_CHAIN[0]
      usedSenders.push(from)
      const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Connection-Api-Key': resendKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [r.email],
          subject: `${r.subjectPrefix ?? ''}${baseSubject}`,
          html: htmlFor(r),

          text: plainTextWithFooter,
          reply_to: REPLY_TO,
          ...(isDunning ? {} : { bcc: ['service@alix-lasers.com'] }),
          headers: {
            'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>, <${UNSUBSCRIBE_URL}>`,
          },
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((a: any) => ({
                  filename: a.filename,
                  content: a.content,
                  content_type: a.contentType || a.content_type || 'application/pdf',
                })),
              }
            : {}),
        }),
      })
      const txt = await res.text()
      if (!res.ok) throw new Error(`Resend ${res.status}: ${txt.slice(0, 300)}`)
      try { return JSON.parse(txt) } catch { return { id: null } }
    }

    const sendOne = async (r: typeof recipients[number], maxAttempts: number) => {
      let attempt = 0
      let switched = 0
      const maxSwitches = Math.max(SENDER_CHAIN.length, ATTACHMENT_SENDER_CHAIN.length) - 1
      while (true) {
        try {
          if (attachments.length > 0) return await sendWithAttachments(r)
          // Bevorzugt Resend: dort erscheint kein fremder Abmeldelink.
          if (Deno.env.get('RESEND_API_KEY') && !resendDisabled) {
            try {
              return await sendWithAttachments(r)
            } catch (resendErr: any) {
              console.warn('Resend-Versand fehlgeschlagen, Fallback auf Lovable', {
                grund: resendErr?.message?.slice(0, 200),
              })
              if (isSenderProblem(resendErr?.message) && attachmentSenderIdx + 1 < ATTACHMENT_SENDER_CHAIN.length) {
                attachmentSenderIdx++
                continue
              }
              resendDisabled = true
            }
          }
          const sender = SENDER_CHAIN[senderIdx] ?? SENDER_CHAIN[0]
          usedSenders.push(sender.from)
          return await sendLovableEmail(

            {
              to: r.email,
              from: sender.from,
              bcc: isDunning ? [] : ["service@alix-lasers.com"],
              sender_domain: sender.domain,
              subject: `${r.subjectPrefix ?? ''}${baseSubject}`,
              html: htmlFor(r),
              text: plainTextWithFooter,
              purpose: 'transactional',
              idempotency_key: `${idempotencyKey}-${r.keySuffix}-s${senderIdx}`,
              unsubscribe_token: unsubscribeToken,
            },
            { apiKey },
          )
        } catch (err: any) {
          const msg = err?.message as string | undefined
          if (isRateLimited(msg) && attempt < maxAttempts) {
            attempt++
            // Backoff: 2s, 4s, 8s, 15s ... (cap 15s) + jitter
            const backoff = Math.min(15000, 2000 * Math.pow(2, attempt - 1))
            const jitter = Math.floor(Math.random() * 1000)
            await sleep(backoff + jitter)
            continue
          }
          // Automatischer Absenderwechsel bei Domain-/Absenderproblemen
          if (isSenderProblem(msg) && switched < maxSwitches) {
            switched++
            const hasNext = attachments.length > 0
              ? attachmentSenderIdx + 1 < ATTACHMENT_SENDER_CHAIN.length
              : senderIdx + 1 < SENDER_CHAIN.length
            if (hasNext) {
              if (attachments.length > 0) attachmentSenderIdx++
              else senderIdx++
              console.warn('Absender wird automatisch gewechselt', {
                grund: msg?.slice(0, 200),
                neuerAbsender: attachments.length > 0
                  ? ATTACHMENT_SENDER_CHAIN[attachmentSenderIdx]
                  : SENDER_CHAIN[senderIdx].from,
              })
              attempt = 0
              await sleep(500)
              continue
            }
          }
          throw err
        }
      }
    }


    // Send every recipient synchronously so required copies/BCC are actually
    // accepted by the email provider before the function returns.
    const results: PromiseSettledResult<any>[] = []
    for (let i = 0; i < recipients.length; i++) {
      try {
        const value = await sendOne(recipients[i], i === 0 ? 6 : 3)
        results.push({ status: 'fulfilled', value } as PromiseFulfilledResult<any>)
      } catch (reason: any) {
        results.push({ status: 'rejected', reason } as PromiseRejectedResult)
      }
      if (i < recipients.length - 1) await sleep(1200)
    }

    const failures = results
      .map((res, i) => ({ res, recipient: recipients[i].email }))
      .filter((x) => x.res.status === 'rejected')

    if (failures.length > 0) {
      console.error('Some email sends failed', failures.map((f) => ({
        recipient: f.recipient,
        error: (f.res as PromiseRejectedResult).reason?.message,
      })))
    }

    // Persist a row per recipient in email_send_log so BCC/copy delivery is auditable.
    try {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      const rows = recipients.map((r, i) => {
        const res = results[i]
        const ok = res.status === 'fulfilled'
        const role = i === 0 ? 'primary' : (r.subjectPrefix ? 'copy' : 'bcc')
        const value: any = ok ? (res as PromiseFulfilledResult<any>).value : null
        const providerMsgId = value?.id ?? value?.message_id ?? value?.messageId ?? null
        return {
          source_id: idempotencyKey,
          recipient_email: r.email,
          subject: `${r.subjectPrefix ?? ''}${baseSubject}`,
          template: templateName,
          status: ok ? 'sent' : 'failed',
          provider_message_id: providerMsgId,
          sent_at: ok ? new Date().toISOString() : null,
          metadata: {
            role,
            idempotency_key: `${idempotencyKey}-${r.keySuffix}`,
            sender_used: attachments.length > 0
              ? (ATTACHMENT_SENDER_CHAIN[attachmentSenderIdx] ?? ATTACHMENT_SENDER_CHAIN[0])
              : (SENDER_CHAIN[senderIdx] ?? SENDER_CHAIN[0]).from,

            ...(ok ? {} : { error: (res as PromiseRejectedResult).reason?.message ?? 'unknown' }),
          },
        }
      })
      const { error: logErr } = await serviceClient.from('email_send_log').insert(rows)
      if (logErr) console.error('email_send_log insert failed', logErr.message)
    } catch (e: any) {
      console.error('email_send_log unexpected error', e?.message ?? e)
    }

    const primaryOk = results[0].status === 'fulfilled'
    console.log('Transactional email sent', {
      templateName,
      effectiveRecipient,
      primaryOk,
      copiesSent: results.slice(1).filter((r) => r.status === 'fulfilled').length,
      copyRecipients: recipients.slice(1).map((r) => r.email),
    })

    if (!primaryOk) {
      const err = (results[0] as PromiseRejectedResult).reason
      const limited = isRateLimited(err?.message)
      return new Response(
        JSON.stringify({
          error: limited
            ? 'E-Mail-Anbieter ist gerade überlastet (Rate-Limit). Bitte in einer Minute erneut senden.'
            : (err?.message || 'Failed to send email'),
          rate_limited: limited,
        }),
        { status: limited ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Failed to send email', { error: error?.message || error, templateName, effectiveRecipient })
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
