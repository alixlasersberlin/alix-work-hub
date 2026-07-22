// sig-apply-facsimile: Embeds the configured facsimile signature onto the last
// page of an incoming PDF (bottom-right over the signer name).
// Input:  { pdf_base64: string, doc_type: 'invoice'|'offer'|'order_confirmation'|'service_report', document_ref?: string }
// Output: { pdf_base64: string, applied: boolean, signer_name?: string }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_TYPES = new Set(['invoice', 'offer', 'order_confirmation', 'service_report', 'lease_purchase']);

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: any;
  try { body = await req.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { pdf_base64, doc_type, document_ref, applied_by } = body || {};
  if (!pdf_base64 || !doc_type || !ALLOWED_TYPES.has(doc_type)) {
    return json({ error: 'pdf_base64 and valid doc_type required' }, 400);
  }

  const { data: cfg } = await admin
    .from('sig_facsimile_settings')
    .select('*')
    .eq('doc_type', doc_type)
    .maybeSingle();

  if (!cfg || !cfg.enabled) {
    return json({ pdf_base64, applied: false, reason: 'not configured or disabled' });
  }

  // Download signature image
  const { data: imgFile, error: imgErr } = await admin.storage
    .from('sig-assets').download(cfg.image_path);
  if (imgErr || !imgFile) return json({ error: `image download failed: ${imgErr?.message}` }, 500);
  const imgBytes = new Uint8Array(await imgFile.arrayBuffer());

  // Load PDF
  const pdfBytes = b64ToBytes(pdf_base64);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  let sigImage;
  try {
    sigImage = cfg.image_path.toLowerCase().endsWith('.jpg') || cfg.image_path.toLowerCase().endsWith('.jpeg')
      ? await pdfDoc.embedJpg(imgBytes)
      : await pdfDoc.embedPng(imgBytes);
  } catch (e) {
    return json({ error: `image embed failed: ${(e as Error).message}` }, 500);
  }

  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const { width: pw } = page.getSize();

  const w = Number(cfg.width) || 160;
  const h = Number(cfg.height) || 60;
  // Default position: right side, offset from bottom
  const x = cfg.pos_x != null ? Number(cfg.pos_x) : pw - w - 40;
  const y = Number(cfg.pos_y) || 90;

  page.drawImage(sigImage, { x, y, width: w, height: h });

  if (cfg.show_name_line) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    // separator line
    page.drawLine({
      start: { x, y: y - 4 },
      end: { x: x + w, y: y - 4 },
      thickness: 0.6,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(cfg.signer_name || 'H. Tran', {
      x, y: y - 16, size: 9, font, color: rgb(0.1, 0.1, 0.1),
    });
    if (cfg.signer_title) {
      page.drawText(String(cfg.signer_title), {
        x, y: y - 27, size: 8, font, color: rgb(0.35, 0.35, 0.35),
      });
    }
  }

  const outBytes = await pdfDoc.save();

  await admin.from('sig_facsimile_log').insert({
    doc_type,
    document_ref: document_ref ?? null,
    applied_by: applied_by ?? null,
    settings_id: cfg.id,
  });

  return json({
    pdf_base64: bytesToB64(outBytes),
    applied: true,
    signer_name: cfg.signer_name,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
