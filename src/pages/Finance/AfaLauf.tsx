import { useState } from 'react';
import { Play, FileCheck2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const fmtEUR = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));

export default function FinanceAfaLauf() {
  const { roles } = useAuth();
  const nav = useNavigate();
  const canRun = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');

  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  const run = async (dry: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-asset-depreciation-run', {
        body: { period, dry_run: dry },
      });
      if (error) throw error;
      setPreview(data);
      toast({ title: dry ? 'Vorschau erstellt' : 'AfA-Lauf abgeschlossen', description: `${data.asset_count} Anlagen · ${fmtEUR(data.total_amount)}` });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AfA-Lauf"
        subtitle="Monatliche Abschreibungsbuchungen erzeugen"
        actions={<Button variant="outline" onClick={() => nav('/finance/anlagen')}>Zur Anlagenliste</Button>}
      />

      {!canRun && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" /> Nur Finance / Admin / Super Admin dürfen den AfA-Lauf starten.
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Periode (YYYY-MM)</Label>
            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!canRun || busy} onClick={() => run(true)} className="gap-2">
              <FileCheck2 className="h-4 w-4" /> Vorschau (Dry-Run)
            </Button>
            <Button disabled={!canRun || busy} onClick={() => run(false)} className="gap-2">
              <Play className="h-4 w-4" /> AfA verbuchen
            </Button>
          </div>
        </div>
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <DataCard title="Periode"><div className="text-2xl font-semibold">{preview.period}</div></DataCard>
            <DataCard title="Anlagen"><div className="text-2xl font-semibold">{String(preview.asset_count)}</div></DataCard>
            <DataCard title="Summe AfA"><div className="text-2xl font-semibold">{fmtEUR(preview.total_amount)}</div></DataCard>
          </div>
          <div className="rounded-md border border-border bg-card">
            <div className="p-4 flex items-center justify-between">
              <div className="font-medium">Buchungen</div>
              <Badge variant={preview.dry_run ? 'secondary' : 'default'}>
                {preview.dry_run ? 'Vorschau (nicht gebucht)' : 'Gebucht'}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Inv.-Nr.</th>
                    <th className="p-3 text-left">Bezeichnung</th>
                    <th className="p-3 text-left">Methode</th>
                    <th className="p-3 text-right">AfA</th>
                    <th className="p-3 text-right">Restbuchwert</th>
                    <th className="p-3 text-right">Kumuliert</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.entries ?? []).map((e: any) => (
                    <tr key={e.asset_id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{e.inventory_number}</td>
                      <td className="p-3">{e.name}</td>
                      <td className="p-3">{e.method}</td>
                      <td className="p-3 text-right">{fmtEUR(e.amount)}</td>
                      <td className="p-3 text-right">{fmtEUR(e.book_value_after)}</td>
                      <td className="p-3 text-right">{fmtEUR(e.accumulated_after)}</td>
                    </tr>
                  ))}
                  {(preview.entries ?? []).length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine AfA-Buchungen für diese Periode</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
