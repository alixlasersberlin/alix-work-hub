// ALIX CONNECT Phase 49 — Voice-Bot / IVR (Twilio Voice Webhook)
// Twilio ruft diesen Endpoint bei eingehenden Anrufen an. Antwortet mit TwiML (IVR Menü).
// URL: https://<project>.functions.supabase.co/ac-voice-twilio-webhook
// Konfiguration: Twilio Number → Voice → Webhook (POST) → obige URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function twiml(xml: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const step = url.searchParams.get('step') ?? 'welcome';

    // Twilio sendet form-encoded
    const contentType = req.headers.get('content-type') ?? '';
    const params: Record<string, string> = {};
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const t = await req.text();
      for (const [k, v] of new URLSearchParams(t)) params[k] = v;
    }
    const From = params.From ?? '';
    const To = params.To ?? '';
    const CallSid = params.CallSid ?? '';
    const Digits = params.Digits ?? '';
    const RecordingUrl = params.RecordingUrl ?? '';

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Business hours check (einfach 08–18 Berlin)
    const berlinHour = Number(new Intl.DateTimeFormat('de-DE', { hour: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(new Date()));
    const inHours = berlinHour >= 8 && berlinHour < 18;

    // Log every call step
    await sb.from('ac_calls').insert({
      external_id: CallSid, provider: 'twilio', direction: 'inbound',
      from_number: From, to_number: To, status: step,
      metadata: { step, digits: Digits, recording: RecordingUrl },
    }).select('id').maybeSingle().catch(() => {});

    if (step === 'welcome') {
      if (!inHours) {
        return twiml(`
          <Say language="de-DE" voice="Polly.Vicki">Willkommen bei Alix Lasers. Unsere Geschäftszeiten sind von 8 bis 18 Uhr. Bitte hinterlassen Sie eine Nachricht nach dem Signalton.</Say>
          <Record maxLength="60" action="?step=voicemail" playBeep="true" />
          <Say language="de-DE" voice="Polly.Vicki">Wir haben keine Nachricht erhalten. Auf Wiederhören.</Say>
        `);
      }
      return twiml(`
        <Gather numDigits="1" action="?step=menu" method="POST" timeout="6">
          <Say language="de-DE" voice="Polly.Vicki">Willkommen bei Alix Lasers. Drücken Sie 1 für Vertrieb, 2 für Service, 3 für Buchhaltung, oder bleiben Sie dran für einen Mitarbeiter.</Say>
        </Gather>
        <Say language="de-DE" voice="Polly.Vicki">Ich habe keine Eingabe erhalten. Sie werden weitergeleitet.</Say>
        <Dial timeout="30"><Number>+491234567890</Number></Dial>
      `);
    }

    if (step === 'menu') {
      const map: Record<string, string> = { '1': 'Vertrieb', '2': 'Service', '3': 'Buchhaltung' };
      const abt = map[Digits] ?? 'Zentrale';
      await sb.from('ac_calls').update({ metadata: { department: abt, digits: Digits } }).eq('external_id', CallSid);
      return twiml(`
        <Say language="de-DE" voice="Polly.Vicki">Sie werden mit ${abt} verbunden.</Say>
        <Dial timeout="30" action="?step=after_dial"><Number>+491234567890</Number></Dial>
        <Say language="de-DE" voice="Polly.Vicki">Der Mitarbeiter ist nicht erreichbar. Bitte hinterlassen Sie eine Nachricht.</Say>
        <Record maxLength="60" action="?step=voicemail" playBeep="true" />
      `);
    }

    if (step === 'voicemail') {
      // Voicemail asynchron transkribieren (bestehende Funktion nutzen)
      await sb.functions.invoke('ac-voicemail-transcribe', { body: { recording_url: RecordingUrl, call_sid: CallSid, from: From } }).catch(() => {});
      return twiml(`<Say language="de-DE" voice="Polly.Vicki">Vielen Dank. Wir melden uns zeitnah.</Say><Hangup/>`);
    }

    return twiml(`<Say language="de-DE" voice="Polly.Vicki">Auf Wiederhören.</Say><Hangup/>`);
  } catch (e) {
    return twiml(`<Say language="de-DE" voice="Polly.Vicki">Ein technischer Fehler ist aufgetreten.</Say><Hangup/>`, 200);
  }
});
