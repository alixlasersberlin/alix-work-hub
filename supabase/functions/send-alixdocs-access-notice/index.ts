import { renderAsync } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'
import { template as alixdocsAccessGranted } from '../_shared/transactional-email-templates/alixdocs-access-granted.tsx'

const SITE_NAME = 'Alix Lasers Datacenter'
const FROM_DOMAIN = 'notify.alixlasers.ai'
const SENDER_DOMAIN = 'notify.alixlasers.ai'
const ARCHIVE_BCC = ['rde@alix-lasers.com']

const RECIPIENTS = [
  { email: 'Natalia.p@alix-operation.de', name: 'Natalia' },
  { email: 'jh@alix-operation.de', name: 'Justin' },
  { email: 's.galushchak@alix-operation.de', name: 'Sergji' },
  { email: 'l.scheidler@Alix-operation.de', name: 'Lars' },
  { email: 'k.trinh@alix-operation.de', name: 'Kenny' },
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const subject = 'ALIXDOCS – Zugriff freigeschaltet'
  const results: any[] = []

  for (const r of RECIPIENTS) {
    const html = await renderAsync(React.createElement(alixdocsAccessGranted.component, { recipientName: r.name }))
    const text = await renderAsync(React.createElement(alixdocsAccessGranted.component, { recipientName: r.name }), { plainText: true })
    const idem = crypto.randomUUID()
    const unsubBytes = new Uint8Array(32); crypto.getRandomValues(unsubBytes)
    const unsubscribeToken = Array.from(unsubBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const targets = [{ to: r.email, key: 'primary' }, ...ARCHIVE_BCC.map((b, i) => ({ to: b, key: `bcc-${i}` }))]
    for (const t of targets) {
      try {
        await sendLovableEmail({
          to: t.to,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: 'transactional',
          idempotency_key: `alixdocs-access-${r.email}-${t.key}`,
          unsubscribe_token: unsubscribeToken,
        }, { apiKey })
        results.push({ to: t.to, ok: true })
      } catch (e: any) {
        results.push({ to: t.to, ok: false, error: e?.message ?? String(e) })
      }
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
