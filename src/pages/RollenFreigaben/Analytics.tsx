import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Download, Loader2, ShieldCheck, Users, Clock,
  ClipboardCheck, AlertTriangle, TrendingUp, FileDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { CRITICAL_ROLE_NAMES, levelClasses, levelLabel } from './lib';
import { toast } from 'sonner';

type Data = {
  roles: any[];
  users: any[];
  userRoles: any[];
  tenants: any[];
  userTenants: any[];
  requests: any[];
  tempGrants: any[];
  audit: any[];
  recert: any[];
};

const COLORS = ['hsl(var(--primary))', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

function toCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    (async () => {
      const [roles, users, ur, tenants, uta, req, tg, au, rc] = await Promise.all([
        supabase.from('roles').select('id, name, description'),
        supabase.from('user_profiles').select('id, full_name, is_active, account_status, department_id'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('tenants').select('id, code, name, country'),
        supabase.from('user_tenant_access').select('user_id, tenant_id'),
        (supabase as any).from('role_change_requests').select('id, status, urgency, created_at, decided_at, applied_at'),
        (supabase as any).from('role_temporary_grants').select('id, user_id, role_id, status, valid_until, granted_at'),
        (supabase as any).from('role_audit_log').select('id, action, created_at').order('created_at', { ascending: false }).limit(1000),
        (supabase as any).from('role_recert_items').select('id, decision, decided_at, campaign_id'),
      ]);
      setD({
        roles: roles.data ?? [],
        users: users.data ?? [],
        userRoles: ur.data ?? [],
        tenants: tenants.data ?? [],
        userTenants: uta.data ?? [],
        requests: req.data ?? [],
        tempGrants: tg.data ?? [],
        audit: au.data ?? [],
        recert: rc.data ?? [],
      });
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    if (!d) return null;
    const decided = d.requests.filter((r: any) => r.decided_at);
    const avgHours = decided.length
      ? decided.reduce((s: number, r: any) => s + (new Date(r.decided_at).getTime() - new Date(r.created_at).getTime()) / 3600000, 0) / decided.length
      : 0;
    const criticalRoleIds = new Set(d.roles.filter(r => CRITICAL_ROLE_NAMES.has(r.name)).map(r => r.id));
    const usersWithCritical = new Set(d.userRoles.filter((r: any) => criticalRoleIds.has(r.role_id)).map((r: any) => r.user_id)).size;
    const recertDone = d.recert.filter((r: any) => r.decision).length;
    const recertRate = d.recert.length ? Math.round((recertDone / d.recert.length) * 100) : 0;
    return {
      totalRoles: d.roles.length,
      totalUsers: d.users.filter((u: any) => u.is_active).length,
      openRequests: d.requests.filter((r: any) => r.status === 'open').length,
      approvedRequests: d.requests.filter((r: any) => r.status === 'approved' || r.status === 'applied').length,
      avgApprovalHours: avgHours.toFixed(1),
      criticalUsers: usersWithCritical,
      activeTempGrants: d.tempGrants.filter((t: any) => t.status === 'active').length,
      recertRate,
    };
  }, [d]);

  const roleDistribution = useMemo(() => {
    if (!d) return [];
    return d.roles
      .map(r => ({
        name: r.name,
        count: d.userRoles.filter((ur: any) => ur.role_id === r.id).length,
        critical: CRITICAL_ROLE_NAMES.has(r.name),
      }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [d]);

  const tenantDistribution = useMemo(() => {
    if (!d) return [];
    return d.tenants.map((t: any) => ({
      name: `${t.code} · ${t.country ?? ''}`.trim(),
      count: d.userTenants.filter((ut: any) => ut.tenant_id === t.id).length,
    })).filter(x => x.count > 0);
  }, [d]);

  const requestsTrend = useMemo(() => {
    if (!d) return [];
    const byMonth: Record<string, { month: string; open: number; approved: number; rejected: number }> = {};
    d.requests.forEach((r: any) => {
      const m = (r.created_at ?? '').slice(0, 7);
      if (!m) return;
      byMonth[m] ??= { month: m, open: 0, approved: 0, rejected: 0 };
      if (r.status === 'approved' || r.status === 'applied') byMonth[m].approved++;
      else if (r.status === 'rejected') byMonth[m].rejected++;
      else byMonth[m].open++;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [d]);

  const auditActivity = useMemo(() => {
    if (!d) return [];
    const byDay: Record<string, number> = {};
    d.audit.forEach((a: any) => {
      const day = (a.created_at ?? '').slice(0, 10);
      if (!day) return;
      byDay[day] = (byDay[day] ?? 0) + 1;
    });
    return Object.entries(byDay).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
  }, [d]);

  const riskHeatmap = useMemo(() => {
    if (!d) return [];
    return d.roles.map(r => {
      const users = d.userRoles.filter((ur: any) => ur.role_id === r.id).length;
      const critical = CRITICAL_ROLE_NAMES.has(r.name);
      let risk = users > 20 ? 3 : users > 5 ? 2 : users > 0 ? 1 : 0;
      if (critical) risk = Math.min(4, risk + 2);
      const level = risk >= 4 ? 'critical' : risk >= 3 ? 'risk' : risk >= 2 ? 'review' : 'safe';
      return { name: r.name, users, critical, level: level as any };
    }).sort((a, b) => (b.users + (b.critical ? 100 : 0)) - (a.users + (a.critical ? 100 : 0)));
  }, [d]);

  function exportKpisPdf() {
    if (!kpis) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Rollen & Freigaben – Analytics</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}
    h1{margin:0 0 4px 0}h2{margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px}
    .k{border:1px solid #ddd;border-radius:8px;padding:12px}.v{font-size:24px;font-weight:700}
    .l{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}
    .muted{color:#666;font-size:11px}</style></head><body>
    <h1>Rollen &amp; Freigaben – Analytics-Bericht</h1>
    <div class="muted">Erstellt: ${new Date().toLocaleString('de-DE')}</div>
    <h2>Kennzahlen</h2><div class="grid">
    ${[
      ['Aktive Rollen', kpis.totalRoles],
      ['Aktive Benutzer', kpis.totalUsers],
      ['Offene Anträge', kpis.openRequests],
      ['Genehmigte Anträge', kpis.approvedRequests],
      ['Ø Freigabedauer (h)', kpis.avgApprovalHours],
      ['Benutzer mit kritischer Rolle', kpis.criticalUsers],
      ['Aktive Zeit-Grants', kpis.activeTempGrants],
      ['Rezertifizierungs-Quote', kpis.recertRate + ' %'],
    ].map(([l, v]) => `<div class="k"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
    </div>
    <h2>Rollenverteilung (Top 12)</h2>
    <table><thead><tr><th>Rolle</th><th>Benutzer</th><th>Kritisch</th></tr></thead><tbody>
    ${roleDistribution.map(r => `<tr><td>${r.name}</td><td>${r.count}</td><td>${r.critical ? 'Ja' : '—'}</td></tr>`).join('')}
    </tbody></table>
    <h2>Risiko-Heatmap</h2>
    <table><thead><tr><th>Rolle</th><th>Benutzer</th><th>Stufe</th></tr></thead><tbody>
    ${riskHeatmap.slice(0, 20).map(r => `<tr><td>${r.name}</td><td>${r.users}</td><td>${levelLabel(r.level)}</td></tr>`).join('')}
    </tbody></table>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  if (loading || !d || !kpis) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Analytics…</div>;
  }

  const kpiCards = [
    { label: 'Aktive Rollen', value: kpis.totalRoles, icon: ShieldCheck, tone: 'good' },
    { label: 'Aktive Benutzer', value: kpis.totalUsers, icon: Users, tone: 'good' },
    { label: 'Offene Anträge', value: kpis.openRequests, icon: ClipboardCheck, tone: kpis.openRequests ? 'warn' : 'default' },
    { label: 'Ø Freigabedauer', value: `${kpis.avgApprovalHours} h`, icon: Clock, tone: 'default' },
    { label: 'Benutzer · kritische Rolle', value: kpis.criticalUsers, icon: AlertTriangle, tone: 'warn' },
    { label: 'Aktive Zeit-Grants', value: kpis.activeTempGrants, icon: Clock, tone: kpis.activeTempGrants ? 'warn' : 'default' },
    { label: 'Genehmigte Anträge', value: kpis.approvedRequests, icon: TrendingUp, tone: 'good' },
    { label: 'Rezertifizierung', value: `${kpis.recertRate} %`, icon: ClipboardCheck, tone: kpis.recertRate >= 80 ? 'good' : 'warn' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Analytics &amp; Berichte</h2>
          <p className="text-xs text-muted-foreground">Kennzahlen, Verteilung, Trends und Risiko-Heatmap für Governance-Reviews.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { toCsv(roleDistribution, 'rollen-verteilung.csv'); toast.success('CSV heruntergeladen'); }}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={exportKpisPdf}>
            <FileDown className="w-4 h-4 mr-1" /> PDF-Bericht
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map(k => (
          <Card key={k.label} className="p-4 bg-card/60 backdrop-blur border-border/60">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{k.label}</div>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                k.tone === 'critical' ? 'bg-red-500/10 text-red-500'
                : k.tone === 'warn' ? 'bg-amber-500/10 text-amber-500'
                : k.tone === 'good' ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-primary/10 text-primary'
              }`}>
                <k.icon className="w-4 h-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Top-Rollen nach Zuweisungen</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleDistribution} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {roleDistribution.map((r, i) => (
                    <Cell key={i} fill={r.critical ? '#ef4444' : 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Verteilung nach Niederlassung</div>
          <div className="h-64">
            {tenantDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tenantDistribution} dataKey="count" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${e.count}`}>
                    {tenantDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">Keine Zuordnungen vorhanden.</div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Freigabeanträge · Monatstrend</div>
          <div className="h-64">
            {requestsTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="approved" stackId="a" fill="#10b981" name="Genehmigt" />
                  <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Abgelehnt" />
                  <Bar dataKey="open" stackId="a" fill="#f59e0b" name="Offen" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">Noch keine Anträge.</div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Änderungsaktivität · letzte 30 Tage</div>
          <div className="h-64">
            {auditActivity.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">Keine Audit-Einträge.</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Risiko-Heatmap · Rollen</div>
          <Badge variant="outline" className="text-xs">{riskHeatmap.length} Rollen</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {riskHeatmap.map(r => (
            <div key={r.name} className={`p-3 rounded-md border ${levelClasses(r.level)}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">{r.name}</div>
                {r.critical && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs opacity-80">{r.users} Benutzer</span>
                <span className="text-[10px] uppercase tracking-wider opacity-70">{levelLabel(r.level)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
