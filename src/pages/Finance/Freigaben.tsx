import { useEffect, useState } from 'react';
import { CheckSquare, Check, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const fmt = (n: number | null) => n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n)) : '–';
const ENTITY_LABEL: Record<string, string> = {
  incoming_invoice: 'Eingangsrechnung',
  sepa_run: 'SEPA-Lauf',
  reminder_batch: 'Mahnstapel',
  year_end_run: 'Jahresabschluss',
};

export default function FinanceFreigaben() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<{ open: boolean; appr?: any; action?: 'approve' | 'reject' }>({ open: false });
  const [comment, setComment] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('finance_approvals' as any).select('*').order('created_at', { ascending: false }).limit(300);
    if (filter !== 'alle') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const act = async (appr: any, action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-approval-action', {
        body: { approval_id: appr.id, action, comment },
      });
      if (error) throw error;
      toast({ title: action === 'approve' ? 'Freigegeben' : 'Abgelehnt', description: (data as any)?.status });
      setDlg({ open: false });
      setComment('');
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  if (loading) return <PageLoading />;
  const pending = rows.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Freigaben" subtitle={`${pending} offene Genehmigungen`} icon={CheckSquare} actions={<>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Offen</SelectItem>
            <SelectItem value="approved">Freigegeben</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            <SelectItem value="alle">Alle</SelectItem>
          </SelectContent>
        </Select>
      </>} />

      <DataCard title="Inbox">
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{ENTITY_LABEL[r.entity_type] ?? r.entity_type}</Badge>
                  <span className="font-semibold">{r.title}</span>
                  {r.requires_dual_approval && <Badge variant="secondary">4-Augen</Badge>}
                  <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                </div>
                {r.description && <div className="text-sm text-muted-foreground truncate">{r.description}</div>}
                <div className="text-xs text-muted-foreground">
                  {r.amount != null && <span className="mr-3 font-semibold text-foreground">{fmt(r.amount)}</span>}
                  Angelegt: {new Date(r.created_at).toLocaleString('de-DE')}
                  {r.approved_at && ` · Freigegeben: ${new Date(r.approved_at).toLocaleString('de-DE')}`}
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 ml-3">
                  <Button size="sm" variant="outline" onClick={() => setDlg({ open: true, appr: r, action: 'reject' })}>
                    <X className="h-4 w-4 mr-1" />Ablehnen
                  </Button>
                  <Button size="sm" onClick={() => setDlg({ open: true, appr: r, action: 'approve' })}>
                    <Check className="h-4 w-4 mr-1" />Freigeben
                  </Button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Keine Einträge</div>}
        </div>
      </DataCard>

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ ...dlg, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dlg.action === 'approve' ? 'Genehmigung freigeben' : 'Genehmigung ablehnen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm font-medium">{dlg.appr?.title}</div>
            <div className="text-xs text-muted-foreground">{dlg.appr?.description}</div>
            <Textarea
              placeholder={dlg.action === 'reject' ? 'Begründung (Pflicht)' : 'Kommentar (optional)'}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg({ open: false })}>Abbrechen</Button>
            <Button
              variant={dlg.action === 'reject' ? 'destructive' : 'default'}
              disabled={busy || (dlg.action === 'reject' && !comment.trim())}
              onClick={() => dlg.appr && dlg.action && act(dlg.appr, dlg.action)}
            >
              {dlg.action === 'reject' ? 'Ablehnen' : 'Freigeben'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
