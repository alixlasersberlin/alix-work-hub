// ALIX CREDIT SCORE® – deterministische Score-Engine
// Berechnet Score 0–1000 aus 8 Kategorien und speichert Faktoren + Ergebnis.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { assessment_id, run_ai = true } = await req.json();
    if (!assessment_id) return json({ error: 'assessment_id required' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: a, error: aErr } = await sb.from('credit_assessments').select('*').eq('id', assessment_id).maybeSingle();
    if (aErr || !a) return json({ error: 'assessment not found' }, 404);

    const { data: pol } = await sb.from('credit_policies').select('*').eq('active', true).eq('name', 'default').maybeSingle();
    const weights: Record<string, number> = pol?.weights ?? {};
    const bands: any[] = pol?.bands ?? [];

    // Sammle Kontextdaten
    const [docs, checks, hist, reminders, sepa, smart] = await Promise.all([
      sb.from('credit_documents').select('doc_type,verified').eq('assessment_id', assessment_id),
      sb.from('credit_external_checks').select('*').eq('assessment_id', assessment_id),
      a.customer_id ? sb.from('orders').select('id,order_status,total_amount,created_at').eq('customer_id', a.customer_id).limit(200) : Promise.resolve({ data: [] }),
      a.customer_id ? sb.from('finance_reminders').select('id,stage,status').eq('customer_id', a.customer_id).limit(50) : Promise.resolve({ data: [] }),
      a.customer_id ? sb.from('finance_sepa_run_items').select('id,status').eq('customer_id', a.customer_id).limit(50).then((r: any) => r).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      a.customer_id ? sb.from('alixsmart_customer_links').select('id,linked_at,last_activity_at').eq('customer_id', a.customer_id).maybeSingle().then((r: any) => r).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
    ]);

    const snap = (a.customer_snapshot ?? {}) as any;
    const factors: any[] = [];

    // 1. SCHUFA (aus snapshot.schufa_grade oder externem Check)
    {
      const grade = String(snap.schufa_grade || '').toUpperCase();
      let pts = 0;
      if (snap.schufa_negative) pts = -40;
      else if (['A','B','C'].includes(grade)) pts = 30;
      else if (grade === 'D') pts = 20;
      else if (grade === 'E') pts = 10;
      else if (grade === 'F') pts = 0;
      else pts = 15; // unbekannt = neutral-mittel
      factors.push({ category: 'schufa', label: `SCHUFA ${grade || 'unbekannt'}`, points: pts, weight_pct: weights.schufa ?? 30, source: 'manual', evidence: { grade, negative: !!snap.schufa_negative } });
    }

    // 2. Einkommen (Privatkunden)
    {
      const inc = Number(snap.net_income || 0);
      let pts = 0;
      if (inc >= 5000) pts = 20; else if (inc >= 3500) pts = 15; else if (inc >= 2500) pts = 10; else if (inc >= 2000) pts = 5; else pts = 0;
      if (a.customer_type === 'company') pts = 12; // Firmenkunden neutral
      factors.push({ category: 'einkommen', label: `Nettoeinkommen ${inc || '—'}`, points: pts, weight_pct: weights.einkommen ?? 20, source: 'manual', evidence: { net_income: inc } });
    }

    // 3. Beschäftigung
    {
      const emp = String(snap.employment || '');
      let pts = 5;
      if (emp === 'beamter') pts = 10;
      else if (emp === 'unbefristet') pts = 9;
      else if (emp === 'befristet') pts = 5;
      else if (emp === 'selbstaendig_neu') pts = 2;
      else if (emp === 'arbeitslos') pts = 0;
      if (a.customer_type === 'company') pts = 7;
      factors.push({ category: 'beschaeftigung', label: `Beschäftigung ${emp || '—'}`, points: pts, weight_pct: weights.beschaeftigung ?? 10, source: 'manual', evidence: { employment: emp } });
    }

    // 4. Unternehmen
    if (a.customer_type === 'company') {
      let pts = 0;
      if (snap.handelsregister) pts += 2;
      if (snap.ust_id) pts += 2;
      if (snap.website) pts += 1;
      if (snap.linkedin) pts += 1;
      const ageYears = Number(snap.company_age_years || 0);
      if (ageYears >= 5) pts += 3; else if (ageYears >= 2) pts += 2; else if (ageYears >= 1) pts += 1;
      if (snap.insolvenz) pts -= 10;
      factors.push({ category: 'unternehmen', label: `Unternehmensdaten`, points: pts, weight_pct: weights.unternehmen ?? 10, source: 'manual', evidence: { handelsregister: !!snap.handelsregister, ust_id: !!snap.ust_id, website: !!snap.website, ageYears } });
    } else {
      factors.push({ category: 'unternehmen', label: 'Privatkunde', points: 5, weight_pct: weights.unternehmen ?? 10, source: 'manual', evidence: {} });
    }

    // 5. Gerätehistorie
    {
      const orders = (hist as any).data ?? [];
      const rem = (reminders as any).data ?? [];
      const inkasso = rem.some((r: any) => String(r.stage || '').toLowerCase().includes('inkasso'));
      const mahnungen = rem.filter((r: any) => Number(r.stage || 0) >= 2).length;
      let pts = 0;
      if (orders.length >= 1) pts += 20;
      if (orders.length >= 2) pts += 30;
      const paid = orders.filter((o: any) => ['bezahlt','geliefert','abgeschlossen'].includes(String(o.order_status || '').toLowerCase())).length;
      if (paid >= 2) pts += 40;
      if (mahnungen > 0) pts -= 50;
      if (inkasso) pts -= 100;
      factors.push({ category: 'historie', label: `Historie: ${orders.length} Aufträge, ${mahnungen} Mahnungen`, points: pts, weight_pct: weights.historie ?? 15, source: 'history', evidence: { order_count: orders.length, paid, mahnungen, inkasso } });
    }

    // 6. AlixSmart
    {
      const s = (smart as any).data;
      let pts = 0;
      if (s) { pts += 10; if (s.last_activity_at) pts += 10; }
      factors.push({ category: 'alixsmart', label: s ? 'AlixSmart angemeldet' : 'Nicht angemeldet', points: pts, weight_pct: weights.alixsmart ?? 5, source: 'alixsmart', evidence: { linked: !!s } });
    }

    // 7. Zahlungsverhalten (SEPA-Rücklastschriften)
    {
      const sepaItems = (sepa as any).data ?? [];
      const returns = sepaItems.filter((s: any) => String(s.status || '').toLowerCase().includes('return') || String(s.status || '').toLowerCase().includes('rueck')).length;
      let pts = 10 - Math.min(10, returns * 5);
      factors.push({ category: 'zahlungsverhalten', label: `SEPA-Rücklastschriften: ${returns}`, points: pts, weight_pct: weights.zahlungsverhalten ?? 5, source: 'finance', evidence: { sepa_returns: returns } });
    }

    // 8. Dokumentenvollständigkeit
    {
      const docList = (docs as any).data ?? [];
      const required = ['perso'];
      const have = new Set(docList.map((d: any) => d.doc_type));
      const missing = required.filter((r) => !have.has(r));
      let pts = 5;
      if (docList.length >= 3) pts = 10;
      if (missing.length > 0) pts -= 5;
      factors.push({ category: 'dokumente', label: `Dokumente: ${docList.length} (fehlend: ${missing.join(',') || 'keine'})`, points: pts, weight_pct: weights.dokumente ?? 5, source: 'docs', evidence: { count: docList.length, missing } });
    }

    // Optional KI (Zusatz-Punkte)
    let aiSummary: string | null = null;
    let aiModel: string | null = null;
    let aiAdj = 0;
    if (run_ai) {
      try {
        const aiRes = await fetch(new URL('../credit-score-ai', import.meta.url).toString(), { method: 'POST' });
        // fallback: direkt Modell rufen
      } catch (_) { /* ignore */ }
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (key) {
        try {
          const prompt = `Bewerte weiche Bonitätsrisiken. Antworte NUR JSON: {"summary":"kurze Begründung DE","risk_adjust":-30..+10}\nKundendaten: ${JSON.stringify(snap).slice(0, 2000)}\nExterne Checks: ${JSON.stringify((checks as any).data ?? []).slice(0, 1000)}`;
          const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Lovable-API-Key': key, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'raw-fetch' },
            body: JSON.stringify({ model: 'google/gemini-3.6-flash', messages: [{ role: 'user', content: prompt }] }),
          });
          if (r.ok) {
            const d = await r.json();
            const raw = d.choices?.[0]?.message?.content ?? '';
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) {
              const p = JSON.parse(m[0]);
              aiSummary = String(p.summary || '');
              aiAdj = Math.max(-30, Math.min(10, Number(p.risk_adjust || 0)));
              aiModel = 'google/gemini-3.6-flash';
              factors.push({ category: 'ki', label: 'KI-Risikoanalyse', points: aiAdj, weight_pct: 100, source: 'ai', evidence: { summary: aiSummary } });
            }
          }
        } catch (_) { /* KI optional */ }
      }
    }

    // Score-Berechnung: gewichtete Summe der 8 Kategorien, KI als Zuschlag (max ±30)
    const catMax: Record<string, number> = { schufa: 30, einkommen: 20, beschaeftigung: 10, unternehmen: 10, historie: 40, alixsmart: 20, zahlungsverhalten: 10, dokumente: 10 };
    let weightedSum = 0;
    let weightTotal = 0;
    for (const f of factors) {
      if (f.category === 'ki') continue;
      const max = catMax[f.category] ?? 10;
      const w = Number(f.weight_pct || 0);
      const norm = Math.max(0, Math.min(1, (Number(f.points) + Math.abs(Math.min(0, -100))) / (max + 100))); // clamp
      const clamped = Math.max(0, Math.min(1, Number(f.points) / max));
      weightedSum += clamped * w;
      weightTotal += w;
    }
    let raw = weightTotal > 0 ? (weightedSum / weightTotal) * 1000 : 500;
    raw += aiAdj * 5; // 1 Punkt KI = 5 Score
    const score = Math.max(0, Math.min(1000, Math.round(raw)));
    const defaultProb = Math.round(Math.max(0, Math.min(100, 100 - score / 10)));

    // Band bestimmen
    const band = bands.find((b) => score >= Number(b.min) && score <= Number(b.max)) ?? bands[bands.length - 1];
    const recommendation = band ? {
      band_label: band.label,
      downpayment_pct: band.downpayment_pct,
      term_months: band.term_months,
      max_credit: band.max_credit,
      decision_stage: band.decision_stage,
    } : {};
    const flags: string[] = [];
    if (snap.insolvenz) flags.push('Insolvenzhinweis');
    if (score < 550) flags.push('Auto-Ablehnung');
    if ((snap.company_age_years || 0) < 1 && a.customer_type === 'company') flags.push('Junges Unternehmen');
    if (String(snap.email || '').match(/@(gmail|gmx|web|yahoo|hotmail)\./i) && a.customer_type === 'company') flags.push('Freemail statt Firmendomain');

    const status = score >= 900 ? 'approved' : score < 550 ? 'rejected' : 'pending_review';
    const workflow_stage = band?.decision_stage ?? 'sales';
    const valid_until = new Date(Date.now() + 90 * 86400_000).toISOString();

    // Persistieren
    await sb.from('credit_score_factors').delete().eq('assessment_id', assessment_id);
    if (factors.length > 0) {
      await sb.from('credit_score_factors').insert(factors.map((f) => ({ ...f, assessment_id })));
    }
    await sb.from('credit_assessments').update({
      score, ampel: band?.ampel ?? 'gelb', default_probability_pct: defaultProb,
      recommendation, flags, ai_summary: aiSummary, ai_model: aiModel,
      status, workflow_stage, valid_until, updated_at: new Date().toISOString(),
    }).eq('id', assessment_id);
    await sb.from('credit_decision_log').insert({
      assessment_id, action: 'recalculated', to_status: status, to_stage: workflow_stage,
      reason: `Score ${score} · Band ${band?.label ?? '—'}`, meta: { score, ampel: band?.ampel, defaultProb },
    });

    return json({ ok: true, score, ampel: band?.ampel, default_probability_pct: defaultProb, recommendation, flags, status, workflow_stage, valid_until });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
