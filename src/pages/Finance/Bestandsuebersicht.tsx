import { useEffect, useMemo, useState } from 'react';
import { Layers, Search, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { KpiTile } from '@/components/infinity/KpiTile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_frequency: string | null;
  repeat_every: number | null;
  start_date: string | null;
  end_date: string | null;
  next_invoice_date: string | null;
  total: number | null;
  currency: string | null;
  created_at: string | null;
};

const isSepa = (p: Profile) =>
  /\bsepa\b|lastschrift/.test(`${p.recurrence_name ?? ''} ${p.reference_number ?? ''}`.toLowerCase());

const monthsFactor = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 30 / e;
    case 'weeks': return (52 / 12) / e;
    case 'months': return 1 / e;
    case 'years': return (1 / 12) / e;
    default: return 1 / e;
  }
};

type PayType = 'all' | 'sepa' | 'self';
type StatusFilter = 'all' | 'active' | 'inactive';
type SortKey = 'date_new' | 'date_old' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';

export default function Bestandsuebersicht() {
  const { region } = useAccountingRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [payType, setPayType] = useState<PayType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date_new');
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | 'all'>(50);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_recurring_profiles')
      .select('id,recurrence_name,reference_number,status,customer_name,company_name,recurrence_frequency,repeat_every,start_date,end_date,next_invoice_date,total,currency,created_at')
      .eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(5000);
    if (error) { setError(error.message); setLoading(false); return; }
    setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = profiles.filter(p => {
      if (payType === 'sepa' && !isSepa(p)) return false;
      if (payType === 'self' && isSepa(p)) return false;
      const active = (p.status ?? '').toLowerCase() === 'active';
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
      if (!s) return true;
      return (
        (p.company_name ?? '').toLowerCase().includes(s) ||
        (p.customer_name ?? '').toLowerCase().includes(s) ||
        (p.recurrence_name ?? '').toLowerCase().includes(s) ||
        (p.reference_number ?? '').toLowerCase().includes(s)
      );
    });
    const name = (p: Profile) => (p.company_name || p.customer_name || '').toLowerCase();
    arr = [...arr].sort((a, b) => {
      switch (sortBy) {
        case 'amount_desc': return Number(b.total || 0) - Number(a.total || 0);
        case 'amount_asc': return Number(a.total || 0) - Number(b.total || 0);
        case 'date_old': return (a.created_at || '').localeCompare(b.created_at || '');
        case 'name_asc': return name(a).localeCompare(name(b));
        case 'name_desc': return name(b).localeCompare(name(a));
        default: return (b.created_at || '').localeCompare(a.created_at || '');
      }
    });
    return arr;
  }, [profiles, search, payType, statusFilter, sortBy]);

  const visible = useMemo(() => (pageSize === 'all' ? rows : rows.slice(0, pageSize)), [rows, pageSize]);

  const totals = useMemo(() => ({
    count: rows.length,
    sepa: rows.filter(isSepa).length,
    self: rows.filter(p => !isSepa(p)).length,
    monthly: rows.reduce((s, p) => s + ((p.status ?? '').toLowerCase() === 'active'
      ? Number(p.total || 0) * monthsFactor(p.recurrence_frequency, p.repeat_every) : 0), 0),
  }), [rows]);

  const buildRows = () => rows.map(p => ({
    Kunde: p.company_name || p.customer_name || 'Unbekannt',
    Vertrag: p.recurrence_name ?? '',
    Referenz: p.reference_number ?? '',
    Zahlart: isSepa(p) ? 'SEPA' : 'Selbstzahler',
    Status: p.status ?? '',
    Frequenz: `${p.repeat_every ?? 1} × ${p.recurrence_frequency ?? ''}`.trim(),
    Erfasst: fmtDate(p.created_at),
    Start: fmtDate(p.start_date),
    Ende: fmtDate(p.end_date),
    'Nächste Rechnung': fmtDate(p.next_invoice_date),
    Betrag: Number(p.total || 0),
    Währung: p.currency || 'EUR',
  }));

  const fileBase = () => `bestandsuebersicht-${region}-${new Date().toISOString().slice(0, 10)}`;

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  function exportCsv() {
    const data = buildRows();
    if (!data.length) { toast({ title: 'Keine Daten', variant: 'destructive' }); return; }
    const cols = Object.keys(data[0]);
    const csv = [cols.join(';'), ...data.map(r => cols.map(c => String((r as any)[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n');
    downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `${fileBase()}.csv`);
  }

  async function exportXlsx() {
    const data = buildRows();
    if (!data.length) { toast({ title: 'Keine Daten', variant: 'destructive' }); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bestand');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase()}.xlsx`);
  }

  async function exportPdf() {
    const data = buildRows();
    if (!data.length) { toast({ title: 'Keine Daten', variant: 'destructive' }); return; }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = ['Kunde', 'Vertrag', 'Referenz', 'Zahlart', 'Status', 'Frequenz', 'Erfasst', 'Start', 'Ende', 'Nächste Rechnung', 'Betrag'];
    doc.setFontSize(14);
    doc.text(`Bestandsübersicht Aufträge · Buchhaltung ${region}`, 40, 40);
    doc.setFontSize(9);
    doc.text(`${data.length} Verträge · SEPA ${totals.sepa} · Selbstzahler ${totals.self} · Stand ${new Date().toLocaleDateString('de-DE')}`, 40, 56);
    autoTable(doc, {
      startY: 72,
      head: [cols],
      body: data.map(r => cols.map(c => (c === 'Betrag' ? fmt(Number(r.Betrag), r['Währung']) : String((r as any)[c] ?? '')))),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 10: { halign: 'right' } },
    });
    doc.save(`${fileBase()}.pdf`);
  }

  if (loading) return <div className="space-y-6"><SkeletonKpiGrid count={4} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bestandsübersicht"
        subtitle="Alle Aufträge/Verträge im Bestand — mit Zahlart SEPA oder Selbstzahler"
        icon={Layers}
        noBreadcrumbs
      />

      {error && <PageError message={error} onRetry={load} />}

      <div className="grid md:grid-cols-4 gap-4">
        <KpiTile label="Verträge gesamt" value={totals.count} icon={Layers} accent="sky" />
        <KpiTile label="SEPA" value={totals.sepa} icon={Layers} accent="emerald" />
        <KpiTile label="Selbstzahler" value={totals.self} icon={Layers} accent="violet" />
        <KpiTile label="Volumen / Monat" value={fmt(totals.monthly)} icon={Layers} accent="gold" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kunde, Vertrag oder Referenz suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['all', 'sepa', 'self'] as const).map(t => (
            <button
              key={t}
              onClick={() => setPayType(t)}
              className={`px-3 py-1 text-xs rounded ${payType === t ? (t === 'sepa' ? 'bg-emerald-600 text-white' : t === 'self' ? 'bg-blue-600 text-white' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'all' ? 'Alle' : t === 'sepa' ? 'SEPA' : 'Selbstzahler'}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['all', 'active', 'inactive'] as const).map(t => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={`px-3 py-1 text-xs rounded ${statusFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'all' ? 'Status: Alle' : t === 'active' ? 'Aktiv' : 'Inaktiv'}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="date_new">Datum neueste</option>
          <option value="date_old">Datum älteste</option>
          <option value="amount_desc">Betrag absteigend</option>
          <option value="amount_asc">Betrag aufsteigend</option>
          <option value="name_asc">Alphabetisch A–Z</option>
          <option value="name_desc">Alphabetisch Z–A</option>
        </select>

        <select
          value={String(pageSize)}
          onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 20 | 50 | 100))}
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="all">Alle</option>
        </select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><Download className="w-4 h-4 mr-2" />Export ({rows.length})</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{rows.length} Verträge</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportPdf}><FileText className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel (XLSX)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv}><FileJson className="w-4 h-4 mr-2" />CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataCard title={`Bestand (${visible.length} / ${rows.length})`}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-3 py-2">Kunde</th>
                <th className="text-left font-medium px-3 py-2">Vertrag</th>
                <th className="text-left font-medium px-3 py-2">Referenz</th>
                <th className="text-left font-medium px-3 py-2">Zahlart</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Erfasst</th>
                <th className="text-left font-medium px-3 py-2">Nächste Rechnung</th>
                <th className="text-right font-medium px-3 py-2">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">Keine Treffer.</td></tr>
              )}
              {visible.map(p => {
                const sepa = isSepa(p);
                const active = (p.status ?? '').toLowerCase() === 'active';
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{p.company_name || p.customer_name || 'Unbekannt'}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">{p.recurrence_name || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.reference_number || '—'}</td>
                    <td className="px-3 py-2">
                      {sepa
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">SEPA</Badge>
                        : <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4">Selbstzahler</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={active ? 'text-emerald-500' : 'text-muted-foreground'}>{active ? 'Aktiv' : (p.status || '—')}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.next_invoice_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(Number(p.total || 0), p.currency || 'EUR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
