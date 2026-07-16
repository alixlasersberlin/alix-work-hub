// Return a short-lived signed URL for a customer document.
import { authPortalUser, audit, json, corsHeaders } from '../_shared/portal-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const b = await req.json().catch(() => ({}));
  const docId = String(b.document_id ?? '');
  if (!docId) return json({ error: 'invalid_input' }, 400);

  const { data: d } = await admin
    .from('customer_portal_documents')
    .select('id, customer_id, customer_visible, storage_bucket, storage_path, title')
    .eq('id', docId).maybeSingle();
  if (!d || d.customer_id !== customerId || !d.customer_visible) return json({ error: 'not_found' }, 404);

  const { data: signed, error } = await admin.storage
    .from(d.storage_bucket ?? 'portal-uploads')
    .createSignedUrl(d.storage_path, 60);
  if (error) return json({ error: error.message }, 400);

  await admin.from('customer_portal_document_downloads').insert({
    document_id: docId, customer_id: customerId, auth_user_id: user.id,
    ip_address: ip, user_agent: ua,
  });
  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'document_downloaded', object_type: 'document', object_id: docId,
    ip_address: ip, user_agent: ua, metadata: { title: d.title },
  });

  return json({ ok: true, url: signed.signedUrl });
});
