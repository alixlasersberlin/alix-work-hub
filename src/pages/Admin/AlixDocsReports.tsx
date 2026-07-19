import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, ScrollText, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Category { id: string; code: string; name: string }
interface Stats { totalActive: number; totalDeleted: number; last30: number; byStatus: Record<string, number>; byCat: Record<string, number> }

export default function AlixDocsReports() {
  const [cats, setCats] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [from, setFrom] = useState<string>(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('alixdocs_categories').select('id, code, name').order('sort_order')
      .then(({ data }) => setCats((data as any) ?? []));
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-stats');
      if (error) throw error;
      const d: any = data;
      setStats({
        totalActive: d.totalActive ?? d.total ?? 0,
        totalDeleted: d.totalDeleted ?? d.deleted ?? 0,
        last30: d.last30 ?? d.month30 ?? 0,
        byStatus: d.byStatus ?? {},
        byCat: d.byCategory ?? d.byCat ?? {},
      });
    } catch (e: any) {
      toast.error('Statistik-Fehler: ' + e.message);
    } finally { setLoadingStats(false); }
  };

  const download = async (kind: 'documents' | 'audit') => {
    setBusy(kind);
    try {
      const body: Record<string, string> = { kind };
      if (from) body.from = new Date(from).toISOString();
      if (to) body.to = new Date(to + 'T23:59:59').toISOString();
      if (kind === 'documents') {
        if (category !== 'all') body.category = category;
        if (status !== 'all') body.status = status;
      }

      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/alixdocs-report-export`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alixdocs-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export erstellt');
    } catch (e: any) {
      toast.error('Export-Fehler: ' + e.message);
    } finally { setBusy(null); }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> AlixDocs Reporting & Audit-Export
        </h1>
        <p className="text-sm text-muted-foreground">CSV-Exporte für ISO 13485 / GoBD / interne Reviews</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aktive Dokumente</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{loadingStats ? '…' : stats?.totalActive ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Neu (30 Tage)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{loadingStats ? '…' : stats?.last30 ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gelöscht (Archiv)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{loadingStats ? '…' : stats?.totalDeleted ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Export-Filter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Von</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bis</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="entwurf">Entwurf</SelectItem>
                  <SelectItem value="in_pruefung">In Prüfung</SelectItem>
                  <SelectItem value="freigegeben">Freigegeben</SelectItem>
                  <SelectItem value="abgelaufen">Abgelaufen</SelectItem>
                  <SelectItem value="archiviert">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <Button onClick={() => download('documents')} disabled={busy !== null} className="h-14">
              {busy === 'documents' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileSpreadsheet className="w-5 h-5 mr-2" />}
              Dokumenten-Liste als CSV
            </Button>
            <Button onClick={() => download('audit')} disabled={busy !== null} variant="outline" className="h-14">
              {busy === 'audit' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ScrollText className="w-5 h-5 mr-2" />}
              Audit-Log als CSV (GoBD)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            <Download className="inline w-3 h-3 mr-1" />
            UTF-8 mit BOM, Trenner „;" — direkt in Excel öffnbar. Filter „Von/Bis" gelten für beide Exporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
