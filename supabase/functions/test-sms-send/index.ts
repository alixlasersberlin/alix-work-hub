import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
  const tok = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
  let from = Deno.env.get('TWILIO_SMS_FROM_NUMBER') ?? ''
  if (!from) from = (Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER') ?? '').replace(/^whatsapp:/i, '')

  let finalSid = sid, finalTok = tok, finalFrom = from
  if (!finalSid || !finalTok || !finalFrom) {
    const { data: cfg } = await admin.from('sms_settings').select('account_sid, auth_token, from_number').eq('id', true).maybeSingle()
    finalSid = finalSid || (cfg?.account_sid?.trim() ?? '')
    finalTok = finalTok || (cfg?.auth_token?.trim() ?? '')
    finalFrom = finalFrom || (cfg?.from_number?.trim() ?? '')
  }

  if (!finalSid || !finalTok || !finalFrom) {
    return new Response(JSON.stringify({ ok: false, error: 'Twilio credentials missing', have: { sid: !!finalSid, tok: !!finalTok, from: !!finalFrom } }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const to = '+491711651000'
  const body = `Alix Sign TEST: Wenn du diese SMS liest, funktioniert die Benachrichtigung nach Unterschrift. (${new Date().toLocaleString('de-DE')})`
  const url = `https://api.twilio.com/2010-04-01/Accounts/${finalSid}/Messages.json`
  const auth = btoa(`${finalSid}:${finalTok}`)
  const form = new URLSearchParams({ To: to, From: finalFrom, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = await res.json()
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, from: finalFrom, to, twilio: data }), {
    status: res.ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
