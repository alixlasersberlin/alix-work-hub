import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { loadTwilioConfig } from '../_shared/twilio-config.ts';
import { reserveSmsSend, smsLimitWithCors } from '../_shared/sms-limit.ts';
import { smsPhone } from '../_shared/sms-policy.ts';
import { maskPhone } from '../_shared/security-core.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {...corsHeaders,'Content-Type':'application/json'},
});
const schema = z.discriminatedUnion('action',[
  z.object({action:z.literal('status')}),
  z.object({action:z.literal('test'),phone:z.string().max(40),text:z.string().trim().min(1).max(600).default('Test-SMS von Alix Lasers (Konfiguration).')}),
]);

export async function handleSmsConfigTest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  try {
    const access = await requireCallerAccess(req,corsHeaders,['Admin','Super Admin']);
    if ('response' in access) return access.response;
    const input = await req.json().catch(() => null);
    const parsed = schema.safeParse(input && typeof input === 'object' ? {action:'status',...input} : input);
    if (!parsed.success) return json({error:parsed.error.flatten()},400);
    const body = parsed.data;
    const to = body.action === 'test' ? smsPhone(body.phone) : null;
    if (body.action === 'test' && !to) return json({error:'Ungültige Mobilnummer'},400);
    const env = {
      sid:Deno.env.get('TWILIO_ACCOUNT_SID') ?? '',token:Deno.env.get('TWILIO_AUTH_TOKEN') ?? '',
      from:Deno.env.get('TWILIO_SMS_FROM_NUMBER') || (Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER') ?? '').replace(/^whatsapp:/i,''),
    };
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',{auth:{persistSession:false,autoRefreshToken:false}});
    const config = await loadTwilioConfig(admin,env);
    const status = {
      account_sid_set:Boolean(config.sid),account_sid_masked:config.sid ? `${config.sid.slice(0,4)}…${config.sid.slice(-4)}` : '',
      auth_token_set:Boolean(config.token),sms_from_set:Boolean(config.db_from || Deno.env.get('TWILIO_SMS_FROM_NUMBER')),
      whatsapp_from_set:Boolean(Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER')),effective_from:config.from || null,
      source:{account_sid:config.db_sid ? 'db' : (env.sid ? 'env' : 'missing'),auth_token:config.db_token ? 'vault' : (env.token ? 'env' : 'missing'),from_number:config.db_from ? 'db' : (env.from ? 'env' : 'missing')},
    };
    if (body.action === 'status') return json({ok:true,status});
    if (!to) return json({error:'Ungültige Mobilnummer'},400);
    if (!config.sid || !config.token || !config.from) return json({error:'Twilio-Zugangsdaten unvollständig',status},503);
    const attemptId = crypto.randomUUID();
    const details = {attempt_id:attemptId,destination_masked:maskPhone(to),test:true};
    const {error:intentError} = await admin.from('audit_logs').insert({user_id:access.user.id,action:'sms_send_requested',module:'sms',details});
    if (intentError) return json({error:'Versandprotokoll konnte nicht gespeichert werden'},503);
    const limited = await reserveSmsSend(admin,access.user.id,to);
    if (limited) return smsLimitWithCors(limited,corsHeaders);
    let providerStatus: number | null = null;
    let providerSid: string | null = null;
    let providerCode: number | null = null;
    let outcome = 'unconfirmed';
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`,{
        method:'POST',headers:{Authorization:`Basic ${btoa(`${config.sid}:${config.token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({To:to,From:config.from,Body:body.text}),
      });
      providerStatus = response.status;
      const payload = await response.json().catch(() => null);
      providerSid = typeof payload?.sid === 'string' ? payload.sid : null;
      providerCode = typeof payload?.code === 'number' ? payload.code : null;
      outcome = response.ok && providerSid ? 'accepted' : response.ok ? 'unconfirmed' : 'failed';
    } catch { /* Unknown provider outcome is never retried or refunded. */ }
    const {error:resultError} = await admin.from('audit_logs').insert({user_id:access.user.id,action:'sms_send_result',module:'sms',details:{...details,status:outcome,provider_status:providerStatus,provider_sid:providerSid,provider_code:providerCode}});
    if (outcome !== 'accepted') return json({ok:false,error:outcome === 'unconfirmed' ? 'Versandergebnis nicht bestätigt; nicht automatisch erneut senden' : `Twilio ${providerStatus}; Code ${providerCode ?? 'unbekannt'}`,status},502);
    return json({ok:true,sid:providerSid,status:'accepted',twilio_from:config.from,warning:resultError ? 'Versand erfolgt; Ergebnisprotokoll unvollständig. Nicht erneut senden.' : undefined});
  } catch {
    return json({error:'SMS-Prüfung nicht verfügbar; bei unklarem Versandergebnis nicht erneut senden'},503);
  }
}