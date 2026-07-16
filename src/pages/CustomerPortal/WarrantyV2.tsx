import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

type Ctx = { customerId: string };
type W = {
  id: string; serial_number: string | null; device_name: string | null;
  warranty_start: string | null; warranty_end: string | null;
  warranty_type: string | null; warranty_status: string | null;
  warranty_notes: string | null; warranty_terms: string | null;
};

export default function CustomerPortalWarranty() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<W[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('warranty_records')
        .select('id, serial_number, device_name, warranty_start, warranty_end, warranty_type, warranty_status, warranty_notes, warranty_terms')
        .eq('customer_id', ctx.customerId)
        .eq('customer_visible', true)
        .order('warranty_end', { ascending: true, nullsFirst: false });
      setRows((data ?? []) as W[]);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5" />
        <h2 className="text-2xl font-semibold">Garantie</h2>
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-2 bg-muted/30 border border-border rounded-md p-3">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Die angezeigten Garantieinformationen dienen der Übersicht. Maßgeblich sind der jeweilige Vertrag und die geltenden Garantiebedingungen.</span>
      </p>

      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aktuell sind keine Garantiedaten für Sie freigegeben.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => {
            const daysLeft = w.warranty_end ? Math.ceil((new Date(w.warranty_end).getTime() - Date.now()) / 86400000) : null;
            return (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{w.device_name ?? 'Gerät'}</span>
                    {w.warranty_status && <Badge variant={w.warranty_status === 'aktiv' ? 'secondary' : 'outline'}>{w.warranty_status}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <Row k="Seriennummer" v={<span className="font-mono">{w.serial_number ?? '—'}</span>} />
                  <Row k="Garantieart" v={w.warranty_type ?? '—'} />
                  <Row k="Beginn" v={w.warranty_start ? new Date(w.warranty_start).toLocaleDateString('de-DE') : '—'} />
                  <Row k="Ende" v={w.warranty_end ? new Date(w.warranty_end).toLocaleDateString('de-DE') : '—'} />
                  {daysLeft != null && daysLeft > 0 && <Row k="Verbleibend" v={`${daysLeft} Tage`} />}
                  {w.warranty_terms && <p className="text-xs text-muted-foreground pt-2">{w.warranty_terms}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground text-xs">{k}</span><span className="text-right">{v}</span></div>;
}
