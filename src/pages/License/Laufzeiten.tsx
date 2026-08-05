import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';

export default function LicenseLaufzeiten() {
  const { tenants } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('license_contracts' as any).select('*').order('end_date', { ascending: true });
      setRows(((data as any[]) || []));
      setBusy(false);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const state = (c: any) => {
    if (!c.end_date) return { label: 'unbefristet', variant: 'outline' as const };
    if (c.end_date < today) return { label: 'abgelaufen', variant: 'destructive' as const };
    const days = Math.round((new Date(c.end_date).getTime() - Date.now()) / 86400000);
    if (days <= 90) return { label: `läuft in ${days} Tagen aus`, variant: 'secondary' as const };
    return { label: 'aktiv', variant: 'default' as const };
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Vertragslaufzeiten" subtitle="Überwachung von Laufzeiten und automatischer Verlängerung" icon={CalendarClock} />
      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((c) => {
              const s = state(c);
              return (
                <div key={c.id} className="grid grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 md:grid-cols-6">
                  <span className="font-mono text-xs">{c.contract_number}</span>
                  <span className="truncate">{tenants.find((t) => t.id === c.licensee_tenant_id)?.name || '–'}</span>
                  <span>{c.start_date || '–'}</span>
                  <span>{c.end_date || '–'}</span>
                  <span className="text-muted-foreground">{c.auto_renew ? 'Auto-Verlängerung' : 'keine Verlängerung'}</span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
              );
            })}
            {rows.length === 0 && <div className="text-muted-foreground">Keine Verträge vorhanden.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}
