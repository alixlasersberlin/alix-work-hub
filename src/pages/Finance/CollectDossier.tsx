import { useEffect, useMemo, useState } from 'react';
import { Download, FileArchive, FolderOpen, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const fmt = (n: any) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n ?? 0));
const dt = (v: any) => (v ? new Date(v).toLocaleString('de-DE') : '—');

const PURPOSES: { value: string; label: string }[] = [
  { value: 'inkasso', label: 'Inkasso-Übergabe' },
  { value: 'anwalt', label: 'Anwalt / Klage' },
  { value: 'insolvenz', label: 'Insolvenzanmeldung' },
  { value: 'intern', label: 'Interne Dokumentation' },
];

export default function FinanceCollectDossier() {
  const [rows, setRows] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [caseId, setCaseId] = useState('');
  const [purpose, setPurpose] = useState('inkasso');
  const [open, setOpen] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from('collect_dossiers' as any).select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('collect_cases' as any)
        .select('id,customer_name,open_amount,overdue_amount,max_days_overdue')
        .order('overdue_amount', { ascending: false }).limit(500),
    ]);
    if (d.error) toast({ title: 'Laden fehlgeschlagen', description: d.error.message, variant: 'destructive' });
    setRows((d.data as any) ?? []);
    setCases((c.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const generate = async () => {
    if (!caseId) { toast({ title: 'Bitte Fall wählen', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const [items, events, calls, promises, plans] = await Promise.all([
        supabase.from('collect_case_items' as any).select('*').eq('case_id', caseId).order('due_date'),
        supabase.from('collect_events' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(200),
        supabase.from('collect_calls' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(100),
        supabase.from('collect_promises' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(100),
        supabase.from('collect_payment_plans' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(50),
      ]);

      const kase = caseById.get(caseId);
      const content = {
        generated_at: new Date().toISOString(),
        purpose,
        case: kase ?? null,
        summary: {
          open_amount: kase?.open_amount ?? 0,
          overdue_amount: kase?.overdue_amount ?? 0,
          max_days_overdue: kase?.max_days_overdue ?? 0,
          invoice_count: (items.data as any[])?.length ?? 0,
          contact_count: ((events.data as any[])?.length ?? 0) + ((calls.data as any[])?.length ?? 0),
        },
        invoices: (items.data as any) ?? [],
        events: (events.data as any) ?? [],
        calls: (calls.data as any) ?? [],
        promises: (promises.data as any) ?? [],
        payment_plans: (plans.data as any) ?? [],
      };

      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from('collect_dossiers' as any).insert({
        case_id: caseId,
        purpose,
        content,
        generated_by: userRes?.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      toast({ title: 'Digitale Akte erstellt' });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const download = (row: any) => {
    const blob = new Blob([JSON.stringify(row.content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akte-${(row.content?.case?.customer_name ?? 'kunde').replace(/\s+/g, '-')}-${row.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDossier = (row: any) => {
    const c = row.content ?? {};
    const inv = (c.invoices ?? []).map((i: any) =>
      `<tr><td>${i.invoice_number ?? '—'}</td><td>${i.due_date ?? '—'}</td><td style="text-align:right">${fmt(i.balance)}</td><td style="text-align:right">${i.days_overdue ?? 0}</td></tr>`
    ).join('');
    const ev = [...(c.events ?? []), ...(c.calls ?? [])].slice(0, 100).map((e: any) =>
      `<tr><td>${dt(e.created_at)}</td><td>${e.event_type ?? e.outcome ?? 'Kontakt'}</td><td>${(e.note ?? e.description ?? '').toString().slice(0, 200)}</td></tr>`
    ).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Digitale Akte</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;padding:24px}
      h1{font-size:18px}h2{font-size:14px;margin-top:20px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}
      th{background:#f4f4f4}</style></head><body>
      <h1>Digitale Akte – ${c.case?.customer_name ?? '—'}</h1>
      <p>Zweck: ${PURPOSES.find((p) => p.value === c.purpose)?.label ?? c.purpose ?? '—'}<br/>
      Erstellt: ${dt(c.generated_at)}</p>
      <h2>Zusammenfassung</h2>
      <p>Offen: <b>${fmt(c.summary?.open_amount)}</b> · Überfällig: <b>${fmt(c.summary?.overdue_amount)}</b> ·
      Max. Verzug: <b>${c.summary?.max_days_overdue ?? 0} Tage</b> · Rechnungen: ${c.summary?.invoice_count ?? 0} ·
      Kontakte: ${c.summary?.contact_count ?? 0}</p>
      <h2>Offene Rechnungen</h2>
      <table><thead><tr><th>Nr.</th><th>Fällig</th><th style="text-align:right">Saldo</th><th style="text-align:right">Verzug</th></tr></thead><tbody>${inv || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <h2>Kommunikationsverlauf</h2>
      <table><thead><tr><th>Datum</th><th>Typ</th><th>Notiz</th></tr></thead><tbody>${ev || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast({ title: 'Popup blockiert', variant: 'destructive' }); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return !q || (r.content?.case?.customer_name ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitale Akte & Dokumenten-Generator"
        subtitle="Vollständige Fallakte für Inkasso, Anwalt oder Insolvenz – druckbar und exportierbar"
        icon={FolderOpen}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="Erstellte Akten"><div className="text-2xl font-semibold">{rows.length}</div></DataCard>
        <DataCard title="Für Anwalt/Klage"><div className="text-2xl font-semibold">{rows.filter((r) => r.purpose === 'anwalt').length}</div></DataCard>
        <DataCard title="Für Inkasso"><div className="text-2xl font-semibold">{rows.filter((r) => r.purpose === 'inkasso').length}</div></DataCard>
      </div>

      <DataCard title="Neue Akte generieren">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="w-80"><SelectValue placeholder="Fall wählen…" /></SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_name} · {fmt(c.overdue_amount)} überfällig
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={generate} disabled={generating}>
            <Sparkles className="mr-2 h-4 w-4" />{generating ? 'Erstelle…' : 'Akte erstellen'}
          </Button>
        </div>
      </DataCard>

      <DataCard title="Akten">
        <div className="mb-3">
          <Input className="w-72" placeholder="Kunde suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileArchive} title="Keine Akten" description="Erstelle oben eine digitale Fallakte." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Zweck</th>
                  <th className="py-2 pr-3">Überfällig</th>
                  <th className="py-2 pr-3">Rechnungen</th>
                  <th className="py-2 pr-3">Erstellt</th>
                  <th className="py-2 pr-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.content?.case?.customer_name ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{PURPOSES.find((p) => p.value === r.purpose)?.label ?? r.purpose}</Badge>
                    </td>
                    <td className="py-2 pr-3">{fmt(r.content?.summary?.overdue_amount)}</td>
                    <td className="py-2 pr-3">{r.content?.summary?.invoice_count ?? 0}</td>
                    <td className="py-2 pr-3">{dt(r.created_at)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOpen(r)}>Ansehen</Button>
                        <Button size="sm" variant="outline" onClick={() => printDossier(r)}>PDF / Druck</Button>
                        <Button size="sm" variant="ghost" onClick={() => download(r)}><Download className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Akte – {open?.content?.case?.customer_name ?? '—'}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><div className="text-muted-foreground">Offen</div><div className="font-semibold">{fmt(open.content?.summary?.open_amount)}</div></div>
                <div><div className="text-muted-foreground">Überfällig</div><div className="font-semibold text-destructive">{fmt(open.content?.summary?.overdue_amount)}</div></div>
                <div><div className="text-muted-foreground">Max. Verzug</div><div className="font-semibold">{open.content?.summary?.max_days_overdue ?? 0} Tage</div></div>
              </div>
              <div>
                <div className="mb-1 font-medium">Offene Rechnungen</div>
                <div className="space-y-1">
                  {(open.content?.invoices ?? []).map((i: any) => (
                    <div key={i.id} className="flex justify-between border-b border-border/50 py-1">
                      <span>{i.invoice_number ?? '—'} · fällig {i.due_date ?? '—'}</span>
                      <span>{fmt(i.balance)} · {i.days_overdue ?? 0} Tage</span>
                    </div>
                  ))}
                  {(open.content?.invoices ?? []).length === 0 && <div className="text-muted-foreground">Keine Positionen</div>}
                </div>
              </div>
              <div>
                <div className="mb-1 font-medium">Verlauf</div>
                <div className="space-y-1">
                  {[...(open.content?.events ?? []), ...(open.content?.calls ?? [])].slice(0, 30).map((e: any) => (
                    <div key={e.id} className="border-b border-border/50 py-1">
                      <span className="text-muted-foreground">{dt(e.created_at)}</span>{' · '}
                      {e.event_type ?? e.outcome ?? 'Kontakt'}{' '}
                      <span className="text-muted-foreground">{(e.note ?? e.description ?? '').toString().slice(0, 160)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
