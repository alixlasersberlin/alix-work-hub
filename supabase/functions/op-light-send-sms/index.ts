// FIBU LIGHT – SMS-Versand an Kunden mit offenen Posten (Twilio)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { smsReview } from '../_shared/sms-policy.ts';
import { reserveSmsSend, smsLimitWithCors } from '../_shared/sms-limit.ts';
import { resolveSmsContext } from '../_shared/sms-context.ts';
import { maskPhone } from '../_shared/security-core.ts';
import { z } from 'npm:zod@3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_SMS_FROM_NUMBER')
  || Deno.env.get('TWILIO_FROM_SMS')
  || Deno.env.get('TWILIO_FROM_NUMBER')
  || '';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY') ?? '';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'FIBU LIGHT', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normalizePhone(raw: string): string | null {
  let p = String(raw ?? '').trim().replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  else if (p.startsWith('0')) p = `+49${p.slice(1)}`;
  else if (!p.startsWith('+')) p = `+${p}`;
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (req.method !== 'POST') return json({error:'Method not allowed'},405);
    const access = await requireCallerAccess(req,corsHeaders,ALLOWED);
    if ('response' in access) return access.response;
    const parsed = z.object({to:z.string().max(40).optional(),message:z.string().trim().min(1).max(600).optional(),preview:z.boolean().optional(),
      record_type:z.enum(['invoice','deposit','device_lock','prenotification']),record_id:z.string().uuid(),
      record_ids:z.array(z.string().uuid()).min(1).max(100).optional(),
      alternative_phone_confirmed:z.boolean().optional(),alternative_phone_reason:z.string().max(500).optional(),
    }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({error:parsed.error.flatten()},400);
    const body = parsed.data;
    const context = await resolveSmsContext(access.caller,access.tenants,body.record_type,body.record_id);
    if (!context) return json({error:'SMS-Vorgang oder Kunde nicht zugänglich'},404);
    // Grouped lock notices may contain only independently authorized records for this customer.
    for (const id of body.record_ids ?? []) {
      const member = await resolveSmsContext(access.caller,access.tenants,body.record_type,id);
      if (!member || member.customerId !== context.customerId) return json({error:'Sammelvorgänge gehören nicht zum selben Kunden'},403);
    }
    const {data: permission} = await access.caller.rpc('security_has_permission',{_user_id:access.user.id,_permission_key:'sms.send_alternative_phone'});
    const canOverride = access.roles.some(r => r === 'Admin' || r === 'Super Admin') || permission === true;
    if (body.preview) return json({stored_phone:context.storedPhones.find(p => typeof p === 'string' && p.trim()) ?? '',can_override:canOverride,record_number:context.recordNumber});
    if (!body.to || !body.message) return json({error:'Mobilnummer und Nachricht erforderlich'},400);
    const review = smsReview(body.to,context.storedPhones,canOverride,body.alternative_phone_confirmed,body.alternative_phone_reason);
    if ('error' in review) return json({error:review.error},review.status);
    const to = review.phone;
    const text = body.message;
    if (!TWILIO_FROM) return json({ error: 'SMS-Absender fehlt (TWILIO_SMS_FROM_NUMBER)' }, 200);
    const attemptId = crypto.randomUUID();
    const {error:auditError} = await admin.from('audit_logs').insert({user_id:access.user.id,action:'sms_send_requested',module:'sms',record_id:context.recordId,details:{attempt_id:attemptId,record_type:body.record_type,record_ids:body.record_ids ?? [body.record_id],record_number:context.recordNumber,customer_id:context.customerId,alternative_phone:review.alternative,reason:review.reason,destination_masked:maskPhone(to)}});
    if (auditError) return json({error:'Versandprotokoll konnte nicht gespeichert werden'},503);

    if (!(LOVABLE_API_KEY && TWILIO_API_KEY) && !(TWILIO_SID && TWILIO_TOKEN)) return json({error:'Twilio ist nicht konfiguriert'},200);
    const limit = await reserveSmsSend(admin,access.user.id,to);
    if (limit) return smsLimitWithCors(limit,corsHeaders);

    const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: text });

    let res: Response;
    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } else if (TWILIO_SID && TWILIO_TOKEN) {
      res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } else {
      return json({ error: 'Twilio ist nicht konfiguriert' }, 200);
    }

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`twilio failed [${res.status}]`);
      let code: number | null = null;
      try { code = JSON.parse(errorBody)?.code ?? null; } catch { /* ignore */ }
      const reason = code === 21408
        ? 'SMS in dieses Land ist bei Twilio nicht freigeschaltet (Geo-Berechtigung)'
        : code === 21211 ? 'Ungültige Mobilnummer' : 'SMS-Versand fehlgeschlagen';
      await admin.from('audit_logs').insert({user_id:access.user.id,action:'sms_send_result',module:'sms',record_id:context.recordId,details:{attempt_id:attemptId,status:'failed',provider_status:res.status,provider_code:code,destination_masked:maskPhone(to)}});
      return json({ success: false, error: reason, twilio_code: code, status: res.status }, 200);
    }
    const payload = await res.json().catch(() => ({}));
    const {error:resultAuditError} = await admin.from('audit_logs').insert({user_id:access.user.id,action:'sms_send_result',module:'sms',record_id:context.recordId,details:{attempt_id:attemptId,status:'accepted',provider_sid:payload?.sid ?? null,destination_masked:maskPhone(to)}});
    return json({ success: true, sid: payload?.sid ?? null, destination_masked:maskPhone(to),warning:resultAuditError ? 'Versand erfolgt; Ergebnisprotokoll unvollständig. Nicht erneut senden.' : undefined });
  } catch (e: any) {
    console.error('op-light-send-sms failed without confirmed result');
    return json({ error: 'Versandergebnis nicht bestätigt; nicht automatisch erneut senden' }, 200);
  }
});
