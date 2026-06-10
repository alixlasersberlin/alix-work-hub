import { useEffect, useRef, useState } from 'react';
import { Banknote, Upload, Link2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number | null | undefined) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '–';

export default function FinanceBank() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'alle' | 'offen' | 'zugeordnet' | 'ignoriert'>('offen');

  const load = async () => {
    setLoading(true);
    const [s, l] = await Promise.all([
      supabase.from('finance_bank_statements' as any).select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('finance_bank_lines' as any).select('*, customers:matched_customer_id(company_name, contact_name)').order('booking_date', { ascending: false }).limit(500),
    ]);
    setStatements((s.data ?? []) as any[]);
    setLines((l.data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const content = await file.text();
      const { data, error } = await supabase.functions.invoke('finance-bank-import', { body: { filename: file.name, content } });
      if (error) throw error;
      if (data?.duplicate) toast({ title: 'Bereits importiert', description: `Statement existiert (${data.lines} Buchungen).` });
      else toast({ title: 'Import erfolgreich', description: `${data.lines} Buchungen, ${data.matched} automatisch zugeordnet.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Import-Fehler', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateLine = async (id: string, patch: any) => {
    const { error } = await supabase.from('finance_bank_lines' as any).update(patch).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    await load();
  };

  const filteredLines = lines.filter(l => filter === 'alle' || l.status === filter);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Banknote className="w-6 h-6 text-primary" />}
        title="Bankimport & Reconciliation"
        subtitle="CAMT.053 (XML) oder MT940 hochladen, automatisches Matching gegen offene Rechnungen"
        actions={
          <div>
            <input ref={fileRef} type="file" accept=".xml,.sta,.txt,.mt940" hidden onChange={onFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gold-gradient text-primary-foreground">
              <Upload className="w-4 h-4 mr-2" />{uploading ? 'Importiere…' : 'Datei hochladen'}
            </Button>
          </div>
        }
      />

      <DataCard className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Statements</h3>
        {statements.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Importe.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr><th className="text-left py-2">Datei</th><th className="text-left">Format</th><th className="text-left">IBAN</th><th className="text-left">Zeitraum</th><th className="text-right">Buchungen</th><th className="text-right">Zugeordnet</th><th className="text-right">Saldo</th></tr>
              </thead>
              <tbody>
                {statements.map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">{s.filename ?? '–'}</td>
                    <td><Badge variant="outline">{s.format}</Badge></td>
                    <td className="text-xs">{s.iban ?? '–'}</td>
                    <td className="text-xs">{s.period_from ?? '–'} – {s.period_to ?? '–'}</td>
                    <td className="text-right tabular-nums">{s.line_count}</td>
                    <td className="text-right tabular-nums">{s.matched_count}</td>
                    <td className="text-right tabular-nums">{fmt(Number(s.closing_balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Buchungen</h3>
          <div className="flex gap-1">
            {(['offen', 'zugeordnet', 'ignoriert', 'alle'] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>{f}</Button>
            ))}
          </div>
        </div>
        {loading ? <PageLoading /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Datum</th>
                  <th className="text-left px-4 py-3">Verwendungszweck</th>
                  <th className="text-left px-4 py-3">Gegenpartei</th>
                  <th className="text-right px-4 py-3">Betrag</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Zuordnung</th>
                  <th className="text-right px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-10">Keine Buchungen.</td></tr>
                ) : filteredLines.map(l => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs">{l.booking_date ?? l.value_date ?? '–'}</td>
                    <td className="px-4 py-3 max-w-md truncate" title={l.purpose}>{l.purpose ?? '–'}</td>
                    <td className="px-4 py-3 text-xs">{l.counterparty_name ?? '–'}<br/><span className="text-muted-foreground">{l.counterparty_iban ?? ''}</span></td>
                    <td className={`px-4 py-3 text-right tabular-nums ${Number(l.amount) < 0 ? 'text-destructive' : 'text-emerald-500'}`}>{fmt(Number(l.amount))}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        l.status === 'zugeordnet' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
                        l.status === 'ignoriert' ? 'bg-muted text-muted-foreground' :
                        'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      }>{l.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{l.customers ? (l.customers.company_name ?? l.customers.contact_name) : '–'}</td>
                    <td className="px-4 py-3 text-right">
                      {l.status === 'offen' && (
                        <Button size="sm" variant="ghost" onClick={() => updateLine(l.id, { status: 'ignoriert' })}>
                          <X className="w-3.5 h-3.5 mr-1" />Ignorieren
                        </Button>
                      )}
                      {l.status === 'ignoriert' && isSuperAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => updateLine(l.id, { status: 'offen' })}><Link2 className="w-3.5 h-3.5 mr-1" />Reaktivieren</Button>
                      )}
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
