import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { magicSearch, groupHits, MAGIC_KIND_LABEL, type MagicHit } from '@/lib/magic/search';
import { statusLabel, statusTone, TONE_CLASS } from '@/lib/magic/statuses';
import MagicOrderPanel from './MagicOrderPanel';

const QUICK_FILTERS: { key: string; label: string }[] = [
  { key: 'heute', label: 'HEUTE' },
  { key: 'ueberfaellig', label: 'ÜBERFÄLLIG' },
  { key: 'serial_missing', label: 'SERIENNUMMER FEHLT' },
  { key: 'payment_open', label: 'ZAHLUNG OFFEN' },
  { key: 'in_produktion', label: 'IN PRODUKTION' },
  { key: 'ware_unterwegs', label: 'WARE UNTERWEGS' },
  { key: 'ware_eingegangen', label: 'WARE EINGEGANGEN' },
  { key: 'technische_pruefung', label: 'PRÜFUNG OFFEN' },
  { key: 'versandbereit', label: 'VERSANDBEREIT' },
  { key: 'in_auslieferung', label: 'AUSLIEFERUNG' },
  { key: 'abnahme_offen', label: 'ABNAHME OFFEN' },
  { key: 'gesperrt', label: 'BLOCKIERT' },
];

interface ListRow { id: string; order_number: string; source_system: string | null; magic_status: string | null; order_status: string | null; total_amount: number | null; currency: string | null; customers?: any }

export default function MagicStatusPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [hits, setHits] = useState<MagicHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(params.get('order'));
  const [filter, setFilter] = useState<string | null>(null);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setHits(await magicSearch(term)); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // KPI-Kacheln
  useEffect(() => {
    (async () => {
      const keys = ['in_produktion', 'ware_unterwegs', 'technische_pruefung', 'versandbereit', 'in_auslieferung', 'gesperrt'];
      const out: Record<string, number> = {};
      const results = await Promise.all(keys.map((k) =>
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('magic_status', k)));
      keys.forEach((k, i) => { out[k] = results[i].count ?? 0; });
      const open = await supabase.from('orders').select('id', { count: 'exact', head: true }).is('magic_status', null);
      out.offen = open.count ?? 0;
      setKpis(out);
    })();
  }, []);

  const loadFilter = useCallback(async (key: string) => {
    setFilter(key);
    let query = supabase.from('orders')
      .select('id, order_number, source_system, magic_status, order_status, total_amount, currency, customers(company_name, contact_name)')
      .order('created_at', { ascending: false }).limit(100);
    if (key === 'heute') query = query.gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
    else if (key === 'ueberfaellig') query = query.lt('expected_shipment_date', new Date().toISOString());
    else if (key === 'payment_open') query = query.gt('finance_open_amount', 0);
    else if (key === 'serial_missing') query = query.is('magic_status', null);
    else query = query.eq('magic_status', key);
    const { data } = await query;
    setRows((data ?? []) as any[]);
  }, []);

  const grouped = useMemo(() => groupHits(hits), [hits]);
  const openOrder = (id: string) => {
    setOrderId(id);
    setParams({ order: id }, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-primary" /> MAGIC STATUS
        </h1>
        <p className="text-sm text-muted-foreground">Suchen. Ändern. Ausführen.</p>
      </div>

      <Card className="p-3 backdrop-blur bg-card/70 border-border/60">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Auftrag, Kunde, Seriennummer, Gerät oder Bestellung suchen …"
            className="pl-12 h-16 text-lg"
          />
          {loading && <Loader2 className="w-5 h-5 animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        </div>
      </Card>

      {/* KPI */}
      {q.trim().length < 2 && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {[
            { k: 'offen', l: 'OFFENE AUFTRÄGE' },
            { k: 'in_produktion', l: 'IN PRODUKTION' },
            { k: 'ware_unterwegs', l: 'WARE UNTERWEGS' },
            { k: 'technische_pruefung', l: 'PRÜFUNG OFFEN' },
            { k: 'versandbereit', l: 'VERSANDBEREIT' },
            { k: 'in_auslieferung', l: 'IN AUSLIEFERUNG' },
            { k: 'gesperrt', l: 'BLOCKIERT' },
          ].map((c) => (
            <button key={c.k} onClick={() => loadFilter(c.k === 'offen' ? 'serial_missing' : c.k)}
              className="rounded-xl border border-border/60 bg-card/60 p-3 text-left hover:border-primary/50 transition">
              <div className="text-2xl font-bold">{kpis[c.k] ?? 0}</div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
            </button>
          ))}
        </div>
      )}

      {/* Magic Filter */}
      {q.trim().length < 2 && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <button key={f.key} onClick={() => loadFilter(f.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${filter === f.key ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 items-start">
        {/* links: Ergebnisse */}
        <div className="space-y-3">
          {grouped.map(([kind, arr]) => (
            <div key={kind} className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{MAGIC_KIND_LABEL[kind]}</div>
              {arr.map((h) => (
                <Card key={`${h.kind}-${h.id}`} className="p-3 hover:border-primary/50 transition cursor-pointer"
                  onClick={() => h.orderId ? openOrder(h.orderId) : undefined}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{h.title}</div>
                      {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      {h.meta && <div className="text-[11px] text-muted-foreground">{h.meta}</div>}
                      {h.orderId
                        ? <span className="text-[10.5px] text-primary">MAGIC STATUS ÖFFNEN</span>
                        : <span className="text-[10.5px] text-muted-foreground">kein Auftrag verknüpft</span>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))}

          {q.trim().length >= 2 && !loading && hits.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Keine Treffer.</Card>
          )}

          {q.trim().length < 2 && rows.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">
                {QUICK_FILTERS.find((f) => f.key === filter)?.label ?? 'AUFTRÄGE'} · {rows.length}
              </div>
              {rows.map((r) => (
                <Card key={r.id} className="p-3 hover:border-primary/50 transition cursor-pointer" onClick={() => openOrder(r.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {r.order_number}{r.source_system === 'zoho_eu_2' ? '-AT' : ''}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(r.customers as any)?.company_name || (r.customers as any)?.contact_name || '—'}
                      </div>
                    </div>
                    <Badge variant="outline" className={TONE_CLASS[statusTone(r.magic_status)]}>
                      {statusLabel(r.magic_status)}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {q.trim().length < 2 && rows.length === 0 && !filter && (
            <Card className="p-6 text-sm text-muted-foreground flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                Tippe eine Auftrags-, Kunden- oder Seriennummer – oder wähle oben einen Magic Filter.
                Überall in AlixWork erreichbar über <kbd className="px-1 border rounded">⌘</kbd>/<kbd className="px-1 border rounded">Ctrl</kbd> + <kbd className="px-1 border rounded">K</kbd>.
              </div>
            </Card>
          )}
        </div>

        {/* rechts: Magic-Akte */}
        <div className="lg:sticky lg:top-4">
          {orderId
            ? <MagicOrderPanel orderId={orderId} onClose={() => { setOrderId(null); setParams({}, { replace: true }); }} />
            : <Card className="p-8 text-center text-sm text-muted-foreground">Kein Auftrag ausgewählt.</Card>}
        </div>
      </div>
    </div>
  );
}
