import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, BellRing, FileWarning, PlayCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

type Doc = {
  id: string; doc_type: string; doc_number: string | null; status: string; tenant_id: string;
  customer_id: string | null; customer_name: string | null; customer_email: string | null;
  doc_date: string; due_date: string | null; currency: string; tax_rate: number;
  net_total: number; tax_total: number; gross_total: number; paid_total: number;
  reference: string | null; notes: string | null; billing_address: string | null;
  reminder_level: number; last_reminded_at: string | null;
};

const LEVELS = [
  { level: 1, type: 'zahlungserinnerung', label: 'Zahlungserinnerung' },
  { level: 2, type: 'mahnung', label: '1. Mahnung' },
  { level: 3, type: 'mahnung', label: '2. Mahnung' },
];

const daysOverdue = (d: Doc) => {
  if (!d.due_date) return 0;
  return Math.floor((Date.now() - new Date(d.due_date).getTime()) / 86400000);
};

export default function CmrMahnwesen() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [levelFilter, setLevelFilter] = useState('');
  const [minDays, setMinDays] = useState('0');

  /** Startet den automatischen Mahnlauf – erzeugt ausschließlich Entwürfe. */
  const runDunning = async () => {
    if (!tenantId) return;
    setRunBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('cmr-dunning-run', { body: { tenantId } });
      if (error) throw error;
      const created = Number((data as any)?.created ?? 0);
      toast.success(created ? `${created} Mahnbeleg(e) als Entwurf erstellt.` : 'Keine neuen Mahnungen fällig.');
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Mahnlauf fehlgeschlagen');
    } finally {
      setRunBusy(false);
    }
  };

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase.from('cmr_documents' as any)
      .select('*').eq('tenant_id', tenantId).eq('doc_type', 'rechnung')
      .order('due_date', { ascending: true }).limit(500);
    setDocs(((data as any) || []) as Doc[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const overdue = useMemo(
    () => docs.filter((d) => Number(d.gross_total) - Number(d.paid_total) > 0.01 && daysOverdue(d) > 0),
    [docs],
  );

  const sums = useMemo(() => ({
    count: overdue.length,
    amount: overdue.reduce((s, d) => s + (Number(d.gross_total) - Number(d.paid_total)), 0),
  }), [overdue]);

  /** Erzeugt Zahlungserinnerung bzw. Mahnung als eigenen Beleg und erhöht die Mahnstufe. */
  const createReminder = async (d: Doc) => {
    if (!tenantId) return;
    const nextLevel = Math.min(3, Number(d.reminder_level || 0) + 1);
    const cfg = LEVELS.find((l) => l.level === nextLevel)!;
    setWorking(d.id);
    try {
      const { data: nr, error: nrErr } = await supabase.rpc('cmr_next_document_number' as any, {
        _tenant_id: tenantId, _doc_type: cfg.type,
      } as any);
      if (nrErr) throw nrErr;

      const openAmount = Number(d.gross_total) - Number(d.paid_total);
      const { data: created, error } = await supabase.from('cmr_documents' as any).insert({
        tenant_id: tenantId, doc_type: cfg.type, doc_number: nr, status: 'entwurf',
        customer_id: d.customer_id, customer_name: d.customer_name, customer_email: d.customer_email,
        billing_address: d.billing_address, doc_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        currency: d.currency || cur, tax_rate: 0,
        net_total: openAmount, tax_total: 0, gross_total: openAmount, paid_total: 0,
        reference: d.doc_number, parent_document_id: d.id,
        notes: `${cfg.label} zur Rechnung ${d.doc_number ?? ''} vom ${new Date(d.doc_date).toLocaleDateString('de-DE')} · offen seit ${daysOverdue(d)} Tagen.`,
      }).select('id').single();
      if (error) throw error;

      await supabase.from('cmr_document_items' as any).insert({
        document_id: (created as any).id, position: 1,
        name: `Offener Betrag Rechnung ${d.doc_number ?? ''}`,
        quantity: 1, unit: 'Pauschal', unit_price: openAmount, discount_pct: 0, tax_rate: 0, line_total: openAmount,
      });

      await supabase.from('cmr_documents' as any).update({
        reminder_level: nextLevel, last_reminded_at: new Date().toISOString(),
      }).eq('id', d.id);

      toast.success(`${cfg.label} ${nr} erstellt – Versand über Geschäftsvorgänge.`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Mahnung konnte nicht erstellt werden');
    } finally {
      setWorking(null);
    }
  };

  const visible = useMemo(
    () => overdue.filter((d) =>
      (levelFilter === '' || Number(d.reminder_level || 0) === Number(levelFilter)) &&
      daysOverdue(d) >= Number(minDays || 0)),
    [overdue, levelFilter, minDays],
  );

  const exportCsv = () => {
    const head = ['belegnummer', 'kunde', 'faellig_am', 'tage_ueberfaellig', 'mahnstufe', 'offen', 'waehrung'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = visible.map((d) => [
      d.doc_number ?? '', d.customer_name ?? '', d.due_date ?? '', daysOverdue(d),
      d.reminder_level ?? 0, (Number(d.gross_total) - Number(d.paid_total)).toFixed(2), d.currency || cur,
    ].map(esc).join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cmr-mahnwesen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };


  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CMR Mahnwesen"
        subtitle="Überfällige Rechnungen des Mandanten CMR – Zahlungserinnerung und Mahnstufen."
        actions={
          <Button variant="outline" onClick={runDunning} disabled={runBusy}>
            {runBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}
            Mahnlauf jetzt
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Überfällige Rechnungen</div><div className="text-xl font-semibold mt-1">{sums.count}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offener Betrag</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.amount, cur)}</div></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="">Alle Mahnstufen</option>
          <option value="0">Stufe 0 – noch nicht gemahnt</option>
          <option value="1">Stufe 1</option>
          <option value="2">Stufe 2</option>
          <option value="3">Stufe 3</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={minDays}
          onChange={(e) => setMinDays(e.target.value)}
        >
          <option value="0">ab 1 Tag überfällig</option>
          <option value="10">ab 10 Tagen</option>
          <option value="30">ab 30 Tagen</option>
          <option value="60">ab 60 Tagen</option>
          <option value="90">ab 90 Tagen</option>
        </select>
        <span className="text-xs text-muted-foreground">{visible.length} Treffer</span>
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="w-4 h-4 mr-1.5" /> CSV Export
        </Button>
      </div>

      <Card className="divide-y">
        {visible.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <FileWarning className="w-5 h-5" /> Keine überfälligen Rechnungen für diese Auswahl.
          </div>
        )}
        {visible.map((d) => {
          const nextLevel = Math.min(3, Number(d.reminder_level || 0) + 1);
          const cfg = LEVELS.find((l) => l.level === nextLevel)!;
          return (
            <div key={d.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{d.doc_number ?? '—'} · {d.customer_name ?? 'Ohne Kunde'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  fällig {d.due_date ? new Date(d.due_date).toLocaleDateString('de-DE') : '—'} · {daysOverdue(d)} Tage überfällig
                  {d.last_reminded_at ? ` · zuletzt gemahnt ${new Date(d.last_reminded_at).toLocaleDateString('de-DE')}` : ''}
                </div>
              </div>
              <Badge variant={Number(d.reminder_level) > 1 ? 'destructive' : 'outline'}>Stufe {d.reminder_level ?? 0}</Badge>
              <div className="text-sm font-semibold whitespace-nowrap">
                {cmrMoney(Number(d.gross_total) - Number(d.paid_total), d.currency || cur)}
              </div>
              <Button size="sm" variant="outline" onClick={() => createReminder(d)} disabled={working === d.id}>
                {working === d.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BellRing className="w-4 h-4 mr-1.5" />}
                {cfg.label}
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
