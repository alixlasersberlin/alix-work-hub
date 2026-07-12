// Security Alert Notify — informiert Super Admins bei kritischen/hohen Findings
// Sammelt alle "open" Findings mit severity in (critical, high) seit lookback_minutes
// und schickt eine kombinierte E-Mail via Resend an alle aktiven Super Admins.
// Cooldown: pro Finding-ID nur alle 6h eine Mail.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM = 'Alix Security <alerts@alixwork.de>';
const COOLDOWN_HOURS = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let lookback = 60;
    try {
      const b = await req.json().catch(() => ({}));
      if (typeof b?.lookback_minutes === 'number') lookback = b.lookback_minutes;
    } catch { /* noop */ }

    const since = new Date(Date.now() - lookback * 60_000).toISOString();
    const { data: findings } = await admin
      .from('security_audit_findings')
      .select('*')
      .in('severity', ['critical', 'high'])
      .eq('status', 'open')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (!findings || findings.length === 0) {
      return json({ ok: true, sent: 0, reason: 'no critical/high findings' });
    }

    // Cooldown check via audit_logs
    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString();
    const { data: recentLogs } = await admin
      .from('audit_logs')
      .select('entity_id')
      .eq('action', 'security_alert_sent')
      .gte('created_at', cutoff);
    const alreadySent = new Set((recentLogs ?? []).map((r: any) => r.entity_id));
    const fresh = findings.filter((f: any) => !alreadySent.has(f.id));
    if (fresh.length === 0) return json({ ok: true, sent: 0, reason: 'all in cooldown' });

    // Recipients: Super Admins
    const { data: sa } = await admin
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .eq('roles.name', 'Super Admin');
    const uids = (sa ?? []).map((r: any) => r.user_id);
    const { data: profs } = await admin
      .from('user_profiles')
      .select('email, is_active')
      .in('id', uids)
      .eq('is_active', true);
    const recipients = (profs ?? []).map((p: any) => p.email).filter(Boolean);
    if (recipients.length === 0) return json({ ok: false, error: 'no super admin recipients' }, 400);

    const rows = fresh.map((f: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #333;color:${f.severity === 'critical' ? '#ff5555' : '#ff9955'};font-weight:600">${f.severity.toUpperCase()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #333">${escapeHtml(f.title)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #333;font-family:monospace;font-size:12px">${escapeHtml(f.target ?? '')}</td>
      </tr>
    `).join('');
    const html = `
      <div style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;padding:24px">
        <h2 style="color:#d4af37;margin:0 0 8px">🛡️ Alix Security Alert</h2>
        <p style="color:#999;margin:0 0 16px">${fresh.length} neue kritische/hohe Sicherheits-Findings.</p>
        <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #333">
          <thead><tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #d4af37">Severity</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #d4af37">Title</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #d4af37">Target</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;color:#999;font-size:12px">
          Details im <a href="https://alixwork.de/security-center/findings" style="color:#d4af37">Security Center</a>.
        </p>
      </div>`;

    if (!RESEND_API_KEY) return json({ ok: false, error: 'RESEND_API_KEY missing' }, 500);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM, to: recipients,
        subject: `🛡️ ${fresh.length} kritische Security-Findings`,
        html,
      }),
    });
    if (!res.ok) return json({ ok: false, error: `resend ${res.status}: ${await res.text()}` }, 500);

    // Log cooldown
    await admin.from('audit_logs').insert(fresh.map((f: any) => ({
      user_id: null, action: 'security_alert_sent',
      entity_type: 'security_finding', entity_id: f.id,
      metadata: { severity: f.severity, recipients: recipients.length },
    })));

    return json({ ok: true, sent: fresh.length, recipients: recipients.length });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function escapeHtml(s: string) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
