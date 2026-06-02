import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, Search, Download, Building2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  pdf_path: string | null;
  supplier_id: string;
  approval_status: string;
  approved_at: string | null;
  created_at: string;
  is_reclamation: boolean;
  customer_name_snapshot: string | null;
  supplier?: { name: string | null } | null;
}

export default function ProductionOrderIn() {
  const { roles } = useAuth();
  const isAdmin = roles.includes('Admin') || roles.includes('Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('id, order_number, production_order_number, status, liefertermin, modellname, farbe, bearbeiter, pdf_path, supplier_id, approval_status, approved_at, created_at, is_reclamation, customer_name_snapshot, supplier:suppliers(name)')
      .eq('approval_status', 'approved')
      .order('approved_at', { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const downloadPdf = async (path: string | null, orderNumber: string) => {
    if (!path) return toast.error('Kein PDF verfügbar');
    const { data, error } = await supabase.storage.from('production-orders').download(path);
    if (error || !data) return toast.error(error?.message || 'Download fehlgeschlagen');
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.production_order_number || ''} ${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.supplier?.name || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { supplierName: string; items: Row[] }>();
    for (const r of filtered) {
      const key = r.supplier_id || 'unknown';
      const name = r.supplier?.name || 'Unbekannter Lieferant';
      if (!map.has(key)) map.set(key, { supplierName: name, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].supplierName.localeCompare(b[1].supplierName));
  }, [filtered]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Order In
          </h1>
          <p className="text-sm text-muted-foreground">
            Freigegebene Bestellungen, gruppiert nach Lieferant
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {filtered.length} freigegebene Bestellungen
        </Badge>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Lieferant, Auftragsnr., Modell, Farbe…"
            className="pl-9 h-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Keine freigegebenen Bestellungen vorhanden.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, group]) => (
            <Card key={key} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-blue-500/5 border-b border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <h2 className="font-semibold text-foreground">{group.supplierName}</h2>
                </div>
                <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-500">
                  {group.items.length}
                </Badge>
              </div>
              <div className="divide-y divide-border">
                {group.items.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.production_order_number || r.order_number}</span>
                        {r.is_reclamation && (
                          <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-500">Reklamation</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                        {r.modellname && <span>{r.modellname}</span>}
                        {r.farbe && <span>· {r.farbe}</span>}
                        {r.bearbeiter && <span>· {r.bearbeiter}</span>}
                        {r.liefertermin && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(r.liefertermin), 'dd.MM.yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPdf(r.pdf_path, r.production_order_number || r.order_number)}
                        disabled={!r.pdf_path}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                      </Button>
                      {isAdmin && (
                        <Link to={`/order/${r.id}`}>
                          <Button variant="ghost" size="sm">Öffnen</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
