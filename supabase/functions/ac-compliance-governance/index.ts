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
      const tenantIds = access.tenants.map(t => t.id);
      const retentionDays = Number(body.retention_days ?? 180);
      const cutoff = new Date(now.getTime() - retentionDays * 86400_000).toISOString();
      // These tables have no declared contact FK, so PostgREST cannot embed them.
      // Materialize authorized contact IDs in complete small pages; never invent a join.
      const contactIds: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await sb.from('ac_contacts').select('id').in('tenant_id', tenantIds).order('id').range(offset, offset + 499);
        if (page.error) throw page.error;
        contactIds.push(...(page.data ?? []).map(c => c.id));
        if ((page.data?.length ?? 0) < 500) break;
      }
      let totalCalls = 0, recordingsWithConsent = 0, overdueRecordings = 0, piiPredictions = 0;
      for (let offset = 0; offset < contactIds.length; offset += 100) {
        const ids = contactIds.slice(offset, offset + 100);
        const results = await Promise.all([
          sb.from('ac_calls').select('id', { count: 'exact', head: true }).in('contact_id', ids),
          sb.from('ac_calls').select('id', { count: 'exact', head: true }).in('contact_id', ids).not('recording_url', 'is', null),
          sb.from('ac_calls').select('id', { count: 'exact', head: true }).in('contact_id', ids).not('recording_url', 'is', null).lt('created_at', cutoff),
          sb.from('ac_predictions').select('id', { count: 'exact', head: true }).in('contact_id', ids).eq('kind', 'compliance_scan'),
        ]);
        const failedResult = results.find(r => r.error);
        if (failedResult?.error) throw failedResult.error;
        totalCalls += results[0]?.count ?? 0;
        recordingsWithConsent += results[1]?.count ?? 0;
        overdueRecordings += results[2]?.count ?? 0;
        piiPredictions += results[3]?.count ?? 0;
      }
      const conversations = await sb.from('ac_conversations').select('id', { count: 'exact', head: true }).in('tenant_id', tenantIds);
      if (conversations.error) throw conversations.error;
      const totalConversations = conversations.count;
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
      let resolvedContact = body.contact_id ?? null;
      let contactTenant: string | null = null;
      for (const [table, id] of [['ac_contacts', body.contact_id], ['ac_conversations', body.conversation_id]] as const) {
        if (!id) continue;
        const result = table === 'ac_conversations'
          ? await sb.from('ac_conversations').select('id,tenant_id,contact_id').eq('id', id).in('tenant_id', access.tenants.map(t => t.id)).maybeSingle()
          : await sb.from('ac_contacts').select('id,tenant_id').eq('id', id).in('tenant_id', access.tenants.map(t => t.id)).maybeSingle();
        const { data, error } = result;
        if (error || !data || !access.tenants.some(t => t.id === data.tenant_id) || (contactTenant && contactTenant !== data.tenant_id)) return new Response(JSON.stringify({ error: 'Resource not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        contactTenant = data.tenant_id;
        if (table === 'ac_conversations') {
          const conversationContact = 'contact_id' in data ? data.contact_id : null;
          if (resolvedContact && conversationContact !== resolvedContact) return new Response(JSON.stringify({ error: 'Conversation and contact do not match' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          // Do not trust a relationship alone to authorize its contact.
          if (!resolvedContact && typeof conversationContact === 'string') {
            const linked = await sb.from('ac_contacts').select('id,tenant_id').eq('id', conversationContact).eq('tenant_id', data.tenant_id).maybeSingle();
            if (linked.error || !linked.data || linked.data.tenant_id !== data.tenant_id) return new Response(JSON.stringify({ error: 'Contact not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            resolvedContact = linked.data.id;
          }
        }
      }
      // Log a redaction/compliance event to ac_predictions for the audit trail.
      const writer = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data, error } = await writer.from('ac_predictions').insert({
        contact_id: resolvedContact,
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
