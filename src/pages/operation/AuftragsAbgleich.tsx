import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, FileUp, ExternalLink, Download, Loader2, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Workflow } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Hit = { id: string; order_number: string; customer_name: string; status?: string | null; source_kind?: string; source_route?: string };
type Row = {
  idx: number;
  input: { num: string; name: string; raw: Record<string, any> };
  found: boolean;
  match: Hit | null;
  matches?: Hit[];
};
type Payload = { filename: string; at: string; rows: Row[] };

export default function AuftragsAbgleich() {
  const [data, setData] = useState<Payload | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'missing'>('all');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);

  async function autoImportMissing() {
    if (!data) return;
    const missing = data.rows.filter(r => !r.found);
    if (!missing.length) { toast.info('Keine fehlenden Vorgänge'); return; }
    setImporting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('zoho-orders-reconcile', {
        body: { sources: ['zoho_eu_1', 'zoho_eu_2'], import: true },
      });
      if (error) throw error;
      const totalImported = (res?.results ?? []).reduce((s: number, r: any) => s + (r.imported ?? 0), 0);
      toast.success(`${totalImported ?? 0} Aufträge importiert · Bitte Datei neu abgleichen`);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('auftragsabgleich:results');
    if (raw) {
      try { setData(JSON.parse(raw)); } catch {}
    }
  }, []);

  const rows = data?.rows ?? [];
  const okCount = rows.filter(r => r.found).length;
  const missingCount = rows.length - okCount;

  const visible = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'ok' && !r.found) return false;
      if (filter === 'missing' && r.found) return false;
      if (q) {
        const hay = (r.input.num + ' ' + r.input.name).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filter, q]);

  function exportMissing() {
    const miss = rows.filter(r => !r.found).map(r => ({ Auftragsnummer: r.input.num, Kunde: r.input.name }));
    const ws = XLSX.utils.json_to_sheet(miss);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fehlend');
    XLSX.writeFile(wb, 'fehlende-auftraege.xlsx');
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader icon={Workflow} title="Auftragsabgleich" subtitle="Ergebnis des letzten Imports." />
        <Link to="/operation/auftrags-import">
          <Button variant="outline" size="sm"><FileUp className="h-4 w-4 mr-2" />Neue Datei</Button>
        </Link>
      </div>

      {!data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Noch keine Import-Datei geladen. <Link to="/operation/auftrags-import" className="text-primary underline ml-1">Jetzt importieren</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div><div className="text-2xl font-semibold">{okCount}</div><div className="text-xs text-muted-foreground">Gefunden</div></div>
              </CardContent>
            </Card>
            <Card className="border-red-500/40 bg-red-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div><div className="text-2xl font-semibold">{missingCount}</div><div className="text-xs text-muted-foreground">Fehlend</div></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Datei</div>
                <div className="text-sm font-mono truncate">{data.filename}</div>
                <div className="text-xs text-muted-foreground">{new Date(data.at).toLocaleString('de-DE')}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Vorgänge ({rows.length})</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} className="w-56 h-8" />
                <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Alle</Button>
                <Button size="sm" variant={filter === 'ok' ? 'default' : 'outline'} onClick={() => setFilter('ok')}>OK</Button>
                <Button size="sm" variant={filter === 'missing' ? 'default' : 'outline'} onClick={() => setFilter('missing')}>Fehlend</Button>
                {missingCount > 0 && <Button size="sm" variant="outline" onClick={exportMissing}><Download className="h-4 w-4 mr-2" />Fehlende exportieren</Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {visible.map(r => {
                const hits = r.matches ?? (r.match ? [r.match] : []);
                return (
                <div key={r.idx} className={`flex items-start gap-3 p-3 rounded-lg border ${r.found ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                  {r.found ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 mt-0.5"><CheckCircle2 className="h-3.5 w-3.5" /> OK !</Badge>
                  ) : (
                    <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1 mt-0.5"><AlertCircle className="h-3.5 w-3.5" /> !</Badge>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-medium truncate">
                      {r.input.name || '—'}
                      {hits.length > 1 && <span className="ml-2 text-xs text-muted-foreground">({hits.length} Treffer)</span>}
                    </div>
                    {hits.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] py-0">{h.source_kind || 'Auftrag'}</Badge>
                        <span className="truncate">{h.order_number} · {h.customer_name}{h.status ? ` · ${h.status}` : ''}</span>
                        {h.id && h.source_route && (
                          <Link to={`${h.source_route}/${h.id}`}>
                            <Button size="sm" variant="ghost" className="h-6 px-2"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
              {!visible.length && <p className="text-sm text-muted-foreground text-center p-6">Keine Einträge.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
