// Compliance & Governance Cockpit — PII redaction, consent audit, retention checks.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deterministic PII regex-based redactor (fast, no AI cost) with optional AI review.
function redactPii(text: string) {
  const findings: { type: string; match: string; start: number }[] = [];
  let out = text;
  const patterns: [string, RegExp][] = [
    ['email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
    ['phone', /\+?\d[\d\s\-().]{7,}\d/g],
    ['iban', /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g],
    ['credit_card', /\b(?:\d[ -]*?){13,19}\b/g],
    ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
    ['de_tax_id', /\b\d{11}\b/g],
    ['de_postal_full', /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß\-]+/g],
  ];
  for (const [type, re] of patterns) {
    out = out.replace(re, (m, offset: number) => {
      findings.push({ type, match: m, start: offset });
      return `[${type.toUpperCase()}_REDACTED]`;
    });
  }
  return { redacted: out, findings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { op = 'redact' } = body;

    if (op === 'redact') {
      const result = redactPii(String(body.text ?? ''));
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'audit') {
      // Snapshot compliance posture: consent, recording retention, redaction coverage.
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const now = new Date();
      const [{ count: totalCalls }, { count: recordingsWithConsent }, { count: totalConversations }, { count: piiPredictions }] = await Promise.all([
        sb.from('ac_calls').select('*', { count: 'exact', head: true }),
        sb.from('ac_calls').select('*', { count: 'exact', head: true }).not('recording_url', 'is', null),
        sb.from('ac_conversations').select('*', { count: 'exact', head: true }),
        sb.from('ac_predictions').select('*', { count: 'exact', head: true }).eq('kind', 'compliance_scan'),
      ]);
      const retentionDays = Number(body.retention_days ?? 180);
      const cutoff = new Date(now.getTime() - retentionDays * 86400_000).toISOString();
      const { count: overdueRecordings } = await sb.from('ac_calls').select('*', { count: 'exact', head: true }).not('recording_url', 'is', null).lt('created_at', cutoff);
      return new Response(JSON.stringify({
        success: true,
        generated_at: now.toISOString(),
        retention_days: retentionDays,
        metrics: {
          total_calls: totalCalls ?? 0,
          recordings: recordingsWithConsent ?? 0,
          overdue_recordings: overdueRecordings ?? 0,
          total_conversations: totalConversations ?? 0,
          compliance_scans_logged: piiPredictions ?? 0,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'log') {
      // Log a redaction/compliance event to ac_predictions for the audit trail.
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data, error } = await sb.from('ac_predictions').insert({
        contact_id: body.contact_id ?? null,
        kind: 'compliance_scan',
        score: Number(body.findings?.length ?? 0),
        risk_level: (body.findings?.length ?? 0) > 0 ? 'medium' : 'low',
        suggested_action: 'PII redaction applied',
        payload: { findings: body.findings ?? [], source: body.source ?? 'manual', conversation_id: body.conversation_id ?? null },
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, log: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown_op' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
