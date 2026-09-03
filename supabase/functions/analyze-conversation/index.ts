// ALIXWORK MOBILE – ALIX AI COMMUNICATION ASSISTANT (Prompt 5)
// Sichere serverseitige Analyse. Die KI schlaegt ausschliesslich vor:
// Es wird NIEMALS automatisch eine Nachricht an Kunden gesendet.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getProvider } from './provider.ts';
import {
  loadContext, renderContext, extractCandidates, resolveDevice, matchTicket,
} from './context.ts';
import {
  systemPrompt, PROMPT_VERSIONS, CATEGORIES, DEPARTMENTS, TONES,
  CLASSIFICATION_SCHEMA, REPLY_SCHEMA, SUMMARY_SCHEMA, QUESTIONS_SCHEMA,
  TRANSLATE_SCHEMA, ASK_SCHEMA, TICKET_SUMMARY_SCHEMA,
} from './prompts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type AnalysisType = 'CLASSIFICATION' | 'REPLY' | 'SUMMARY' | 'QUESTIONS' | 'TRANSLATE' | 'ASK' | 'TICKET_SUMMARY';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function flag(key: string, fallback: boolean) {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  return String(data.value).toLowerCase() === 'true';
}

async function audit(conversationId: string, type: string, userId: string | null, value: unknown) {
  await admin.from('ac_conversation_events').insert({
    conversation_id: conversationId, event_type: type, user_id: userId, new_value: value as any,
  });
}

const P1_SIGNALS = [
  'verletz', 'verbrenn', 'rauch', 'feuer', 'brennt', 'stromschlag', 'patient',
  'geruch', 'funken', 'kurzschluss', 'behandlung abgebrochen', 'abbrechen müssen', 'notfall',
];

function hasSafetySignal(text: string) {
  const t = text.toLowerCase();
  return P1_SIGNALS.some((s) => t.includes(s));
}

const FLAG_BY_TYPE: Record<AnalysisType, string> = {
  CLASSIFICATION: 'ai_classification_enabled',
  REPLY: 'ai_reply_enabled',
  SUMMARY: 'ai_summary_enabled',
  QUESTIONS: 'ai_reply_enabled',
  TRANSLATE: 'ai_translation_enabled',
  ASK: 'ai_summary_enabled',
  TICKET_SUMMARY: 'ai_summary_enabled',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  const started = Date.now();
  let conversationId = '';
  let userId: string | null = null;

  try {
    // 1) Auth – Identitaet nie aus dem Client uebernehmen
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
    userId = auth.user.id;

    const { data: profile } = await admin.from('user_profiles')
      .select('id, is_active').eq('id', userId).maybeSingle();
    if (!profile || profile.is_active === false) return json({ ok: false, error: 'Kein aktives Mitarbeiterprofil.' }, 403);

    const body = await req.json().catch(() => ({}));
    conversationId = String(body.conversation_id ?? '');
    const analysisType = String(body.analysis_type ?? 'CLASSIFICATION').toUpperCase() as AnalysisType;
    if (!conversationId) return json({ ok: false, error: 'conversation_id fehlt.' }, 400);
    if (!FLAG_BY_TYPE[analysisType]) return json({ ok: false, error: 'analysis_type ungueltig.' }, 400);

    // 2) Feature Flags
    if (!(await flag('ai_enabled', true))) return json({ ok: false, error: 'ALIX AI ist deaktiviert.', code: 'AI_DISABLED' }, 200);
    if (!(await flag(FLAG_BY_TYPE[analysisType], true))) {
      return json({ ok: false, error: 'Diese AI-Funktion ist deaktiviert.', code: 'AI_FEATURE_DISABLED' }, 200);
    }

    // 3) Zugriffspruefung ueber RLS des Mitarbeiters (Konversation lesbar?)
    const { data: allowed } = await userClient.from('ac_conversations').select('id').eq('id', conversationId).maybeSingle();
    if (!allowed) return json({ ok: false, error: 'Kein Zugriff auf diese Conversation.' }, 403);

    const provider = getProvider();
    if (!provider.isConfigured()) {
      return json({ ok: false, error: 'ALIX AI derzeit nicht verfuegbar (Provider nicht konfiguriert).', code: 'AI_PROVIDER_NOT_CONFIGURED' }, 200);
    }

    const ctx = await loadContext(admin, conversationId);
    if (!ctx.messages.length) return json({ ok: false, error: 'Keine Nachrichten zur Analyse vorhanden.' }, 200);

    // 4) AI-Cache: gleiche Nachrichtenbasis nicht erneut analysieren
    const lastMsgId = ctx.messages[ctx.messages.length - 1].id;
    if (analysisType === 'CLASSIFICATION' && !body.force) {
      const { data: cached } = await admin.from('ai_classifications')
        .select('*').eq('conversation_id', conversationId)
        .eq('classification_type', 'CLASSIFICATION').eq('status', 'COMPLETED')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (cached && (cached.metadata as any)?.last_message_id === lastMsgId) {
        return json({ ok: true, cached: true, classification: cached });
      }
    }

    await audit(conversationId, 'AI_ANALYSIS_STARTED', userId, { analysis_type: analysisType });

    const contextText = renderContext(ctx);
    const lastText = ctx.lastCustomerMessage?.body ?? '';
    const safety = hasSafetySignal(lastText || contextText);

    // ---------- CLASSIFICATION ----------
    if (analysisType === 'CLASSIFICATION') {
      const result = await provider.run({
        system: systemPrompt(
          'Analysiere die Konversation und liefere eine strukturierte Einschaetzung.\n' +
          'reasoning_summary: EIN kurzer fachlicher Satz zur Begruendung (kein interner Denkprozess).\n' +
          'reply_draft: hoeflicher Antwortvorschlag in der Sprache des Kunden, ohne Zusagen.\n' +
          (safety ? 'ACHTUNG: Sicherheitsrelevante Begriffe erkannt – Prioritaet P1 pruefen und Hinweis auf menschliche Pruefung geben.\n' : ''),
        ),
        user: contextText,
        schema: CLASSIFICATION_SCHEMA,
      });

      if (!result.ok || !result.json) {
        await admin.from('ai_classifications').insert({
          conversation_id: conversationId, message_id: lastMsgId, classification_type: 'CLASSIFICATION',
          status: 'FAILED', model_name: provider.model, prompt_version: PROMPT_VERSIONS.CLASSIFICATION,
          metadata: { error: result.error ?? 'NO_JSON', latency_ms: result.latency_ms, last_message_id: lastMsgId },
        });
        await audit(conversationId, 'AI_ANALYSIS_FAILED', userId, { error: result.error, status: result.status });
        return json({ ok: false, error: 'ALIX AI derzeit nicht verfuegbar.', code: result.error }, 200);
      }

      const r = result.json as any;
      // 5) Output-Validierung – keine beliebigen Werte akzeptieren
      const category = CATEGORIES.includes(String(r.category)) ? String(r.category) : 'OTHER';
      let priority = ['P1', 'P2', 'P3', 'P4'].includes(String(r.priority)) ? String(r.priority) : 'P3';
      if (safety && priority !== 'P1') priority = 'P1';
      const clamp = (n: unknown) => {
        const v = typeof n === 'number' ? (n > 1 ? n / 100 : n) : 0;
        return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
      };
      const department = DEPARTMENTS.includes(String(r.suggested_department)) ? String(r.suggested_department) : 'SERVICE';

      const cand = extractCandidates(contextText);
      const dev = await resolveDevice(admin, ctx, cand.serials, r.detected_serial_number ?? null);
      const errorCodes: string[] = Array.from(new Set([
        ...(Array.isArray(r.error_codes) ? r.error_codes.map((c: unknown) => String(c).toUpperCase()) : []),
        ...cand.errors,
      ])).slice(0, 10);

      const ticketMatch = (await flag('ai_ticket_detection_enabled', true))
        ? matchTicket(ctx, { serial: dev.serial, category, errorCodes, problem: String(r.summary ?? '') })
        : null;

      const row = {
        conversation_id: conversationId,
        message_id: lastMsgId,
        classification_type: 'CLASSIFICATION',
        category,
        priority,
        confidence: clamp(r.category_confidence),
        detected_customer_id: ctx.customer?.id ?? null,
        detected_device_id: dev.device?.id ?? null,
        detected_serial_number: dev.serial,
        detected_ticket_id: ticketMatch?.ticket.id ?? null,
        summary: String(r.summary ?? '').slice(0, 4000),
        reasoning_summary: String(r.reasoning_summary ?? '').slice(0, 600),
        suggested_action: String(r.suggested_action ?? '').slice(0, 1000),
        model_name: provider.model,
        prompt_version: PROMPT_VERSIONS.CLASSIFICATION,
        status: 'COMPLETED',
        metadata: {
          last_message_id: lastMsgId,
          latency_ms: result.latency_ms,
          language: r.language ?? null,
          alternative_category: r.alternative_category ?? null,
          priority_confidence: clamp(r.priority_confidence),
          device_confidence: dev.confidence,
          device_ambiguous: dev.ambiguous,
          device_options: dev.options?.map((d: any) => ({ id: d.id, model_name: d.model_name, serial_number: d.serial_number })) ?? [],
          detected_error_codes: errorCodes,
          missing_information: Array.isArray(r.missing_information) ? r.missing_information.slice(0, 8) : [],
          risk_flags: Array.isArray(r.risk_flags) ? r.risk_flags.slice(0, 8) : [],
          safety_signal: safety,
          sentiment: r.sentiment ?? 'UNKLAR',
          entities: r.entities ?? null,
          sales: r.sales ?? null,
          technical: r.technical ?? null,
          suggested_department: department,
          ticket_match: ticketMatch ? { id: ticketMatch.ticket.id, number: ticketMatch.ticket.number, title: ticketMatch.ticket.title, similarity: Math.round(ticketMatch.score * 100) } : null,
          reply_draft: String(r.reply_draft ?? '').slice(0, 3000),
          duplicate_hint: ticketMatch ? 'Moeglicher Folgekontakt zu bestehendem Vorgang.' : null,
        },
      };

      const { data: saved, error: insErr } = await admin.from('ai_classifications').insert(row).select('*').single();
      if (insErr) throw insErr;

      await audit(conversationId, 'AI_ANALYSIS_COMPLETED', userId, {
        analysis_type: 'CLASSIFICATION', category, priority, latency_ms: result.latency_ms,
      });
      return json({ ok: true, classification: saved });
    }

    // ---------- Übrige Analysearten ----------
    const tone = TONES[String(body.tone ?? 'PROFESSIONELL').toUpperCase()] ? String(body.tone).toUpperCase() : 'PROFESSIONELL';
    const language = body.language ? String(body.language).slice(0, 30) : null;

    let system = '';
    let user = contextText;
    let schema: any = null;

    if (analysisType === 'REPLY') {
      system = systemPrompt(
        `Formuliere EINEN Antwortvorschlag an den Kunden. Tonalitaet: ${TONES[tone]}.\n` +
        (language ? `Antworte auf ${language}.\n` : 'Antworte in der Sprache des Kunden.\n') +
        'Keine Termin-, Garantie-, Kulanz- oder Preiszusagen. Keine internen Informationen weitergeben.\n' +
        'Der Text wird NICHT automatisch gesendet, sondern von einem Mitarbeiter geprueft.',
      );
      schema = REPLY_SCHEMA;
    } else if (analysisType === 'SUMMARY') {
      system = systemPrompt('Erstelle eine kurze strukturierte interne Zusammenfassung. Unbekanntes: "Nicht bekannt".');
      schema = SUMMARY_SCHEMA;
    } else if (analysisType === 'QUESTIONS') {
      system = systemPrompt(
        'Ermittle, welche Informationen zur Bearbeitung fehlen, und formuliere daraus EINE professionelle Rueckfrage an den Kunden ' +
        '(wird nicht automatisch gesendet).',
      );
      schema = QUESTIONS_SCHEMA;
    } else if (analysisType === 'TRANSLATE') {
      system = systemPrompt(
        'Uebersetze die letzte Kundennachricht fuer den INTERNEN Gebrauch ins Deutsche ' +
        (language ? `bzw. nach ${language}. ` : '. ') + 'Keine Interpretation, keine Ergaenzungen.',
      );
      user = `${contextText}\n\nZu uebersetzen (letzte Kundennachricht):\n${lastText}`;
      schema = TRANSLATE_SCHEMA;
    } else if (analysisType === 'ASK') {
      const question = String(body.question ?? '').slice(0, 500);
      if (!question) return json({ ok: false, error: 'Frage fehlt.' }, 400);
      system = systemPrompt(
        'Beantworte die interne Mitarbeiterfrage ausschliesslich anhand des gelieferten Kontexts. ' +
        'Wenn die Antwort nicht im Kontext steht: "Nicht bekannt". Nenne in sources die verwendeten Kontextquellen.',
      );
      user = `${contextText}\n\nINTERNE MITARBEITERFRAGE:\n${question}`;
      schema = ASK_SCHEMA;
    } else if (analysisType === 'TICKET_SUMMARY') {
      system = systemPrompt(
        'Erzeuge Titel und Beschreibung fuer ein internes Ticket. Titel kurz (max. 80 Zeichen). ' +
        'Beschreibung mit Problem, Geraet, Seriennummer, Fehlercode, bisherigen Schritten und offenen Fragen. ' +
        'Nur belegte Angaben, sonst "Noch zu klaeren".',
      );
      schema = TICKET_SUMMARY_SCHEMA;
    }

    const res = await provider.run({ system, user, schema });
    if (!res.ok || !res.json) {
      await audit(conversationId, 'AI_ANALYSIS_FAILED', userId, { analysis_type: analysisType, error: res.error });
      return json({ ok: false, error: 'ALIX AI derzeit nicht verfuegbar.', code: res.error }, 200);
    }

    const versionKey = PROMPT_VERSIONS[analysisType];
    const { data: saved } = await admin.from('ai_classifications').insert({
      conversation_id: conversationId,
      message_id: lastMsgId,
      classification_type: analysisType,
      status: 'COMPLETED',
      model_name: provider.model,
      prompt_version: versionKey,
      summary: analysisType === 'SUMMARY' ? String((res.json as any).problem ?? '').slice(0, 2000) : null,
      metadata: { ...(res.json as any), latency_ms: res.latency_ms, tone, last_message_id: lastMsgId },
    }).select('*').single();

    await audit(conversationId, analysisType === 'REPLY' ? 'AI_REPLY_GENERATED' : 'AI_ANALYSIS_COMPLETED', userId, {
      analysis_type: analysisType, latency_ms: res.latency_ms,
    });
    return json({ ok: true, analysis_type: analysisType, result: res.json, record_id: saved?.id ?? null });
  } catch (e) {
    // Technisches Log ohne Nachrichtentexte
    console.error('analyze-conversation failed', {
      conversation_id: conversationId, latency_ms: Date.now() - started, error: String((e as Error).message),
    });
    if (conversationId) await audit(conversationId, 'AI_ANALYSIS_FAILED', userId, { error: String((e as Error).message) });
    return json({ ok: false, error: 'Analyse fehlgeschlagen.' }, 200);
  }
});
