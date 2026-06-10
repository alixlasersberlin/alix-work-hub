// Phase 4: DATEV CSV-Export (Format "EXTF Buchungsstapel 700") aus finance_transactions.
// Konfig liegt in app_settings.key='finance.datev.config' (Beraternr., Mandantennr., SKR, Sachkonten-Mapping).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_CFG = {
  berater: '0000000',
  mandant: '00000',
  wj_beginn: '0101',
  skr: '03',
  konto_debitor_default: '10000',
  konto_erloese: '8400',
  konto_zahlung: '1200',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { date_from, date_to } = await req.json();
    if (!date_from || !date_to) {
      return new Response(JSON.stringify({ error: 'date_from und date_to erforderlich' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: cfgRow } = await admin.from('app_settings').select('value').eq('key', 'finance.datev.config').maybeSingle();
    let cfg = { ...DEFAULT_CFG };
    try { if (cfgRow?.value) cfg = { ...cfg, ...JSON.parse(cfgRow.value) }; } catch { /* ignore */ }

    const { data: txs, error } = await admin
      .from('finance_transactions')
      .select('id, transaction_type, amount, booking_date, notes, reference, customer_id, customers(company_name, contact_name)')
      .gte('booking_date', date_from)
      .lte('booking_date', date_to)
      .order('booking_date', { ascending: true });
    if (error) throw error;

    const year = (date_from as string).slice(0, 4);
    const dateFromCmp = (date_from as string).replace(/-/g, '');
    const dateToCmp = (date_to as string).replace(/-/g, '');

    // EXTF Header (Version 700)
    const created = new Date();
    const ts = created.toISOString().replace(/[-:T]/g, '').slice(0, 14) + '000';
    const header = [
      '"EXTF"', '700', '21', '"Buchungsstapel"', '7',
      ts, '', '"AlixFinance"', '""', '""',
      `"${cfg.berater}"`, `"${cfg.mandant}"`,
      `${year}${cfg.wj_beginn}`, '4',
      dateFromCmp, dateToCmp,
      `"Export ${date_from}..${date_to}"`,
      '"AlixFinance"', '', '', '1', '0', '', '"EUR"',
      '', '', '', '', '', '', '',
    ].join(';');

    const colHeader = [
      'Umsatz (ohne Soll-/Haben-Kz)', 'Soll-/Haben-Kennzeichen', 'WKZ Umsatz',
      'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
      'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel',
      'Belegdatum', 'Belegfeld 1', 'Belegfeld 2',
      'Skonto', 'Buchungstext',
    ].map(h => `"${h}"`).join(';');

    const rows: string[] = [];
    for (const t of (txs ?? []) as any[]) {
      const amount = Math.abs(Number(t.amount ?? 0));
      const sh = Number(t.amount ?? 0) >= 0 ? 'S' : 'H';
      const dat = (t.booking_date as string).slice(5).replace('-', '') + (t.booking_date as string).slice(0, 4); // TTMM JJJJ → DATEV "Belegdatum" TTMMJJJJ
      const belegdat = (t.booking_date as string).slice(8, 10) + (t.booking_date as string).slice(5, 7);
      const beleg1 = (t.reference ?? '').replace(/"/g, '').slice(0, 36);
      const text = ((t.customers?.company_name || t.customers?.contact_name || '') + ' – ' + (t.notes ?? '')).replace(/[\r\n;"]/g, ' ').slice(0, 60);
      const konto = cfg.konto_debitor_default;
      const gegen = t.transaction_type === 'Rechnung' ? cfg.konto_erloese : cfg.konto_zahlung;
      rows.push([
        amount.toFixed(2).replace('.', ','),
        sh, 'EUR', '', '', '',
        konto, gegen, '',
        belegdat,
        `"${beleg1}"`, '', '',
        `"${text}"`,
      ].join(';'));
    }

    const csv = header + '\r\n' + colHeader + '\r\n' + rows.join('\r\n') + '\r\n';
    const filename = `EXTF_Buchungsstapel_${date_from}_${date_to}.csv`;

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=windows-1252',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
