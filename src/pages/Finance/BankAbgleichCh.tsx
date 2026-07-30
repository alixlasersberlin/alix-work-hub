import { useEffect, useMemo, useState } from 'react';
import { Banknote, RefreshCw, Link2, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const fmt = (n: any) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(n || 0));

export default function BankAbgleichCh() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [ddItems, setDdItems] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [l, i, d] = await Promise.all([
      (supabase as any).from('finance_bank_lines')
        .select('*, customers:matched_customer_id(company_name, contact_name)')
        .eq('accounting_region', 'CH').order('booking_date', { ascending: false }).limit(300),
      (supabase as any).from('finance_qr_invoices')
        .select('*').eq('accounting_region', 'CH').order('created_at', { ascending: false }).limit(300),
      (supabase as any).from('finance_ch_dd_run_items')
        .select('*, run:run_id(run_number, scheme, collection_date, status), mandate:mandate_id(account_holder, mandate_reference)')
        .eq('accounting_region', 'CH').order('created_at', { ascending: false }).limit(300),
    ]);
    setLines(l.data ?? []); setInvoices(i.data ?? []); setDdItems(d.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openLines = useMemo(() => lines.filter(l => l.status === 'offen' && Number(l.amount) > 0), [lines]);
  const openInvoices = useMemo(() => invoices.filter(i => i.status !== 'bezahlt' && i.status !== 'storniert'), [invoices]);
  const matchedCount = lines.filter(l => l.status === 'zugeordnet').length;
  const matchRate = lines.length ? Math.round((matchedCount / lines.length) * 100) : 0;
  const ddOpen = ddItems.filter(d => d.status !== 'verbucht');

  const runReconcile = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-ch-reconcile', { body: {} });
      if (error) throw error;
      toast({
        title: 'Abgleich abgeschlossen',
        description: `${data?.qrMatched ?? 0} QR-Zahlungen zugeordnet · ${data?.ddUpdated ?? 0} LSV-Positionen aktualisiert · ${data?.runsClosed ?? 0} Läufe verbucht.`,
      });
      await load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message, variant: 'destructive' });
    } finally { setRunning(false); }
  };

  const manualMatch = async (line: any) => {
    const invId = pick[line.id];
    if (!invId) return;
    const inv = invoices.find(i => i.id === invId);
    const { error } = await (supabase as any).from('finance_bank_lines').update({
      status: 'zugeordnet',
      matched_customer_id: inv?.customer_id ?? null,
      match_confidence: 1,
      match_method: 'manuell:qr-rechnung',
      matched_at: new Date().toISOString(),
    }).eq('id', line.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    await (supabase as any).from('finance_qr_invoices')
      .update({ status: 'bezahlt', paid_at: new Date().toISOString() }).eq('id', invId);
    toast({ title: 'Zugeordnet', description: `Buchung mit ${inv?.invoice_number ?? 'QR-Rechnung'} verknüpft.` });
    await load();
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Banknote}
        title="Bank-Abgleich 🇨🇭 CH"
        subtitle="CAMT.053 QR-Referenz-Matching und LSV+/BDD Status-Loop"
        noBreadcrumbs
        meta={<StatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${matchRate}% zugeordnet`} pulse={loading} />}
        actions={
          <Button onClick={runReconcile} disabled={running} className="gold-gradient text-primary-foreground">
            <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />{running ? 'Läuft…' : 'Abgleich starten'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { l: 'Offene Buchungen', v: String(openLines.length) },
          { l: 'Offene QR-Rechnungen', v: String(openInvoices.length) },
          { l: 'Offener QR-Betrag', v: fmt(openInvoices.reduce((s, i) => s + Number(i.amount || 0), 0)) },
          { l: 'LSV+ offen', v: String(ddOpen.length) },
        ].map(k => (
          <DataCard key={k.l} className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.l}</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{k.v}</div>
          </DataCard>
        ))}
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Offene Buchungen</TabsTrigger>
          <TabsTrigger value="qr">QR-Rechnungen</TabsTrigger>
          <TabsTrigger value="lsv">LSV+/BDD Status-Loop</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <DataCard className="overflow-hidden">
            {loading ? <div className="p-6"><SkeletonTable rows={6} cols={5} /></div> : openLines.length === 0 ? (
              <div className="p-8"><EmptyState compact icon={QrCode} title="Keine offenen Buchungen" description="Alle CH-Zahlungseingänge sind zugeordnet." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Datum</th>
                      <th className="text-left px-4 py-3">Referenz / Zweck</th>
                      <th className="text-left px-4 py-3">Gegenpartei</th>
                      <th className="text-right px-4 py-3">Betrag</th>
                      <th className="text-left px-4 py-3">Manuelle Zuordnung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openLines.map(l => (
                      <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs">{l.booking_date ?? l.value_date ?? '–'}</td>
                        <td className="px-4 py-3 max-w-sm truncate" title={l.purpose}>{l.purpose ?? '–'}</td>
                        <td className="px-4 py-3 text-xs">{l.counterparty_name ?? '–'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-500">{fmt(l.amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 items-center">
                            <Select value={pick[l.id] ?? ''} onValueChange={(v) => setPick(p => ({ ...p, [l.id]: v }))}>
                              <SelectTrigger className="w-[240px]"><SelectValue placeholder="QR-Rechnung wählen…" /></SelectTrigger>
                              <SelectContent>
                                {openInvoices.map(i => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {(i.invoice_number ?? i.reference ?? i.id.slice(0, 8))} · {fmt(i.amount)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" disabled={!pick[l.id]} onClick={() => manualMatch(l)}>
                              <Link2 className="w-3.5 h-3.5 mr-1" />Zuordnen
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>

        <TabsContent value="qr">
          <DataCard className="overflow-hidden">
            {loading ? <div className="p-6"><SkeletonTable rows={6} cols={5} /></div> : invoices.length === 0 ? (
              <div className="p-8"><EmptyState compact title="Keine QR-Rechnungen" description="Es wurden noch keine QR-Rechnungen erstellt." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Rechnung</th>
                      <th className="text-left px-4 py-3">Referenz</th>
                      <th className="text-left px-4 py-3">Debitor</th>
                      <th className="text-right px-4 py-3">Betrag</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(i => (
                      <tr key={i.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">{i.invoice_number ?? '–'}</td>
                        <td className="px-4 py-3 text-xs font-mono">{i.reference ?? '–'}</td>
                        <td className="px-4 py-3 text-xs">{i.debtor_name ?? '–'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(i.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge className={i.status === 'bezahlt'
                            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}>{i.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>

        <TabsContent value="lsv">
          <DataCard className="overflow-hidden">
            {loading ? <div className="p-6"><SkeletonTable rows={6} cols={6} /></div> : ddItems.length === 0 ? (
              <div className="p-8"><EmptyState compact title="Keine LSV+/BDD Positionen" description="Es wurden noch keine Lastschriftläufe erstellt." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Lauf</th>
                      <th className="text-left px-4 py-3">Verfahren</th>
                      <th className="text-left px-4 py-3">Zahler</th>
                      <th className="text-left px-4 py-3">Referenz</th>
                      <th className="text-right px-4 py-3">Betrag</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ddItems.map(d => (
                      <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs">{d.run?.run_number ?? '–'}<br /><span className="text-muted-foreground">{d.run?.collection_date ?? ''}</span></td>
                        <td className="px-4 py-3 text-xs">{d.run?.scheme ?? 'LSV+'}</td>
                        <td className="px-4 py-3 text-xs">{d.mandate?.account_holder ?? '–'}</td>
                        <td className="px-4 py-3 text-xs font-mono">{d.reference ?? d.end_to_end_id ?? '–'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(d.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge className={
                            d.status === 'verbucht' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                              : d.status === 'teilbelastet' ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                          }>{d.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
