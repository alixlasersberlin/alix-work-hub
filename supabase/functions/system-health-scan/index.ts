import "../_shared/global-bcc.ts";
// ALIXWORK System Health Scan
// Täglicher Health-/Sicherheits-/Performance-Scan.
// - Sammelt Datenbank-Kennzahlen, langsame Abfragen, Tabellen-/Indexstatistik
// - Prüft Hintergrundprozesse (Cronjobs), Edge-Function-Fehler, Backups, Sicherheit
// - Führt NUR risikoarme Wartung automatisch aus (mode=auto)
// - Strukturelle Vorschläge (Indizes etc.) landen als Freigabe-Anfrage
// Aufruf: Cron (03:00 UTC) oder manuell durch Super Admin.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM = 'Alix Lasers ® <alerts@alixwork.de>';

type Finding = {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail?: string;
  recommendation?: string;
  target?: string;
  metric?: number;
  needs_approval?: boolean;
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function isSuperAdmin(req: Request, admin: ReturnType<typeof createClient>) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return false;
  const { data } = await admin.from('user_roles').select('roles:role_id(name)').eq('user_id', user.id);
  return (data ?? []).some((r: any) => r.roles?.name === 'Super Admin');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({} as any));
  const trigger: string = body?.trigger === 'manual' ? 'manual' : 'cron';
  const cronSecret = req.headers.get('x-cron-secret');
  const autoFixEnabled = body?.autofix !== false;

  // Manuelle Aufrufe nur für Super Admins
  if (trigger === 'manual' && !cronSecret) {
    if (!(await isSuperAdmin(req, admin))) return json({ error: 'forbidden' }, 403);
  }

  const { data: run, error: runErr } = await admin
    .from('sys_health_runs')
    .insert({ trigger, status: 'running' })
    .select('id')
    .single();
  if (runErr || !run) return json({ error: runErr?.message ?? 'run insert failed' }, 500);
  const runId = (run as any).id as string;

  const findings: Finding[] = [];
  let autoActions: unknown[] = [];
  let metrics: any = {};

  try {
    // ---------- 1) Datenbank-Kennzahlen ----------
    const { data: m } = await admin.rpc('sys_health_metrics' as any);
    metrics = m ?? {};

    const cacheHit = Number(metrics.cache_hit_ratio ?? 1);
    if (cacheHit < 0.95) {
      findings.push({
        category: 'database', severity: cacheHit < 0.9 ? 'high' : 'medium',
        title: `Cache-Trefferquote nur ${(cacheHit * 100).toFixed(1)} %`,
        detail: 'Häufige Lesezugriffe gehen auf die Festplatte statt in den Arbeitsspeicher.',
        recommendation: 'Größe der Instanz bzw. Indizes und Abfragen prüfen (Freigabe erforderlich).',
        metric: cacheHit,
      });
    }

    const conn = Number(metrics.connections ?? 0);
    const connMax = Number(metrics.connections_max ?? 100);
    const connPct = connMax ? conn / connMax : 0;
    if (connPct > 0.8) {
      findings.push({
        category: 'connections', severity: connPct > 0.9 ? 'critical' : 'high',
        title: `Datenbankverbindungen bei ${(connPct * 100).toFixed(0)} %`,
        detail: `${conn} von ${connMax} Verbindungen belegt.`,
        recommendation: 'Connection Pooling (Supavisor) und Poolgröße prüfen.',
        metric: connPct,
      });
    }
    if (Number(metrics.long_running ?? 0) > 0) {
      findings.push({
        category: 'database', severity: 'high',
        title: `${metrics.long_running} lang laufende Abfragen (> 60 s)`,
        recommendation: 'Abfragen im Performance Center analysieren.',
        metric: Number(metrics.long_running),
      });
    }
    if (Number(metrics.blocked ?? 0) > 0) {
      findings.push({
        category: 'database', severity: 'medium',
        title: `${metrics.blocked} blockierte Datenbankprozesse`,
        recommendation: 'Sperren prüfen, ggf. Transaktionen verkürzen.',
        metric: Number(metrics.blocked),
      });
    }

    for (const t of (metrics.seq_scan_heavy ?? []) as any[]) {
      findings.push({
        category: 'index', severity: 'medium', target: t.table_name,
        title: `Tabelle ${t.table_name} wird überwiegend vollständig gescannt`,
        detail: `${t.seq_scan} vollständige Scans, ${t.idx_scan ?? 0} Index-Zugriffe, ${t.n_live_tup} Datensätze.`,
        recommendation: 'Passenden Index prüfen — Anlage nur nach Freigabe.',
        metric: Number(t.seq_scan), needs_approval: true,
      });
    }
    for (const i of (metrics.unused_indexes ?? []) as any[]) {
      findings.push({
        category: 'index', severity: 'low', target: `${i.table_name}.${i.index_name}`,
        title: `Index ${i.index_name} wird kaum genutzt`,
        detail: `${i.idx_scan} Zugriffe, ${(Number(i.index_bytes) / 1048576).toFixed(1)} MB.`,
        recommendation: 'Löschen nur nach Freigabe prüfen.', needs_approval: true,
      });
    }
    const rlsMissing = (metrics.rls_missing ?? []) as string[];
    if (rlsMissing.length) {
      findings.push({
        category: 'security', severity: 'high',
        title: `${rlsMissing.length} Tabellen ohne Row Level Security`,
        detail: rlsMissing.slice(0, 20).join(', '),
        recommendation: 'RLS aktivieren — nur nach Freigabe.', needs_approval: true,
      });
    }

    // ---------- 2) Langsame Abfragen ----------
    let slowCount = 0;
    try {
      const { data: slow } = await admin.rpc('perf_slow_queries' as any, { _limit: 20 });
      const list = (slow ?? []) as any[];
      slowCount = list.filter((q) => Number(q.mean_ms) > 1000).length;
      for (const q of list.filter((q) => Number(q.mean_ms) > 1000).slice(0, 10)) {
        findings.push({
          category: 'query', severity: Number(q.mean_ms) > 5000 ? 'high' : 'medium',
          title: `Langsame Abfrage (Ø ${Math.round(Number(q.mean_ms))} ms)`,
          detail: String(q.query ?? '').slice(0, 500),
          recommendation: 'Abfrage optimieren, Ergebnismenge begrenzen oder Index prüfen.',
          metric: Number(q.mean_ms),
        });
      }
    } catch { /* pg_stat_statements evtl. nicht verfügbar */ }

    // ---------- 3) Hintergrundprozesse / Cronjobs ----------
    let cronFailed = 0;
    try {
      const { data: cron } = await admin.rpc('sys_cron_recent_failures' as any);
      cronFailed = Array.isArray(cron) ? cron.length : 0;
    } catch { /* optional */ }
    if (cronFailed > 0) {
      findings.push({
        category: 'jobs', severity: 'high',
        title: `${cronFailed} fehlgeschlagene Hintergrundprozesse (24 h)`,
        recommendation: 'Cronjob-Protokolle prüfen und Prozesse erneut starten.',
        metric: cronFailed,
      });
    }

    // ---------- 4) Backups ----------
    let backupOk = true;
    try {
      const { data: bk } = await admin
        .from('backups_metadata').select('backup_status, created_at, completed_at')
        .order('created_at', { ascending: false }).limit(1);
      const last = (bk ?? [])[0] as any;
      const ts = last ? new Date(last.completed_at ?? last.created_at).getTime() : 0;
      const stale = !last || ts < Date.now() - 48 * 3600_000;
      const ok = ['success', 'completed', 'erfolgreich'].includes(String(last?.backup_status ?? '').toLowerCase());
      backupOk = !!last && ok && !stale;
      if (!backupOk) {
        findings.push({
          category: 'backup', severity: 'critical',
          title: !last
            ? 'Keine Sicherung gefunden'
            : stale
              ? `Letzte Sicherung älter als 48 Stunden (${new Date(ts).toLocaleString('de-DE')})`
              : `Letzte Sicherung: ${last.backup_status}`,
          recommendation: 'Datensicherung sofort prüfen.',
        });
      }
    } catch { /* Tabelle optional */ }

    // ---------- 5) Sicherheit ----------
    let openCritical = 0;
    try {
      const { data: sec } = await admin
        .from('security_audit_findings').select('id, severity')
        .eq('status', 'open').in('severity', ['critical', 'high']);
      openCritical = (sec ?? []).length;
      if (openCritical > 0) {
        findings.push({
          category: 'security', severity: 'high',
          title: `${openCritical} offene Sicherheits-Findings (kritisch/hoch)`,
          recommendation: 'Im Security Center bearbeiten.', metric: openCritical,
        });
      }
    } catch { /* optional */ }

    // ---------- 6) Fehlgeschlagene Logins ----------
    let failedLogins = 0;
    try {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await admin
        .from('audit_sessions').select('id', { count: 'exact', head: true })
        .gte('created_at', since).eq('status', 'failed');
      failedLogins = count ?? 0;
    } catch { /* optional */ }
    if (failedLogins > 25) {
      findings.push({
        category: 'security', severity: 'high',
        title: `${failedLogins} fehlgeschlagene Anmeldungen in 24 h`,
        recommendation: 'Auf Angriffsversuche prüfen.', metric: failedLogins,
      });
    }

    // ---------- 7) Risikoarme Wartung ----------
    if (autoFixEnabled) {
      try {
        const { data: fixed, error: fixErr } = await admin.rpc('sys_health_autofix' as any);
        if (fixErr) autoActions = [{ action: 'autofix', ok: false, error: fixErr.message }];
        else autoActions = Array.isArray(fixed) ? fixed : [{ action: 'autofix', ok: true, result: fixed }];
      } catch (e) {
        autoActions = [{ action: 'autofix', ok: false, error: String(e) }];
      }
    }

    // ---------- 8) Bewertung ----------
    const pen = (sev: Finding['severity']) => (sev === 'critical' ? 25 : sev === 'high' ? 10 : sev === 'medium' ? 4 : sev === 'low' ? 1 : 0);
    const totalPenalty = findings.reduce((s, f) => s + pen(f.severity), 0);
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    const areaScore = (cat: string, base = 100) =>
      Math.max(0, base - findings.filter((f) => f.category === cat).reduce((s, f) => s + pen(f.severity), 0));

    const breakdown = {
      datenbank: areaScore('database'),
      abfragen: areaScore('query'),
      indizes: areaScore('index'),
      verbindungen: areaScore('connections'),
      hintergrundprozesse: areaScore('jobs'),
      sicherheit: areaScore('security'),
      backup: backupOk ? 100 : 0,
    };

    // ---------- 9) Speichern ----------
    if (findings.length) {
      await admin.from('sys_health_findings').insert(
        findings.map((f) => ({
          run_id: runId, category: f.category, severity: f.severity, title: f.title,
          detail: f.detail ?? null, recommendation: f.recommendation ?? null,
          target: f.target ?? null, metric: f.metric ?? null, needs_approval: !!f.needs_approval,
        })),
      );
    }

    // Freigabe-Anfragen für strukturelle Vorschläge (ohne Duplikate)
    // Wichtig: auch bereits bearbeitete (approved/rejected/applied) Titel werden
    // 90 Tage lang nicht erneut vorgeschlagen – sonst kommen die gleichen
    // Anzeigen nach jedem Scan wieder.
    const approvalCandidates = findings.filter((f) => f.needs_approval);
    if (approvalCandidates.length) {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pending } = await admin
        .from('sys_health_approvals')
        .select('title, status, created_at')
        .or(`status.eq.pending,created_at.gte.${since}`);
      const known = new Set((pending ?? []).map((p: any) => p.title));
      const rows = approvalCandidates
        .filter((f) => !known.has(f.title))
        .map((f) => ({
          action_type: f.category === 'index' ? 'index_change' : 'security_change',
          title: f.title, description: f.detail ?? null,
          sql_preview: f.category === 'index' && f.target && !f.target.includes('.')
            ? `-- Vorschlag: CREATE INDEX ON public.${f.target} (<spalten>);`
            : null,
          risk: f.severity === 'high' ? 'high' : 'medium',
        }));
      if (rows.length) await admin.from('sys_health_approvals').insert(rows);
    }

    const summary = [
      `${findings.filter((f) => f.category === 'query').length} langsame Abfragen`,
      `${findings.filter((f) => f.category === 'index').length} Index-Hinweise`,
      `${cronFailed} fehlgeschlagene Hintergrundprozesse`,
      `${openCritical} offene Sicherheits-Findings`,
      backupOk ? 'Backupstatus erfolgreich' : 'Backup fehlgeschlagen',
    ].join(' · ');

    await admin.from('sys_health_runs').update({
      finished_at: new Date().toISOString(), status: 'done',
      score, metrics, breakdown, auto_actions: autoActions, summary,
    }).eq('id', runId);

    // ---------- 10) Warnung bei kritischen Problemen ----------
    const critical = findings.filter((f) => f.severity === 'critical');
    if ((critical.length > 0 || score < 50) && RESEND_API_KEY) {
      try {
        const { data: sa } = await admin.from('user_roles').select('user_id, roles!inner(name)').eq('roles.name', 'Super Admin');
        const uids = (sa ?? []).map((r: any) => r.user_id);
        const { data: profs } = await admin.from('user_profiles').select('email').in('id', uids).eq('is_active', true);
        const to = (profs ?? []).map((p: any) => p.email).filter(Boolean);
        if (to.length) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: FROM, to,
              subject: `⚠️ AlixWork Systemzustand ${score}/100`,
              html: `<div style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;padding:24px">
                <h2 style="color:#d4af37;margin:0 0 8px">AlixWork Systemprüfung</h2>
                <p style="margin:0 0 12px">Systemzustand: <b>${score} von 100</b></p>
                <p style="color:#999">${summary}</p>
                <ul>${critical.map((c) => `<li>${c.title}</li>`).join('')}</ul>
                <p style="font-size:12px;color:#999">Details im System Health Center.</p></div>`,
            }),
          });
        }
      } catch { /* Mailversand darf den Scan nicht abbrechen */ }
    }

    return json({ ok: true, run_id: runId, score, findings: findings.length, auto_actions: autoActions, summary });
  } catch (e: any) {
    await admin.from('sys_health_runs').update({
      status: 'error', finished_at: new Date().toISOString(), summary: e?.message ?? String(e),
    }).eq('id', runId);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});