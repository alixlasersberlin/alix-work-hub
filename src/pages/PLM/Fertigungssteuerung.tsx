import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Factory, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PRODUCTION_STATUS, plmLabel } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const COLUMNS = PRODUCTION_STATUS.filter(s => s !== 'storniert');

const colTone: Record<string, string> = {
  geplant: 'border-muted-foreground/30',
  material_bereit: 'border-sky-500/40',
  in_fertigung: 'border-amber-500/40',
  in_pruefung: 'border-violet-500/40',
  fertig: 'border-emerald-500/40',
  freigegeben: 'border-emerald-500/60',
};

export default function PlmFertigungssteuerung() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Row[]>([]);
  const [devices, setDevices] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [o, d] = await Promise.all([
      supabase.from('plm_production_orders' as any).select('*').order('planned_start', { ascending: true }).limit(2000),
      supabase.from('plm_devices' as any).select('id,name,article_number').limit(2000),
    ]);
    if (o.error || d.error) toast.error((o.error || d.error)!.message);
    setOrders((o.data as any[]) || []);
    setDevices((d.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deviceLabel = (id?: string | null) => {
    const d = devices.find(x => x.id === id);
    return d ? `${d.name}${d.article_number ? ` · ${d.article_number}` : ''}` : '—';
  };

  const move = async (row: Row, dir: 1 | -1) => {
    const idx = COLUMNS.indexOf(row.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    setBusy(row.id);
    const patch: Record<string, any> = { status: next };
    if (next === 'in_fertigung' && !row.actual_start) patch.actual_start = new Date().toISOString().slice(0, 10);
    if (next === 'fertig' && !row.actual_end) patch.actual_end = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('plm_production_orders' as any).update(patch).eq('id', row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    await supabase.from('plm_audit_log' as any).insert({
      entity_type: 'production_order',
      entity_id: row.id,
      action: 'status_change',
      details: { from: row.status, to: next },
    } as any);
    setOrders(prev => prev.map(o => (o.id === row.id ? { ...o, ...patch } : o)));
    toast.success(`Status: ${plmLabel(next)}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      [o.order_number, o.batch_number, deviceLabel(o.device_id)]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)),
    );
  }, [orders, search, devices]);

  const byCol = (s: string) => filtered.filter(o => o.status === s);
  const totalQty = (s: string) => byCol(s).reduce((a, b) => a + (Number(b.quantity) || 0), 0);

  const overdue = (o: Row) =>
    o.planned_end && !['fertig', 'freigegeben'].includes(o.status) && new Date(o.planned_end) < new Date();

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader
        icon={Factory}
        title="Fertigungssteuerung"
        subtitle="Produktionsaufträge im Fertigungsfluss – Status, Termine und Chargen auf einen Blick."
        noBreadcrumbs
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Suche Auftragsnummer, Charge oder Gerät…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="outline">{filtered.length} Aufträge</Badge>
        <Badge variant="outline">
          {filtered.filter(overdue).length} überfällig
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Produktionsaufträge…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {COLUMNS.map(col => (
            <Card key={col} className={`border-t-4 ${colTone[col] || 'border-border'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{plmLabel(col)}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {byCol(col).length} · {totalQty(col)} Stk
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {byCol(col).length === 0 && (
                  <p className="text-xs text-muted-foreground">Keine Aufträge.</p>
                )}
                {byCol(col).map(o => (
                  <div key={o.id} className="rounded-md border bg-card/60 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs">{o.order_number || '—'}</span>
                      <Badge variant="outline" className="text-[10px]">{o.quantity ?? 1} Stk</Badge>
                    </div>
                    <p className="text-sm leading-tight">{deviceLabel(o.device_id)}</p>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {o.planned_start && <div>Start: {o.planned_start}</div>}
                      {o.planned_end && (
                        <div className={overdue(o) ? 'text-destructive' : ''}>
                          Ende: {o.planned_end}{overdue(o) ? ' · überfällig' : ''}
                        </div>
                      )}
                      {o.batch_number && <div>Charge: {o.batch_number}</div>}
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={busy === o.id || COLUMNS.indexOf(col) === 0}
                        onClick={() => move(o, -1)}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1"
                        disabled={busy === o.id || COLUMNS.indexOf(col) === COLUMNS.length - 1}
                        onClick={() => move(o, 1)}
                      >
                        Weiter <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
