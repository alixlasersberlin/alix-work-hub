import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'



const SITE_NAME = "Alix Lasers Datacenter"
const SENDER_DOMAIN = "notify.alixlasers.ai"
const FROM_DOMAIN = "notify.alixlasers.ai"

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
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Authorization: only allow privileged roles to send emails (prevent abuse by e.g. suppliers)
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
  let skipDefaultCopies = false
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
    if (body.skipDefaultCopies === true) skipDefaultCopies = true
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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

  // Render template
  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

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
    if (!skipDefaultCopies) {
      recipients.push(
        { email: 'Natalia.p@alix-operation.de', subjectPrefix: '[Kopie] ', keySuffix: 'copy-natalia' },
        { email: 'rde@alix-lasers.com', subjectPrefix: '[Kopie] ', keySuffix: 'copy-rde' },
      )
    }
    const seen = new Set<string>([effectiveRecipient.toLowerCase()])
    extraCc.forEach((email, idx) => {
      const k = email.toLowerCase()
      if (seen.has(k)) return
      seen.add(k)
      recipients.push({ email, subjectPrefix: '[Kopie] ', keySuffix: `copy-extra-${idx}` })
    })

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const isRateLimited = (msg?: string) => !!msg && /429|rate.?limit|high demand/i.test(msg)

    const sendOne = async (r: typeof recipients[number]) => {
      let attempt = 0
      while (true) {
        try {
          return await sendLovableEmail(
            {
              to: r.email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: `${r.subjectPrefix ?? ''}${baseSubject}`,
              html,
              text: plainText,
              purpose: 'transactional',
              idempotency_key: `${idempotencyKey}-${r.keySuffix}`,
              unsubscribe_token: unsubscribeToken,
            },
            { apiKey },
          )
        } catch (err: any) {
          if (isRateLimited(err?.message) && attempt < 4) {
            attempt++
            await sleep(1000 * attempt)
            continue
          }
          throw err
        }
      }
    }

    const results: PromiseSettledResult<any>[] = []
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i]
      try {
        const value = await sendOne(r)
        results.push({ status: 'fulfilled', value } as PromiseFulfilledResult<any>)
      } catch (reason: any) {
        results.push({ status: 'rejected', reason } as PromiseRejectedResult)
      }
      if (i < recipients.length - 1) await sleep(400)
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

    const primaryOk = results[0].status === 'fulfilled'
    console.log('Transactional email sent', {
      templateName,
      effectiveRecipient,
      primaryOk,
      copiesSent: results.slice(1).filter((r) => r.status === 'fulfilled').length,
    })

    if (!primaryOk) {
      const err = (results[0] as PromiseRejectedResult).reason
      return new Response(
        JSON.stringify({ error: err?.message || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
