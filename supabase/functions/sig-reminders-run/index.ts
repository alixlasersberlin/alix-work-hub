// sig-reminders-run: läuft per Cron; verschickt Erinnerungen an offene Unterzeichner
// gemäß sig_reminder_rules (offsets_hours seit sent_at) und markiert abgelaufene Anfragen.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

  const now = Date.now();
  let expired = 0, reminders = 0;

  // 1) expire overdue
  const { data: overdue } = await admin.from('sig_requests')
    .select('id, document_id').lt('expires_at', new Date().toISOString())
    .in('status', ['versendet', 'geoeffnet', 'teilweise_signiert']);
  for (const r of overdue || []) {
    await admin.from('sig_requests').update({ status: 'abgelaufen' }).eq('id', r.id);
    await admin.from('sig_documents').update({ status: 'abgelaufen' }).eq('id', r.document_id);
    await admin.from('sig_audit_log').insert({ document_id: r.document_id, request_id: r.id, event: 'expired' });
    expired++;
  }

  // 2) reminders for open requests
  const { data: openReqs } = await admin.from('sig_requests')
    .select('id, document_id, sent_at, expires_at, token, status, sig_documents:document_id(document_type, title, id)')
    .in('status', ['versendet', 'geoeffnet', 'teilweise_signiert'])
    .not('sent_at', 'is', null);

  for (const r of openReqs || []) {
    const docType = (r as any).sig_documents?.document_type;
    if (!docType) continue;
    const { data: rule } = await admin.from('sig_reminder_rules')
      .select('offsets_hours, is_active').eq('document_type', docType).eq('is_active', true).maybeSingle();
    if (!rule?.offsets_hours?.length) continue;

    const sentMs = new Date(r.sent_at).getTime();
    const ageH = (now - sentMs) / 3600000;

    // Find highest matching offset that hasn't been sent yet
    const { data: sentRems } = await admin.from('sig_audit_log')
      .select('details').eq('request_id', r.id).eq('event', 'reminder_sent');
    const sentOffsets = new Set((sentRems || []).map((x: any) => x.details?.offset_hours).filter(Boolean));

    const dueOffsets = (rule.offsets_hours as number[]).filter((h) => ageH >= h && !sentOffsets.has(h));
    if (!dueOffsets.length) continue;
    const off = Math.max(...dueOffsets);

    const { data: openSigners } = await admin.from('sig_signers')
      .select('id, name, email').eq('request_id', r.id)
      .is('signed_at', null).is('declined_at', null);

    for (const s of openSigners || []) {
      if (!s.email) continue;
      const signUrl = `https://alixwork.de/sign-doc/${r.token}`;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({
            templateName: 'sig-reminder',
            recipientEmail: s.email,
            idempotencyKey: `sig-reminder-${r.id}-${s.id}-${off}`,
            templateData: {
              offer_number: (r as any).sig_documents?.title,
              customer_name: s.name,
              sign_url: signUrl,
              expires_at: new Date(r.expires_at).toLocaleDateString('de-DE'),
              offset_hours: off,
            },
          }),
        });
        reminders++;
      } catch (e) { console.error('reminder mail error', e); }
    }
    await admin.from('sig_audit_log').insert({
      document_id: r.document_id, request_id: r.id, event: 'reminder_sent',
      details: { offset_hours: off, recipients: (openSigners || []).length },
    });
  }

  return new Response(JSON.stringify({ ok: true, expired, reminders }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
