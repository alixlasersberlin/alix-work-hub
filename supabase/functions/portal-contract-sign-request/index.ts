// Issues an OTP for signing a specific contract version. Stores hashed OTP in
// a portal notification row (kind=contract_otp) with 10-minute expiry. Sends
// OTP by email to the portal user.
import { authPortalUser, audit, json, corsHeaders, sendMail, otp6 } from '../_shared/portal-auth.ts';

async function sha256(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const body = await req.json().catch(() => ({}));
  const contractId = String(body.contract_id ?? '');
  if (!contractId) return json({ error: 'invalid_input' }, 400);

  const { data: c } = await admin
    .from('finance_contracts')
    .select('id, customer_id, customer_visible, contract_version, signature_status')
    .eq('id', contractId).maybeSingle();
  if (!c || c.customer_id !== customerId || !c.customer_visible) return json({ error: 'not_found' }, 404);
  if (c.signature_status === 'signed') return json({ error: 'already_signed' }, 409);

  const code = otp6();
  const hash = await sha256(`${contractId}:${code}:${user.id}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin.from('customer_portal_notifications').insert({
    customer_id: customerId,
    auth_user_id: user.id,
    kind: 'contract_otp',
    title: `Signatur-Code Vertrag`,
    body: hash,
    payload: { contract_id: contractId, version: c.contract_version ?? 1, expires_at: expiresAt },
  });

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'contract_otp_requested',
    object_type: 'contract', object_id: contractId,
    ip_address: ip, user_agent: ua,
  });

  await sendMail(user.email!, 'Ihr Signatur-Code für den Vertrag',
    `<p>Ihr Bestätigungscode lautet:</p><p style="font-size:24px;letter-spacing:4px"><strong>${code}</strong></p>
     <p>Gültig für 10 Minuten. Wenn Sie das nicht waren, ignorieren Sie diese Mail.</p>`);

  return json({ ok: true, expires_at: expiresAt });
});
