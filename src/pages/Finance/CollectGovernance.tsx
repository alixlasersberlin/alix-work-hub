import { useEffect, useState } from 'react';
import { ShieldCheck, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));

export default function FinanceCollectGovernance() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [a, t] = await Promise.all([
      supabase.from('collect_approvals' as any).select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('collect_payment_term_changes' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (a.error) toast({ title: 'Laden fehlgeschlagen', description: a.error.message, variant: 'destructive' });
    setApprovals((a.data as any) ?? []);
    setTerms((t.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (table: string, id: string, approved: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from(table as any).update({
      status: approved ? 'approved' : 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: auth?.user?.id ?? null,
      decision_note: note[id] ?? null,
    }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: approved ? 'Freigegeben' : 'Abgelehnt' });
    load();
  };

  const statusBadge = (s: string) => (
    <Badge variant="outline" className={s === 'approved' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500' : s === 'rejected' ? 'border-destructive/30 bg-destructive/15 text-destructive' : 'border-amber-500/30 bg-amber-500/15 text-amber-500'}>
      {s === 'approved' ? 'Freigegeben' : s === 'rejected' ? 'Abgelehnt' : 'Offen'}
    </Badge>
  );

  const pending = approvals.filter((a) => a.status === 'pending');
  const pendingTerms = terms.filter((t) => t.status === 'pending');

  return (
    <div className="space-y-6">
      <PageHeader title="Governance & Freigaben" subtitle="Vier-Augen-Prinzip für Stundungen, Zahlungsziel-Änderungen, Abschreibungen und Sperren" icon={ShieldCheck} />

      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="Offene Freigaben"><div className="text-2xl font-semibold">{pending.length}</div></DataCard>
        <DataCard title="Offene Zahlungsziele"><div className="text-2xl font-semibold">{pendingTerms.length}</div></DataCard>
        <DataCard title="Gesamt"><div className="text-2xl font-semibold">{approvals.length + terms.length}</div></DataCard>
      </div>

      <DataCard title="Freigabeanträge">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : approvals.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Keine Anträge" description="Freigaben entstehen automatisch bei hohen Beträgen oder Sonderkonditionen." />
        ) : (
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.title ?? a.approval_type}</span>
                  {statusBadge(a.status)}
                  {a.amount ? <Badge variant="outline">{eur(a.amount)}</Badge> : null}
                  <span className="text-xs text-muted-foreground">{a.customer_name ?? ''}</span>
                  <div className="flex-1" />
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('de-DE')}</span>
                </div>
                {a.reason && <p className="mt-2 text-sm text-muted-foreground">{a.reason}</p>}
                {a.status === 'pending' && (
                  <div className="mt-3 space-y-2">
                    <Textarea rows={2} placeholder="Begründung der Entscheidung (optional)" value={note[a.id] ?? ''} onChange={(e) => setNote((p) => ({ ...p, [a.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide('collect_approvals', a.id, true)}><Check className="mr-1 h-4 w-4" />Freigeben</Button>
                      <Button size="sm" variant="outline" onClick={() => decide('collect_approvals', a.id, false)}><X className="mr-1 h-4 w-4" />Ablehnen</Button>
                    </div>
                  </div>
                )}
                {a.decision_note && <p className="mt-2 text-xs text-muted-foreground">Entscheidung: {a.decision_note}</p>}
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <DataCard title="Zahlungsziel-Änderungen">
        {loading ? (
          <SkeletonTable rows={3} />
        ) : terms.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Keine Anträge" description="Änderungen von Zahlungszielen erscheinen hier zur Freigabe." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Alt</th>
                  <th className="py-2 pr-3">Neu</th>
                  <th className="py-2 pr-3">Grund</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{t.customer_name}</td>
                    <td className="py-2 pr-3">{t.old_terms_days ?? '—'} Tage</td>
                    <td className="py-2 pr-3">{t.new_terms_days ?? '—'} Tage</td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.reason ?? '—'}</td>
                    <td className="py-2 pr-3">{statusBadge(t.status)}</td>
                    <td className="py-2 pr-3">
                      {t.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => decide('collect_payment_term_changes', t.id, true)}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => decide('collect_payment_term_changes', t.id, false)}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
