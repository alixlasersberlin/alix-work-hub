// Portal Invoice Download – erzeugt kurzlebige signierte URL (60s) für Rechnungs-PDF
// nach vollständiger Berechtigungsprüfung.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'unauthorized' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const attachmentId = String(body?.attachment_id ?? '');
    if (!attachmentId) return json({ error: 'attachment_id required' }, 400);

    const admin = createClient(url, serviceKey);

    // Portal-Zugang aktiv?
    const { data: portal } = await admin
      .from('customer_portal_users')
      .select('customer_id, status')
      .eq('user_id', authUserId)
      .maybeSingle();
    if (!portal || portal.status !== 'active') {
      await logAudit(admin, { action: 'invoice_downloaded', authUserId, success: false, metadata: { reason: 'no_active_portal' } });
      return json({ error: 'forbidden' }, 403);
    }

    // Rechnung gehört dem Kunden?
    const { data: att } = await admin
      .from('mail_attachments')
      .select('id, customer_id, document_type, storage_bucket, storage_path, file_name')
      .eq('id', attachmentId)
      .maybeSingle();
    if (
      !att ||
      att.document_type !== 'Rechnung' ||
      !att.customer_id ||
      att.customer_id !== portal.customer_id
    ) {
      await logAudit(admin, {
        action: 'invoice_downloaded',
        authUserId,
        customerId: portal.customer_id,
        objectId: attachmentId,
        success: false,
        metadata: { reason: 'not_owner_or_not_invoice' },
      });
      return json({ error: 'not_found' }, 404);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(att.storage_bucket)
      .createSignedUrl(att.storage_path, 60, { download: att.file_name });

    if (signErr || !signed?.signedUrl) {
      return json({ error: 'sign_failed' }, 500);
    }

    await logAudit(admin, {
      action: 'invoice_downloaded',
      authUserId,
      customerId: portal.customer_id,
      objectType: 'mail_attachment',
      objectId: attachmentId,
      success: true,
    });

    return json({ url: signed.signedUrl, file_name: att.file_name, expires_in: 60 });
  } catch (e) {
    return json({ error: 'internal', message: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logAudit(admin: any, p: {
  action: string;
  authUserId: string;
  customerId?: string;
  objectType?: string;
  objectId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}) {
  try {
    await admin.from('customer_portal_audit_logs').insert({
      action: p.action,
      auth_user_id: p.authUserId,
      customer_id: p.customerId ?? null,
      object_type: p.objectType ?? null,
      object_id: p.objectId ?? null,
      success: p.success,
      metadata: p.metadata ?? {},
    });
  } catch { /* ignore */ }
}
