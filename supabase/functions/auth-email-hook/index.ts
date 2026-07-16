// Supabase Send-Email Auth Hook
// Verifies Supabase standard-webhooks signature, renders the branded template
// and sends via Resend (connector gateway).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, webhook-id, webhook-timestamp, webhook-signature',
}

const SITE_NAME = 'AlixWork'
const ROOT_DOMAIN = 'alixwork.de'
const FROM_ADDRESS = `AlixWork <noreply@notify.alixlasers.ai>`

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'AlixWork · E-Mail bestätigen',
  invite: 'AlixWork · Sie wurden eingeladen',
  magiclink: 'AlixWork · Ihr Anmeldecode',
  recovery: 'AlixWork · Passwort zurücksetzen',
  email_change: 'AlixWork · Neue E-Mail bestätigen',
  reauthentication: 'AlixWork · Bestätigungscode',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

async function sendViaResend(payload: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    throw new Error('Missing LOVABLE_API_KEY or RESEND_API_KEY')
  }
  const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
    if (!rawSecret) {
      console.error('SEND_EMAIL_HOOK_SECRET not configured')
      return new Response(JSON.stringify({ error: 'server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Supabase stores secret as "v1,whsec_<base64>"; standardwebhooks expects the base64 part.
    const secret = rawSecret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '')

    const body = await req.text()
    const headers = Object.fromEntries(req.headers.entries())

    let verified: any
    try {
      const wh = new Webhook(secret)
      verified = wh.verify(body, headers)
    } catch (e) {
      console.error('Webhook verification failed', { error: String(e) })
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user, email_data } = verified as {
      user: { email: string; new_email?: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new?: string
      }
    }

    const emailType = email_data.email_action_type
    const Template = EMAIL_TEMPLATES[emailType]
    if (!Template) {
      console.error('Unknown email type', { emailType })
      return new Response(JSON.stringify({ error: `unknown email type: ${emailType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build the confirmation URL (Supabase Verify endpoint → then redirect_to).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(
      email_data.token_hash,
    )}&type=${encodeURIComponent(emailType)}&redirect_to=${encodeURIComponent(
      email_data.redirect_to || email_data.site_url,
    )}`

    const templateProps = {
      siteName: SITE_NAME,
      siteUrl: `https://${ROOT_DOMAIN}`,
      recipient: user.email,
      confirmationUrl,
      token: email_data.token,
      email: user.email,
      newEmail: user.new_email,
      oldEmail: user.email,
    }

    const html = await renderAsync(React.createElement(Template, templateProps))
    const text = await renderAsync(React.createElement(Template, templateProps), {
      plainText: true,
    })

    const recipient = emailType === 'email_change' && user.new_email ? user.new_email : user.email

    await sendViaResend({
      to: recipient,
      subject: EMAIL_SUBJECTS[emailType] || 'AlixWork',
      html,
      text,
    })

    console.log('Auth email sent', { emailType, recipient })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('auth-email-hook error', { message })
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
