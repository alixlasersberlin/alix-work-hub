import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

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
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    idempotencyKey = body.idempotencyKey || body.idempotency_key || crypto.randomUUID()
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
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
      { email: 'Natalia.p@alix-operation.de', subjectPrefix: '[Kopie] ', keySuffix: 'copy-natalia' },
      { email: 'rde@alix-lasers.com', subjectPrefix: '[Kopie] ', keySuffix: 'copy-rde' },
    ]

    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendLovableEmail(
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
        ),
      ),
    )

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
