// Server-side offer accept/decline. Idempotent-safe: reads offer, validates
// state (visible, not expired, not finalized), inserts immutable acceptance,
// updates official offer status, notifies internal address + customer.
import { authPortalUser, audit, json, corsHeaders, sendMail } from '../_shared/portal-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offer_id ?? '');
  const action = body.action === 'declined' ? 'declined' : body.action === 'accepted' ? 'accepted' : null;
  const acceptedByName = String(body.accepted_by_name ?? '').trim();
  const acceptedByRole = body.accepted_by_role ? String(body.accepted_by_role).trim() : null;
  const declineReason = body.decline_reason ? String(body.decline_reason).slice(0, 100) : null;
  const declineNote = body.decline_note ? String(body.decline_note).slice(0, 1000) : null;
  const consentText = String(body.consent_text ?? '').slice(0, 2000);

  if (!offerId || !action || !acceptedByName || !consentText) {
    return json({ error: 'invalid_input' }, 400);
  }

  const { data: offer } = await admin
    .from('offers')
    .select('id, offer_number, status, valid_until, customer_visible, customer_id, portal_version, portal_pdf_hash, total_gross')
    .eq('id', offerId)
    .maybeSingle();
  if (!offer || offer.customer_id !== customerId || !offer.customer_visible) {
    return json({ error: 'not_found' }, 404);
  }
  const finalized = ['angenommen', 'abgelehnt', 'storniert'].includes(String(offer.status ?? '').toLowerCase());
  const expired = offer.valid_until && new Date(offer.valid_until).getTime() < Date.now();
  if (finalized || expired) return json({ error: 'not_actionable' }, 409);

  const { data: existing } = await admin
    .from('customer_portal_offer_acceptances')
    .select('id')
    .eq('offer_id', offerId)
    .eq('offer_version', offer.portal_version ?? 1)
    .limit(1);
  if (existing && existing.length) return json({ error: 'already_recorded' }, 409);

  const { error: insErr } = await admin.from('customer_portal_offer_acceptances').insert({
    offer_id: offer.id,
    offer_version: offer.portal_version ?? 1,
    customer_id: customerId,
    auth_user_id: user.id,
    accepted_by_name: acceptedByName,
    accepted_by_role: acceptedByRole,
    consent_text: consentText,
    pdf_hash: offer.portal_pdf_hash ?? null,
    ip_address: ip,
    user_agent: ua,
    action,
    decline_reason: declineReason,
    decline_note: declineNote,
  });
  if (insErr) return json({ error: insErr.message }, 400);

  const patch: Record<string, unknown> = action === 'accepted'
    ? { status: 'angenommen', accepted_at: new Date().toISOString(), accepted_by_name: acceptedByName }
    : { status: 'abgelehnt', declined_at: new Date().toISOString(), declined_reason: declineReason };
  await admin.from('offers').update(patch).eq('id', offer.id);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: action === 'accepted' ? 'offer_accepted' : 'offer_declined',
    object_type: 'offer', object_id: offer.id,
    ip_address: ip, user_agent: ua,
    metadata: { version: offer.portal_version ?? 1, reason: declineReason },
  });

  const to = Deno.env.get('SUPPORT_NOTIFY_EMAIL');
  if (to) {
    const subject = action === 'accepted'
      ? `[Portal] Angebot ${offer.offer_number} wurde ANGENOMMEN`
      : `[Portal] Angebot ${offer.offer_number} wurde abgelehnt`;
    await sendMail(to, subject, `
      <p><strong>Angebot:</strong> ${offer.offer_number} (v${offer.portal_version ?? 1})</p>
      <p><strong>Kunde:</strong> ${customerId}</p>
      <p><strong>Aktion:</strong> ${action}</p>
      <p><strong>Von:</strong> ${acceptedByName}${acceptedByRole ? ' · ' + acceptedByRole : ''}</p>
      ${declineReason ? `<p><strong>Grund:</strong> ${declineReason}</p>` : ''}
      ${declineNote ? `<p>${declineNote}</p>` : ''}
      <p style="color:#666;font-size:12px">IP ${ip ?? '—'} · ${ua ?? ''}</p>
    `);
  }

  return json({ ok: true });
});
