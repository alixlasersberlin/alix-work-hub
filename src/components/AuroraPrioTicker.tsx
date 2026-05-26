import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDesignVariant } from '@/hooks/useDesignVariant';

/**
 * Aurora Prio Ticker – Laufschrift mit den Top 5 PRIO-Bestellungen.
 * Nur sichtbar, wenn das Aurora-Design aktiv ist.
 */

interface PrioRow {
  id: string;
  order_number: string;
  expected_shipment_date: string | null;
  customers: { company_name: string | null; contact_name: string | null } | null;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date); t.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - n.getTime()) / 86_400_000);
}

function label(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} Tage überfällig`;
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}

export default function AuroraPrioTicker() {
  const { variant } = useDesignVariant();
  const [rows, setRows] = useState<PrioRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (variant !== 'aurora') return;
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, expected_shipment_date, customers(company_name, contact_name)')
        .not('expected_shipment_date', 'is', null)
        .in('order_status', ['overdue', 'Overdue', 'invoiced', 'Invoiced', 'open', 'Open', 'offen', 'Offen', 'approved', 'Approved'])
        .order('expected_shipment_date', { ascending: true })
        .limit(10);
      if (!cancelled && data) setRows(data as any);
    }
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [variant]);

  if (variant !== 'aurora' || rows.length === 0) return null;

  const items = rows.map((r) => {
    const d = daysUntil(r.expected_shipment_date);
    const name = r.customers?.company_name || r.customers?.contact_name || '—';
    const tone = d !== null && d < 0
      ? 'text-[hsl(0_72%_55%)]'
      : d !== null && d <= 7
        ? 'text-[hsl(38_92%_50%)]'
        : 'text-[hsl(43_95%_55%)]';
    return { ...r, d, name, tone };
  });

  // duplicate for seamless marquee
  const loop = [...items, ...items];

  return (
    <div
      className="hidden md:flex items-center gap-2 max-w-[420px] lg:max-w-[560px] xl:max-w-[720px] h-9 px-3 rounded-full border border-[hsl(43_95%_62%/0.35)] bg-[hsl(43_95%_62%/0.06)] overflow-hidden"
      title="Top 10 PRIO Bestellungen"
    >
      <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold uppercase tracking-wider text-[hsl(43_95%_50%)]">
        <Flame className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">PRIO</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="aurora-ticker-track flex items-center gap-8 whitespace-nowrap text-xs">
          {loop.map((it, i) => (
            <button
              key={`${it.id}-${i}`}
              onClick={() => navigate(`/order/${it.id}`)}
              className="inline-flex items-center gap-2 hover:underline focus:outline-none"
            >
              <span className="font-mono font-semibold text-foreground/90">#{it.order_number}</span>
              <span className="text-foreground/70">{it.name}</span>
              <span className={`font-semibold ${it.tone}`}>· {label(it.d)}</span>
              <span className="text-[hsl(43_95%_62%/0.6)]">•</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
