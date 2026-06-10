import { useEffect, useState } from 'react';
import { Coins, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function FinanceFxRates() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currency, setCurrency] = useState('CHF');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState('1.0');
  const [source, setSource] = useState('manuell');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_fx_rates' as any)
      .select('*')
      .order('rate_date', { ascending: false })
      .limit(200);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const r = Number(rate.replace(',', '.'));
    if (!currency || !date || !r || r <= 0) {
      toast({ title: 'Bitte gültige Werte eingeben', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('finance_fx_rates' as any).upsert(
      { currency: currency.toUpperCase(), rate_date: date, rate_to_eur: r, source },
      { onConflict: 'currency,rate_date' }
    );
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Kurs gespeichert' }); await load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('finance_fx_rates' as any).delete().eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else await load();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Devisenkurse" subtitle="FX-Kurse zur Umrechnung in EUR (für Konsolidierung)" icon={Coins} />

      <DataCard title="Neuen Kurs anlegen">
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Währung</label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} /></div>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Datum</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Kurs → EUR</label>
            <Input value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Quelle</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} /></div>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1.5" />Speichern</Button>
        </div>
      </DataCard>

      <DataCard title={`${rows.length} Kurse`}>
        {rows.length === 0 ? (
          <PageEmpty message="Noch keine Kurse erfasst." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Datum</th>
                  <th className="text-left p-3">Währung</th>
                  <th className="text-right p-3">Kurs → EUR</th>
                  <th className="text-left p-3">Quelle</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="p-3">{r.rate_date}</td>
                    <td className="p-3 font-medium">{r.currency}</td>
                    <td className="p-3 text-right">{Number(r.rate_to_eur).toFixed(6)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.source ?? '–'}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
