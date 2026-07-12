import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Download, Loader2, Search } from 'lucide-react';

type Row = {
  id: string; created_at: string; action: string | null; module: string | null;
  ip_address: string | null; details: any; user_id: string | null;
  user_profiles?: { full_name?: string | null; email?: string | null } | null;
};

export default function AdminAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [module, setModule] = useState<string>('all');
  const [days, setDays] = useState<string>('7');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(days) * 86400e3).toISOString();
      let query = supabase
        .from('audit_logs')
        .select('id, created_at, action, module, ip_address, details, user_id, user_profiles!audit_logs_user_id_fkey(full_name, email)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (module !== 'all') query = query.eq('module', module);
      const { data } = await query;
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [module, days]);

  const modules = useMemo(() => Array.from(new Set(rows.map((r) => r.module).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const hay = [r.action, r.module, r.ip_address, r.user_profiles?.full_name, r.user_profiles?.email, JSON.stringify(r.details)]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const exportCsv = () => {
    const header = ['created_at', 'user', 'module', 'action', 'ip', 'details'];
    const lines = filtered.map((r) => [
      r.created_at,
      (r.user_profiles?.full_name || r.user_profiles?.email || r.user_id || '').replaceAll('"', "'"),
      r.module ?? '',
      r.action ?? '',
      r.ip_address ?? '',
      JSON.stringify(r.details ?? {}).replaceAll('"', "'"),
    ].map((v) => `"${v}"`).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Audit-Log</h1>
        <Button onClick={exportCsv} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> CSV Export</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aktion, User, IP, Details…" className="pl-8" />
          </div>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger><SelectValue placeholder="Modul" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Module</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">letzte 24 h</SelectItem>
              <SelectItem value="7">letzte 7 Tage</SelectItem>
              <SelectItem value="30">letzte 30 Tage</SelectItem>
              <SelectItem value="90">letzte 90 Tage</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} Einträge</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Keine Einträge.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Zeit</th>
                    <th className="pr-3">User</th>
                    <th className="pr-3">Modul</th>
                    <th className="pr-3">Aktion</th>
                    <th className="pr-3">IP</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                      <td className="pr-3">{r.user_profiles?.full_name || r.user_profiles?.email || <span className="text-muted-foreground">System</span>}</td>
                      <td className="pr-3">{r.module && <Badge variant="outline">{r.module}</Badge>}</td>
                      <td className="pr-3 font-mono">{r.action}</td>
                      <td className="pr-3 text-muted-foreground">{r.ip_address}</td>
                      <td className="max-w-md">
                        <pre className="text-[10px] whitespace-pre-wrap break-words text-muted-foreground line-clamp-3">{JSON.stringify(r.details ?? {}, null, 0)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
