// AlixDocs KI — OCR, Kategorisierung, Serien-/Auftragsnummer-Erkennung,
// Zusammenfassung, Ablaufdatum. Ruft Lovable AI Gateway (Gemini) auf.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const CATEGORY_CODES = [
  'angebot','auftrag','kaufvertrag','mietvertrag','finanzierung','rechnung','zahlung',
  'lieferschein','uebergabe','geraetefoto','seriennummer','servicebericht','reparatur',
  'wartung','garantie','schulung','nisv','mediapaket','reklamation','kundenkommunikation',
  'intern_vertraulich','sonstiges',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return json(500, { error: 'missing_lovable_api_key' });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const document_id = body.document_id as string;
  if (!document_id) return json(400, { error: 'document_id_required' });

  const admin = createClient(supabaseUrl, serviceKey);

  // Load document (RLS-checked via userClient first)
  const { data: doc } = await userClient.from('alixdocs_documents')
    .select('id, current_version, mime_type, title, category_id').eq('id', document_id).maybeSingle();
  if (!doc) return json(404, { error: 'not_found_or_forbidden' });

  const { data: ver } = await admin.from('alixdocs_versions')
    .select('storage_bucket, storage_path, mime_type, file_hash')
    .eq('document_id', document_id).eq('version_number', doc.current_version).maybeSingle();
  if (!ver) return json(404, { error: 'version_not_found' });

  // Job start
  const { data: job } = await admin.from('alixdocs_ai_jobs').insert({
    document_id, job_type: 'full', status: 'running', triggered_by: userId,
  }).select('id').single();
  const startedAt = Date.now();

  // Skip AI for very large files – edge worker memory (~150MB) can't hold
  // download + base64 (~1.35x) + AI request buffers. 8MB raw ≈ 11MB base64.
  const MAX_AI_BYTES = 8 * 1024 * 1024;

  try {
    // Duplicate check on file hash (cheap, before any download)
    if (ver.file_hash) {
      const { data: dupes } = await admin.from('alixdocs_versions')
        .select('document_id').eq('file_hash', ver.file_hash).neq('document_id', document_id).limit(1);
      if (dupes && dupes.length) {
        await admin.from('alixdocs_documents').update({ duplicate_of: dupes[0].document_id }).eq('id', document_id);
      }
    }

    // Check file size via storage metadata to avoid downloading huge files
    const { data: fileInfo } = await admin.storage.from(ver.storage_bucket)
      .list(ver.storage_path.substring(0, ver.storage_path.lastIndexOf('/')), {
        search: ver.storage_path.split('/').pop(),
      });
    const size = fileInfo?.[0]?.metadata?.size ?? 0;
    if (size > MAX_AI_BYTES) {
      await admin.from('alixdocs_documents').update({
        ocr_status: 'skipped_too_large',
        ai_processed_at: new Date().toISOString(),
      }).eq('id', document_id);
      await admin.from('alixdocs_ai_jobs').update({
        status: 'skipped', error: `file_too_large_${size}`,
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      }).eq('id', job!.id);
      return json(200, { ok: true, skipped: 'file_too_large', size });
    }

    // Download file
    const { data: blob, error: dErr } = await admin.storage.from(ver.storage_bucket).download(ver.storage_path);
    if (dErr || !blob) throw new Error(`storage_download_failed: ${dErr?.message}`);
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Base64 for inline content
    const b64 = base64FromBytes(buf);
    const mime = ver.mime_type || doc.mime_type || 'application/pdf';

    // Ask Gemini for structured extraction
    const model = 'google/gemini-2.5-flash';
    const systemPrompt =
      'Du bist eine deutschsprachige Dokumenten-KI für ein Medizintechnik-Unternehmen (Laser-Geräte). ' +
      'Du erhältst ein Dokument (PDF oder Bild). Antworte AUSSCHLIESSLICH mit gültigem JSON – kein Markdown, kein Fließtext davor oder danach. ' +
      'Wenn ein Feld nicht bestimmbar ist, verwende null oder ein leeres Array.';

    const schemaHint = `{
  "ocr_text": "kompletter erkannter Text",
  "summary": "1-3 Sätze deutsche Zusammenfassung",
  "category_code": "einer von: ${CATEGORY_CODES.join(', ')}",
  "serial_numbers": ["z.B. AL-2024-1234"],
  "order_numbers": ["Auftragsnummer, Angebotsnummer, Rechnungsnummer wie SO-1234, AB-2024-001, INV-…"],
  "expiry_date": "YYYY-MM-DD oder null (Ablauf/Garantie/Vertragsende)",
  "tags": ["3-6 knappe deutsche Schlagworte, kleingeschrieben, ohne Sonderzeichen"]
}`;

    const content: any[] = [
      { type: 'text', text: `Analysiere das Dokument und liefere JSON mit folgender Struktur:\n${schemaHint}` },
    ];
    if (mime.startsWith('image/')) {
      content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
    } else {
      content.push({ type: 'file', file: { filename: 'doc', file_data: `data:${mime};base64,${b64}` } });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': lovableKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`ai_gateway_${aiRes.status}: ${t.slice(0, 300)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch {
      // Some models wrap in ```json fences — try to salvage
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const ocr_text: string = typeof parsed.ocr_text === 'string' ? parsed.ocr_text.slice(0, 60000) : '';
    const summary: string | null = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 4000) : null;
    const category_code: string | null =
      typeof parsed.category_code === 'string' && CATEGORY_CODES.includes(parsed.category_code) ? parsed.category_code : null;
    const serial_numbers: string[] = Array.isArray(parsed.serial_numbers) ? parsed.serial_numbers.filter((x: any) => typeof x === 'string').slice(0, 20) : [];
    const order_numbers: string[] = Array.isArray(parsed.order_numbers) ? parsed.order_numbers.filter((x: any) => typeof x === 'string').slice(0, 20) : [];
    const expiry_date: string | null = typeof parsed.expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.expiry_date) ? parsed.expiry_date : null;
    const ai_tags: string[] = Array.isArray(parsed.tags)
      ? parsed.tags.filter((x: any) => typeof x === 'string')
        .map((x: string) => x.toLowerCase().replace(/[^a-z0-9äöüß\- ]/g, '').trim().replace(/\s+/g, '-'))
        .filter((x: string) => x.length >= 2 && x.length <= 32)
        .slice(0, 8)
      : [];

    // Try to link order_id via first matched order_number
    let matchedOrderId: string | null = null;
    if (order_numbers.length) {
      const { data: orderHit } = await admin.from('orders')
        .select('id').in('order_number', order_numbers).limit(1).maybeSingle();
      if (orderHit?.id) matchedOrderId = orderHit.id;
    }
    // Try to link device_id via first matched serial number
    let matchedDeviceId: string | null = null;
    if (serial_numbers.length) {
      const { data: dev } = await admin.from('lager_devices')
        .select('id').in('serial_number', serial_numbers).limit(1).maybeSingle();
      if (dev?.id) matchedDeviceId = dev.id;
    }

    const patch: Record<string, any> = {
      ocr_text: ocr_text || null,
      ocr_status: 'done',
      ai_summary: summary,
      ai_category_suggestion: category_code,
      ai_serial_numbers: serial_numbers,
      ai_order_numbers: order_numbers,
      ai_processed_at: new Date().toISOString(),
      ai_model: model,
      content_hash: ver.file_hash,
    };
    if (expiry_date) patch.expiry_date = expiry_date;
    if (matchedOrderId) patch.order_id = matchedOrderId;
    if (matchedDeviceId) patch.device_id = matchedDeviceId;
    if (serial_numbers.length && !patch.serial_number) patch.serial_number = serial_numbers[0];

    // Merge AI-Tags mit existierenden Tags (dedupliziert)
    if (ai_tags.length) {
      const { data: cur } = await admin.from('alixdocs_documents').select('tags').eq('id', document_id).maybeSingle();
      const existing: string[] = Array.isArray(cur?.tags) ? cur!.tags : [];
      const merged = Array.from(new Set([...existing, ...ai_tags])).slice(0, 20);
      patch.tags = merged;
    }

    // Apply category suggestion automatically only if current is 'sonstiges' or null
    if (category_code) {
      const { data: currentCat } = await admin.from('alixdocs_categories').select('code').eq('id', doc.category_id).maybeSingle();
      if (!currentCat || currentCat.code === 'sonstiges') {
        const { data: newCat } = await admin.from('alixdocs_categories').select('id').eq('code', category_code).maybeSingle();
        if (newCat?.id) patch.category_id = newCat.id;
      }
    }

    await admin.from('alixdocs_documents').update(patch).eq('id', document_id);

    await admin.from('alixdocs_ai_jobs').update({
      status: 'done', model, duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
    }).eq('id', job!.id);

    await admin.from('alixdocs_audit_log').insert({
      document_id, user_id: userId, action: 'ai_processed',
      metadata: { category: category_code, serials: serial_numbers.length, orders: order_numbers.length, expiry: expiry_date },
      user_agent: req.headers.get('user-agent'),
    });

    // Smart-Match anstoßen (Fire & Forget, Fehler nicht kritisch)
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/alixdocs-smart-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ document_id }),
      });
    } catch (e) { console.warn('smart-match trigger failed', e); }

    return json(200, {
      ok: true,
      summary, category_suggestion: category_code,
      serial_numbers, order_numbers, expiry_date,
      linked_order_id: matchedOrderId, linked_device_id: matchedDeviceId,
    });
  } catch (e: any) {
    await admin.from('alixdocs_ai_jobs').update({
      status: 'failed', error: String(e?.message || e), duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
    }).eq('id', job!.id);
    await admin.from('alixdocs_documents').update({ ocr_status: 'failed' }).eq('id', document_id);
    return json(500, { error: 'ai_failed', details: String(e?.message || e) });
  }
});

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}
