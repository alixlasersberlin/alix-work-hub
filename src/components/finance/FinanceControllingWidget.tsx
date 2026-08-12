import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Kleine Kennzahl für offene Finance-Controlling-Vorgänge (additiv). */
export function FinanceControllingWidget() {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await (supabase as any)
        .from('fc_cases')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("abgeschlossen","freigegeben")');
      setOpen(count ?? 0);
    })();
  }, []);

  if (open === null) return null;

  return (
    <Link
      to="/finance/finance-controlling"
      className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
    >
      <Activity className="w-5 h-5 text-primary" />
      <div className="flex-1">
        <div className="text-sm font-medium">Finance Controlling</div>
        <div className="text-xs text-muted-foreground">Zentrale Rechnungs-Kontrollstelle</div>
      </div>
      <div className={open > 0 ? 'text-destructive font-semibold' : 'text-emerald-400 font-semibold'}>
        {open > 0 ? `🔴 ${open} offene Vorgänge` : '🟢 keine offenen Vorgänge'}
      </div>
    </Link>
  );
}
