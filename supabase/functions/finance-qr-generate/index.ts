// Swiss QR-Rechnung: builds SIX QR-payload string and QR reference (Mod-10 recursive check digit)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

function mod10CheckDigit(body: string): string {
  let carry = 0;
  for (const ch of body) {
    const d = parseInt(ch, 10);
    if (Number.isNaN(d)) throw new Error('QR-Referenz darf nur Ziffern enthalten');
    carry = MOD10_TABLE[(carry + d) % 10];
  }
  return String((10 - carry) % 10);
}

/** Build a 27-digit QR reference from an arbitrary numeric body (padded left with zeros). */
function buildQrReference(seed: string): string {
  const digits = (seed || '').replace(/\D/g, '').slice(-26).padStart(26, '0');
  return digits + mod10CheckDigit(digits);
}

function fmtAmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Build the SIX QR-bill payload string (SPC v0200) as LF-separated fields. */
function buildQrPayload(inv: any): string {
  const L = (v: any) => (v == null ? '' : String(v));
  const lines = [
    'SPC', '0200', '1',
    L(inv.qr_iban).replace(/\s+/g, ''),
    'S',
    L(inv.creditor_name).slice(0, 70),
    L(inv.creditor_street).slice(0, 70),
    L(inv.creditor_house_no).slice(0, 16),
    L(inv.creditor_postal_code).slice(0, 16),
    L(inv.creditor_city).slice(0, 35),
    L(inv.creditor_country || 'CH').slice(0, 2),
    '', '', '', '', '', '', '',
    fmtAmt(Number(inv.amount || 0)),
    L(inv.currency || 'CHF'),
    inv.debtor_name ? 'S' : '',
    L(inv.debtor_name).slice(0, 70),
    L(inv.debtor_street).slice(0, 70),
    L(inv.debtor_house_no).slice(0, 16),
    L(inv.debtor_postal_code).slice(0, 16),
    L(inv.debtor_city).slice(0, 35),
    L(inv.debtor_country || 'CH').slice(0, 2),
    L(inv.reference_type || 'QRR'),
    L(inv.reference),
    L(inv.unstructured_message).slice(0, 140),
    'EPD',
    L(inv.bill_info).slice(0, 140),
  ];
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const body = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // preview-only: build payload + reference without persistence
    if (body.preview) {
      const ref = body.reference_type === 'QRR'
        ? buildQrReference(body.reference_seed || String(Date.now()))
        : (body.reference || '');
      const payload = buildQrPayload({ ...body, reference: ref });
      return new Response(JSON.stringify({ reference: ref, payload }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.id) throw new Error('id oder preview erforderlich');
    const { data: inv, error } = await admin.from('finance_qr_invoices').select('*').eq('id', body.id).maybeSingle();
    if (error || !inv) throw new Error(error?.message ?? 'QR-Rechnung nicht gefunden');

    let ref = inv.reference;
    if (!ref && inv.reference_type === 'QRR') {
      ref = buildQrReference(body.reference_seed || inv.id.replace(/-/g, '').slice(0, 26));
    }
    const payload = buildQrPayload({ ...inv, reference: ref });

    await admin.from('finance_qr_invoices').update({
      reference: ref,
      status: inv.status === 'entwurf' ? 'erstellt' : inv.status,
    }).eq('id', inv.id);

    return new Response(JSON.stringify({ reference: ref, payload }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
