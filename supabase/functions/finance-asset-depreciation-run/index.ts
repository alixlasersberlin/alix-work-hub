import { requireProcessAccess, financeRoles } from '../_shared/process-access.ts';
import { z } from 'npm:zod@3.25.76';
// Phase 7 – AfA monthly depreciation run
// Computes monthly depreciation for all active assets for a given period (YYYY-MM)
// - linear: AHK / Nutzungsdauer
// - gwg_sofort: 100% in first month
// - gwg_pool: AHK / 60 (5 years)
// - degressiv: book_value * (degressive_rate/100) / 12 (with linear floor)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const access = await requireProcessAccess(req, corsHeaders, financeRoles);
    if ('response' in access) return access.response;
    const admin = access.client;
    const parsed = z.object({ dry_run: z.boolean().default(false), period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).strict().safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid period; expected YYYY-MM' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const dryRun = parsed.data.dry_run;
    const periodInput = parsed.data.period ?? new Date().toISOString().slice(0, 7);
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
