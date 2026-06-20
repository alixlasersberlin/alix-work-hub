import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MFA_REQUIRED_ROLES } from '@/lib/mfa-required';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Shield, ShieldAlert, Activity, Users, Monitor, Globe, AlertTriangle,
  Smartphone, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';

// ---------------- Types ----------------
interface SessionRow {
  id: string;
  user_id: string | null;
  created_at: string;
  ip_address: string | null;
  device_info: string | null;
  is_active: boolean;
  otp_verified_at: string | null;
  expires_at: string | null;
}
interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  module: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
}
interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  account_status: string;
  is_active: boolean;
}

const SECURITY_EVENT_ACTIONS = [
  'rate_limit_hit', 'captcha_failed', 'failed_login',
  'admin_login', 'password_changed', 'new_device', 'new_location',
];

// ---------------- Helpers ----------------
function parseUA(ua: string | null) {
  if (!ua) return { browser: '—', os: '—' };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Andere';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' : '—';
  return { browser, os };
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('de-DE'); } catch { return '—'; }
}

// ---------------- Component ----------------
export default function SecurityCenter() {
  const { hasAnyRole, loading: authLoading } = useAuth();
  const allowed = hasAnyRole(['Super Admin', 'Admin', 'Geschäftsführung']);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [mfaCoverage, setMfaCoverage] = useState<{ requiredUsers: number; withMfa: number }>({ requiredUsers: 0, withMfa: 0 });

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [s, a, p] = await Promise.all([
        supabase.from('login_sessions').select('id,user_id,created_at,ip_address,device_info,is_active,otp_verified_at,expires_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
        supabase.from('audit_logs').select('id,created_at,user_id,action,module,ip_address,user_agent,details').in('action', SECURITY_EVENT_ACTIONS).gte('created_at', since).order('created_at', { ascending: false }).limit(500),
        supabase.from('user_profiles').select('id,full_name,email,account_status,is_active'),
      ]);
      if (cancelled) return;
      setSessions((s.data as SessionRow[]) ?? []);
      setAudits((a.data as AuditRow[]) ?? []);
      setProfiles((p.data as ProfileRow[]) ?? []);

      // MFA coverage for required roles (read-only, via existing schema)
      try {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)');
        const requiredUserIds = new Set<string>();
        (roleRows ?? []).forEach((r: any) => {
          if (MFA_REQUIRED_ROLES.includes(r.roles?.name)) requiredUserIds.add(r.user_id);
        });
        // Heuristik: User mit otp_verified_at in den letzten 30 Tagen gelten als MFA-aktiv.
        const verifiedUsers = new Set<string>();
        ((s.data ?? []) as SessionRow[]).forEach(row => {
          if (row.otp_verified_at && row.user_id) verifiedUsers.add(row.user_id);
        });
        const withMfa = [...requiredUserIds].filter(uid => verifiedUsers.has(uid)).length;
        setMfaCoverage({ requiredUsers: requiredUserIds.size, withMfa });
      } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  const userMap = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach(p => m.set(p.id, p));
    return m;
  }, [profiles]);

  // ---------- Aggregations ----------
  const activeSessions = useMemo(
    () => sessions.filter(s => s.is_active && (!s.expires_at || new Date(s.expires_at) > new Date())),
    [sessions],
  );
  const failed = useMemo(
    () => audits.filter(a => ['failed_login', 'captcha_failed', 'rate_limit_hit'].includes(a.action)),
    [audits],
  );
  const blockedUsers = useMemo(
    () => profiles.filter(p => p.account_status !== 'active' || !p.is_active),
    [profiles],
  );
  const deviceAgg = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach(s => {
      const { browser, os } = parseUA(s.device_info);
      const key = `${os} · ${browser}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [sessions]);
  const ipAgg = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach(s => { if (s.ip_address) m.set(s.ip_address, (m.get(s.ip_address) ?? 0) + 1); });
    audits.forEach(a => { if (a.ip_address) m.set(a.ip_address, (m.get(a.ip_address) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [sessions, audits]);

  // ---------- Score ----------
  const score = useMemo(() => {
    let s = 100;
    const last24h = (rows: { created_at: string }[]) =>
      rows.filter(r => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000).length;
    const failedRate = last24h(failed);
    if (failedRate > 50) s -= 25; else if (failedRate > 20) s -= 15; else if (failedRate > 5) s -= 5;
    if (blockedUsers.length > 10) s -= 10;
    const mfaPct = mfaCoverage.requiredUsers === 0 ? 1 : mfaCoverage.withMfa / mfaCoverage.requiredUsers;
    if (mfaPct < 0.5) s -= 30; else if (mfaPct < 0.8) s -= 15; else if (mfaPct < 1) s -= 5;
    const stale = activeSessions.filter(x => Date.now() - new Date(x.created_at).getTime() > 24 * 60 * 60 * 1000).length;
    if (stale > 25) s -= 10; else if (stale > 10) s -= 5;
    return Math.max(0, Math.min(100, s));
  }, [failed, blockedUsers, mfaCoverage, activeSessions]);

  const scoreColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreLabel = score >= 80 ? 'Grün' : score >= 60 ? 'Gelb' : 'Rot';

  if (authLoading) return <div className="container mx-auto p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!allowed) {
    return (
      <div className="container mx-auto p-6">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Kein Zugriff auf das Alix Security Center.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Shield}
        title="Alix Security Center"
        subtitle="Enterprise-Sicherheitsüberwachung – Login-Historie, Sitzungen, Geräte, IPs und Warnungen."
      />

      {/* KPI-Reihe + Score */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Activity} label="Aktive Sitzungen" value={activeSessions.length} />
        <Kpi icon={AlertTriangle} label="Fehlversuche (30 T.)" value={failed.length} tone={failed.length > 50 ? 'warn' : 'ok'} />
        <Kpi icon={Users} label="Gesperrte Benutzer" value={blockedUsers.length} tone={blockedUsers.length ? 'warn' : 'ok'} />
        <Card className="card-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" /> Alix Security Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${scoreColor}`}>{score}<span className="text-base text-muted-foreground"> / 100</span></div>
            <div className={`text-xs mt-1 ${scoreColor}`}>● {scoreLabel}</div>
            <div className="text-[11px] text-muted-foreground mt-2">
              MFA-Abdeckung Pflichtrollen: {mfaCoverage.withMfa}/{mfaCoverage.requiredUsers}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade Sicherheitsdaten…</CardContent></Card>
      ) : (
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="history">Login-Historie</TabsTrigger>
            <TabsTrigger value="failed">Fehlgeschlagene Logins</TabsTrigger>
            <TabsTrigger value="active">Aktive Sitzungen</TabsTrigger>
            <TabsTrigger value="blocked">Gesperrte Benutzer</TabsTrigger>
            <TabsTrigger value="devices">Geräte</TabsTrigger>
            <TabsTrigger value="ips">IP-Übersicht</TabsTrigger>
            <TabsTrigger value="alerts">Sicherheitswarnungen</TabsTrigger>
            <TabsTrigger value="mfa">MFA / TOTP</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <SessionTable rows={sessions.slice(0, 200)} userMap={userMap} showStatus />
          </TabsContent>
          <TabsContent value="failed">
            <AuditTable rows={failed} userMap={userMap} />
          </TabsContent>
          <TabsContent value="active">
            <SessionTable rows={activeSessions} userMap={userMap} />
          </TabsContent>
          <TabsContent value="blocked">
            <Card><CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><Th>Benutzer</Th><Th>E-Mail</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {blockedUsers.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Keine gesperrten Benutzer.</td></tr>}
                  {blockedUsers.map(p => (
                    <tr key={p.id} className="border-t border-border/60">
                      <Td>{p.full_name ?? '—'}</Td><Td>{p.email ?? '—'}</Td>
                      <Td><Badge variant="destructive">{p.account_status}{p.is_active ? '' : ' · inaktiv'}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="devices">
            <AggList icon={Monitor} title="Geräte (letzte 30 Tage)" rows={deviceAgg} />
          </TabsContent>
          <TabsContent value="ips">
            <AggList icon={Globe} title="IP-Adressen (letzte 30 Tage)" rows={ipAgg} />
          </TabsContent>
          <TabsContent value="alerts">
            <AuditTable rows={audits} userMap={userMap} />
          </TabsContent>
          <TabsContent value="mfa">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> MFA / TOTP</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>Pflichtrollen: <span className="text-foreground">{MFA_REQUIRED_ROLES.join(', ')}</span></div>
                <div>Abdeckung: <span className="text-foreground">{mfaCoverage.withMfa} / {mfaCoverage.requiredUsers}</span></div>
                <div className="text-muted-foreground">
                  Unterstützte Authenticator-Apps (RFC 6238 TOTP): Microsoft Authenticator, Google Authenticator, Authy.
                  Einrichtung erfolgt über <code>/sicherheit</code> bzw. den verpflichtenden MFA-Setup-Flow.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------- Small bits ----------------
function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <Card className="card-glow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone === 'warn' ? 'text-amber-500' : 'text-primary'}`} /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}

function SessionTable({ rows, userMap, showStatus }: { rows: SessionRow[]; userMap: Map<string, ProfileRow>; showStatus?: boolean }) {
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <Th>Datum</Th><Th>Benutzer</Th><Th>Browser</Th><Th>OS</Th><Th>IP</Th>
            {showStatus && <Th>MFA</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Einträge.</td></tr>}
          {rows.map(r => {
            const u = r.user_id ? userMap.get(r.user_id) : undefined;
            const { browser, os } = parseUA(r.device_info);
            return (
              <tr key={r.id} className="border-t border-border/60">
                <Td>{fmt(r.created_at)}</Td>
                <Td>{u?.full_name || u?.email || (r.user_id ? r.user_id.slice(0, 8) : '—')}</Td>
                <Td>{browser}</Td><Td>{os}</Td><Td className="font-mono text-xs">{r.ip_address ?? '—'}</Td>
                {showStatus && <Td>{r.otp_verified_at ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</Td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardContent></Card>
  );
}

function AuditTable({ rows, userMap }: { rows: AuditRow[]; userMap: Map<string, ProfileRow> }) {
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr><Th>Datum</Th><Th>Aktion</Th><Th>Modul</Th><Th>Benutzer</Th><Th>IP</Th><Th>Details</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Einträge.</td></tr>}
          {rows.map(r => {
            const u = r.user_id ? userMap.get(r.user_id) : undefined;
            return (
              <tr key={r.id} className="border-t border-border/60">
                <Td>{fmt(r.created_at)}</Td>
                <Td><Badge variant="outline">{r.action}</Badge></Td>
                <Td>{r.module ?? '—'}</Td>
                <Td>{u?.full_name || u?.email || (r.details?.email ?? '—')}</Td>
                <Td className="font-mono text-xs">{r.ip_address ?? '—'}</Td>
                <Td className="text-xs text-muted-foreground max-w-[280px] truncate">{r.details ? JSON.stringify(r.details) : '—'}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardContent></Card>
  );
}

function AggList({ icon: Icon, title, rows }: { icon: any; title: string; rows: [string, number][] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr><Th>Eintrag</Th><Th>Anzahl</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Keine Daten.</td></tr>}
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-border/60">
                <Td className="font-mono text-xs">{k}</Td><Td>{v}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
