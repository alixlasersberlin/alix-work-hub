import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, DownloadCloud, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { listBankAccounts, type BankAccount } from '@/lib/bank/api';

const SETTINGS_KEY = 'bank_api_connections';

interface Conn {
  id: string;
  label: string;
  bank_account_id: string;
  accounting_area: 'EU' | 'CH';
  endpoint_url: string;
  format: 'camt053' | 'camt052' | 'csv' | 'mt940';
  days_back: number;
  enabled: boolean;
}

const emptyConn = (area: 'EU' | 'CH'): Conn => ({
  id: crypto.randomUUID(),
  label: 'Neue Verbindung',
  bank_account_id: '',
  accounting_area: area,
  endpoint_url: '',
  format: 'camt053',
  days_back: 7,
  enabled: false,
});

export default function KontoauszuegeBankApi() {
  const { region } = useAccountingRegion();
  const [conns, setConns] = useState<Conn[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data }, accs] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle(),
        listBankAccounts((region as any)).catch(() => [] as BankAccount[]),
      ]);
      setConns(((data?.value as any)?.connections ?? []) as Conn[]);
      setAccounts(accs);
      setLoading(false);
    })();
  }, [region]);

  const save = async (next: Conn[]) => {
    setConns(next);
    const { error } = await (supabase.from('app_settings') as any)
      .upsert({ key: SETTINGS_KEY, value: { connections: next } as any }, { onConflict: 'key' });
    if (error) toast.error(error.message);
  };

  const patch = (id: string, p: Partial<Conn>) =>
    save(conns.map(c => (c.id === id ? { ...c, ...p } : c)));

  const fetchNow = async (id?: string) => {
    setBusy(id ?? 'all');
    try {
      const { data, error } = await supabase.functions.invoke('bank-api-fetch', {
        body: id ? { connectionId: id } : {},
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      if (res?.errors?.length) toast.warning(res.errors.join('\n'));
      toast.success(`${res?.fetched ?? 0} Datei(en) abgerufen – Verarbeitung im Tab „Kontoauszüge importieren“`);
    } catch (e: any) {
      toast.error(e.message ?? 'Abruf fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  };

  const visible = conns.filter(c => c.accounting_area === region);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Bank-API / EBICS-Anbindung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Umsätze werden über einen HTTPS-Endpunkt deines EBICS- bzw. Open-Banking-Providers abgeholt
            (CAMT.053/052, MT940 oder CSV). Die abgeholte Datei landet automatisch als Import-Datensatz
            und wird im Tab „Kontoauszüge importieren“ geprüft und verbucht.
          </p>
          <p>
            Die Zugangsdaten liegen ausschließlich serverseitig im Secret <code>BANK_API_TOKEN</code>;
            hier werden nur Endpunkt, Format und Zeitraum konfiguriert.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => save([...conns, emptyConn((region as any))])}>
              <Plus className="w-4 h-4 mr-2" />Verbindung hinzufügen
            </Button>
            <Button size="sm" variant="outline" onClick={() => fetchNow()} disabled={busy !== null || !visible.some(c => c.enabled)}>
              {busy === 'all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DownloadCloud className="w-4 h-4 mr-2" />}
              Alle jetzt abrufen
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}

      {!loading && !visible.length && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          Noch keine Bank-API-Verbindung für Buchhaltung {region} konfiguriert.
        </CardContent></Card>
      )}

      {visible.map(c => (
        <Card key={c.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              {c.label}
              <Badge variant={c.enabled ? 'default' : 'secondary'}>{c.enabled ? 'aktiv' : 'inaktiv'}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch checked={c.enabled} onCheckedChange={v => patch(c.id, { enabled: v })} />
              <Button size="sm" variant="outline" onClick={() => fetchNow(c.id)} disabled={busy !== null || !c.enabled}>
                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => save(conns.filter(x => x.id !== c.id))}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label>Bezeichnung</Label>
              <Input value={c.label} onChange={e => patch(c.id, { label: e.target.value })} /></div>
            <div><Label>Bankkonto</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={c.bank_account_id}
                onChange={e => patch(c.id, { bank_account_id: e.target.value })}
              >
                <option value="">— wählen —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name} · {a.iban ?? ''}</option>
                ))}
              </select>
            </div>
            <div><Label>Format</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={c.format}
                onChange={e => patch(c.id, { format: e.target.value as Conn['format'] })}
              >
                <option value="camt053">CAMT.053</option>
                <option value="camt052">CAMT.052</option>
                <option value="mt940">MT940</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div><Label>Zeitraum (Tage zurück)</Label>
              <Input type="number" min={1} max={90} value={c.days_back}
                onChange={e => patch(c.id, { days_back: Number(e.target.value) })} /></div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label>Endpunkt-URL</Label>
              <Input placeholder="https://ebics-gateway.example.com/statements"
                value={c.endpoint_url} onChange={e => patch(c.id, { endpoint_url: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
