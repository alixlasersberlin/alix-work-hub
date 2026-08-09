import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import SignaturePad from '@/components/finance/SignaturePad';
import { useAuth } from '@/hooks/useAuth';
import { Download, FileText, ShieldCheck, RefreshCw, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STAGES, STATUS_UI, OVERALL_UI, SLA_HOURS, type ApprovalStage } from '@/lib/delivery-approval/config';
import {
  slaLevel, fetchEvents, bulkApproveStage, fetchEscalationStats,
  type DeliveryApproval, type EscalationStat,
} from '@/lib/delivery-approval/api';
import { downloadDeliveryApprovalPdf } from '@/lib/delivery-approval/protokoll-pdf';

const db = supabase as any;

interface Row extends DeliveryApproval {
  order_number?: string | null;
  order_status?: string | null;
  total_amount?: number | null;
}

const hoursBetween = (a?: string | null, b?: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 36e5 : null;

export default function Auslieferungsfreigabe() {
  const { user, profile, hasAnyRole } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'blocked' | 'waiting' | 'released'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStage, setBulkStage] = useState<ApprovalStage>('accounting');
  const [bulkComment, setBulkComment] = useState('');
  const [bulkSig, setBulkSig] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [escalations, setEscalations] = useState<EscalationStat[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from('delivery_approvals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data ?? []) as Row[];
    const ids = list.map((r) => r.order_id);
    if (ids.length) {
      const { data: orders } = await db.from('orders').select('id, order_number, order_status, total_amount').in('id', ids);
      const map = new Map((orders ?? []).map((o: any) => [o.id, o]));
      for (const r of list) {
        const o: any = map.get(r.order_id);
        r.order_number = o?.order_number ?? null;
        r.order_status = o?.order_status ?? null;
        r.total_amount = o?.total_amount ?? null;
      }
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { void load(); void fetchEscalationStats().then(setEscalations).catch(() => {}); }, []);

  // Realtime: Freigaben live aktualisieren
  useEffect(() => {
    const channel = supabase
      .channel('delivery-approvals-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_approvals' }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter !== 'all' && r.overall_status !== filter) return false;
    if (!q.trim()) return true;
    return (r.order_number ?? '').toLowerCase().includes(q.trim().toLowerCase());
  }), [rows, q, filter]);

  const kpi = useMemo(() => {
    const avg = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const blocked = rows.filter((r) => r.overall_status !== 'released' && r.overall_status !== 'delivered' && r.overall_status !== 'completed');
    const slaBreaches = blocked.filter((r) => slaLevel(r.created_at) !== 'ok').length;
    return {
      total: rows.length,
      blocked: blocked.length,
      released: rows.filter((r) => ['released', 'delivered', 'completed'].includes(r.overall_status)).length,
      slaBreaches,
      slaQuote: blocked.length ? Math.round((1 - slaBreaches / blocked.length) * 100) : 100,
      avgWarehouse: avg(rows.map((r) => hoursBetween(r.created_at, r.warehouse_at))),
      avgAccounting: avg(rows.map((r) => hoursBetween(r.warehouse_at, r.accounting_at))),
      avgDispatch: avg(rows.map((r) => hoursBetween(r.accounting_at, r.dispatch_at))),
      avgTotal: avg(rows.map((r) => hoursBetween(r.created_at, r.released_at))),
    };
  }, [rows]);

  const openReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (['released', 'delivered', 'completed'].includes(r.overall_status)) continue;
      for (const s of STAGES) {
        if ((r as any)[`${s.stage}_status`] !== 'approved') { counts[s.title] = (counts[s.title] ?? 0) + 1; break; }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const exportCsv = () => {
    const head = ['Auftrag', 'Gesamtstatus', 'Bereitstellung', 'Buchhaltung', 'Tourenplanung', 'Erstellt', 'Freigegeben'];
    const lines = filtered.map((r) => [
      r.order_number ?? r.order_id,
      OVERALL_UI[r.overall_status].label,
      STATUS_UI[r.warehouse_status].label,
      STATUS_UI[r.accounting_status].label,
      STATUS_UI[r.dispatch_status].label,
      new Date(r.created_at).toLocaleString('de-DE'),
      r.released_at ? new Date(r.released_at).toLocaleString('de-DE') : '',
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `auslieferungsfreigabe-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Auslieferungsfreigabe – Übersicht', 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Stand ${new Date().toLocaleString('de-DE')} · Offen: ${kpi.blocked} · Freigegeben: ${kpi.released} · SLA-Einhaltung: ${kpi.slaQuote}%`,
      14, 20,
    );
    autoTable(doc, {
      startY: 26,
      head: [['Auftrag', 'Gesamtstatus', 'Bereitstellung', 'Buchhaltung', 'Tourenplanung', 'Erstellt', 'Freigegeben']],
      body: filtered.map((r) => [
        r.order_number ?? r.order_id.slice(0, 8),
        OVERALL_UI[r.overall_status].label,
        STATUS_UI[r.warehouse_status].label,
        STATUS_UI[r.accounting_status].label,
        STATUS_UI[r.dispatch_status].label,
        new Date(r.created_at).toLocaleDateString('de-DE'),
        r.released_at ? new Date(r.released_at).toLocaleDateString('de-DE') : '—',
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`auslieferungsfreigabe-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const h = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)} h`);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Auslieferungsfreigabe</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Excel/CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Offene Freigaben</div><div className="text-2xl font-semibold">{kpi.blocked}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Freigegeben</div><div className="text-2xl font-semibold text-emerald-400">{kpi.released}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">SLA-Einhaltung ({SLA_HOURS.reminder}/{SLA_HOURS.lead}/{SLA_HOURS.operations} h)</div><div className="text-2xl font-semibold">{kpi.slaQuote}%</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Ø Auftrag → Freigabe</div><div className="text-2xl font-semibold">{h(kpi.avgTotal)}</div></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-3">
          <div className="text-sm font-medium mb-2">Ø Freigabezeit pro Abteilung</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-xs text-muted-foreground">Bereitstellung</div>{h(kpi.avgWarehouse)}</div>
            <div><div className="text-xs text-muted-foreground">Buchhaltung</div>{h(kpi.avgAccounting)}</div>
            <div><div className="text-xs text-muted-foreground">Tourenplanung</div>{h(kpi.avgDispatch)}</div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-sm font-medium mb-2">Häufigste Blockade-Stufen</div>
          {openReasons.length === 0 ? <div className="text-sm text-muted-foreground">Keine offenen Freigaben.</div> : (
            <div className="space-y-1 text-sm">
              {openReasons.map(([label, count]) => (
                <div key={label} className="flex justify-between"><span>{label}</span><span className="font-medium">{count}</span></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />Eskalationen (Stufe 1 = 24 h, 2 = 48 h, 3 = 72 h)
        </div>
        {escalations.length === 0 ? (
          <div className="text-sm text-muted-foreground">Bisher keine Eskalationen ausgelöst.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {STAGES.map((s) => {
              const stats = escalations.filter((e) => e.stage === s.stage);
              return (
                <div key={s.stage} className="rounded-md border border-border p-2">
                  <div className="text-xs text-muted-foreground">{s.title}</div>
                  <div className="flex gap-3 text-sm mt-1">
                    {[1, 2, 3].map((l) => (
                      <span key={l}>
                        <span className="text-xs text-muted-foreground">L{l}</span>{' '}
                        <span className="font-medium">{stats.find((x) => x.level === l)?.count ?? 0}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftragsnummer suchen…" className="max-w-xs" />
        {(['all', 'blocked', 'waiting', 'released'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Alle' : OVERALL_UI[f].label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} Einträge</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
          onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((r) => r.id)) : new Set())}
        />
        <span className="text-xs text-muted-foreground">Alle sichtbaren markieren</span>
        {selected.size > 0 && (
          <>
            <Badge variant="outline">{selected.size} markiert</Badge>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" />Sammelfreigabe
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Auswahl aufheben</Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">Keine Freigabevorgänge gefunden.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((r) => {
            const ov = OVERALL_UI[r.overall_status];
            const sla = slaLevel(r.created_at);
            return (
              <Link key={r.id} to={`/orders/${r.order_id}?tab=freigaben`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-accent/20">
                <span className={`h-3 w-3 rounded-full ${ov.dot}`} />
                <div className="font-medium min-w-[140px]">{r.order_number ?? r.order_id.slice(0, 8)}</div>
                <Badge variant="outline" className={ov.text}>{ov.label}</Badge>
                <div className="flex gap-2">
                  {STAGES.map((s) => {
                    const st = (r as any)[`${s.stage}_status`] as keyof typeof STATUS_UI;
                    return (
                      <span key={s.stage} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_UI[st].dot}`} />{s.title}
                      </span>
                    );
                  })}
                </div>
                {r.overall_status !== 'released' && sla !== 'ok' && (
                  <Badge variant="outline" className="text-amber-400">SLA {sla === 'reminder' ? '24 h' : sla === 'lead' ? '48 h' : '72 h'}</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('de-DE')}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  title="Freigabeprotokoll als PDF"
                  onClick={async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    try {
                      const events = await fetchEvents(r.order_id);
                      downloadDeliveryApprovalPdf({ approval: r, events, orderNumber: r.order_number });
                    } catch (err: any) { toast.error(err?.message ?? 'PDF konnte nicht erstellt werden'); }
                  }}
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
