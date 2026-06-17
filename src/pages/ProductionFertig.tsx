import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, FileText, Search, Mail, RefreshCw, Download, FileDown } from 'lucide-react';
import { createPDF } from '@/lib/pdf-utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAtOnly } from '@/hooks/useAtOnly';
import { sendProductionSuccessfulEmail } from '@/lib/send-production-successful-email';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  order_number: string;
  production_order_number: string | null;
  display_order_number: string;
  modellname: string | null;
  bearbeiter: string | null;
  liefertermin: string | null;
  status: string;
  is_reclamation: boolean;
  updated_at: string | null;
  supplier?: { name: string | null } | null;
  customer_name?: string | null;
};

export default function ProductionFertig() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const atOnly = useAtOnly();

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qb = supabase
        .from('production_orders')
        .select(atOnly
          ? '*, supplier:suppliers(name), orders!inner(source_system)'
          : '*, supplier:suppliers(name)')
        .eq('status', 'fertig')
        .order('updated_at', { ascending: false });
      if (atOnly) qb = qb.eq('orders.source_system', 'zoho_eu_2');
      const { data, error } = await qb;
      if (error) { toast.error(error.message); setLoading(false); return; }
      const list = (data || []).map((r: any) => ({
        ...r,
        display_order_number: r.production_order_number || r.order_number,
      }));
      const orderNumbers = Array.from(new Set(list.map((r: any) => r.order_number).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (orderNumbers.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('order_number, customers(company_name, contact_name)')
          .in('order_number', orderNumbers as string[]);
        (orders || []).forEach((o: any) => {
          const name = o.customers?.company_name || o.customers?.contact_name || '';
          if (o.order_number && name) nameMap.set(o.order_number, name);
        });
      }
      setRows(list.map((r: any) => ({ ...r, customer_name: nameMap.get(r.order_number) || null })));
      setLoading(false);
    })();
  }, [atOnly]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const changeStatus = async (r: Row, newStatus: string) => {
    setBusyId(r.id);
    const { error } = await supabase
      .from('production_orders')
      .update({ status: newStatus })
      .eq('id', r.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Status auf "${newStatus}" geändert`);
    setRows(prev => prev.filter(x => x.id !== r.id));
  };

  const sendEmail = async (r: Row) => {
    setBusyId(r.id);
    const res = await sendProductionSuccessfulEmail(r.id, 'manuell');
    setBusyId(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!q) return true;
    return [r.display_order_number, r.order_number, r.modellname, r.supplier?.name, r.customer_name, r.bearbeiter]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const exportRows = () => filtered.map((r: any) => ({
    bestellnummer: r.display_order_number || '',
    auftragsnummer: r.order_number || '',
    kunde: r.customer_name || '',
    modell: r.modellname || '',
    farbe: r.farbe || '',
    power: r.power_handstueck || '',
    seriennummer: r.seriennummer || '',
    bearbeiter: r.bearbeiter || '',
    zulieferer: r.supplier?.name || '',
    liefertermin: r.liefertermin && isValid(new Date(r.liefertermin)) ? format(new Date(r.liefertermin), 'dd.MM.yyyy') : '',
    status: r.status || '',
    reklamation: r.is_reclamation ? 'Ja' : 'Nein',
    sonderwuensche: (r.sonderwuensche || '').replace(/\s+/g, ' ').trim(),
    anmerkungen: (r.anmerkungen || '').replace(/\s+/g, ' ').trim(),
    aktualisiert_am: r.updated_at ? format(new Date(r.updated_at), 'dd.MM.yyyy HH:mm') : '',
  }));

  const exportCSV = () => {
    const data = exportRows();
    if (data.length === 0) { toast.info('Keine Daten zum Exportieren'); return; }
    const headers = Object.keys(data[0]);
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(';'),
      ...data.map(row => headers.map(h => escape((row as any)[h])).join(';')),
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fertig_produziert_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} Einträge exportiert`);
  };

  const exportPDF = () => {
    const data = exportRows();
    if (data.length === 0) { toast.info('Keine Daten zum Exportieren'); return; }
    const doc = createPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pageW = 297, pageH = 210, marginX = 10;
    let y = 14;
    doc.setFont('Inter', 'bold'); doc.setFontSize(14);
    doc.text('Production – Fertig produziert', marginX, y);
    doc.setFont('Inter', 'normal'); doc.setFontSize(9);
    doc.text(`Stand: ${format(new Date(), 'dd.MM.yyyy HH:mm')}  ·  ${data.length} Einträge`, pageW - marginX, y, { align: 'right' });
    y += 6;

    const cols = [
      { key: 'bestellnummer',  label: 'Bestell-Nr.', w: 28 },
      { key: 'auftragsnummer', label: 'Auftrag',     w: 26 },
      { key: 'kunde',          label: 'Kunde',       w: 40 },
      { key: 'modell',         label: 'Modell',      w: 32 },
      { key: 'farbe',          label: 'Farbe',       w: 18 },
      { key: 'seriennummer',   label: 'SN',          w: 22 },
      { key: 'bearbeiter',     label: 'Bearbeiter',  w: 24 },
      { key: 'zulieferer',     label: 'Zulieferer',  w: 30 },
      { key: 'liefertermin',   label: 'Liefertermin', w: 22 },
      { key: 'status',         label: 'Status',      w: 22 },
      { key: 'reklamation',    label: 'Rekl.',       w: 14 },
    ] as const;

    const drawHeader = () => {
      doc.setFillColor(30, 30, 30);
      doc.setTextColor(255, 255, 255);
      doc.rect(marginX, y - 4, pageW - marginX * 2, 6, 'F');
      doc.setFont('Inter', 'bold'); doc.setFontSize(8);
      let x = marginX + 1;
      cols.forEach(c => { doc.text(c.label, x, y); x += c.w; });
      y += 4;
      doc.setTextColor(0, 0, 0);
      doc.setFont('Inter', 'normal');
    };
    drawHeader();

    doc.setFontSize(7.5);
    data.forEach((row, idx) => {
      const cellLines = cols.map(c => doc.splitTextToSize(String((row as any)[c.key] ?? ''), c.w - 2));
      const rowH = Math.max(...cellLines.map(l => l.length)) * 3.2 + 1.5;
      if (y + rowH > pageH - 10) { doc.addPage(); y = 14; drawHeader(); doc.setFontSize(7.5); }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(marginX, y - 3, pageW - marginX * 2, rowH, 'F');
      }
      let x = marginX + 1;
      cellLines.forEach((lines, i) => {
        doc.text(lines, x, y);
        x += cols[i].w;
      });
      y += rowH;
    });

    doc.save(`fertig_produziert_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success(`${data.length} Einträge als PDF exportiert`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CheckCircle2}
        title="Production – Fertig produziert"
        subtitle={`${filtered.length} abgeschlossene Produktionsaufträge`}
        noBreadcrumbs
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} title="Als CSV herunterladen">
              <FileDown className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} title="Als PDF herunterladen">
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Suche Auftragsnr., Modell, Kunde, Zulieferer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Keine fertig produzierten Aufträge.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(r => {
              const basePath = r.is_reclamation ? '/order/reklamation' : '/order';
              return (
                <div key={r.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        'bg-green-500/15 text-green-500'
                      )}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-foreground">{r.display_order_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-500">
                            Fertig produziert
                          </span>
                          {r.is_reclamation && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-600 text-white border border-red-400/40">
                              Reklamation
                            </span>
                          )}
                          {r.customer_name && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                              {r.customer_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {r.modellname || '—'} · {r.supplier?.name || '—'} · {r.bearbeiter || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Liefertermin</div>
                        <div className="text-sm font-medium text-foreground">
                          {r.liefertermin && isValid(new Date(r.liefertermin))
                            ? format(new Date(r.liefertermin), 'dd. MMM yyyy', { locale: de })
                            : '—'}
                        </div>
                      </div>
                      <Select
                        value={r.status}
                        onValueChange={(v) => v !== r.status && changeStatus(r, v)}
                        disabled={busyId === r.id}
                      >
                        <SelectTrigger className="h-9 w-[170px]">
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offen">offen</SelectItem>
                          <SelectItem value="in Bearbeitung">in Bearbeitung</SelectItem>
                          <SelectItem value="fertig">fertig produziert</SelectItem>
                          <SelectItem value="versendet">versendet</SelectItem>
                          <SelectItem value="erledigt">erledigt</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendEmail(r)}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        <span className="ml-1">E-Mail</span>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`${basePath}/${r.id}`}><FileText className="w-4 h-4" /></Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
