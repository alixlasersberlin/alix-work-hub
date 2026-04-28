import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Factory, Download, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProductionOrderRow {
  id: string;
  order_number: string;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  power_handstueck: string | null;
  sonderwuensche: string | null;
  anmerkungen: string | null;
  seriennummer: string | null;
  pdf_path: string | null;
  created_at: string;
  sent_at: string | null;
  supplier?: { name: string | null } | null;
}

const STATUS_OPTIONS = [
  'offen',
  'in Bearbeitung',
  'fertig',
  'versendet',
];

export default function ProductionPortal() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductionOrderRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductionOrderRow>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name)')
      .order('liefertermin', { ascending: true });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('production_orders')
      .update({ status: newStatus })
      .eq('id', id);
    setUpdatingId(null);
    if (error) return toast.error(error.message);
    toast.success('Status aktualisiert');
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const openEdit = (row: ProductionOrderRow) => {
    setEditing(row);
    setEditForm({
      modellname: row.modellname,
      farbe: row.farbe,
      power_handstueck: row.power_handstueck,
      bearbeiter: row.bearbeiter,
      seriennummer: row.seriennummer,
      sonderwuensche: row.sonderwuensche,
      anmerkungen: row.anmerkungen,
      status: row.status,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      modellname: editForm.modellname ?? null,
      farbe: editForm.farbe ?? '',
      power_handstueck: editForm.power_handstueck ?? '',
      bearbeiter: editForm.bearbeiter ?? '',
      seriennummer: editForm.seriennummer ?? null,
      sonderwuensche: editForm.sonderwuensche ?? null,
      anmerkungen: editForm.anmerkungen ?? null,
      status: editForm.status ?? editing.status,
    };
    const { error } = await supabase
      .from('production_orders')
      .update(payload)
      .eq('id', editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Auftrag gespeichert');
    setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...payload } as ProductionOrderRow : r));
    setEditing(null);
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

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    const hay = `${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.seriennummer || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const supplierName = rows[0]?.supplier?.name;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Factory className="w-6 h-6" /> PRODUCTION
          </h1>
          <p className="text-sm text-muted-foreground">
            Arbeitsliste {supplierName ? `– ${supplierName}` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Angemeldet als <span className="text-foreground font-medium">{profile?.full_name || profile?.email}</span>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Auftragsnr., Modell, Farbe, Seriennr., Bearbeiter…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Aktualisieren
        </Button>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Bestellungen gefunden.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(row => (
            <Card key={row.id} className="p-5 space-y-3 card-glow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-foreground">{row.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    Liefertermin: <span className="text-foreground font-medium">
                      {row.liefertermin ? format(new Date(row.liefertermin), 'dd.MM.yyyy') : '—'}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {row.pdf_path && (
                    <Button size="sm" variant="outline" onClick={() => downloadPdf(row.pdf_path, row.order_number)}>
                      <Download className="w-4 h-4 mr-1" /> PDF
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Modell:</span>{' '}
                  <span className="text-foreground">{row.modellname || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Farbe:</span>{' '}
                  <span className="text-foreground">{row.farbe || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Power-Handstück:</span>{' '}
                  <span className="text-foreground">{row.power_handstueck || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bearbeiter:</span>{' '}
                  <span className="text-foreground">{row.bearbeiter || '—'}</span>
                </div>
                {row.seriennummer && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Seriennummer:</span>{' '}
                    <span className="text-foreground">{row.seriennummer}</span>
                  </div>
                )}
                {row.sonderwuensche && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Sonderwünsche:</span>{' '}
                    <span className="text-foreground">{row.sonderwuensche}</span>
                  </div>
                )}
                {row.anmerkungen && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Anmerkungen:</span>{' '}
                    <span className="text-foreground">{row.anmerkungen}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select
                  value={row.status}
                  onValueChange={(v) => updateStatus(row.id, v)}
                  disabled={updatingId === row.id}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatingId === row.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
