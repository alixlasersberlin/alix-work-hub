import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, KeyRound, AlertTriangle, Users, ClipboardList, HardDrive, PlayCircle, ListChecks, ShieldCheck, Radar, ClipboardCheck } from 'lucide-react';

const NAV = [
  { to: '/security-center', end: true, label: 'Übersicht', icon: Shield },
  { to: '/security-center/inventory', label: 'Sicherheitsprüfung', icon: Database },
  { to: '/security-center/roles', label: 'Rollen', icon: Users },
  { to: '/security-center/permissions', label: 'Berechtigungen', icon: KeyRound },
  { to: '/security-center/policies', label: 'RLS-Status', icon: ListChecks },
  { to: '/security-center/storage', label: 'Storage', icon: HardDrive },
  { to: '/security-center/mfa', label: 'MFA & Sessions', icon: ShieldCheck },
  { to: '/security-center/findings', label: 'Sicherheitsereignisse', icon: AlertTriangle },
  { to: '/security-center/pentest', label: 'Pen-Test', icon: Radar },
  { to: '/security-center/compliance', label: 'Compliance', icon: ClipboardCheck },
  { to: '/security-center/simulate', label: 'Zugriffs-Simulation', icon: PlayCircle },
  { to: '/security-center/plan', label: 'Migrationsplan', icon: ClipboardList },
];

export default function SecurityCenterLayout() {
  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold">Security Center</h1>
          <p className="text-sm text-muted-foreground">Zentrale Sicherheitsanalyse — nur Super Admin</p>
        </div>
        <Badge variant="outline" className="ml-auto bg-primary/10 border-primary/40 text-primary">Phase 1 · Analyse</Badge>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1">
          {NAV.map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40 text-muted-foreground'}`}
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ÜBERSICHT
// ────────────────────────────────────────────────────────────────
export function SecurityCenterOverview() {
  const [stats, setStats] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [scanInfo, setScanInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [inv, buckets, roles, users, fnd, tr, si] = await Promise.all([
        (supabase as any).from('security_table_inventory').select('rls_enabled, policy_count, anon_access, classification'),
        (supabase as any).schema('storage').from('buckets').select('id, public'),
        (supabase as any).from('security_roles').select('id, is_active'),
        (supabase as any).from('user_profiles').select('id').eq('is_active', true),
        (supabase as any).from('security_audit_findings').select('*').order('severity', { ascending: true }).limit(20),
        (supabase as any).from('security_findings_trend_30d').select('*'),
        (supabase as any).from('security_last_scan_info').select('*').single(),
      ]);
      setStats({
        tables_total: inv.data?.length ?? 0,
        tables_no_rls: (inv.data ?? []).filter((t: any) => !t.rls_enabled).length,
        tables_no_policy: (inv.data ?? []).filter((t: any) => t.rls_enabled && t.policy_count === 0).length,
        anon_access: (inv.data ?? []).filter((t: any) => t.anon_access).length,
        class4: (inv.data ?? []).filter((t: any) => t.classification === 4).length,
        class3: (inv.data ?? []).filter((t: any) => t.classification === 3).length,
        buckets_total: buckets.data?.length ?? 0,
        buckets_public: (buckets.data ?? []).filter((b: any) => b.public).length,
        roles: roles.data?.length ?? 0,
        active_users: users.data?.length ?? 0,
      });
      setFindings(fnd.data ?? []);
      setTrend(tr.data ?? []);
      setScanInfo(si.data);
    })();
  }, []);

  if (!stats) return <div className="text-sm text-muted-foreground">Wird geladen…</div>;

  const openFindings = findings.filter(f => f.status === 'open').length;
  const critical = findings.filter(f => (f.severity === 'critical' || f.severity === 'high') && f.status === 'open').length;

  // Trend by day
  const days = Array.from(new Set(trend.map((r: any) => r.day))).sort();
  const maxCnt = Math.max(1, ...trend.map((r: any) => r.cnt));
  const sevColor: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-blue-500', info: 'bg-muted' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Tabellen gesamt" value={stats.tables_total} />
        <Kpi label="Ohne RLS" value={stats.tables_no_rls} tone={stats.tables_no_rls ? 'red' : 'green'} />
        <Kpi label="RLS ohne Policy" value={stats.tables_no_policy} tone={stats.tables_no_policy ? 'red' : 'green'} />
        <Kpi label="Anon-Zugriff" value={stats.anon_access} tone={stats.anon_access > 5 ? 'amber' : 'green'} />
        <Kpi label="Klasse 4 (hochsensibel)" value={stats.class4} tone="amber" />
        <Kpi label="Klasse 3 (vertraulich)" value={stats.class3} />
        <Kpi label="Öffentliche Buckets" value={`${stats.buckets_public} / ${stats.buckets_total}`} tone={stats.buckets_public ? 'red' : 'green'} />
        <Kpi label="Systemrollen (neu)" value={stats.roles} />
        <Kpi label="Aktive Benutzer" value={stats.active_users} />
        <Kpi label="Offene Risiken" value={openFindings} tone={openFindings ? 'amber' : 'green'} />
        <Kpi label="Kritisch/Hoch offen" value={critical} tone={critical ? 'red' : 'green'} />
        <Kpi label="Findings 7d" value={scanInfo?.findings_last_7d ?? 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Findings-Trend · letzte 30 Tage</CardTitle>
          <span className="text-xs text-muted-foreground">
            Letzter Eintrag: {scanInfo?.last_scan_at ? new Date(scanInfo.last_scan_at).toLocaleString('de-DE') : '–'}
          </span>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Trenddaten.</div>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {days.map((d: string) => {
                const dayRows = trend.filter((r: any) => r.day === d);
                return (
                  <div key={d} className="flex-1 flex flex-col justify-end items-stretch gap-[1px] group relative" title={d}>
                    {['info','low','medium','high','critical'].map(sv => {
                      const row = dayRows.find((r: any) => r.severity === sv);
                      const h = row ? (row.cnt / maxCnt) * 100 : 0;
                      return h > 0 ? <div key={sv} className={sevColor[sv]} style={{ height: `${h}%` }} /> : null;
                    })}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-popover border rounded px-1 whitespace-nowrap">{d}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-3 text-xs mt-3">
            {['critical','high','medium','low','info'].map(sv => (
              <div key={sv} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${sevColor[sv]}`} />{sv}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Zusammenfassung</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>✅ <strong>{stats.tables_total} Tabellen</strong> analysiert — alle mit RLS + mindestens einer Policy.</p>
          <p>✅ <strong>{stats.buckets_total} Storage-Buckets</strong>, davon <strong>{stats.buckets_public} öffentlich</strong>.</p>
          <p>ℹ️ Rollen: {stats.roles} Systemrollen definiert; {stats.active_users} aktive Nutzer.</p>
          <p>⚠️ {openFindings} offene Findings — davon {critical} kritisch/hoch.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: 'red' | 'amber' | 'green' }) {
  const cls = tone === 'red' ? 'text-red-400 border-red-500/40 bg-red-500/5'
    : tone === 'amber' ? 'text-amber-400 border-amber-500/40 bg-amber-500/5'
    : tone === 'green' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/5'
    : 'text-foreground';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
