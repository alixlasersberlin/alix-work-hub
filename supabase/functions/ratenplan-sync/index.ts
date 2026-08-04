// ALIX Ratenplan-Sync
// Ermittelt Liefertermine ausschliesslich aus ALIXDOCS (OCR/KI) und synchronisiert
// den Ratenplan (Erstfaelligkeit = 1. des Folgemonats) fuer wiederkehrende Zahlungen /
// Mietkauf / Leasing / Finanzierung.
// Aktionen: scan (Dry-Run), apply (mit Backup + Audit), rollback, correct (KI-Lernen)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const DOC_TYPE_PRIORITY: { type: string; score: number; kw: string[] }[] = [
  { type: 'Übergabeprotokoll', score: 100, kw: ['übergabeprotokoll', 'uebergabeprotokoll', 'übergabebestätigung', 'geräteübergabe', 'hand over', 'handover'] },
  { type: 'Installationsprotokoll', score: 90, kw: ['installationsprotokoll', 'installation completed', 'inbetriebnahme'] },
  { type: 'Lieferschein', score: 80, kw: ['lieferschein', 'auslieferung'] },
  { type: 'Delivery Note', score: 70, kw: ['delivery note', 'delivery protocol', 'delivery date'] },
  { type: 'Versandnachweis', score: 60, kw: ['versandnachweis', 'versandprotokoll', 'shipment'] },
  { type: 'Transportdokument', score: 50, kw: ['transportdokument', 'frachtbrief', 'transport'] },
];

function classifyDoc(text: string): { type: string; score: number } | null {
  const t = (text || '').toLowerCase();
  for (const d of DOC_TYPE_PRIORITY) {
    if (d.kw.some((k) => t.includes(k))) return { type: d.type, score: d.score };
  }
  return null;
}

const DATE_LABELS: { key: string; prio: number; kw: string[] }[] = [
  { key: 'Lieferdatum', prio: 4, kw: ['lieferdatum', 'liefertermin', 'delivery date', 'device delivered', 'customer received'] },
  { key: 'Übergabedatum', prio: 3, kw: ['übergabedatum', 'uebergabedatum', 'übergabe am', 'hand over date', 'delivery completed'] },
  { key: 'Installationsdatum', prio: 2, kw: ['installationsdatum', 'installation am', 'installation completed', 'inbetriebnahme am'] },
  { key: 'Versanddatum', prio: 1, kw: ['versanddatum', 'shipment date', 'versendet am'] },
];

function parseDate(raw: string): string | null {
  let m = raw.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    let yy = Number(y);
    if (yy < 100) yy += 2000;
    const dt = new Date(Date.UTC(yy, Number(mo) - 1, Number(d)));
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  return null;
}

/** Regex-Extraktion: sucht Datum in der Naehe eines Labels */
function extractDate(text: string): { date: string; source: string } | null {
  const t = (text || '').replace(/\s+/g, ' ');
  const lower = t.toLowerCase();
  const hits: { date: string; source: string; prio: number }[] = [];
  for (const lab of DATE_LABELS) {
    for (const kw of lab.kw) {
      let idx = lower.indexOf(kw);
      while (idx >= 0) {
        const window = t.slice(idx, idx + kw.length + 40);
        const d = parseDate(window);
        if (d) hits.push({ date: d, source: lab.key, prio: lab.prio });
        idx = lower.indexOf(kw, idx + kw.length);
      }
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.prio - a.prio);
  return { date: hits[0].date, source: hits[0].source };
}

function firstOfNextMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const next = new Date(Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1));
  return next.toISOString().slice(0, 10);
}

function monthDiff(a: string, b: string): number {
  const x = new Date(a + 'T00:00:00Z');
  const y = new Date(b + 'T00:00:00Z');
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
}

function shiftMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return nd.toISOString().slice(0, 10);
}

async function aiExtract(lovableKey: string, docs: { id: string; title: string; text: string }[]) {
  const out: Record<string, { date: string | null; source: string | null }> = {};
  const context = docs
    .map((d) => `### DOC ${d.id}\nTitel: ${d.title}\n${(d.text || '').slice(0, 4000)}`)
    .join('\n\n');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content:
            'Du extrahierst aus Lieferdokumenten das tatsaechliche Liefer-/Uebergabedatum. ' +
            'Antworte ausschliesslich als JSON-Array: [{"id":"<DOC-ID>","date":"YYYY-MM-DD"|null,"source":"Lieferdatum|Übergabedatum|Installationsdatum|Versanddatum|Dokumentdatum"}]. ' +
            'Kein Fliesstext, keine Erklaerung. Wenn kein Datum erkennbar ist: date=null.',
        },
        { role: 'user', content: context },
      ],
    }),
  });
  if (!resp.ok) {
    console.error('ai extract failed', resp.status, (await resp.text()).slice(0, 300));
    return out;
  }
  const j = await resp.json();
  const raw = j?.choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return out;
  try {
    for (const r of JSON.parse(match[0])) {
      if (r?.id) out[String(r.id)] = { date: r.date ?? null, source: r.source ?? null };
    }
  } catch (_e) {
    console.error('ai json parse failed');
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'unauthorized' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY') ?? '';

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData?.user?.id ?? null;
  if (!uid) return json(401, { error: 'unauthorized' });
  const { data: isAdmin } = await userClient.rpc('has_role', { check_role: 'Admin' });
  const { data: isSuper } = await userClient.rpc('has_role', { check_role: 'Super Admin' });
  if (!isAdmin && !isSuper) return json(403, { error: 'forbidden' });

  const svc = createClient(url, service);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? 'scan');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;

  try {
    if (action === 'scan') return await scan();
    if (action === 'apply') return await apply();
    if (action === 'rollback') return await rollback();
    if (action === 'correct') return await correct();
    return json(400, { error: 'unknown_action' });
  } catch (e) {
    console.error('ratenplan-sync error', e);
    return json(500, { error: String((e as Error)?.message ?? e) });
  }

  // ---------------- SCAN (Dry Run) ----------------
  async function scan() {
    const statusScope: string[] = Array.isArray(body?.statuses) && body.statuses.length
      ? body.statuses
      : ['stopped', 'expired'];
    const region = body?.region ?? 'EU';
    const limit = Math.min(Number(body?.limit ?? 100), 300);
    const useAi = body?.useAi !== false && !!lovableKey;

    const { data: run, error: runErr } = await svc
      .from('ratenplan_sync_runs')
      .insert({
        mode: 'dry_run',
        status: 'running',
        created_by: uid,
        scope: { statuses: statusScope, region, limit, useAi },
      })
      .select('id')
      .single();
    if (runErr) throw runErr;
    const runId = run.id as string;

    const { data: profiles, error: pErr } = await svc
      .from('zoho_recurring_profiles')
      .select('id, customer_id, customer_name, company_name, reference_number, recurrence_name, status, start_date, next_invoice_date, end_date, last_sent_date, total, currency, accounting_region')
      .in('status', statusScope)
      .eq('accounting_region', region)
      .order('start_date', { ascending: false })
      .limit(limit);
    if (pErr) throw pErr;

    const items: any[] = [];
    let found = 0, review = 0, ready = 0, skipped = 0;

    for (const p of profiles ?? []) {
      const base: any = {
        run_id: runId,
        profile_id: p.id,
        order_number: p.reference_number,
        customer_name: p.company_name || p.customer_name,
        first_rate_old: p.start_date,
        status: 'pending',
      };

      // 1) Bereits bestaetigte Dokumentzuordnung bevorzugen
      const { data: link } = await svc
        .from('ratenplan_document_links')
        .select('document_id, document_type, delivery_date')
        .eq('profile_id', p.id)
        .maybeSingle();

      let docId: string | null = link?.document_id ?? null;
      let docTitle: string | null = null;
      let docType: string | null = link?.document_type ?? null;
      let delivery: string | null = link?.delivery_date ?? null;
      let source = link ? 'Verknüpftes Dokument' : null;
      let estimated = false;
      let candidates: any[] = [];

      if (!delivery) {
        // 2) Dokumentensuche in ALIXDOCS
        const terms = [p.reference_number, p.company_name, p.customer_name].filter(Boolean) as string[];
        const docs: any[] = [];
        for (const term of terms) {
          const esc = term.replace(/[%,]/g, ' ').trim();
          if (esc.length < 3) continue;
          const { data: d } = await svc
            .from('alixdocs_documents')
            .select('id, title, original_filename, document_date, ocr_text, status, created_at, order_id')
            .is('deleted_at', null)
            .or(`title.ilike.%${esc}%,original_filename.ilike.%${esc}%,ocr_text.ilike.%${esc}%`)
            .limit(10);
          for (const x of d ?? []) if (!docs.find((y) => y.id === x.id)) docs.push(x);
          if (docs.length >= 15) break;
        }

        const scored = docs
          .map((d) => {
            const hay = `${d.title ?? ''} ${d.original_filename ?? ''} ${(d.ocr_text ?? '').slice(0, 8000)}`;
            const cls = classifyDoc(hay);
            return cls ? { doc: d, type: cls.type, score: cls.score, hay } : null;
          })
          .filter(Boolean) as any[];

        scored.sort((a, b) =>
          b.score - a.score ||
          new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime());

        candidates = scored.slice(0, 5).map((s) => ({
          id: s.doc.id, title: s.doc.title ?? s.doc.original_filename, type: s.type,
        }));

        if (scored.length === 0) {
          base.status = 'nacharbeit';
          base.needs_review = true;
          base.reason = 'Kein Lieferdokument in ALIXDOCS gefunden';
          items.push({ ...base, candidates });
          review++;
          continue;
        }

        const best = scored[0];
        docId = best.doc.id;
        docTitle = best.doc.title ?? best.doc.original_filename;
        docType = best.type;

        const reg = extractDate(best.hay);
        if (reg) { delivery = reg.date; source = reg.source; }

        if (!delivery && useAi) {
          const ai = await aiExtract(lovableKey, [{
            id: best.doc.id,
            title: docTitle ?? '',
            text: best.hay,
          }]);
          const r = ai[best.doc.id];
          if (r?.date) { delivery = r.date; source = r.source ?? 'KI-Analyse'; }
        }

        if (!delivery && best.doc.document_date) {
          delivery = String(best.doc.document_date).slice(0, 10);
          source = 'Dokumentdatum';
          estimated = true;
        }

        // Mehrere unterschiedliche Liefertermine in gleichrangigen Dokumenten?
        const sameRank = scored.filter((s) => s.score === best.score);
        const dates = new Set(
          sameRank.map((s) => extractDate(s.hay)?.date).filter(Boolean) as string[],
        );
        if (dates.size > 1) {
          base.status = 'nacharbeit';
          base.needs_review = true;
          base.reason = `Mehrere abweichende Liefertermine gefunden (${[...dates].join(', ')})`;
          items.push({
            ...base, document_id: docId, document_title: docTitle, document_type: docType,
            delivery_date: delivery, delivery_source: source, estimated, candidates,
          });
          review++;
          continue;
        }
      }

      if (!delivery) {
        base.status = 'nacharbeit';
        base.needs_review = true;
        base.reason = 'Lieferdatum im Dokument nicht lesbar (OCR/KI ohne Treffer)';
        items.push({ ...base, document_id: docId, document_title: docTitle, document_type: docType, candidates });
        review++;
        continue;
      }
      found++;

      // 3) Validierung
      let block: string | null = null;
      if (p.last_sent_date) block = 'Rate/Rechnung bereits gestellt (last_sent_date gesetzt) – keine Änderung';
      if (!p.start_date) block = block ?? 'Kein bestehender Ratenbeginn hinterlegt';

      const firstNew = firstOfNextMonth(delivery);
      const shift = p.start_date ? monthDiff(p.start_date, firstNew) : 0;

      if (block) {
        items.push({
          ...base, document_id: docId, document_title: docTitle, document_type: docType,
          delivery_date: delivery, delivery_source: source, estimated, candidates,
          first_rate_new: firstNew, status: 'nacharbeit', needs_review: true, reason: block,
        });
        review++;
        continue;
      }

      if (shift === 0) {
        items.push({
          ...base, document_id: docId, document_title: docTitle, document_type: docType,
          delivery_date: delivery, delivery_source: source, estimated, candidates,
          first_rate_new: firstNew, status: 'unverändert', reason: 'Ratenbeginn bereits korrekt',
        });
        skipped++;
        continue;
      }

      // Doppelte Pruefung: Liefertermin und erste Rate muessen zusammenpassen
      if (firstOfNextMonth(delivery) !== firstNew) {
        items.push({
          ...base, delivery_date: delivery, status: 'fehler', needs_review: true,
          reason: 'Plausibilitätsprüfung fehlgeschlagen',
        });
        review++;
        continue;
      }

      const shiftedCount = p.end_date ? Math.max(1, monthDiff(firstNew, p.end_date) + 1) : 1;

      items.push({
        ...base, document_id: docId, document_title: docTitle, document_type: docType,
        delivery_date: delivery, delivery_source: source, estimated, candidates,
        first_rate_new: firstNew, shifted_count: shiftedCount, status: 'bereit',
      });
      ready++;
    }

    if (items.length) {
      const { error: iErr } = await svc.from('ratenplan_sync_items').insert(items);
      if (iErr) throw iErr;
    }

    const stats = {
      checked: profiles?.length ?? 0,
      documents_found: found,
      ready,
      unchanged: skipped,
      needs_review: review,
    };
    await svc.from('ratenplan_sync_runs')
      .update({ status: 'completed', stats, finished_at: new Date().toISOString() })
      .eq('id', runId);

    return json(200, { run_id: runId, stats });
  }

  // ---------------- APPLY ----------------
  async function apply() {
    const dryRunId = String(body?.run_id ?? '');
    if (!dryRunId) return json(400, { error: 'run_id_required' });
    const onlyIds: string[] | null = Array.isArray(body?.item_ids) && body.item_ids.length ? body.item_ids : null;

    let q = svc.from('ratenplan_sync_items').select('*').eq('run_id', dryRunId).eq('status', 'bereit');
    if (onlyIds) q = q.in('id', onlyIds);
    const { data: items, error } = await q;
    if (error) throw error;
    if (!items?.length) return json(400, { error: 'no_items_ready' });

    const { data: run, error: rErr } = await svc
      .from('ratenplan_sync_runs')
      .insert({
        mode: 'apply', status: 'running', created_by: uid,
        scope: { source_run: dryRunId, item_count: items.length },
        applied_run_id: dryRunId,
      })
      .select('id').single();
    if (rErr) throw rErr;
    const runId = run.id as string;

    let updated = 0, failed = 0;
    const errors: string[] = [];

    for (const it of items) {
      const { data: p } = await svc
        .from('zoho_recurring_profiles')
        .select('*')
        .eq('id', it.profile_id)
        .maybeSingle();
      if (!p) { failed++; errors.push(`${it.order_number}: Vertrag nicht gefunden`); continue; }
      // Erneute Validierung unmittelbar vor Speicherung
      if (p.last_sent_date) { failed++; errors.push(`${it.order_number}: bereits fakturiert`); continue; }
      if (!it.first_rate_new || it.first_rate_new === p.start_date) { failed++; continue; }

      await svc.from('ratenplan_sync_backups').insert({
        run_id: runId, table_name: 'zoho_recurring_profiles', record_id: p.id, before_data: p,
      });

      const shift = monthDiff(p.start_date, it.first_rate_new);
      const nextNew = p.next_invoice_date ? shiftMonths(p.next_invoice_date, shift) : it.first_rate_new;
      const endNew = p.end_date ? shiftMonths(p.end_date, shift) : null;

      const patch: Record<string, unknown> = {
        start_date: it.first_rate_new,
        next_invoice_date: nextNew,
        updated_at: new Date().toISOString(),
      };
      if (endNew) patch.end_date = endNew;

      const { error: uErr } = await svc.from('zoho_recurring_profiles').update(patch).eq('id', p.id);
      if (uErr) { failed++; errors.push(`${it.order_number}: ${uErr.message}`); continue; }

      if (it.document_id) {
        await svc.from('ratenplan_document_links').upsert({
          profile_id: p.id,
          document_id: it.document_id,
          document_type: it.document_type,
          delivery_date: it.delivery_date,
          confirmed_by: uid,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' });
      }

      await svc.from('finance_audit_trail').insert({
        module: 'ratenplan_sync',
        entity_table: 'zoho_recurring_profiles',
        entity_id: p.id,
        action: 'update',
        old_data: { start_date: p.start_date, next_invoice_date: p.next_invoice_date, end_date: p.end_date },
        new_data: {
          ...patch, backup_run_id: runId, document_id: it.document_id,
          delivery_date: it.delivery_date, delivery_source: it.delivery_source,
        },
        user_id: uid, ip_address: ip, user_agent: ua,
        accounting_region: p.accounting_region ?? 'EU',
      });

      await svc.from('ratenplan_sync_items')
        .update({ status: 'übernommen', shifted_count: Math.abs(shift) })
        .eq('id', it.id);
      updated++;
    }

    const stats = { updated, failed, backup_id: runId, errors: errors.slice(0, 50) };
    await svc.from('ratenplan_sync_runs')
      .update({
        status: failed && !updated ? 'failed' : 'completed',
        stats, finished_at: new Date().toISOString(),
        error: errors.length ? errors.slice(0, 5).join(' | ') : null,
      })
      .eq('id', runId);

    return json(200, { run_id: runId, backup_id: runId, stats });
  }

  // ---------------- ROLLBACK ----------------
  async function rollback() {
    const backupId = String(body?.backup_id ?? '');
    if (!backupId) return json(400, { error: 'backup_id_required' });

    const { data: backups, error } = await svc
      .from('ratenplan_sync_backups').select('*').eq('run_id', backupId);
    if (error) throw error;
    if (!backups?.length) return json(400, { error: 'no_backup_found' });

    let restored = 0;
    for (const b of backups) {
      const before = b.before_data as Record<string, unknown>;
      const region = (before.accounting_region as string) ?? 'EU';
      const { error: uErr } = await svc
        .from(b.table_name)
        .update({
          start_date: before.start_date,
          next_invoice_date: before.next_invoice_date,
          end_date: before.end_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.record_id);
      if (!uErr) {
        restored++;
        await svc.from('finance_audit_trail').insert({
          module: 'ratenplan_sync', entity_table: b.table_name, entity_id: b.record_id,
          action: 'rollback', new_data: before, user_id: uid, ip_address: ip, user_agent: ua,
          accounting_region: region,
        });
      }
    }
    await svc.from('ratenplan_sync_runs')
      .update({ rolled_back_at: new Date().toISOString(), rolled_back_by: uid, status: 'rolled_back' })
      .eq('id', backupId);

    return json(200, { restored });
  }

  // ---------------- KI-LERNEN ----------------
  async function correct() {
    const { item_id, corrected_date, note } = body ?? {};
    if (!item_id || !corrected_date) return json(400, { error: 'item_id_and_date_required' });
    const { data: it } = await svc.from('ratenplan_sync_items').select('*').eq('id', item_id).maybeSingle();
    if (!it) return json(404, { error: 'item_not_found' });

    await svc.from('ratenplan_ai_corrections').insert({
      document_id: it.document_id, profile_id: it.profile_id,
      extracted_date: it.delivery_date, corrected_date, note: note ?? null, corrected_by: uid,
    });
    if (it.document_id) {
      await svc.from('ratenplan_document_links').upsert({
        profile_id: it.profile_id, document_id: it.document_id,
        document_type: it.document_type, delivery_date: corrected_date,
        confirmed_by: uid, updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
    }
    const firstNew = firstOfNextMonth(String(corrected_date));
    await svc.from('ratenplan_sync_items').update({
      delivery_date: corrected_date, delivery_source: 'Manuelle Korrektur',
      first_rate_new: firstNew, estimated: false,
      status: it.first_rate_old && it.first_rate_old !== firstNew ? 'bereit' : 'unverändert',
      needs_review: false, reason: 'Vom Benutzer korrigiert',
    }).eq('id', item_id);

    return json(200, { ok: true, first_rate_new: firstNew });
  }
});
