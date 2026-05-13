import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Search, FileText, Download, ScrollText } from 'lucide-react';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';

type AuditRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
};

type SessionRow = {
  id: string;
  created_at: string;
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
  otp_verified_at: string | null;
  last_reauth_at: string | null;
  ip_address: string | null;
  device_info: string | null;
  session_context: string | null;
};

type Profile = { id: string; full_name: string | null; email: string | null };

type LogEntry = {
  id: string;
  ts: string;
  type: 'audit' | 'login';
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  ip: string | null;
  agent: string | null;
  details: any;
};

export default function Logfiles() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState<string>('__all__');
  const [moduleFilter, setModuleFilter] = useState<string>('__all__');
  const [typeFilter, setTypeFilter] = useState<string>('__all__');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, s, p] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('login_sessions').select('id,created_at,user_id,is_active,expires_at,otp_verified_at,last_reauth_at,ip_address,device_info,session_context').order('created_at', { ascending: false }).limit(1000),
        supabase.from('user_profiles').select('id,full_name,email'),
      ]);
      if (a.error) throw a.error;
      setAudit((a.data ?? []) as AuditRow[]);
      setSessions((s.data ?? []) as SessionRow[]);
      const map: Record<string, Profile> = {};
      ((p.data ?? []) as Profile[]).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const merged: LogEntry[] = useMemo(() => {
    const a: LogEntry[] = audit.map((r) => ({
      id: `a-${r.id}`,
      ts: r.created_at,
      type: 'audit',
      user_id: r.user_id,
      action: r.action,
      module: r.module,
      record_id: r.record_id,
      ip: r.ip_address,
      agent: r.user_agent,
      details: r.details,
    }));
    const s: LogEntry[] = sessions.map((r) => ({
      id: `s-${r.id}`,
      ts: r.created_at,
      type: 'login',
      user_id: r.user_id,
      action: r.otp_verified_at ? 'login_verified' : 'login',
      module: 'auth',
      record_id: r.id,
      ip: r.ip_address,
      agent: r.device_info,
      details: {
        is_active: r.is_active,
        expires_at: r.expires_at,
        last_reauth_at: r.last_reauth_at,
        otp_verified_at: r.otp_verified_at,
        session_context: r.session_context,
      },
    }));
    return [...a, ...s].sort((x, y) => (x.ts < y.ts ? 1 : -1));
  }, [audit, sessions]);

  const userList = useMemo(() => {
    const ids = new Set<string>();
    merged.forEach((m) => { if (m.user_id) ids.add(m.user_id); });
    return Array.from(ids)
      .map((id) => profiles[id] ?? { id, full_name: null, email: null })
      .sort((a, b) => (a.full_name ?? a.email ?? a.id).localeCompare(b.full_name ?? b.email ?? b.id, 'de'));
  }, [merged, profiles]);

  const moduleList = useMemo(() => {
    const set = new Set<string>();
    merged.forEach((m) => set.add(m.module));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [merged]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toMs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    return merged.filter((m) => {
      if (typeFilter !== '__all__' && m.type !== typeFilter) return false;
      if (userFilter !== '__all__' && m.user_id !== userFilter) return false;
      if (moduleFilter !== '__all__' && m.module !== moduleFilter) return false;
      const ts = new Date(m.ts).getTime();
      if (ts < fromMs || ts > toMs) return false;
      if (!q) return true;
      const p = m.user_id ? profiles[m.user_id] : null;
      const hay = [
        m.action, m.module, m.record_id ?? '', m.ip ?? '', m.agent ?? '',
        p?.full_name ?? '', p?.email ?? '',
        m.details ? JSON.stringify(m.details) : '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [merged, query, userFilter, moduleFilter, typeFilter, dateFrom, dateTo, profiles]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 50);

  function userLabel(uid: string | null) {
    if (!uid) return '—';
    const p = profiles[uid];
    if (!p) return uid.slice(0, 8);
    return p.full_name ?? p.email ?? uid.slice(0, 8);
  }

  function exportCsv() {
    const header = ['Zeitpunkt', 'Typ', 'Benutzer', 'E-Mail', 'Modul', 'Aktion', 'Datensatz', 'IP', 'User-Agent', 'Details'];
    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((m) => {
      const p = m.user_id ? profiles[m.user_id] : null;
      return [
        new Date(m.ts).toLocaleString('de-DE'),
        m.type,
        p?.full_name ?? '',
        p?.email ?? '',
        m.module,
        m.action,
        m.record_id ?? '',
        m.ip ?? '',
        m.agent ?? '',
        m.details ? JSON.stringify(m.details) : '',
      ].map(esc).join(';');
    });
    const blob = new Blob(['\ufeff' + [header.map(esc).join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logfiles_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <ScrollText className="w-6 h-6" /> Logfiles
          </h1>
          <p className="text-sm text-muted-foreground">
            Protokoll aller Zugriffe, Logins und Aktionen im System.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Neu laden
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> CSV-Export
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suche nach Aktion, Benutzer, IP, Datensatz, Details…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full lg:w-[240px]">
              <SelectValue placeholder="Benutzer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Benutzer</SelectItem>
              {userList.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Module</SelectItem>
              {moduleList.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[160px]">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Typen</SelectItem>
              <SelectItem value="audit">Aktivitäten</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full lg:w-[150px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full lg:w-[150px]" />
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="font-normal">
              {filtered.length.toLocaleString('de-DE')} Einträge
            </Badge>
            <PageSizeSelector value={pageSize} onChange={setPageSize} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Keine Log-Einträge gefunden.
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-360px)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 backdrop-blur text-xs uppercase text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2">Zeitpunkt</th>
                  <th className="text-left px-3 py-2">Typ</th>
                  <th className="text-left px-3 py-2">Benutzer</th>
                  <th className="text-left px-3 py-2">Modul</th>
                  <th className="text-left px-3 py-2">Aktion</th>
                  <th className="text-left px-3 py-2">Datensatz</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((m) => {
                  const isOpen = expanded === m.id;
                  return (
                    <>
                      <tr key={m.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => setExpanded(isOpen ? null : m.id)}>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                          {new Date(m.ts).toLocaleString('de-DE')}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={m.type === 'login' ? 'default' : 'secondary'} className="text-xs">
                            {m.type === 'login' ? 'Login' : 'Aktion'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{userLabel(m.user_id)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="font-normal text-xs">{m.module}</Badge>
                        </td>
                        <td className="px-3 py-2 font-medium">{m.action}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.record_id ?? '–'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.ip ?? '–'}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {isOpen ? '▲' : '▼'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${m.id}-d`} className="bg-muted/10 border-t border-border">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="uppercase text-muted-foreground mb-1">User-Agent / Gerät</div>
                                <div className="font-mono break-all">{m.agent ?? '–'}</div>
                              </div>
                              <div>
                                <div className="uppercase text-muted-foreground mb-1">Benutzer-ID</div>
                                <div className="font-mono break-all">{m.user_id ?? '–'}</div>
                              </div>
                              <div className="md:col-span-2">
                                <div className="uppercase text-muted-foreground mb-1">Details</div>
                                <pre className="bg-muted/40 rounded p-2 overflow-x-auto max-h-64">
                                  {m.details ? JSON.stringify(m.details, null, 2) : '–'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 text-xs text-muted-foreground border-t border-border">
          {filtered.length} von {merged.length} Einträgen
        </div>
      </Card>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />
    </div>
  );
}
