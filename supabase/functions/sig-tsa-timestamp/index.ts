// sig-tsa-timestamp: RFC 3161 Zeitstempel-Client
// Baut eine DER-kodierte TimeStampReq für den SHA-256 Hash eines Dokuments,
// sendet sie an die konfigurierte TSA (application/timestamp-query) und
// speichert das TimeStampToken (base64) im sig_audit_log.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---- Minimal DER encoder (nur die für TimeStampReq nötigen Typen) ----
function derLen(n: number): Uint8Array {
  if (n < 128) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) { bytes.unshift(x & 0xff); x >>>= 8; }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
function derTLV(tag: number, value: Uint8Array): Uint8Array {
  const len = derLen(value.length);
  const out = new Uint8Array(1 + len.length + value.length);
  out[0] = tag; out.set(len, 1); out.set(value, 1 + len.length);
  return out;
}
function derSeq(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  return derTLV(0x30, buf);
}
function derInt(n: number): Uint8Array {
  const bytes: number[] = [];
  let x = n;
  do { bytes.unshift(x & 0xff); x = x >>> 8; } while (x > 0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return derTLV(0x02, new Uint8Array(bytes));
}
function derOctet(v: Uint8Array): Uint8Array { return derTLV(0x04, v); }
function derBool(b: boolean): Uint8Array { return derTLV(0x01, new Uint8Array([b ? 0xff : 0x00])); }
function derNull(): Uint8Array { return derTLV(0x05, new Uint8Array()); }
// OID 2.16.840.1.101.3.4.2.1 (SHA-256)
function derOidSha256(): Uint8Array {
  return derTLV(0x06, new Uint8Array([0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]));
}

function buildTimeStampReq(sha256: Uint8Array, nonce: number): Uint8Array {
  const algId = derSeq(derOidSha256(), derNull());
  const msgImprint = derSeq(algId, derOctet(sha256));
  return derSeq(derInt(1), msgImprint, derInt(nonce), derBool(true));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
function b64(bytes: Uint8Array): string {
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { document_id, storage_path } = body || {};
  if (!document_id) {
    return new Response(JSON.stringify({ error: 'document_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: cfgRow } = await admin.from('app_settings').select('value').eq('key', 'sig_tsa_config').maybeSingle();
  const cfg: any = cfgRow?.value || {};
  if (!cfg?.enabled || !cfg?.url) {
    return new Response(JSON.stringify({ ok: false, skipped: 'tsa_disabled' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: doc } = await admin.from('sig_documents')
    .select('id, storage_path').eq('id', document_id).single();
  const path = storage_path || doc?.storage_path;
  if (!path) {
    return new Response(JSON.stringify({ error: 'no storage_path' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: dl, error: dlErr } = await admin.storage.from('sig-documents').download(path);
  if (dlErr || !dl) {
    return new Response(JSON.stringify({ error: `download failed: ${dlErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const pdfBytes = new Uint8Array(await dl.arrayBuffer());
  const hash = await sha256(pdfBytes);
  const nonce = Math.floor(Math.random() * 0x7fffffff);
  const tsReq = buildTimeStampReq(hash, nonce);

  const headers: Record<string, string> = { 'Content-Type': 'application/timestamp-query' };
  if (cfg.auth_header) headers['Authorization'] = cfg.auth_header;

  let tsrB64: string | null = null;
  let tsaError: string | null = null;
  try {
    const res = await fetch(cfg.url, { method: 'POST', headers, body: tsReq });
    if (!res.ok) {
      tsaError = `HTTP ${res.status}`;
    } else {
      const tsr = new Uint8Array(await res.arrayBuffer());
      tsrB64 = b64(tsr);
    }
  } catch (e: any) {
    tsaError = e?.message || 'fetch failed';
  }

  await admin.from('sig_audit_log').insert({
    document_id,
    event: tsrB64 ? 'tsa_timestamp_issued' : 'tsa_timestamp_failed',
    details: {
      tsa_url: cfg.url,
      sha256: Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join(''),
      nonce,
      tsr_base64: tsrB64,
      error: tsaError,
      issued_at: new Date().toISOString(),
    },
  });

  return new Response(JSON.stringify({ ok: !!tsrB64, tsr_base64: tsrB64, error: tsaError }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
