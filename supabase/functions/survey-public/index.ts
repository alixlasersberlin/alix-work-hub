// Öffentlicher Endpunkt für die Umfrageteilnahme (Token-basiert, kein Login).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'load');
    const token = String(body?.token ?? '').trim();
    if (!token || token.length < 16 || token.length > 120) return json({ error: 'invalid_token' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: inv } = await admin
      .from('survey_invitations')
      .select('id, survey_id, recipient_id, expires_at, completed_at, started_at, status')
      .eq('token', token)
      .maybeSingle();

    if (!inv) {
      // Offener Link (QR): anonyme Teilnahme -> frische Einladung erzeugen
      const { data: openSurvey } = await admin
        .from('surveys').select('id, status, language, public_enabled')
        .eq('public_token', token).maybeSingle();
      if (openSurvey && openSurvey.public_enabled && openSurvey.status !== 'archiviert') {
        const rnd = crypto.randomUUID().replace(/-/g, '');
        const { data: rec, error: recErr } = await admin.from('survey_recipients').insert({
          survey_id: openSurvey.id,
          email: `anonym+${rnd}@umfrage.local`,
          first_name: 'Anonym',
          language: openSurvey.language ?? 'de',
          consent_status: 'unbekannt',
          status: 'eingeladen_offen',
        }).select('id').single();
        if (recErr) return json({ error: recErr.message }, 500);
        const newToken = rnd + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        const { error: invErr } = await admin.from('survey_invitations').insert({
          survey_id: openSurvey.id, recipient_id: rec.id, token: newToken,
          multi_use: false, status: 'versendet', sent_at: new Date().toISOString(),
        });
        if (invErr) return json({ error: invErr.message }, 500);
        return json({ redirect_token: newToken });
      }
      return json({ error: 'invalid_token' }, 404);
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return json({ error: 'expired' }, 410);


    const { data: survey } = await admin
      .from('surveys')
      .select('id, name, public_title, intro_text, outro_text, language, est_minutes, status, reward_id, ends_at, design')
      .eq('id', inv.survey_id).maybeSingle();
    if (!survey || survey.status === 'archiviert') return json({ error: 'not_available' }, 410);

    if (action === 'load') {
      if (inv.completed_at) {
        return json({ already_completed: true, survey });
      }
      const { data: questions } = await admin
        .from('survey_questions')
        .select('id, qtype, label, help_text, position, required, min_value, max_value')
        .eq('survey_id', survey.id).neq('visible', false).order('position');

      const qids = (questions ?? []).map((q) => q.id);
      let optsByQ: Record<string, unknown[]> = {};
      if (qids.length) {
        const { data: opts } = await admin
          .from('survey_question_options')
          .select('id, question_id, label, value, position')
          .in('question_id', qids).order('position');
        for (const o of opts ?? []) (optsByQ[o.question_id] ||= []).push(o);
      }

      const { data: logic } = await admin
        .from('survey_logic_rules')
        .select('id, source_question_id, operator, compare_value, action, target_question_id, position, status')
        .eq('survey_id', survey.id).eq('status', 'aktiv').order('position');

      const { data: session } = await admin
        .from('survey_sessions').select('id, draft_answers')
        .eq('invitation_id', inv.id).maybeSingle();

      if (!inv.started_at) {
        await admin.from('survey_invitations')
          .update({ started_at: new Date().toISOString(), opened_at: new Date().toISOString(), status: 'gestartet' })
          .eq('id', inv.id);
      }
      if (!session) {
        await admin.from('survey_sessions').insert({
          survey_id: survey.id, invitation_id: inv.id, recipient_id: inv.recipient_id,
          language: survey.language, started_at: new Date().toISOString(), status: 'offen',
        });
      }

      let recipient: Record<string, unknown> | null = null;
      if (inv.recipient_id) {
        const { data: rec } = await admin
          .from('survey_recipients').select('*').eq('id', inv.recipient_id).maybeSingle();
        if (rec) {
          recipient = {
            name: (rec as any).name ?? (rec as any).contact_name ?? null,
            firma: (rec as any).company ?? (rec as any).company_name ?? null,
          };
        }
      }

      return json({
        survey,
        recipient,
        questions: (questions ?? []).map((q) => ({ ...q, options: optsByQ[q.id] ?? [] })),
        logic: logic ?? [],
        draft_answers: session?.draft_answers ?? {},
      });
    }

    if (action === 'save_draft') {
      await admin.from('survey_sessions')
        .update({ draft_answers: body?.answers ?? {}, last_seen_at: new Date().toISOString() })
        .eq('invitation_id', inv.id);
      return json({ ok: true });
    }

    if (action === 'submit') {
      if (inv.completed_at) return json({ error: 'already_submitted' }, 409);
      const answers = (body?.answers ?? {}) as Record<string, unknown>;

      const { data: questions } = await admin
        .from('survey_questions').select('id, qtype, label, points, weight').eq('survey_id', survey.id);
      const qmap = new Map((questions ?? []).map((q) => [q.id, q]));

      const now = new Date().toISOString();
      const { data: session } = await admin.from('survey_sessions').select('id, started_at').eq('invitation_id', inv.id).maybeSingle();
      const duration = session?.started_at
        ? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)) : null;

      let scoreSum = 0, scoreCount = 0, npsScore: number | null = null, critical = false;
      const items: Record<string, unknown>[] = [];

      for (const [qid, raw] of Object.entries(answers)) {
        const q = qmap.get(qid);
        if (!q) continue;
        const item: Record<string, unknown> = { question_id: qid, question_label: q.label, qtype: q.qtype, status: 'ok' };
        if (Array.isArray(raw)) item.value_json = raw;
        else if (typeof raw === 'boolean') item.value_bool = raw;
        else if (typeof raw === 'number') item.value_number = raw;
        else if (q.qtype === 'date') item.value_date = String(raw || '') || null;
        else if (['stars', 'scale10', 'nps', 'slider', 'number'].includes(q.qtype) && num(raw) !== null) item.value_number = num(raw);
        else item.value_text = String(raw ?? '').slice(0, 8000);

        const n = item.value_number as number | undefined;
        if (typeof n === 'number') {
          if (q.qtype === 'nps') { npsScore = n; if (n <= 6) critical = true; }
          if (q.qtype === 'stars') { scoreSum += n; scoreCount++; if (n <= 2) critical = true; }
          if (q.qtype === 'scale10' || q.qtype === 'slider') { scoreSum += n / 2; scoreCount++; if (n <= 4) critical = true; }
        }
        items.push(item);
      }

      const scoreTotal = scoreCount ? Number((scoreSum / scoreCount).toFixed(2)) : null;

      const { data: resp, error: respErr } = await admin.from('survey_responses').insert({
        survey_id: survey.id, session_id: session?.id ?? null, recipient_id: inv.recipient_id,
        language: survey.language, score_total: scoreTotal, nps_score: npsScore, is_critical: critical,
        started_at: session?.started_at ?? now, completed_at: now, duration_seconds: duration,
        status: 'abgeschlossen', reward_status: survey.reward_id ? 'offen' : 'keine',
      }).select().single();
      if (respErr) return json({ error: respErr.message }, 500);

      if (items.length) {
        await admin.from('survey_response_items').insert(items.map((i) => ({ ...i, response_id: resp.id })));
      }

      await admin.from('survey_invitations').update({ completed_at: now, status: 'abgeschlossen' }).eq('id', inv.id);
      await admin.from('survey_sessions').update({ completed_at: now, duration_seconds: duration, status: 'abgeschlossen' }).eq('invitation_id', inv.id);

      if (critical) {
        await admin.from('survey_alerts').insert({
          survey_id: survey.id, response_id: resp.id, recipient_id: inv.recipient_id,
          rule_name: 'negative_bewertung', severity: 'hoch',
          reason: 'Kritische Bewertung erkannt (Sterne ≤ 2, Skala ≤ 4 oder NPS ≤ 6)', status: 'offen',
        });
      }

      // Belohnung zuweisen
      let rewardOut: Record<string, unknown> | null = null;
      if (survey.reward_id) {
        const { data: reward } = await admin.from('survey_rewards').select('*').eq('id', survey.reward_id).maybeSingle();
        if (reward && reward.status === 'aktiv') {
          let codeText: string | null = reward.generic_code ?? null;
          let codeId: string | null = null;
          if (reward.code_mode === 'einmalig') {
            const { data: freeCode } = await admin.from('survey_reward_codes')
              .select('id, code').eq('reward_id', reward.id).is('assigned_to_recipient_id', null).limit(1).maybeSingle();
            if (freeCode) {
              codeText = freeCode.code; codeId = freeCode.id;
              await admin.from('survey_reward_codes').update({
                assigned_to_recipient_id: inv.recipient_id, assigned_at: now, status: 'vergeben',
              }).eq('id', freeCode.id);
            }
          }
          await admin.from('survey_reward_assignments').insert({
            survey_id: survey.id, reward_id: reward.id, recipient_id: inv.recipient_id, response_id: resp.id,
            code_id: codeId, code_text: codeText, issued_at: now, expires_at: reward.valid_to ?? null,
            status: 'freigeschaltet',
          });
          await admin.from('survey_responses').update({ reward_status: 'freigeschaltet' }).eq('id', resp.id);
          await admin.from('survey_rewards').update({ stock_used: (reward.stock_used ?? 0) + 1 }).eq('id', reward.id);
          rewardOut = { name: reward.name, description: reward.description, code: codeText };
        }
      }

      return json({ ok: true, reward: rewardOut });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'error' }, 500);
  }
});
