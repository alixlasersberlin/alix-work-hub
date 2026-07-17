// ALIX SIGN PRO — Prüfbericht/Signatur-Zertifikat als PDF
// eIDAS-orientierter Compliance-Report inkl. Hash-Chain-Prüfung.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

export async function generateSignatureCertificate(documentId: string) {
  const { data: doc } = await supabase
    .from('sig_documents')
    .select('id, title, document_type, sha256, status, completed_at, created_at, storage_path, entity_type, entity_id')
    .eq('id', documentId).maybeSingle();
  if (!doc) throw new Error('Dokument nicht gefunden');

  const { data: reqs } = await supabase
    .from('sig_requests').select('id, expires_at, otp_required, status, completed_at')
    .eq('document_id', documentId);

  const requestIds = (reqs || []).map((r) => r.id);

  const { data: signers } = requestIds.length
    ? await supabase.from('sig_signers').select('*').in('request_id', requestIds)
    : { data: [] as any[] };

  const { data: signatures } = requestIds.length
    ? await supabase.from('sig_signatures').select('*').in('request_id', requestIds)
    : { data: [] as any[] };

  const { data: audit } = await supabase
    .from('sig_audit_log').select('*').eq('document_id', documentId).order('created_at', { ascending: true });

  // Hash-Chain verifizieren (Client-Side via SubtleCrypto)
  let chainValid = true;
  let prev = '';
  const chainRows: { ok: boolean; event: string; created_at: string; entry_hash: string }[] = [];
  for (const a of audit || []) {
    const payload = `${prev}|${a.event}|${a.document_id ?? ''}|${a.request_id ?? ''}|${a.signer_id ?? ''}|${a.actor_email ?? ''}|${a.ip_address ?? ''}|${JSON.stringify(a.details ?? {})}`;
    const buf = new TextEncoder().encode(payload);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const expected = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const ok = expected === (a.entry_hash || '');
    if (!ok) chainValid = false;
    chainRows.push({ ok, event: a.event, created_at: a.created_at, entry_hash: (a.entry_hash || '').slice(0, 16) + '…' });
    prev = a.entry_hash || expected;
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40; let y = M;

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
  pdf.text('Signatur-Prüfbericht', M, y); y += 22;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.setTextColor(120);
  pdf.text('ALIX SIGN PRO · eIDAS-konformer Nachweis · Fortgeschrittene elektronische Signatur (FES)', M, y); y += 20;
  pdf.setTextColor(0);

  // Dokument-Info
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
  pdf.text('Dokument', M, y); y += 4;
  autoTable(pdf, {
    startY: y + 4,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ['Titel', doc.title],
      ['Dokumenttyp', doc.document_type],
      ['Status', doc.status],
      ['SHA-256 (Original)', doc.sha256 || '—'],
      ['Erstellt', new Date(doc.created_at).toLocaleString('de-DE')],
      ['Abgeschlossen', doc.completed_at ? new Date(doc.completed_at).toLocaleString('de-DE') : '—'],
      ['CRM-Referenz', doc.entity_type ? `${doc.entity_type} · ${doc.entity_id}` : '—'],
    ],
  });
  y = (pdf as any).lastAutoTable.finalY + 16;

  // Signer
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
  pdf.text('Unterzeichner', M, y); y += 4;
  autoTable(pdf, {
    startY: y + 4,
    head: [['#', 'Name', 'E-Mail', 'Rolle', 'Signiert am', 'Status']],
    body: (signers || []).map((s: any) => [
      s.order_index + 1, s.name || '—', s.email || '—', s.signer_role,
      s.signed_at ? new Date(s.signed_at).toLocaleString('de-DE') : '—',
      s.signed_at ? 'signiert' : s.declined_at ? 'abgelehnt' : 'offen',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  y = (pdf as any).lastAutoTable.finalY + 16;

  // Signaturen (technisch)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
  pdf.text('Signatur-Instanzen', M, y); y += 4;
  autoTable(pdf, {
    startY: y + 4,
    head: [['Zeit', 'Typ', 'IP', 'OS/Client', 'OTP', 'Hash']],
    body: (signatures || []).map((s: any) => [
      new Date(s.signed_at).toLocaleString('de-DE'),
      s.field_type,
      s.ip_address || '—',
      (s.os || '').slice(0, 20) + ' / ' + (s.user_agent || '').slice(0, 30),
      s.otp_verified ? 'Ja' : 'Nein',
      (s.hash || '').slice(0, 16) + '…',
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  y = (pdf as any).lastAutoTable.finalY + 16;

  // Chain-Prüfung
  pdf.addPage(); y = M;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
  pdf.text('Manipulations-Prüfung (Hash-Chain)', M, y); y += 20;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.setTextColor(chainValid ? 0 : 200, chainValid ? 128 : 0, 0);
  pdf.text(chainValid ? '✓ Kette ist unverändert und vollständig' : '✗ Kette weist Manipulation auf', M, y);
  pdf.setTextColor(0); y += 16;

  autoTable(pdf, {
    startY: y,
    head: [['#', 'Event', 'Zeit', 'Hash', 'OK']],
    body: chainRows.map((r, i) => [i + 1, r.event, new Date(r.created_at).toLocaleString('de-DE'), r.entry_hash, r.ok ? '✓' : '✗']),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = (pdf as any).lastAutoTable.finalY + 20;
  pdf.setFontSize(8); pdf.setTextColor(120);
  pdf.text(
    'Dieser Prüfbericht dokumentiert die technischen Nachweise zur Signatur gemäß eIDAS-Verordnung (EU) Nr. 910/2014.\n' +
    'Er ersetzt keine qualifizierte Signatur (QES). Für QES wird ein akkreditierter Vertrauensdiensteanbieter benötigt.',
    M, y, { maxWidth: 515 },
  );

  pdf.save(`Pruefbericht_${doc.title.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
