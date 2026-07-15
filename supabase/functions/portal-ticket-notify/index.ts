import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Wird von einem DB-Trigger oder client-seitig nach Insert eines neuen Tickets/Message
// aufgerufen. Sendet Benachrichtigung an die interne Support-Adresse.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body.ticket_id ?? '');
    const kind = body.kind === 'reply' ? 'reply' : 'new';
    if (!ticketId) return json({ error: 'ticket_id required' }, 400);

    const admin = createClient(url, service);

    const { data: t } = await admin
      .from('customer_portal_tickets')
      .select('id, subject, category, customer_id, customers:customer_id(company_name, contact_name, email, external_customer_id)')
      .eq('id', ticketId)
      .maybeSingle();
    if (!t) return json({ error: 'ticket not found' }, 404);

    // Portalzugehörigkeit prüfen
    const { data: link } = await admin
      .from('customer_portal_users')
      .select('customer_id, status')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!link || link.status !== 'active' || link.customer_id !== t.customer_id) {
      return json({ error: 'forbidden' }, 403);
    }

    // Audit
    await admin.from('customer_portal_audit_logs').insert({
      customer_id: t.customer_id,
      auth_user_id: userData.user.id,
      action: kind === 'new' ? 'ticket_notify_new' : 'ticket_notify_reply',
      object_type: 'ticket',
      object_id: ticketId,
      success: true,
      user_agent: req.headers.get('user-agent'),
      metadata: { kind },
    });

    // Optionaler SMTP-Versand — falls SUPPORT_NOTIFY_EMAIL gesetzt, versucht Resend
    const to = Deno.env.get('SUPPORT_NOTIFY_EMAIL');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (to && resendKey) {
      const c: any = (t as any).customers ?? {};
      const subject = kind === 'new'
        ? `[Portal] Neues Ticket: ${t.subject}`
        : `[Portal] Antwort im Ticket: ${t.subject}`;
      const html = `
        <p><strong>Kunde:</strong> ${c.company_name ?? c.contact_name ?? '—'} (${c.external_customer_id ?? '—'})</p>
        <p><strong>Kontakt:</strong> ${c.email ?? '—'}</p>
        <p><strong>Kategorie:</strong> ${t.category ?? '—'}</p>
        <p><strong>Betreff:</strong> ${t.subject}</p>
        <p>Bitte im AlixWork Admin öffnen: /kunden/${t.customer_id}</p>
      `;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Alix Portal <no-reply@alixwork.de>', to: [to], subject, html }),
      }).catch(() => {});
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
