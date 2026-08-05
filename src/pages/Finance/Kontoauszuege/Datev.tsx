import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { buildDatevExtf, downloadDatevCsv, DATEV_DEFAULTS, type DatevOptions, type DatevRow } from '@/lib/bank/datev';

const SETTINGS_KEY = 'bank_datev_export';
const money = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function KontoauszuegeDatev() {
  const { region } = useAccountingRegion();
  const [opt, setOpt] = useState<DatevOptions>(DATEV_DEFAULTS);
  const [rows, setRows] = useState<DatevRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyBooked, setOnlyBooked] = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
      .then(({ data }) => { if (data?.value) setOpt(o => ({ ...o, ...(data.value as any) })); });
  }, []);

  const set = (k: keyof DatevOptions, v: any) => setOpt(o => ({ ...o, [k]: v }));

  const saveSettings = async () => {
    const { error } = await (supabase.from('app_settings') as any)
      .upsert({ key: SETTINGS_KEY, value: opt as any }, { onConflict: 'key' });
    if (error) toast.error(error.message); else toast.success('Einstellungen gespeichert');
  };

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('bank_transactions' as any)
        .select('id, booking_date, amount, currency, transaction_type, purpose, booking_text, sender_receiver_name, bank_reference, status')
        .eq('accounting_area', region)
        .gte('booking_date', opt.from).lte('booking_date', opt.to)
        .order('booking_date')
        .limit(5000);
      if (onlyBooked) q = q.eq('status', 'verbucht');
      const { data, error } = await q;
      if (error) throw error;

      const txIds = (data ?? []).map((t: any) => t.id).slice(0, 1000);
      const allocMap = new Map<string, string>();
      if (txIds.length) {
        const { data: allocs } = await supabase.from('bank_transaction_allocations' as any)
          .select('bank_transaction_id, invoice_number').in('bank_transaction_id', txIds);
        (allocs ?? []).forEach((a: any) => {
          if (a.invoice_number && !allocMap.has(a.bank_transaction_id)) {
            allocMap.set(a.bank_transaction_id, a.invoice_number);
          }
        });
      }

      setRows((data ?? []).map((t: any) => ({
        booking_date: t.booking_date,
        amount: Number(t.amount || 0),
        currency: t.currency,
        transaction_type: t.transaction_type,
        purpose: t.purpose,
        booking_text: t.booking_text,
        sender_receiver_name: t.sender_receiver_name,
        bank_reference: t.bank_reference,
        invoice_number: allocMap.get(t.id) ?? null,
        counter_account: null,
      })));
    } catch (e: any) {
      toast.error(e.message ?? 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [region]);

  const sum = useMemo(() => rows.reduce((a, r) => a + Number(r.amount || 0), 0), [rows]);

  const exportCsv = () => {
    if (!rows.length) { toast.error('Keine Buchungen im Zeitraum'); return; }
    downloadDatevCsv(buildDatevExtf(rows, opt), `DATEV_EXTF_${region}_${opt.from}_${opt.to}.csv`);
    toast.success(`${rows.length} Buchungen exportiert`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">DATEV-Export (EXTF 700 Buchungsstapel)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div><Label>Berater-Nr.</Label><Input value={opt.beraterNr} onChange={e => set('beraterNr', e.target.value)} /></div>
          <div><Label>Mandanten-Nr.</Label><Input value={opt.mandantenNr} onChange={e => set('mandantenNr', e.target.value)} /></div>
          <div><Label>WJ-Beginn</Label><Input type="date" value={opt.wjBeginn} onChange={e => set('wjBeginn', e.target.value)} /></div>
          <div><Label>Sachkontenlänge</Label><Input type="number" min={4} max={9} value={opt.sachkontenlaenge} onChange={e => set('sachkontenlaenge', Number(e.target.value))} /></div>
          <div><Label>Bank-Sachkonto</Label><Input value={opt.bankKonto} onChange={e => set('bankKonto', e.target.value)} /></div>
          <div><Label>Interimskonto</Label><Input value={opt.interimskonto} onChange={e => set('interimskonto', e.target.value)} /></div>
          <div><Label>Bezeichnung</Label><Input value={opt.bezeichnung} onChange={e => set('bezeichnung', e.target.value)} /></div>
          <div className="flex items-end"><Button variant="outline" onClick={saveSettings} className="w-full">Einstellungen speichern</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Zeitraum &amp; Export</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Von</Label><Input type="date" value={opt.from} onChange={e => set('from', e.target.value)} /></div>
            <div><Label>Bis</Label><Input type="date" value={opt.to} onChange={e => set('to', e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm h-10">
              <input type="checkbox" checked={onlyBooked} onChange={e => setOnlyBooked(e.target.checked)} />
              nur verbuchte Zahlungen
            </label>
            <Button onClick={load} variant="outline" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}Aktualisieren
            </Button>
            <Button onClick={exportCsv} disabled={!rows.length}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />DATEV-CSV herunterladen
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{rows.length} Buchungen</Badge>
            <Badge variant="secondary">Saldo {money(sum)}</Badge>
            <Badge variant="outline">Buchhaltung {region}</Badge>
          </div>

          <div className="overflow-auto max-h-[420px] rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Datum</th><th className="p-2">Betrag</th>
                  <th className="p-2">S/H</th><th className="p-2">Beleg</th><th className="p-2">Buchungstext</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{r.booking_date ? new Date(r.booking_date).toLocaleDateString('de-DE') : '—'}</td>
                    <td className="p-2 whitespace-nowrap">{money(r.amount)}</td>
                    <td className="p-2">{Number(r.amount) >= 0 ? 'S' : 'H'}</td>
                    <td className="p-2">{r.invoice_number || r.bank_reference || '—'}</td>
                    <td className="p-2 truncate max-w-[380px]">{r.purpose || r.booking_text || r.sender_receiver_name || '—'}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Keine Buchungen im Zeitraum</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
