import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { listBankAccounts, type BankAccount } from '@/lib/bank/api';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

export default function Importregeln() {
  const { region } = useAccountingRegion();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const accs = await listBankAccounts(region);
    setAccounts(accs);
    const ids = accs.map(a => a.id);
    if (!ids.length) { setRows([]); return; }
    const { data, error } = await supabase.from('bank_import_templates' as any)
      .select('*').in('bank_account_id', ids).order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setRows((data ?? []) as any[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const remove = async (id: string) => {
    if (!window.confirm('Importvorlage wirklich löschen?')) return;
    const { error } = await supabase.from('bank_import_templates' as any).delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Vorlage gelöscht'); load(); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" />Importregeln &amp; Spaltenvorlagen</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Vorlagen entstehen im Importassistenten über „Als Importvorlage speichern“ und werden beim nächsten Import desselben Bankformats automatisch vorgeschlagen.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">Vorlage</th><th className="p-2">Bankkonto</th><th className="p-2">Format</th>
            <th className="p-2">Zugeordnete Spalten</th><th className="p-2"></th>
          </tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Keine Importvorlagen vorhanden.</td></tr>}
            {rows.map(r => {
              const acc = accounts.find(a => a.id === r.bank_account_id);
              const map = r.column_mapping ?? {};
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-medium">{r.template_name}</td>
                  <td className="p-2">{acc ? `${acc.bank_name} · ${acc.account_name}` : '–'}</td>
                  <td className="p-2"><Badge variant="outline">{String(r.file_format ?? '').toUpperCase()}</Badge></td>
                  <td className="p-2 space-x-1">
                    {Object.entries(map).map(([k, v]) => <Badge key={k} variant="outline" className="mr-1">{k} → {String(v)}</Badge>)}
                  </td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
