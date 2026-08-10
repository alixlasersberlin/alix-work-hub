import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Table2, Loader2, FileDown, Search } from 'lucide-react';

function cellState(t: any | undefined) {
  if (!t) return <span className="text-destructive font-medium">Missing</span>;
  if (t.result === 'pass' && t.executed_confirmed) return <span className="text-emerald-500 font-medium">PASS</span>;
  if (t.result === 'fail') return <span className="text-destructive font-medium">FAIL</span>;
  return <span className="text-amber-500 font-medium">{t.result === 'offen' ? 'Offen' : t.result}</span>;
}

export default function SoftwareTraceability() {
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reqs, setReqs] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from('plm_devices' as any) as any).select('id,name,article_number').order('name');
      const list = (data as any[]) || [];
      setDevices(list);
      setDeviceId(prev => prev || list[0]?.id || '');
      if (!list.length) setLoading(false);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    const f = (t: string) => (supabase.from(t as any) as any).select('*').eq('device_id', deviceId).limit(3000);
    const [r, u, k, t] = await Promise.all([f('plm_sw_requirements'), f('plm_sw_units'), f('plm_sw_risks'), f('plm_sw_tests')]);
    setReqs((r.data as any[]) || []);
    setUnits((u.data as any[]) || []);
    setRisks((k.data as any[]) || []);
    setTests((t.data as any[]) || []);
    setLoading(false);
  }, [deviceId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const unitById = new Map(units.map(u => [u.id, u]));
    const list = reqs.map(q => {
      const rel = risks.filter(r => r.requirement_id === q.id);
      const pick = (kind: string) => tests.find(t => t.kind === kind && t.requirement_id === q.id);
      const ver = pick('verification'), int = pick('integration'), sys = pick('system');
      const ok = (t: any) => t && t.result === 'pass' && t.executed_confirmed;
      const status = ok(ver) && ok(int) && ok(sys) ? 'ok' : (!ver || !int || !sys || ver?.result === 'fail' || int?.result === 'fail' || sys?.result === 'fail') ? 'bad' : 'warn';
      return { q, unit: unitById.get(q.unit_id), risks: rel, ver, int, sys, status };
    });
    const s = search.trim().toLowerCase();
    return s ? list.filter(r => JSON.stringify(r).toLowerCase().includes(s)) : list;
  }, [reqs, units, risks, tests, search]);

  const exportCsv = () => {
    const head = ['Requirement', 'Titel', 'Unit', 'Risk', 'Verification', 'Integration', 'System Test', 'Status'];
    const body = rows.map(r => [
      r.q.req_code ?? '', r.q.title ?? '', r.unit?.unit_code ?? '',
      r.risks.map((x: any) => x.risk_code).join(' '), r.ver?.result ?? 'Missing',
      r.int?.result ?? 'Missing', r.sys?.result ?? 'Missing', r.status,
    ]);
    const csv = [head, ...body].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv' }));
    a.download = 'traceability-matrix.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader
        icon={Table2}
        title="Traceability Matrix"
        subtitle="Requirement → Unit → Risk → Verification → Integration → System Test"
        noBreadcrumbs
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[240px]"
            value={deviceId} onChange={e => setDeviceId(e.target.value)}
          >
            {!devices.length && <option value="">Keine Geräte vorhanden</option>}
            {devices.map(d => <option key={d.id} value={d.id}>{[d.article_number, d.name].filter(Boolean).join(' · ')}</option>)}
          </select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground">{rows.length} Requirements</span>
          <Button variant="outline" onClick={exportCsv}><FileDown className="w-4 h-4 mr-1" /> CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Integration</TableHead>
                  <TableHead>System Test</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.q.id}>
                    <TableCell className="font-mono text-xs">{r.q.req_code ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.q.title}</TableCell>
                    <TableCell className="font-mono text-xs">{r.unit?.unit_code ?? <span className="text-destructive">Missing</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.risks.length ? r.risks.map((x: any) => x.risk_code).join(', ') : '—'}</TableCell>
                    <TableCell className="text-xs">{cellState(r.ver)}</TableCell>
                    <TableCell className="text-xs">{cellState(r.int)}</TableCell>
                    <TableCell className="text-xs">{cellState(r.sys)}</TableCell>
                    <TableCell className="text-right text-lg">
                      {r.status === 'ok' ? '🟢' : r.status === 'warn' ? '🟡' : '🔴'}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Keine Requirements erfasst</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
