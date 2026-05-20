import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Calendar, Loader2, Factory, AlertTriangle, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  display_order_number: string;
  order_number: string;
  production_order_number: string | null;
  modellname: string | null;
  bearbeiter: string;
  liefertermin: string;
  status: string;
  payment_status: string;
  is_reclamation: boolean;
  supplier?: { name: string | null } | null;
  customer_name?: string | null;
};

export default function ProductionTimeline() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'order' | 'reclamation'>('all');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<'10' | '20' | '30' | 'all'>('20');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name)')
      .order('liefertermin', { ascending: true });
    if (error) toast.error(error.message);
    else {
      const list = (data || []).map((r: any) => ({
        ...r,
        display_order_number: r.production_order_number || r.order_number,
      }));
      // Fetch customer names via orders.order_number
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
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'order' && r.is_reclamation) return false;
      if (filter === 'reclamation' && !r.is_reclamation) return false;
      if (!q) return true;
      const haystack = [
        r.bearbeiter,
        r.display_order_number,
        r.order_number,
        r.production_order_number,
        r.modellname,
        r.supplier?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, filter, search]);

  const visible = useMemo(() => {
    if (pageSize === 'all') return filtered;
    return filtered.slice(0, parseInt(pageSize, 10));
  }, [filtered, pageSize]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDeliveryStatus = (liefertermin: string) => {
    const date = new Date(liefertermin);
    if (!isValid(date)) return { label: '—', cls: 'bg-muted text-muted-foreground' };
    const diff = differenceInCalendarDays(date, today);
    if (diff < 0) return { label: `${Math.abs(diff)} Tage überfällig`, cls: 'bg-destructive/15 text-destructive' };
    if (diff === 0) return { label: 'Heute fällig', cls: 'bg-yellow-500/15 text-yellow-500' };
    if (diff <= 7) return { label: `In ${diff} Tagen`, cls: 'bg-yellow-500/15 text-yellow-500' };
    return { label: `In ${diff} Tagen`, cls: 'bg-green-500/15 text-green-500' };
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Calendar className="w-5 h-5 md:w-6 md:h-6" /> Timeline
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Alle Bestellungen und Reklamationen nach Fälligkeit sortiert
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
          {(['all', 'order', 'reclamation'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' ? 'Alle' : f === 'order' ? 'Bestellungen' : 'Reklamationen'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Auftragsnummer, Modell oder Zulieferer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
          <Select value={pageSize} onValueChange={(v: any) => setPageSize(v)}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {visible.length} / {filtered.length}
          </span>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Keine Einträge vorhanden.</div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map(r => {
              const ds = getDeliveryStatus(r.liefertermin);
              const basePath = r.is_reclamation ? '/order/reklamation' : '/order';
              return (
                <div key={r.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        r.is_reclamation ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
                      )}>
                        {r.is_reclamation ? <AlertTriangle className="w-4 h-4" /> : <Factory className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-foreground">{r.display_order_number}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium',
                            r.is_reclamation ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'
                          )}>
                            {r.is_reclamation ? 'Reklamation' : 'Bestellung'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{r.status}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {r.modellname || '—'} · {r.supplier?.name || '—'} · {r.bearbeiter}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {r.liefertermin && isValid(new Date(r.liefertermin))
                            ? format(new Date(r.liefertermin), 'dd. MMM yyyy', { locale: de })
                            : '—'}
                        </div>
                        <span className={cn('inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium', ds.cls)}>
                          {ds.label}
                        </span>
                      </div>
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
