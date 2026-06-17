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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CheckCircle2}
        title="Production – Fertig produziert"
        subtitle={`${filtered.length} abgeschlossene Produktionsaufträge`}
        noBreadcrumbs
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
