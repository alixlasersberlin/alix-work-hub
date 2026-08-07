import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Loader2, History } from 'lucide-react';
import { listImports } from '@/lib/bank/api';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

export default function Importhistorie() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listImports((region as any)).then(setRows).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [region]);

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('bank-statements').createSignedUrl(path, 60);
    if (error || !data) return toast.error('Datei nicht verfügbar');
    const a = document.createElement('a');
    a.href = data.signedUrl; a.download = name; a.target = '_blank'; a.click();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" />Importhistorie · Buchhaltung {region}</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">Datum</th><th className="p-2">Datei</th><th className="p-2">Format</th>
            <th className="p-2">Bankkonto</th><th className="p-2">Zeitraum</th>
            <th className="p-2 text-right">Buchungen</th><th className="p-2 text-right">Eingänge</th><th className="p-2 text-right">Ausgänge</th>
            <th className="p-2 text-right">Auto-Zuordnung</th><th className="p-2 text-right">Dubletten</th>
            <th className="p-2">Status</th><th className="p-2">Original</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={12} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!loading && !rows.length && <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Noch keine Importe.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 whitespace-nowrap">{r.imported_at ? new Date(r.imported_at).toLocaleString('de-DE') : '–'}</td>
                <td className="p-2 max-w-xs truncate" title={r.file_name}>{r.file_name}</td>
                <td className="p-2">{String(r.file_format ?? '').toUpperCase()}</td>
                <td className="p-2">{r.bank_accounts?.bank_name ?? '–'}</td>
                <td className="p-2 whitespace-nowrap">{r.period_from ?? '–'} – {r.period_to ?? '–'}</td>
                <td className="p-2 text-right">{r.total_transactions ?? 0}</td>
                <td className="p-2 text-right text-emerald-500">{fmt(Number(r.total_income ?? 0))}</td>
                <td className="p-2 text-right text-red-500">{fmt(Number(r.total_expenses ?? 0))}</td>
                <td className="p-2 text-right">{r.auto_matched_count ?? 0}</td>
                <td className="p-2 text-right">{r.duplicates_count ?? 0}</td>
                <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                <td className="p-2">
                  {r.file_path
                    ? <Button size="sm" variant="ghost" onClick={() => download(r.file_path, r.file_name)}><Download className="w-3.5 h-3.5" /></Button>
                    : <span className="text-muted-foreground">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
