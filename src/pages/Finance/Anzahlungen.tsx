import { useEffect, useMemo, useState } from 'react';
import { Wallet, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { getTransactions } from '@/lib/finance/api';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function FinanceAnzahlungen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [openingRef, setOpeningRef] = useState<string | null>(null);
  useEffect(() => {
    getTransactions({ transaction_type: 'Anzahlung' }).then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const openPdf = async (reference: string | null) => {
    if (!reference) { toast({ title: 'Keine Referenz', variant: 'destructive' }); return; }
    setOpeningRef(reference);
    try {
      const { data, error } = await supabase
        .from('order_documents')
        .select('download_token, file_path, file_name')
        .eq('document_type', 'Anzahlungsrechnung')
        .ilike('file_name', `%${reference}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const doc: any = data?.[0];
      if (doc?.download_token) {
        window.open(`https://alixwork.de/d/${doc.download_token}`, '_blank', 'noopener');
        return;
      }
      if (doc?.file_path) {
        const { data: signed, error: sErr } = await supabase.storage
          .from('order-invoices')
          .createSignedUrl(doc.file_path, 300);
        if (sErr) throw sErr;
        window.open(signed.signedUrl, '_blank', 'noopener');
        return;
      }
      toast({ title: 'Keine PDF gefunden', description: `Für ${reference} liegt kein Dokument vor.`, variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setOpeningRef(null);
    }
  };
  const filtered = useMemo(() => rows.filter((r) => matchesQuery({ ...r, total: r.amount, balance: r.amount }, search)), [rows, search]);
  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Wallet}
        title="Anzahlungen"
        subtitle={`${rows.length} Anzahlungen`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
      />
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={8} cols={4} /></div>
        ) : visible.length === 0 ? (
          <div className="p-8"><EmptyState title="Keine Anzahlungen" description="Es wurden noch keine Anzahlungen erfasst." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Datum</th><th className="text-left px-4 py-3">Referenz</th><th className="text-right px-4 py-3">Betrag</th><th className="text-left px-4 py-3">Notiz</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2">{r.booking_date ? new Date(r.booking_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2">{r.reference || '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(r.amount)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
