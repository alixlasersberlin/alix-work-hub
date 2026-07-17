// sig-render-final: Baut eine finale PDF mit fest eingebetteten Signaturen an
// den Feldkoordinaten aus sig_documents.fields. Speichert als /v{n+1}.pdf ab.
// Wird nach dem letzten Signieren durch sig-submit aufgerufen (oder per REST).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { document_id, request_id } = body || {};
  if (!document_id) return new Response(JSON.stringify({ error: 'document_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: doc } = await admin.from('sig_documents')
    .select('id, storage_path, fields, version, title').eq('id', document_id).single();
  if (!doc) return new Response(JSON.stringify({ error: 'doc not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: signatures } = await admin.from('sig_signatures')
    .select('signer_id, field_key, field_type, page, x, y, width, height, png_data, signed_at')
    .eq('request_id', request_id);
  const { data: signers } = await admin.from('sig_signers')
    .select('id, order_index, name, email, signed_at').eq('request_id', request_id).order('order_index');

  // Download original PDF
  const { data: dl, error: dlErr } = await admin.storage.from('sig-documents').download(doc.storage_path);
  if (dlErr || !dl) return new Response(JSON.stringify({ error: `download failed: ${dlErr?.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const srcBytes = new Uint8Array(await dl.arrayBuffer());
  const pdfDoc = await PDFDocument.load(srcBytes);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const signerById = new Map((signers || []).map((s: any) => [s.id, s]));

  // Merge: if `fields` blueprint exists, place per blueprint; else use raw signature coords
  const fieldsBlueprint: any[] = Array.isArray(doc.fields) ? doc.fields : [];

  const placeSignaturePng = async (pngDataUrl: string, pageIdx: number, xPt: number, yPt: number, wPt: number, hPt: number) => {
    const page = pages[pageIdx]; if (!page) return;
    const b64 = pngDataUrl.includes(',') ? pngDataUrl.split(',')[1] : pngDataUrl;
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const img = await pdfDoc.embedPng(arr);
    const pageH = page.getHeight();
    // Editor stores top-left; pdf-lib uses bottom-left origin
    page.drawImage(img, { x: xPt, y: pageH - yPt - hPt, width: wPt, height: hPt });
  };

  const placeText = (text: string, pageIdx: number, xPt: number, yPt: number, hPt: number, bold = false) => {
    const page = pages[pageIdx]; if (!page) return;
    const size = Math.min(hPt * 0.55, 12);
    page.drawText(text, {
      x: xPt + 2,
      y: page.getHeight() - yPt - hPt + (hPt - size) / 2,
      size,
      font: bold ? helvB : helv,
      color: rgb(0.05, 0.05, 0.15),
    });
  };

  const usedSignatureIds = new Set<string>();

  if (fieldsBlueprint.length > 0) {
    for (const bf of fieldsBlueprint) {
      const pageIdx = Math.max(0, (bf.page || 1) - 1);
      // Find matching signature by signer_index + field_key
      const targetSigner = (signers || []).find((s: any) => s.order_index === bf.signer_index);
      const sig = (signatures || []).find((s: any) =>
        s.signer_id === targetSigner?.id && (s.field_key === bf.field_key || s.field_type === bf.field_type));
      if (bf.field_type === 'signature' || bf.field_type === 'initials') {
        if (sig?.png_data) {
          await placeSignaturePng(sig.png_data, pageIdx, bf.x, bf.y, bf.width, bf.height);
          usedSignatureIds.add(`${sig.signer_id}|${sig.field_key}`);
        }
      } else if (bf.field_type === 'date') {
        const dt = sig?.signed_at ? new Date(sig.signed_at) : (targetSigner?.signed_at ? new Date(targetSigner.signed_at) : new Date());
        placeText(dt.toLocaleDateString('de-DE'), pageIdx, bf.x, bf.y, bf.height);
      } else if (bf.field_type === 'text') {
        placeText(targetSigner?.name || '', pageIdx, bf.x, bf.y, bf.height);
      } else if (bf.field_type === 'checkbox') {
        if (sig) placeText('X', pageIdx, bf.x, bf.y, bf.height, true);
      }
    }
  }

  // Fallback: place any leftover signatures at their stored coords
  for (const sig of signatures || []) {
    const key = `${sig.signer_id}|${sig.field_key}`;
    if (usedSignatureIds.has(key)) continue;
    if (!sig.png_data) continue;
    const pageIdx = Math.max(0, (sig.page || 1) - 1);
    await placeSignaturePng(sig.png_data, pageIdx, Number(sig.x), Number(sig.y), Number(sig.width), Number(sig.height));
  }

  // Certification footer on last page
  const last = pages[pages.length - 1];
  const now = new Date();
  const footer = `Elektronisch signiert via AlixWork Sign • ${now.toLocaleString('de-DE')} • Doc-ID ${doc.id}`;
  last.drawRectangle({ x: 0, y: 0, width: last.getWidth(), height: 18, color: rgb(0.95, 0.97, 1) });
  last.drawText(footer, { x: 6, y: 5, size: 7, font: helv, color: rgb(0.1, 0.15, 0.35) });

  const outBytes = await pdfDoc.save();
  const nextVersion = (doc.version || 1) + 1;
  const parts = doc.storage_path.split('/');
  parts[parts.length - 1] = `v${nextVersion}-signed.pdf`;
  const newPath = parts.join('/');
  const outHash = await sha256Hex(outBytes);

  const { error: upErr } = await admin.storage.from('sig-documents').upload(newPath, outBytes, {
    contentType: 'application/pdf', upsert: true,
  });
  if (upErr) return new Response(JSON.stringify({ error: `upload failed: ${upErr.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  await admin.from('sig_document_versions').insert({
    document_id: doc.id, version: nextVersion, storage_path: newPath, sha256: outHash,
    is_signed_version: true,
  });
  await admin.from('sig_documents').update({
    storage_path: newPath, version: nextVersion, sha256: outHash, locked_at: new Date().toISOString(),
  }).eq('id', doc.id);
  await admin.from('sig_audit_log').insert({
    document_id: doc.id, request_id, event: 'final_pdf_rendered',
    details: { path: newPath, sha256: outHash, version: nextVersion },
  });

  return new Response(JSON.stringify({ ok: true, storage_path: newPath, version: nextVersion, sha256: outHash }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
