import "../_shared/global-bcc.ts";
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.0.4'

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

  let to = 'rde@alix-lasers.com'
  try {
    const body = await req.json()
    if (typeof body?.to === 'string' && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(body.to)) to = body.to
  } catch { /* kein Body -> Standardempfänger */ }

  const subject = 'Testmail – Alix Work E-Mail-Versand'
  const html = '<p>Dies ist eine Testmail von Alix Work.</p><p>Absender: noreply@alixwork.de</p>'
  const text = 'Dies ist eine Testmail von Alix Work. Absender: noreply@alixwork.de'

  try {
    // Primärweg wie im Produktivversand: Resend über den Lovable-Connector
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Connection-Api-Key': resendKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Alix Lasers ® <noreply@alixwork.de>',
          to: [to],
          subject,
          html,
          text,
          reply_to: 'service@alix-lasers.com',
        }),
      })
      const txt = await res.text()
      if (res.ok) {
        return new Response(JSON.stringify({ ok: true, via: 'resend', to, result: txt.slice(0, 300) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.warn('Resend fehlgeschlagen', res.status, txt.slice(0, 300))
    }

    const result = await sendLovableEmail({
      from: 'Alix Lasers Datacenter <noreply@alixwork.de>',
      sender_domain: 'alixwork.de',
      to,
      subject,
      html,
      text,
      purpose: 'transactional',
      idempotency_key: crypto.randomUUID(),
      unsubscribe_token: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0')).join(''),
    }, { apiKey })

    return new Response(JSON.stringify({ ok: true, via: 'lovable', to, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
