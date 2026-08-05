import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Landmark } from 'lucide-react';
import { listBankAccounts, saveBankAccount, type BankAccount } from '@/lib/bank/api';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const empty = (area: string): Partial<BankAccount> => ({
  bank_name: '', account_name: '', iban: '', bic: '', currency: area === 'CH' ? 'CHF' : 'EUR',
  country: area === 'CH' ? 'CH' : 'DE', accounting_area: area, automatic_booking_enabled: false,
  auto_book_threshold: 95, active: true, notes: '',
});

export default function Bankkonten() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [edit, setEdit] = useState<Partial<BankAccount> | null>(null);

  const load = () => listBankAccounts(region).then(setRows).catch(e => toast.error(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const save = async () => {
    if (!edit?.bank_name || !edit?.account_name) return toast.error('Bankname und Kontobezeichnung sind Pflichtfelder.');
    try {
      await saveBankAccount({ ...edit, accounting_area: edit.accounting_area ?? region });
      toast.success('Bankkonto gespeichert'); setEdit(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Landmark className="w-4 h-4" />Bankkonten · Buchhaltung {region}</CardTitle>
          <Button size="sm" onClick={() => setEdit(empty(region))}><Plus className="w-4 h-4 mr-1" />Bankkonto anlegen</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40"><tr className="text-left">
              <th className="p-2">Bank</th><th className="p-2">Kontobezeichnung</th><th className="p-2">IBAN</th>
              <th className="p-2">BIC</th><th className="p-2">Währung</th><th className="p-2">Automatische Verbuchung</th>
              <th className="p-2">Status</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Noch kein Bankkonto angelegt.</td></tr>}
              {rows.map(a => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-2">{a.bank_name}</td>
                  <td className="p-2">{a.account_name}</td>
                  <td className="p-2">{a.iban ?? '–'}</td>
                  <td className="p-2">{a.bic ?? '–'}</td>
                  <td className="p-2">{a.currency}</td>
                  <td className="p-2">{a.automatic_booking_enabled ? `ab ${a.auto_book_threshold} %` : 'aus'}</td>
                  <td className="p-2">{a.active ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}</td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(a)}>Bearbeiten</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? 'Bankkonto bearbeiten' : 'Bankkonto anlegen'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field l="Bankname"><Input value={edit.bank_name ?? ''} onChange={e => setEdit({ ...edit, bank_name: e.target.value })} /></Field>
              <Field l="Kontobezeichnung"><Input value={edit.account_name ?? ''} onChange={e => setEdit({ ...edit, account_name: e.target.value })} /></Field>
              <Field l="IBAN"><Input value={edit.iban ?? ''} onChange={e => setEdit({ ...edit, iban: e.target.value })} /></Field>
              <Field l="BIC"><Input value={edit.bic ?? ''} onChange={e => setEdit({ ...edit, bic: e.target.value })} /></Field>
              <Field l="Währung"><Input value={edit.currency ?? ''} onChange={e => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} /></Field>
              <Field l="Land"><Input value={edit.country ?? ''} onChange={e => setEdit({ ...edit, country: e.target.value.toUpperCase() })} /></Field>
              <Field l="Buchhaltungsbereich">
                <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={edit.accounting_area ?? region} onChange={e => setEdit({ ...edit, accounting_area: e.target.value })}>
                  <option value="EU">EU</option><option value="CH">CH</option>
                </select>
              </Field>
              <Field l="Schwelle automatische Verbuchung (%)">
                <Input type="number" min={50} max={100} value={edit.auto_book_threshold ?? 95}
                  onChange={e => setEdit({ ...edit, auto_book_threshold: Number(e.target.value) })} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={!!edit.automatic_booking_enabled}
                  onChange={e => setEdit({ ...edit, automatic_booking_enabled: e.target.checked })} />
                Sichere Treffer automatisch verbuchen
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({ ...edit, active: e.target.checked })} />
                Konto aktiv
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{l}</Label>{children}</div>;
}
