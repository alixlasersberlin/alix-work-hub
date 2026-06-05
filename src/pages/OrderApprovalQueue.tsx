import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ShieldCheck, Search, Download, Calendar, CheckCircle2, Clock, AlertTriangle, Factory,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Row {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string | null;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  pdf_path: string | null;
  supplier_id: string | null;
  approval_status: string | null;
  created_at: string;
  is_reclamation: boolean;
  customer_name_snapshot: string | null;
  supplier?: { name: string | null } | null;
}

export default function OrderApprovalQueue() {
  const { user, roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select(
        'id, order_number, production_order_number, status, liefertermin, modellname, farbe, bearbeiter, pdf_path, supplier_id, approval_status, created_at, is_reclamation, customer_name_snapshot, supplier:suppliers(name)',
      )
      .or('approval_status.is.null,approval_status.eq.pending')
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    else setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('order-approval-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'production_orders' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const approve = async (id: string) => {
    if (!isSuperAdmin) return;
    setApprovingId(id);
    const { error } = await supabase
      .from('production_orders')
      .update({
        approval_status: 'approved',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        approval_note: null,
      } as any)
      .eq('id', id);
    setApprovingId(null);
    if (error) return toast.error(error.message);
    toast.success('Bestellung freigegeben');
    setRows((prev) => prev.filter((r) => r.id !== id));
    window.dispatchEvent(new Event('einkauf-counts-refresh'));
  };

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
    return rows.filter((r) =>
      `${r.production_order_number || ''} ${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.supplier?.name || ''} ${r.customer_name_snapshot || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Freigabe – ORDER Produktionsbestellungen
          </h1>
          <p className="text-sm text-muted-foreground">
            Wartende Bestellungen, die auf Freigabe durch den Super Admin warten.
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-yellow-500/40 text-yellow-500">
          {filtered.length} wartend
        </Badge>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Auftragsnr., Modell, Farbe, Bearbeiter, Lieferant, Kunde…"
            className="pl-9 h-9"
          />
        </div>
      </Card>

      {!isSuperAdmin && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/5 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
          <div>
            Nur Super Admins können Bestellungen freigeben. Diese Liste ist schreibgeschützt.
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Keine wartenden Bestellungen.
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={r.is_reclamation ? `/order/reklamation/${r.id}` : `/order/${r.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {r.production_order_number || r.order_number}
                  </Link>
                  {r.is_reclamation ? (
                    <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-500">
                      Reklamation
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-500">
                      <Factory className="w-3 h-3 mr-1" /> Order
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                </div>
                {r.customer_name_snapshot && (
                  <div className="text-xs font-medium text-foreground/90 mt-0.5 truncate">
                    {r.customer_name_snapshot}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  {r.modellname && <span>{r.modellname}</span>}
                  {r.farbe && <span>· {r.farbe}</span>}
                  {r.bearbeiter && <span>· {r.bearbeiter}</span>}
                  {r.supplier?.name && <span>· {r.supplier.name}</span>}
                  {r.liefertermin && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(r.liefertermin), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPdf(r.pdf_path, r.production_order_number || r.order_number)}
                  disabled={!r.pdf_path}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                </Button>
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    onClick={() => approve(r.id)}
                    disabled={approvingId === r.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {approvingId === r.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Freigeben
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
