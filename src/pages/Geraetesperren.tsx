import { useEffect, useState } from 'react';
import { Lock, RefreshCw, Unlock } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GeraetesperrenTabs } from './GeraetesperrenTabs';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

export default function Geraetesperren() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('device_locks' as any)
      .select('*')
      .eq('status', 'aktiv')
      .order('activated_at', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function release(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('device_locks' as any)
      .update({ status: 'aufgehoben', released_at: new Date().toISOString(), released_by: u?.user?.id ?? null } as any)
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Sperre aufgehoben');
    load();
  }

  const filtered = q.trim()
    ? rows.filter((r) =>
        `${r.invoice_number ?? ''} ${r.customer_name ?? ''} ${r.lock_note ?? ''}`.toLowerCase().includes(q.toLowerCase()),
      )
    : rows;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Lock} title="Gerätesperren" subtitle="Übersicht und Verwaltung gesperrter Geräte" noBreadcrumbs />
      <GeraetesperrenTabs />

      <Card className="border-red-500/30">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            Aktive Sperren <Badge variant="destructive">{rows.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechnung / Kunde suchen…" className="w-64" />
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Lädt…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">Keine aktiven Gerätesperren.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Rechnung</th>
                  <th className="p-2">Kunde</th>
                  <th className="p-2 text-right">Betrag</th>
                  <th className="p-2">Rückl.-Datum</th>
                  <th className="p-2">Sperrvermerk</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-red-500/5">
                    <td className="p-2 font-medium text-red-500 whitespace-nowrap">{r.invoice_number ?? '—'}</td>
                    <td className="p-2">{r.customer_name ?? '—'}</td>
                    <td className="p-2 text-right whitespace-nowrap">{fmt(r.amount)}</td>
                    <td className="p-2 whitespace-nowrap">{r.return_date ?? '—'}</td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[420px]">{r.lock_note}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => release(r.id)}>
                        <Unlock className="w-3.5 h-3.5 mr-1" /> Aufheben
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
