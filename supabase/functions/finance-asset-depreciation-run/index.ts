// Phase 7 – AfA monthly depreciation run
// Computes monthly depreciation for all active assets for a given period (YYYY-MM)
// - linear: AHK / Nutzungsdauer
// - gwg_sofort: 100% in first month
// - gwg_pool: AHK / 60 (5 years)
// - degressiv: book_value * (degressive_rate/100) / 12 (with linear floor)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate caller (cron uses anon, but we still allow it)
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dryRun: boolean = body.dry_run ?? false;
    const periodInput: string = body.period ?? new Date().toISOString().slice(0, 7); // YYYY-MM
    const [py, pm] = periodInput.split('-').map(Number);
    const period = new Date(Date.UTC(py, pm - 1, 1)).toISOString().slice(0, 10);

    // Load active assets
    const { data: assets, error: assetErr } = await admin
      .from('finance_assets')
      .select('*')
      .eq('status', 'aktiv');
    if (assetErr) throw assetErr;

    const results: any[] = [];
    let totalAmount = 0;

    for (const a of assets ?? []) {
      const acq = new Date(a.acquisition_date);
      const periodEnd = new Date(Date.UTC(py, pm, 0));
      if (acq > periodEnd) continue; // not yet acquired
      if (Number(a.book_value) <= 0) continue;

      let amount = 0;
      const ahk = Number(a.acquisition_value);
      const bv = Number(a.book_value);

      if (a.depreciation_method === 'gwg_sofort') {
        amount = bv; // write off remainder
      } else if (a.depreciation_method === 'gwg_pool') {
        amount = Math.min(ahk / 60, bv);
      } else if (a.depreciation_method === 'degressiv') {
        const rate = Number(a.degressive_rate ?? 20);
        const degMonthly = (bv * (rate / 100)) / 12;
        const linMonthly = ahk / Math.max(a.useful_life_months, 1);
        amount = Math.min(Math.max(degMonthly, linMonthly), bv);
      } else {
        amount = Math.min(ahk / Math.max(a.useful_life_months, 1), bv);
      }
      amount = Math.round(amount * 100) / 100;
      if (amount <= 0) continue;

      const newBookValue = Math.max(0, Math.round((bv - amount) * 100) / 100);
      const newAccum = Math.round(((Number(a.accumulated_depreciation) || 0) + amount) * 100) / 100;

      results.push({
        asset_id: a.id,
        inventory_number: a.inventory_number,
        name: a.name,
        method: a.depreciation_method,
        amount,
        book_value_after: newBookValue,
        accumulated_after: newAccum,
      });
      totalAmount += amount;

      if (!dryRun) {
        // Upsert depreciation row
        const { error: depErr } = await admin
          .from('finance_asset_depreciations')
          .upsert({
            asset_id: a.id,
            period,
            amount,
            book_value_after: newBookValue,
            method: a.depreciation_method,
            datev_account: a.datev_account,
            posting_text: `AfA ${a.inventory_number} – ${a.name} (${periodInput})`,
            is_posted: true,
            posted_at: new Date().toISOString(),
          }, { onConflict: 'asset_id,period' });
        if (depErr) {
          console.error('dep insert error', depErr);
          continue;
        }
        // Update asset book value
        const update: any = {
          book_value: newBookValue,
          accumulated_depreciation: newAccum,
        };
        if (newBookValue === 0) {
          update.status = a.depreciation_method === 'gwg_sofort' ? a.status : a.status;
        }
        await admin.from('finance_assets').update(update).eq('id', a.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      period: periodInput,
      dry_run: dryRun,
      asset_count: results.length,
      total_amount: Math.round(totalAmount * 100) / 100,
      entries: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('afa-run error', e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
