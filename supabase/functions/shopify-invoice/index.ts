import '../_shared/global-bcc.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { createAuditServiceClient } from '../_shared/audit-auth.ts';
import { invoiceSnapshot, paymentText } from '../_shared/shopify-invoice-rules.ts';
import { createInvoicePdf } from './pdf.ts';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
const schema = z.object({ order_id: z.string().uuid(), dry_run: z.boolean().optional() }).strict();
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const supplied = req.headers.get('x-cron-secret');
  if (!supplied) return json({ error: 'Unauthorized' }, 401);
  const db = createAuditServiceClient();
  if (supplied !== Deno.env.get('CRON_SECRET')) {
    const check = await db.rpc('auto_az_secret_ok', { p_secret: supplied });
    if (check.error || check.data !== true) return json({ error: 'Unauthorized' }, 401);
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid input' }, 400);
  const orderId = parsed.data.order_id;
  const gateway = Deno.env.get('LOVABLE_API_KEY'); const resend = Deno.env.get('RESEND_API_KEY');
  if (!gateway || !resend) return json({ error: 'Versandkonfiguration fehlt' }, 503);
  let claim: string | undefined; let sending = false; let prepared: any;
  try {
    const { data: order, error } = await db.from('orders').select('raw_data,shopify_invoice_state,source_system').eq('id', orderId).maybeSingle();
    if (error || order?.source_system !== 'shopify:0213c2-4.myshopify.com') return json({ error: 'Shopify order unavailable' }, 404);
    const snapshot = invoiceSnapshot(order.raw_data.shopify);
    if (parsed.data.dry_run) return json({ ok: true, writes: false, total: snapshot.total, tax: snapshot.tax, balance: snapshot.balance });
    const result = await db.rpc('shopify_invoice_claim', { p_order: orderId, p_snapshot: snapshot });
    if (result.error) throw new Error('Rechnungsanlage benötigt manuelle Prüfung.');
    if (!result.data) return json({ ok: true, skipped: true });
    prepared = result.data; claim = prepared.claim;
    const path = `${orderId}/shopify/rechnung_${prepared.invoice_id}.pdf`;
    const filename = `Rechnung_${prepared.number}.pdf`;
    const stored = await db.storage.from('order-invoices').download(path);
    const pdf = stored.data ? new Uint8Array(await stored.data.arrayBuffer()) : await createInvoicePdf(prepared);
    if (!stored.data) {
      const upload = await db.storage.from('order-invoices').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
      if (upload.error) throw new Error('PDF konnte nicht gespeichert werden.');
    }
    const document = await db.from('order_documents').select('id').eq('order_id', orderId).eq('file_path', path).maybeSingle();
    if (document.error) throw new Error('Dokumentprüfung fehlgeschlagen.');
    if (!document.data) {
      const added = await db.from('order_documents').insert({ order_id: orderId, file_name: filename, file_path: path, file_type: 'application/pdf', document_type: 'Rechnung' });
      if (added.error) throw new Error('Rechnungsablage fehlgeschlagen.');
    }
    const subject = `Ihre Rechnung ${prepared.number} – ${prepared.order_number}`;
    const body = `Guten Tag,\n\nanbei erhalten Sie Ihre Rechnung ${prepared.number} zum Auftrag ${prepared.order_number} als PDF.\n\n${paymentText(prepared.snapshot)}\n\nMit freundlichen Grüßen\nAlix Lasers Finance`;
    const note = await db.from('order_notes').insert({ order_id: orderId, note_type: 'email', is_internal: true, note_text: `An: ${prepared.snapshot.recipient}\n${subject}\n\n${body}\nAnhang: ${path}\nVersand vorbereitet; Ergebnis siehe Shopify-Protokoll.` });
    if (note.error) throw new Error('E-Mail-Archivierung fehlgeschlagen.');
    const marked = await db.rpc('shopify_invoice_transition', { p_order: orderId, p_claim: claim, p_status: 'sending', p_details: { pdf_path: path, recipient: prepared.snapshot.recipient, sending_at: new Date().toISOString() } });
    if (marked.error || marked.data !== true) throw new Error('Versandsperre konnte nicht gesetzt werden.');
    sending = true;
    let binary = ''; for (const byte of pdf) binary += String.fromCharCode(byte);
    const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${gateway}`, 'X-Connection-Api-Key': resend, 'Content-Type': 'application/json', 'Idempotency-Key': `shopify-invoice-${prepared.invoice_id}` },
      body: JSON.stringify({ from: 'Alix Lasers Finance <finance@alixwork.de>', to: [prepared.snapshot.recipient], reply_to: 'buchhaltung@alix-operation.de', subject, text: body, attachments: [{ filename, content: btoa(binary), content_type: 'application/pdf' }] }),
    });
    if (!response.ok) throw new Error(`Versand nicht bestätigt (${response.status}); manuelle Prüfung, kein automatischer Neuversand.`);
    const accepted = await response.json();
    if (!accepted.id) throw new Error('Versandbestätigung fehlt; kein automatischer Neuversand.');
    const logged = await db.from('email_send_log').insert({ source_id: `shopify-invoice-${prepared.invoice_id}`, recipient_email: prepared.snapshot.recipient, subject, template: 'shopify-invoice', status: 'sent', provider_message_id: accepted.id, sent_at: new Date().toISOString(), metadata: { order_id: orderId, invoice_id: prepared.invoice_id, pdf_path: path } });
    if (logged.error) throw new Error('Versand angenommen, Protokollspeicherung fehlgeschlagen; manuelle Prüfung.');
    const finished = await db.rpc('shopify_invoice_transition', { p_order: orderId, p_claim: claim, p_status: 'sent', p_details: { provider_message_id: accepted.id, sent_at: new Date().toISOString() } });
    if (finished.error || !finished.data) throw new Error('Versandstatus benötigt manuelle Prüfung.');
    await db.from('integration_logs').insert({ source: 'shopify:invoice', event: 'sent', external_id: orderId, status: 'ok', tenant_id: prepared.invoice.tenant_id, message: `Rechnung ${prepared.number} erstellt; Versand vom Anbieter angenommen.`, payload: { invoice_id: prepared.invoice_id, provider_message_id: accepted.id, pdf_path: path } });
    return json({ ok: true, invoice_number: prepared.number, provider_accepted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Rechnung konnte nicht verarbeitet werden.';
    if (claim) await db.rpc('shopify_invoice_transition', { p_order: orderId, p_claim: claim, p_status: sending ? 'uncertain' : 'pending', p_details: { error: message } });
    await db.from('integration_logs').insert({ source: 'shopify:invoice', event: 'error', external_id: orderId, status: 'error', message, payload: { manual_review: sending } });
    return json({ ok: false, error: message }, 503);
  }
});