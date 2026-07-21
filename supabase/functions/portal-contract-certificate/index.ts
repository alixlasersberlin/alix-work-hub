// Generates a signature certificate PDF for a signed contract and returns a
// signed download URL. Certificate is created on-demand and cached in Storage.
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { authPortalUser, audit, json, corsHeaders } from '../_shared/portal-auth.ts';

const BUCKET = 'portal-uploads';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const body = await req.json().catch(() => ({}));
  const contractId = String(body.contract_id ?? '');
  if (!contractId) return json({ error: 'invalid_input' }, 400);

  const { data: contract } = await admin
    .from('finance_contracts')
    .select('id, customer_id, customer_visible, contract_number, contract_type, contract_version, signature_status')
    .eq('id', contractId).maybeSingle();
  if (!contract || contract.customer_id !== customerId || !contract.customer_visible) {
    return json({ error: 'not_found' }, 404);
  }
  if (contract.signature_status !== 'signed') return json({ error: 'not_signed' }, 409);

  const { data: sig } = await admin
    .from('customer_portal_contract_signatures')
    .select('id, signed_by_name, signed_by_role, signed_at, ip_address, user_agent, consents, contract_version, signature_storage_path')
    .eq('contract_id', contractId)
    .eq('customer_id', customerId)
    .order('signed_at', { ascending: false })
    .limit(1).maybeSingle();
  if (!sig) return json({ error: 'signature_not_found' }, 404);

  const path = sig.signature_storage_path
    ?? `contract-certificates/${customerId}/${contractId}_${sig.id}.pdf`;

  // Return cached certificate if present
  if (sig.signature_storage_path) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
    if (signed?.signedUrl) return json({ url: signed.signedUrl, cached: true });
  }

  // Generate certificate PDF
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.72, 0.55, 0.18);
  const dark = rgb(0.1, 0.1, 0.12);
  const grey = rgb(0.45, 0.45, 0.5);

  const draw = (t: string, x: number, y: number, size = 10, f = font, c = dark) =>
    page.drawText(t, { x, y, size, font: f, color: c });

  // Header bar
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: rgb(0.06, 0.06, 0.08) });
  draw('ALIX LASERS', 40, 812, 16, bold, gold);
  draw('Signaturzertifikat', 40, 793, 10, font, rgb(0.85, 0.85, 0.9));
  draw(`Ausstellungsdatum: ${new Date().toLocaleString('de-DE')}`, 380, 802, 8, font, rgb(0.8, 0.8, 0.85));

  let y = 740;
  draw('Rechtsverbindliche elektronische Signatur', 40, y, 14, bold); y -= 24;
  draw('Bestätigung gemäß eIDAS-Verordnung (EU) Nr. 910/2014 – einfache elektronische Signatur', 40, y, 9, font, grey); y -= 30;

  const line = (label: string, value: string) => {
    draw(label, 40, y, 9, bold, grey);
    draw(value, 200, y, 10, font);
    y -= 18;
  };

  line('Vertragsnummer:', contract.contract_number ?? contract.id);
  line('Vertragstyp:', contract.contract_type ?? '—');
  line('Vertragsversion:', String(sig.contract_version ?? contract.contract_version ?? 1));
  y -= 8;
  line('Signatur-ID:', sig.id);
  line('Signiert am:', new Date(sig.signed_at).toLocaleString('de-DE'));
  line('Unterzeichner:', sig.signed_by_name);
  if (sig.signed_by_role) line('Funktion:', sig.signed_by_role);
  line('E-Mail:', user.email ?? '—');
  line('IP-Adresse:', sig.ip_address ?? '—');
  y -= 8;

  draw('Zustimmungserklärung', 40, y, 11, bold); y -= 16;
  const consentText = (sig.consents as any)?.text
    ?? 'Der Unterzeichner hat den Vertrag gelesen und rechtsverbindlich elektronisch signiert.';
  const wrap = (txt: string, max: number) => {
    const words = txt.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (const ln of wrap(consentText, 95)) { draw(ln, 40, y, 9, font); y -= 13; }
  y -= 6;
  if ((sig.consents as any)?.accepted_at) {
    draw(`Zugestimmt am: ${new Date((sig.consents as any).accepted_at).toLocaleString('de-DE')}`, 40, y, 9, font, grey);
    y -= 18;
  }

  y -= 6;
  draw('Verifizierungsverfahren', 40, y, 11, bold); y -= 16;
  const method = [
    '• Authentifizierung des Kunden über das Alix Kundenportal (E-Mail + Passwort).',
    '• Zweifaktor-Bestätigung durch einen 6-stelligen Einmalcode (OTP) per E-Mail.',
    '• Protokollierung von IP-Adresse, User-Agent und Zeitstempel.',
    '• Signatur unveränderbar in der Alix Datenbank hinterlegt (Audit-Trail).',
  ];
  for (const m of method) { draw(m, 40, y, 9, font); y -= 13; }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: grey });
  y -= 16;
  draw('User-Agent:', 40, y, 8, bold, grey);
  const uaText = sig.user_agent ?? ua ?? '—';
  for (const ln of wrap(uaText, 110)) { draw(ln, 100, y, 8, font, grey); y -= 11; }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 40, color: rgb(0.96, 0.96, 0.97) });
  draw('Alix Lasers GmbH · Dieses Zertifikat wurde automatisch erstellt und ist ohne Unterschrift gültig.', 40, 18, 8, font, grey);
  draw(`Dok-ID: ${sig.id}`, 460, 18, 8, font, grey);

  const bytes = await pdf.save();

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'application/pdf', upsert: true,
  });
  if (upErr) return json({ error: upErr.message }, 500);

  await admin.from('customer_portal_contract_signatures')
    .update({ signature_storage_path: path })
    .eq('id', sig.id);

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (!signed?.signedUrl) return json({ error: 'signed_url_failed' }, 500);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'contract_certificate_downloaded',
    object_type: 'contract', object_id: contractId,
    ip_address: ip, user_agent: ua,
    metadata: { signature_id: sig.id },
  });

  return json({ url: signed.signedUrl, cached: false });
});
