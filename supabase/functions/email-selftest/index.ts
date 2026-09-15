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

  try {
    const result = await sendLovableEmail({
      from: 'Alix Lasers Datacenter <noreply@notify.alix-finance.de>',
      sender_domain: 'notify.alix-finance.de',
      to: 'rde@alix-lasers.com',
      subject: 'Testmail – Alix Work E-Mail-Versand',
      html: '<p>Dies ist eine Testmail von Alix Work.</p><p>Absender: noreply@notify.alix-finance.de</p>',
      text: 'Dies ist eine Testmail von Alix Work. Absender: noreply@notify.alix-finance.de',
      purpose: 'transactional',
      idempotency_key: crypto.randomUUID(),
      unsubscribe_token: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0')).join(''),
    }, { apiKey })


    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
