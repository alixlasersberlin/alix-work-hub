import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

const statusLabel: Record<string, { label: string; variant: any; tip: string }> = {
  'grün': { label: 'Gut', variant: 'default', tip: 'Keine Auffälligkeiten — Gerät läuft regulär.' },
  'gelb': { label: 'Beobachten', variant: 'secondary', tip: 'Wartung empfohlen — bitte Termin vereinbaren.' },
  'rot':  { label: 'Service nötig', variant: 'destructive', tip: 'Bitte kontaktieren Sie unseren Service.' },
};

export default function CustomerPortalHealth() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: lc } = await supabase
        .from('device_lifecycle')
        .select('serial_number, device_name')
        .eq('customer_id', ctx.customerId)
        .not('serial_number', 'is', null);
      const serials = Array.from(new Set((lc ?? []).map((r: any) => r.serial_number)));
      if (serials.length === 0) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from('device_health_scores')
        .select('serial_number, device_name, health_status, warranty_status, leasing_status, updated_at')
        .in('serial_number', serials);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Gerätegesundheit</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Noch keine Daten zur Gerätegesundheit.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((r) => {
              const meta = statusLabel[r.health_status as string] ?? { label: r.health_status ?? '—', variant: 'outline' as any, tip: '' };
              return (
                <div key={r.serial_number} className="p-4 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.device_name ?? 'Gerät'}</p>
                      <p className="text-xs font-mono text-muted-foreground">{r.serial_number}</p>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  {meta.tip && <p className="text-sm text-muted-foreground mt-2">{meta.tip}</p>}
                  {r.warranty_status && <Badge variant="outline" className="mt-2 text-[10px]">Garantie: {r.warranty_status}</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
