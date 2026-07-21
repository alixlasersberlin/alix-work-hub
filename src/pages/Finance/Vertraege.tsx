import { useEffect, useState } from 'react';
import { FileText, Plus, FileSignature, BellRing, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Button } from '@/components/ui/button';
import { listContracts } from '@/lib/finance/api';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { Badge } from '@/components/ui/badge';
import { ContractSignatureDetailsDialog } from './ContractSignatureDetailsDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function FinanceVertraege() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { canWrite } = useFinancePermissions();
  const [sigContract, setSigContract] = useState<any | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  async function sendReminder(r: any) {
    setRemindingId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke('portal-contract-remind-now', {
        body: { contract_id: r.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Erinnerung ${(data as any).reminder_number}/${(data as any).max} gesendet`);
      setRows(prev => prev.map(x => x.id === r.id
        ? { ...x, signature_reminder_count: (data as any).reminder_number, signature_last_reminder_at: new Date().toISOString(), signature_status: x.signature_status ?? 'requested' }
        : x));
    } catch (e: any) {
      toast.error(e?.message === 'cooldown' ? 'Bitte warten (Cool-down aktiv)' : `Fehler: ${e?.message || 'unbekannt'}`);
    } finally {
      setRemindingId(null);
    }
  }

  useEffect(() => {
    listContracts().then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const fmt = (n: number | null | undefined) => n != null ? Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—';

  const signatureBadge = (r: any) => {
    const s = r.signature_status as string | null;
    if (!s) return <span className="text-muted-foreground text-xs">—</span>;
    const map: Record<string, string> = {
      signed: 'bg-green-500/15 text-green-700 dark:text-green-300',
      pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
      requested: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      declined: 'bg-red-500/15 text-red-700 dark:text-red-300',
    };
    return <Badge className={map[s] ?? 'bg-muted'}>{s}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={FileText}
        title="Verträge"
        subtitle={`${rows.length} Verträge · ${rows.filter(r => r.signature_status === 'signed').length} signiert`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
        actions={canWrite ? <Button disabled className="gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Neuer Vertrag (folgt)</Button> : undefined}
      />
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={8} cols={8} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8"><EmptyState title="Keine Verträge" description="Noch keine Verträge angelegt." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Vertragsnummer</th>
                <th className="text-left px-4 py-3">Typ</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Signatur</th>
                <th className="text-left px-4 py-3">Start</th>
                <th className="text-left px-4 py-3">Ende</th>
                <th className="text-right px-4 py-3">Monatsrate</th>
                <th className="text-right px-4 py-3">Restbetrag</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2 font-medium">{r.contract_number || '—'}</td>
                  <td className="px-4 py-2">{r.contract_type}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="px-4 py-2">{signatureBadge(r)}</td>
                  <td className="px-4 py-2">{r.start_date ? new Date(r.start_date).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2">{r.end_date ? new Date(r.end_date).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.monthly_rate)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.remaining_amount)}</td>
                  <td className="px-4 py-2 text-right">
                    {r.signature_status === 'signed' && (
                      <Button size="sm" variant="ghost" onClick={() => setSigContract(r)}>
                        <FileSignature className="w-3.5 h-3.5 mr-1" /> Details
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ContractSignatureDetailsDialog
        open={!!sigContract}
        onOpenChange={(v) => !v && setSigContract(null)}
        contractId={sigContract?.id ?? null}
        contractLabel={sigContract ? `${sigContract.contract_type ?? 'Vertrag'} · ${sigContract.contract_number ?? ''}` : undefined}
      />
    </div>
  );
}
