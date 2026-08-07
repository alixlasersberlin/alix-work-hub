import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

const fmt = (n: any, cur = 'CHF') => new Intl.NumberFormat('de-CH', { style: 'currency', currency: cur }).format(Number(n || 0));

export default function Camt054() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<any[]>([]);
  const [entries, setEntries] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('finance_camt054_notifications')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region])
      .order('created_at', { ascending: false }).limit(100);
    setRows(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const content = await f.text();
      const { data, error } = await supabase.functions.invoke('finance-camt054-import', { body: { filename: f.name, content } });
      if (error) throw error;
      const d = data as any;
      if (d?.duplicate) toast({ title: 'Bereits importiert', description: 'Diese Datei wurde schon einmal verarbeitet.' });
      else toast({ title: 'CAMT.054 importiert', description: `${d.entry_count} Einträge · ${d.matched_count} zugeordnet` });
      load();
    } catch (e: any) {
      toast({ title: 'Import-Fehler', description: e.message, variant: 'destructive' });
    }
    setBusy(false); if (fileRef.current) fileRef.current.value = '';
  };

  const toggleDetails = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (!entries[id]) {
      const { data } = await (supabase as any).from('finance_camt054_entries')
        .select('*, qr:matched_qr_invoice_id(invoice_number, reference, amount)')
        .eq('notification_id', id).order('booking_date', { ascending: false });
      setEntries(prev => ({ ...prev, [id]: data ?? [] }));
    }
  };

  if (region !== 'CH') {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader icon={FileText} title="CAMT.054 · Gutschriftsanzeigen" subtitle="Nur für Buchhaltung 🇨🇭 CH verfügbar." />
        <EmptyState icon={FileText} title="Region wechseln" description="Bitte oben links Buchhaltung 🇨🇭 CH auswählen." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={FileText}
        title="CAMT.054 · Gutschriftsanzeigen · 🇨🇭 CH"
        subtitle="Import bankseitiger CAMT.054-Meldungen mit automatischem Matching gegen QR-Rechnungen"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Aktualisieren</Button>
            <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />{busy ? 'Lade…' : 'CAMT.054 hochladen'}
            </Button>
            <input ref={fileRef} type="file" accept=".xml,application/xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </div>
        }
      />

      {loading ? <SkeletonTable rows={5} /> : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Noch keine Meldungen" description="Lade eine CAMT.054-XML-Datei hoch." />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card">
              <button className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/20" onClick={() => toggleDetails(r.id)}>
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.filename}</div>
                  <div className="text-xs text-muted-foreground">{r.booking_date} · IBAN {r.account_iban || '—'} · MsgId {r.message_id || '—'}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{r.entry_count} Einträge</Badge>
                  <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-4 h-4" />{r.matched_count} zugeordnet</span>
                  {(r.entry_count - r.matched_count) > 0 && (
                    <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="w-4 h-4" />{r.entry_count - r.matched_count} offen</span>
                  )}
                  <div className="font-medium">{fmt(r.total_amount, r.currency || 'CHF')}</div>
                  <StatusBadge kind={r.status === 'verarbeitet' ? 'done' : r.status === 'fehler' ? 'error' : 'progress'} label={r.status} />
                </div>
              </button>
              {open === r.id && (
                <div className="border-t border-border p-3">
                  {!entries[r.id] ? <SkeletonTable rows={3} /> : entries[r.id].length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">Keine Einträge.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr><th className="text-left p-2">Datum</th><th className="text-left p-2">Zahler</th><th className="text-left p-2">Referenz</th><th className="text-right p-2">Betrag</th><th className="text-left p-2">Match</th></tr>
                      </thead>
                      <tbody>
                        {entries[r.id].map(e => (
                          <tr key={e.id} className="border-t border-border">
                            <td className="p-2">{e.booking_date}</td>
                            <td className="p-2">{e.debtor_name || '—'}</td>
                            <td className="p-2 font-mono">{e.reference ? e.reference.replace(/(\d{5})/g, '$1 ').trim() : '—'}</td>
                            <td className="p-2 text-right">{fmt(e.amount, e.currency || 'CHF')}</td>
                            <td className="p-2">
                              {e.match_status === 'zugeordnet'
                                ? <span className="text-emerald-500">✓ {e.qr?.invoice_number || 'zugeordnet'}</span>
                                : <span className="text-amber-500">{e.match_status}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
