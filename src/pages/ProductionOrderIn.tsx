import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Inbox, Search, Download, Building2, Calendar, UserCog, Warehouse, RefreshCw, PackagePlus, Truck, Factory, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import OrderPickerDialog from '@/components/OrderPickerDialog';
import { cn } from '@/lib/utils';

type LagerTarget = 'Bestand' | 'Transfer' | 'Produktion';
const LAGER_TARGETS: { value: LagerTarget; label: string; icon: typeof Warehouse; route: string }[] = [
  { value: 'Bestand',    label: 'Lagergeräte',  icon: Warehouse, route: '/lager/lagergeraete' },
  { value: 'Transfer',   label: 'Unterwegs',    icon: Truck,     route: '/lager/equipment-area/unterwegs' },
  { value: 'Produktion', label: 'Produktion',   icon: Factory,   route: '/lager/equipment-area/produktion' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'offen', label: 'offen' },
  { value: 'in Bearbeitung', label: 'in Bearbeitung' },
  { value: 'fertig', label: 'fertig produziert' },
  { value: 'versendet', label: 'versendet' },
  { value: 'erledigt', label: 'erledigt' },
];

interface Row {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  seriennummer: string | null;
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
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isAdmin = roles.includes('Admin') || roles.includes('Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reassignFor, setReassignFor] = useState<Row | null>(null);
  const [moveFor, setMoveFor] = useState<{ row: Row; target: LagerTarget } | null>(null);
  const [moveSerial, setMoveSerial] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const canReassign = isAdmin || roles.includes('Auftragsverwaltung') || roles.includes('Order');
  const [busyId, setBusyId] = useState<string | null>(null);

  const changeStatus = async (r: Row, newStatus: string) => {
    setBusyId(r.id);
    const { error } = await supabase
      .from('production_orders')
      .update({ status: newStatus })
      .eq('id', r.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Status geändert: "${newStatus}"`);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: newStatus } : x));
  };

  const openMoveDialog = (r: Row, target: LagerTarget) => {
    setMoveSerial(r.seriennummer || '');
    setMoveFor({ row: r, target });
  };

  const confirmMove = async () => {
    if (!moveFor) return;
    const serial = moveSerial.trim();
    if (!serial) { toast.error('Seriennummer wird benötigt'); return; }
    const { row: r, target } = moveFor;
    setMoveBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const today = new Date().toISOString().slice(0, 10);
      const targetCfg = LAGER_TARGETS.find(t => t.value === target)!;

      // Check if a lager_devices entry already exists for this serial
      const { data: existing } = await supabase
        .from('lager_devices')
        .select('id, notes')
        .eq('serial_number', serial)
        .maybeSingle();

      const modelWithColor = [r.modellname, r.farbe].filter(Boolean).join(' ');
      const meta = `[Aus Bestellung: ${r.production_order_number || r.order_number}]`;
      const tagPrefix = `[Typ: Neugerät] [Status: ${target}]`;

      if (existing) {
        // rewrite status tag while keeping other content
        const cleaned = (existing.notes || '')
          .replace(/\s*\[Typ:\s*[^\]]+\]\s*/g, ' ')
          .replace(/\s*\[Status:\s*[^\]]+\]\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const newNotes = `${tagPrefix} ${meta}${cleaned ? ' ' + cleaned : ''}`.trim();
        const { error } = await supabase
          .from('lager_devices')
          .update({ notes: newNotes, model_name: modelWithColor || r.modellname || '—', updated_by: userData.user?.id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lager_devices').insert([{
          serial_number: serial,
          model_name: modelWithColor || r.modellname || '—',
          entry_date: today,
          notes: `${tagPrefix} ${meta}`.trim(),
          reserved_order_id: null,
          created_by: userData.user?.id,
          updated_by: userData.user?.id,
          airtable_record_id: null,
        }]);
        if (error) throw error;
      }

      // Map lager target → production_orders.status
      const statusMap: Record<LagerTarget, string> = {
        Bestand: 'fertig',
        Transfer: 'versendet',
        Produktion: 'in Bearbeitung',
      };
      const newProdStatus = statusMap[target];
      await supabase.from('production_orders')
        .update({ status: newProdStatus, seriennummer: serial })
        .eq('id', r.id);

      setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: newProdStatus, seriennummer: serial } : x));
      toast.success(`In "${targetCfg.label}" verschoben`, {
        action: { label: 'Öffnen', onClick: () => navigate(targetCfg.route) },
      });
      setMoveFor(null);
      setMoveSerial('');
    } catch (e: any) {
      toast.error('Verschieben fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setMoveBusy(false);
    }
  };


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('id, order_number, production_order_number, status, liefertermin, modellname, farbe, bearbeiter, seriennummer, pdf_path, supplier_id, approval_status, approved_at, created_at, is_reclamation, customer_name_snapshot, supplier:suppliers(name)')
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {filtered.length} freigegebene Bestellungen
          </Badge>
          <Button variant="outline" size="sm" onClick={() => navigate('/lager')}>
            <Warehouse className="w-4 h-4 mr-1.5" /> Zur Lagerverwaltung
          </Button>
        </div>
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
                        {r.liefertermin && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(r.liefertermin), 'dd.MM.yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
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
                          {STATUS_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              (r.status === 'fertig' || r.status === 'versendet') &&
                                'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10',
                            )}
                          >
                            <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
                            Verschieben
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>In Lager-Abteilung</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {LAGER_TARGETS.map(t => {
                            const Icon = t.icon;
                            return (
                              <DropdownMenuItem key={t.value} onClick={() => openMoveDialog(r, t.value)}>
                                <Icon className="w-3.5 h-3.5 mr-2" />
                                {t.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!r.pdf_path) {
                            toast.error('Kein PDF verfügbar für diese Bestellung');
                            return;
                          }
                          downloadPdf(r.pdf_path, r.production_order_number || r.order_number);
                        }}
                        className={!r.pdf_path ? 'opacity-60' : ''}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                      </Button>
                      {canReassign && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReassignFor(r)}
                          title="Auftrag/Kunde zuweisen"
                        >
                          <UserCog className="w-3.5 h-3.5 mr-1.5" /> Zuweisen
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/order/${r.id}`)}
                        >
                          Öffnen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <OrderPickerDialog
        open={!!reassignFor}
        filterModel={reassignFor?.modellname || null}
        onOpenChange={(o) => { if (!o) setReassignFor(null); }}
        onSelect={async (o) => {
          if (!reassignFor) return;
          const customerName = o.customers?.company_name || o.customers?.contact_name || null;
          const { error } = await supabase
            .from('production_orders')
            .update({ order_number: o.order_number, customer_name_snapshot: customerName })
            .eq('id', reassignFor.id);
          if (error) { toast.error(error.message); return; }
          toast.success(`Bestellung neu zugewiesen: ${o.order_number}`);
          setReassignFor(null);
          load();
        }}
      />
    </div>
  );
}
