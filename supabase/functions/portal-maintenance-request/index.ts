// Create a maintenance/service request from portal.
import { authPortalUser, audit, json, corsHeaders, sendMail } from '../_shared/portal-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const b = await req.json().catch(() => ({}));
  const deviceId = b.device_id ? String(b.device_id) : null;
  const kind = ['maintenance','repair','check','other'].includes(b.kind) ? b.kind : 'maintenance';
  const preferredDate = b.preferred_date ? String(b.preferred_date) : null;
  const description = String(b.description ?? '').trim().slice(0, 3000);
  const contactPhone = b.contact_phone ? String(b.contact_phone).slice(0, 50) : null;
  if (!description) return json({ error: 'invalid_input' }, 400);

  const { data: row, error } = await admin.from('customer_portal_maintenance_requests').insert({
    customer_id: customerId, auth_user_id: user.id,
    device_id: deviceId, kind, preferred_date: preferredDate,
    description, contact_phone: contactPhone, status: 'open',
  }).select('id').single();
  if (error) return json({ error: error.message }, 400);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'maintenance_requested', object_type: 'maintenance_request', object_id: row.id,
    ip_address: ip, user_agent: ua, metadata: { kind },
  });

  const to = Deno.env.get('SUPPORT_NOTIFY_EMAIL');
  if (to) await sendMail(to, `[Portal] Neue Wartungsanfrage (${kind})`,
    `<p>Kunde: ${customerId}</p>${deviceId ? `<p>Gerät: ${deviceId}</p>` : ''}
     ${preferredDate ? `<p>Wunschtermin: ${preferredDate}</p>` : ''}
     <blockquote>${description.replace(/</g,'&lt;')}</blockquote>`);

  return json({ ok: true, id: row.id });
});
