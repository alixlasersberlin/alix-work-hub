// Verifies OTP, writes immutable signature row, marks contract signed.
import { authPortalUser, audit, json, corsHeaders, sendMail } from '../_shared/portal-auth.ts';

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
  const code = String(body.code ?? '').trim();
  const signedByName = String(body.signed_by_name ?? '').trim();
  const signedByRole = body.signed_by_role ? String(body.signed_by_role).trim() : null;
  const consents = body.consents && typeof body.consents === 'object' ? body.consents : {};
  if (!contractId || !/^\d{6}$/.test(code) || !signedByName) return json({ error: 'invalid_input' }, 400);

  const { data: c } = await admin
    .from('finance_contracts')
    .select('id, customer_id, customer_visible, contract_version, signature_status, signed_pdf_path')
    .eq('id', contractId).maybeSingle();
  if (!c || c.customer_id !== customerId || !c.customer_visible) return json({ error: 'not_found' }, 404);
  if (c.signature_status === 'signed') return json({ error: 'already_signed' }, 409);

  const hash = await sha256(`${contractId}:${code}:${user.id}`);
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: chall } = await admin
    .from('customer_portal_notifications')
    .select('id, payload, created_at')
    .eq('customer_id', customerId)
    .eq('auth_user_id', user.id)
    .eq('kind', 'contract_otp')
    .eq('body', hash)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  if (!chall) {
    await audit(admin, { customer_id: customerId, auth_user_id: user.id, action: 'contract_otp_failed', object_type: 'contract', object_id: contractId, success: false, ip_address: ip, user_agent: ua });
    return json({ error: 'invalid_or_expired_code' }, 400);
  }

  const { data: sig, error: sigErr } = await admin
    .from('customer_portal_contract_signatures').insert({
      contract_id: contractId,
      contract_version: c.contract_version ?? 1,
      customer_id: customerId,
      auth_user_id: user.id,
      signed_by_name: signedByName,
      signed_by_role: signedByRole,
      pdf_hash: c.signed_pdf_path ?? null,
      otp_challenge_id: chall.id,
      consents,
      ip_address: ip,
      user_agent: ua,
    }).select('id').single();
  if (sigErr) return json({ error: sigErr.message }, 400);

  await admin.from('finance_contracts').update({
    signature_status: 'signed',
  }).eq('id', contractId);

  // Consume challenge
  await admin.from('customer_portal_notifications').delete().eq('id', chall.id);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'contract_signed',
    object_type: 'contract', object_id: contractId,
    ip_address: ip, user_agent: ua,
    metadata: { signature_id: sig.id, version: c.contract_version ?? 1 },
  });

  const to = Deno.env.get('SUPPORT_NOTIFY_EMAIL');
  if (to) {
    await sendMail(to, `[Portal] Vertrag signiert`,
      `<p>Vertrag <code>${contractId}</code> (v${c.contract_version ?? 1}) wurde durch <strong>${signedByName}</strong>${signedByRole ? ' · ' + signedByRole : ''} rechtsverbindlich signiert.</p>
       <p>Kunde: ${customerId} · Signature-ID: ${sig.id}</p>`);
  }
  return json({ ok: true, signature_id: sig.id });
});
