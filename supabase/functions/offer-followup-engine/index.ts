// Offer Follow-Up Engine — generates stage tasks & updates priority
// Trigger: pg_cron hourly. May also be invoked manually.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STAGE_TITLES: Record<number, string> = {
  1: 'Kunde kontaktieren',
  2: 'Nachfassen',
  3: 'Dringende Kontaktaufnahme',
  4: 'Letzte Angebotsnachverfolgung',
  5: 'Angebot als Inaktiv markieren',
};

function priorityFor(dueAt: string, stage: number): 'gruen' | 'gelb' | 'orange' | 'rot' {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const diffHrs = (due - now) / 3_600_000;
  if (diffHrs < 0) return 'rot';
  if (stage >= 3) return 'orange';
  if (diffHrs < 24) return 'gelb';
  return 'gruen';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: settings } = await admin
      .from('offer_followup_settings').select('*').eq('id', 1).maybeSingle();
    const stageDays: number[] = settings?.stage_days || [2, 4, 7, 14, 21];

    // Candidate offers: open drafts only
    const { data: offers, error: oErr } = await admin
      .from('offers')
      .select('offer_number, offer_date, created_at, customer_id, created_by, status, approval_status, total_gross')
      .in('status', ['draft'])
      .order('created_at', { ascending: false })
      .limit(2000);
    if (oErr) throw oErr;

    // Outcomes lookup
    const numbers = (offers || []).map((o) => o.offer_number);
    const { data: outcomes } = numbers.length
      ? await admin.from('offer_outcomes').select('offer_number, outcome').in('offer_number', numbers)
      : { data: [] as any[] };
    const outcomeMap = new Map((outcomes || []).map((o: any) => [o.offer_number, o.outcome]));

    // Existing tasks
    const { data: existing } = numbers.length
      ? await admin.from('offer_followup_tasks').select('offer_number, stage, due_at, status, priority').in('offer_number', numbers)
      : { data: [] as any[] };
    const taskKey = (n: string, s: number) => `${n}::${s}`;
    const existingMap = new Map((existing || []).map((t: any) => [taskKey(t.offer_number, t.stage), t]));

    const toInsert: any[] = [];
    const toUpdate: { id?: string; offer_number: string; stage: number; due_at: string; priority: string }[] = [];

    for (const o of offers || []) {
      const oc = outcomeMap.get(o.offer_number);
      if (oc === 'gewonnen' || oc === 'verloren') continue;
      if (o.approval_status === 'rejected') continue;
      const baseDate = o.offer_date || o.created_at;
      if (!baseDate) continue;
      const base = new Date(baseDate);

      for (let i = 0; i < stageDays.length; i++) {
        const stage = i + 1;
        const due = new Date(base);
        due.setDate(due.getDate() + stageDays[i]);
        due.setHours(9, 0, 0, 0);
        const dueISO = due.toISOString();
        const k = taskKey(o.offer_number, stage);
        const existingT = existingMap.get(k);
        const priority = priorityFor(dueISO, stage);

        if (!existingT) {
          toInsert.push({
            offer_number: o.offer_number,
            customer_id: o.customer_id,
            owner_user_id: o.created_by,
            stage,
            due_at: dueISO,
            status: 'offen',
            priority,
            title: STAGE_TITLES[stage],
          });
        } else if (existingT.status === 'offen' && existingT.priority !== priority) {
          toUpdate.push({ offer_number: o.offer_number, stage, due_at: existingT.due_at, priority });
        }
      }

      // Stage-5 inactive marking
      const stage5Due = new Date(base);
      stage5Due.setDate(stage5Due.getDate() + (stageDays[4] || 21));
      if (Date.now() > stage5Due.getTime() && (!oc || oc === 'offen')) {
        await admin.from('offer_outcomes').upsert({
          offer_number: o.offer_number,
          outcome: 'inaktiv',
          reason: 'Automatisch nach Stufe 5 (Ablauf Nachfasskette)',
          decided_at: new Date().toISOString(),
        }, { onConflict: 'offer_number' });
      }
    }

    let inserted = 0, updated = 0;
    if (toInsert.length) {
      const { error } = await admin.from('offer_followup_tasks').insert(toInsert);
      if (!error) inserted = toInsert.length;
    }
    for (const u of toUpdate) {
      await admin.from('offer_followup_tasks')
        .update({ priority: u.priority })
        .eq('offer_number', u.offer_number).eq('stage', u.stage);
      updated++;
    }

    // --- Nachfass-Automatik: E-Mail-Digest an Angebots-Owner ---
    let notified = 0;
    try {
      const nowISO = new Date().toISOString();
      const { data: dueTasks } = await admin
        .from('offer_followup_tasks')
        .select('id, offer_number, customer_id, owner_user_id, stage, due_at, title, priority')
        .eq('status', 'offen')
        .is('reminder_sent_at', null)
        .lte('due_at', nowISO)
        .not('owner_user_id', 'is', null)
        .limit(500);

      if (dueTasks?.length) {
        const ownerIds = [...new Set(dueTasks.map((t: any) => t.owner_user_id))];
        const { data: owners } = await admin
          .from('user_profiles').select('id, full_name, email, is_active').in('id', ownerIds);
        const ownerMap = new Map((owners || []).map((o: any) => [o.id, o]));

        const custIds = [...new Set(dueTasks.map((t: any) => t.customer_id).filter(Boolean))];
        const { data: customers } = custIds.length
          ? await admin.from('customers').select('id, customer_name').in('id', custIds)
          : { data: [] as any[] };
        const custMap = new Map((customers || []).map((c: any) => [c.id, c.customer_name]));

        const byOwner = new Map<string, any[]>();
        for (const t of dueTasks) {
          const o = ownerMap.get(t.owner_user_id);
          if (!o?.email || o.is_active === false) continue;
          const list = byOwner.get(t.owner_user_id) || [];
          list.push({
            offer_number: t.offer_number,
            customer_name: custMap.get(t.customer_id) || '',
            title: t.title,
            stage: t.stage,
            due_at: t.due_at,
            priority: t.priority,
            overdue_days: Math.max(0, Math.floor((Date.now() - new Date(t.due_at).getTime()) / 86_400_000)),
          });
          byOwner.set(t.owner_user_id, list);
        }

        for (const [ownerId, tasks] of byOwner) {
          const owner = ownerMap.get(ownerId);
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: owner.email,
              templateName: 'offer-followup-digest',
              templateData: {
                ownerName: owner.full_name || '',
                tasks,
                portalUrl: 'https://app.alixwork.de/verkauf/angebotsanalyse',
              },
            }),
          });
          if (res.ok) {
            notified += tasks.length;
            const ids = dueTasks.filter((t: any) => t.owner_user_id === ownerId).map((t: any) => t.id);
            await admin.from('offer_followup_tasks')
              .update({ reminder_sent_at: new Date().toISOString() }).in('id', ids);
          } else {
            console.error('followup digest mail failed', await res.text());
          }
        }
      }
    } catch (e) {
      console.error('followup notification error', e);
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: offers?.length || 0, inserted, updated, notified }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
