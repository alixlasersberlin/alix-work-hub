import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';
// Compliance & Governance Cockpit — PII redaction, consent audit, retention checks.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const sb = access.caller;
    const parsed = z.object({ op: z.enum(['redact', 'audit', 'log']).default('redact'), text: z.string().max(50000).optional(), retention_days: z.number().int().min(1).max(3650).optional(), contact_id: z.string().uuid().nullish(), conversation_id: z.string().uuid().nullish(), findings: z.array(z.object({ type: z.string().max(100), match: z.string().max(1000), start: z.number().int().nonnegative() })).max(1000).optional(), source: z.string().max(100).optional() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid compliance request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = parsed.data;
    const { op = 'redact' } = body;

    if (op === 'redact') {
      const result = redactPii(String(body.text ?? ''));
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'audit') {
      // Snapshot compliance posture: consent, recording retention, redaction coverage.
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
      // A referenced contact/conversation must be readable before storing a derived audit record.
      for (const [table, id] of [['ac_contacts', body.contact_id], ['ac_conversations', body.conversation_id]] as const) {
        if (!id) continue;
        const { data, error } = await sb.from(table).select('id,tenant_id').eq('id', id).in('tenant_id', access.tenants.map((t: any) => t.id)).maybeSingle();
        if (error || !data) return new Response(JSON.stringify({ error: 'Resource not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Log a redaction/compliance event to ac_predictions for the audit trail.
      const writer = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data, error } = await writer.from('ac_predictions').insert({
        contact_id: body.contact_id ?? null,
        kind: 'compliance_scan',
        score: Number(body.findings?.length ?? 0),
        risk_level: (body.findings?.length ?? 0) > 0 ? 'medium' : 'low',
        suggested_action: 'PII redaction applied',
        payload: { actor_id: access.user.id, manual_unverified: true, findings: body.findings ?? [], source: body.source ?? 'manual', conversation_id: body.conversation_id ?? null },
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
