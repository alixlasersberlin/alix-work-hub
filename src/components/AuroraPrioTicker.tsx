import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, GanttChart, Package, ChevronDown, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withAt } from '@/lib/atSuffix';
import { useDesignVariant } from '@/hooks/useDesignVariant';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Aurora Ticker – Laufschrift mit umschaltbaren Quellen (Prio / Timeline / Lager).
 * Nur sichtbar im Aurora-Design.
 */

type Mode = 'prio' | 'timeline' | 'lager' | 'cnn';

interface TickerItem {
  id: string;
  label: string;
  meta: string;
  tone: string;
  href?: string;
}

const MODE_STORAGE_KEY = 'aurora-ticker-mode';

const MODES: { value: Mode; label: string; icon: typeof Flame }[] = [
  { value: 'prio', label: 'PRIO Top 10', icon: Flame },
  { value: 'timeline', label: 'Timeline Top 10', icon: GanttChart },
  { value: 'lager', label: 'Lagerbestand', icon: Package },
  { value: 'cnn', label: 'CNN Live', icon: Radio },
];

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date); t.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - n.getTime()) / 86_400_000);
}

function dateLabel(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} Tage überfällig`;
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}

function dateTone(days: number | null): string {
  if (days === null) return 'text-foreground/60';
  if (days < 0) return 'text-[hsl(0_72%_55%)]';
  if (days <= 7) return 'text-[hsl(38_92%_50%)]';
  return 'text-[hsl(43_95%_55%)]';
}

export default function AuroraPrioTicker() {
  const { variant } = useDesignVariant();
  const { hasRole } = useAuth();
  const atOnly = hasRole('Österreich');
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'prio';
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY) as Mode | null;
    return stored && MODES.some(m => m.value === stored) ? stored : 'prio';
  });
  const [items, setItems] = useState<TickerItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (variant !== 'aurora') return;
    let cancelled = false;

    async function loadPrio() {
      let q = supabase
        .from('orders')
        .select('id, order_number, source_system, expected_shipment_date, customers(company_name, contact_name)')
        .not('expected_shipment_date', 'is', null)
        .in('order_status', ['overdue', 'Overdue', 'invoiced', 'Invoiced', 'open', 'Open', 'offen', 'Offen', 'approved', 'Approved']);
      if (atOnly) q = q.eq('source_system', 'zoho_eu_2');
      const { data } = await q.order('expected_shipment_date', { ascending: true }).limit(10);
      return (data ?? []).map((r: any): TickerItem => {
        const d = daysUntil(r.expected_shipment_date);
        const name = r.customers?.company_name || r.customers?.contact_name || '—';
        return {
          id: r.id,
          label: `#${withAt(r.order_number, r.source_system)}  ${name}`,
          meta: dateLabel(d),
          tone: dateTone(d),
          href: `/order/${r.id}`,
        };
      });
    }

    async function loadTimeline() {
      let q = supabase
        .from('production_orders')
        .select('id, production_order_number, order_number, modellname, liefertermin, customer_name_snapshot, orders!inner(source_system)')
        .not('liefertermin', 'is', null);
      if (atOnly) q = q.eq('orders.source_system', 'zoho_eu_2');
      const { data } = await q.order('liefertermin', { ascending: true }).limit(10);
      return (data ?? []).map((r: any): TickerItem => {
        const d = daysUntil(r.liefertermin);
        const num = r.production_order_number || r.order_number || '—';
        const name = r.customer_name_snapshot || r.modellname || '—';
        return {
          id: r.id,
          label: `#${num}  ${name}`,
          meta: dateLabel(d),
          tone: dateTone(d),
          href: `/order/timeline`,
        };
      });
    }

    async function loadLager() {
      let q = supabase
        .from('lager_devices')
        .select(atOnly
          ? 'id, serial_number, model_name, entry_date, reserved_order_id, orders!inner(source_system)'
          : 'id, serial_number, model_name, entry_date, reserved_order_id');
      if (atOnly) q = q.eq('orders.source_system', 'zoho_eu_2');
      const { data } = await q.order('entry_date', { ascending: false }).limit(50);
      return (data ?? []).map((r: any): TickerItem => {
        const reserved = !!r.reserved_order_id;
        return {
          id: r.id,
          label: `${r.model_name || '—'} · SN ${r.serial_number || '—'}`,
          meta: reserved ? 'reserviert' : 'frei',
          tone: reserved ? 'text-[hsl(38_92%_50%)]' : 'text-[hsl(140_60%_50%)]',
          href: `/lager`,
        };
      });
    }

    async function loadCNN() {
      try {
        const res = await fetch(
          'https://api.rss2json.com/v1/api.json?rss_url=' +
            encodeURIComponent('http://rss.cnn.com/rss/edition.rss')
        );
        const json = await res.json();
        return ((json?.items ?? []) as any[]).slice(0, 15).map((it, idx): TickerItem => ({
          id: `${idx}-${it.link}`,
          label: it.title,
          meta: 'CNN',
          tone: 'text-[hsl(0_72%_55%)]',
          href: it.link,
        }));
      } catch {
        return [];
      }
    }

    async function load() {
      try {
        const next = mode === 'prio'
          ? await loadPrio()
          : mode === 'timeline'
            ? await loadTimeline()
            : mode === 'lager'
              ? await loadLager()
              : await loadCNN();
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      }
    }
    load();
    const iv = setInterval(load, 60 * 60 * 1000);

    // Realtime: aktualisiere sofort bei Status-/Lieferänderungen
    const channel = supabase
      .channel('aurora-ticker-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lager_devices' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [variant, mode, atOnly]);

  // Für Rolle Österreich: CNN-News ausblenden (kein AT-Bezug) und ggf. auf 'prio' zurücksetzen.
  useEffect(() => {
    if (atOnly && mode === 'cnn') setMode('prio');
  }, [atOnly, mode]);

  if (variant !== 'aurora') return null;

  const visibleModes = atOnly ? MODES.filter(m => m.value !== 'cnn') : MODES;
  const current = MODES.find(m => m.value === mode)!;
  const Icon = current.icon;
  const loop = [...items, ...items];

  return (
    <div className="relative z-20 hidden md:flex items-stretch gap-0 h-9 max-w-[460px] lg:max-w-[620px] xl:max-w-[820px] rounded-full border border-[hsl(43_95%_62%/0.35)] bg-[hsl(43_95%_62%/0.06)] overflow-hidden">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-[hsl(43_95%_50%)] hover:bg-[hsl(43_95%_62%/0.10)] focus:outline-none border-r border-[hsl(43_95%_62%/0.25)]">
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{current.label}</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={10} className="z-[9999] min-w-[420px] p-2">
          {visibleModes.map((m) => {
            const MIcon = m.icon;
            return (
              <DropdownMenuItem
                key={m.value}
                onClick={() => setMode(m.value)}
                className={mode === m.value ? 'bg-[hsl(43_95%_62%/0.15)]' : ''}
              >
                <MIcon className="w-3.5 h-3.5 mr-2" />
                {m.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative flex-1 overflow-hidden px-3 flex items-center">
        {items.length === 0 ? (
          <span className="text-xs text-foreground/50">Keine Einträge</span>
        ) : (
          <div className={`aurora-ticker-track flex items-center gap-8 whitespace-nowrap text-xs ${mode === 'lager' ? 'aurora-ticker-slow' : ''}`}>
            {loop.map((it, i) => (
              <button
                key={`${it.id}-${i}`}
                onClick={() => {
                  if (!it.href) return;
                  if (/^https?:\/\//.test(it.href)) window.open(it.href, '_blank', 'noopener,noreferrer');
                  else navigate(it.href);
                }}
                className="inline-flex items-center gap-2 hover:underline focus:outline-none"
              >
                <span className="font-mono font-semibold text-foreground/90">{it.label}</span>
                <span className={`font-semibold ${it.tone}`}>· {it.meta}</span>
                <span className="text-[hsl(43_95%_62%/0.6)]">•</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
