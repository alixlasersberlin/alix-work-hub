import '../_shared/global-bcc.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { createDepositPdf } from './pdf.ts';
import { bytesToBase64, invoiceEmail } from './rules.ts';

const schema = z.object({ order_id: z.string().uuid(), dry_run: z.boolean().optional() }).strict();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('CRON_SECRET');
  const suppliedSecret = req.headers.get('x-cron-secret');
  if (!suppliedSecret) return json({ error: 'Unauthorized' }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Ungültige Eingabe' }, 400);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const gatewayKey = Deno.env.get('LOVABLE_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url || !key || !gatewayKey || !resendKey) return json({ error: 'Versandkonfiguration fehlt' }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!secret || suppliedSecret !== secret) {
    const check = await admin.rpc('auto_az_secret_ok', { p_secret: suppliedSecret });
    if (check.error || check.data !== true) return json({ error: 'Unauthorized' }, 401);
  }
  const orderId = parsed.data.order_id;
  if (parsed.data.dry_run) {
    const { data, error } = await admin.from('orders').select('id, auto_az').eq('id', orderId).maybeSingle();
    return error ? json({ error: error.message }, 500) : json({ ok: true, state: data?.auto_az ?? null, writes: false });
  }
  let claim: string | undefined;
  try {
    const claimed = await admin.rpc('auto_az_claim', { p_order_id: orderId });
    if (claimed.error) throw claimed.error;
    if (!claimed.data) return json({ ok: true, skipped: true });
    claim = claimed.data.claim;
    if (!claim) throw new Error('Verarbeitungsauftrag fehlt');
    const prepared = await admin.rpc('auto_az_prepare', { p_order_id: orderId, p_claim: claim });
    if (prepared.error) throw prepared.error;
    if (prepared.data?.skipped) return json({ ok: true, skipped: true });
    const { order, customer, deposit, invoice_number: number } = prepared.data;
    const email = invoiceEmail(customer.email.trim(), number, order.order_number);
    const path = `${orderId}/anzahlung/auto_${number}.pdf`;
    const fileName = `Anzahlungsrechnung_${number}.pdf`;
    let pdf: Uint8Array;
    const saved = await admin.storage.from('order-invoices').download(path);
    if (saved.data) pdf = new Uint8Array(await saved.data.arrayBuffer());
    else {
      pdf = await createDepositPdf(order, customer, deposit, number);
      const upload = await admin.storage.from('order-invoices').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
      if (upload.error) throw upload.error;
    }
    const existingDoc = await admin.from('order_documents').select('id').eq('order_id', orderId).eq('file_path', path).maybeSingle();
    if (existingDoc.error) throw existingDoc.error;
    if (!existingDoc.data) {
      const stored = await admin.from('order_documents').insert({ order_id: orderId, file_name: fileName, file_path: path, file_type: 'application/pdf', document_type: 'Anzahlungsrechnung' });
      if (stored.error) throw stored.error;
    }
    const body = `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Anzahlungsrechnung ${number} zum Auftrag ${order.order_number}.\n\nRechnungsbetrag: ${Number(deposit.gross_amount).toLocaleString('de-DE', { style: 'currency', currency: deposit.currency || 'EUR' })}\nFällig am: ${new Date(deposit.due_date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}\n\nBitte verwenden Sie bei der Überweisung die Rechnungsnummer ${number}.\n\nMit freundlichen Grüßen\nAlix Lasers Finance`;
    const idempotency = `auto-az-${orderId}`;
    const sent = await admin.from('email_send_log').select('id').eq('source_id', idempotency).eq('status', 'sent').eq('recipient_email', customer.email.trim()).limit(1);
    if (sent.error) throw sent.error;
    if (!sent.data?.length) {
      const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${gatewayKey}`, 'X-Connection-Api-Key': resendKey, 'Content-Type': 'application/json', 'Idempotency-Key': idempotency },
        body: JSON.stringify({ ...email, from: 'Alix Lasers Finance <finance@alixwork.de>', reply_to: 'buchhaltung@alix-operation.de', text: body, html: `<pre>${body.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))}</pre>`, attachments: [{ filename: fileName, content: bytesToBase64(pdf), content_type: 'application/pdf' }] }),
      });
      if (!response.ok) throw new Error(`E-Mail-Versand fehlgeschlagen (${response.status})`);
      const result = await response.json();
      if (!result.id) throw new Error('Versandanbieter hat keine Versandbestätigung zurückgegeben');
      const logged = await admin.from('email_send_log').insert([...email.to, ...email.cc].map((recipient, idx) => ({ source_id: idempotency, recipient_email: recipient, subject: email.subject, template: 'auto-deposit-invoice', status: 'sent', provider_message_id: result.id, sent_at: new Date().toISOString(), metadata: { role: idx === 0 ? 'primary' : 'cc', order_id: orderId, deposit_id: deposit.id, pdf_path: path } })));
      if (logged.error) throw logged.error;
    }
    const done = await admin.rpc('auto_az_finish', { p_order_id: orderId, p_claim: claim, p_success: true, p_details: { sent_at: new Date().toISOString(), pdf_path: path, recipient: customer.email, cc: email.cc } });
    if (done.error) throw done.error;
    await admin.from('order_notes').insert({ order_id: orderId, note_type: 'email', is_internal: true, note_text: `Automatische Anzahlungsrechnung ${number} erstellt, gespeichert und versendet. An: ${customer.email}; CC: ${email.cc.join(', ')}` });
    return json({ ok: true, invoice_number: number });
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as any)?.message || error);
    if (claim) await admin.rpc('auto_az_finish', { p_order_id: orderId, p_claim: claim, p_success: false, p_details: { error: message, failed_at: new Date().toISOString() } });
    console.error('[auto-deposit-invoice]', message);
    return json({ ok: false, error: message }, 500);
  }
});