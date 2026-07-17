import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function SignApprovals() {
  const { user } = useAuth();
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sig_approval_states')
      .select('*, sig_requests(id, status, document_id, sig_documents(title))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setStates(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel('approval-states')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sig_approval_states' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const act = async (row: any, decision: 'approved' | 'rejected') => {
    const history = [...(row.history ?? []), { user_id: user?.id, decision, step: row.current_step, at: new Date().toISOString() }];
    const chainSteps = row.chain_id ? (await supabase.from('sig_approval_chains').select('steps').eq('id', row.chain_id).single()).data?.steps ?? [] : [];
    const nextStep = row.current_step + 1;
    const finished = decision === 'rejected' || nextStep >= (chainSteps as any[]).length;
    const nextApprover = finished ? null : (chainSteps as any[])[nextStep]?.user_id ?? null;

    const { error } = await supabase.from('sig_approval_states').update({
      status: finished ? decision : 'pending',
      current_step: finished ? row.current_step : nextStep,
      current_approver: nextApprover,
      history,
    }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }

    if (finished && decision === 'approved' && row.request_id) {
      await supabase.from('sig_requests').update({ status: 'sent' }).eq('id', row.request_id);
    }
    toast.success(decision === 'approved' ? 'Freigegeben' : 'Abgelehnt');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> Signatur-Genehmigungen</h1>
        <p className="text-sm text-muted-foreground">Ausstehende Freigaben für mehrstufige Signatur-Workflows.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Offen ({states.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Stufe</TableHead>
                  <TableHead>Zuständig</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {states.map(s => {
                  const canAct = s.current_approver === user?.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{s.sig_requests?.sig_documents?.title ?? s.request_id}</TableCell>
                      <TableCell><Badge variant="outline">Schritt {s.current_step + 1}</Badge></TableCell>
                      <TableCell className="text-xs">{canAct ? <Badge>Sie</Badge> : <span className="text-muted-foreground">Andere</span>}</TableCell>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString('de-DE')}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="default" disabled={!canAct} onClick={() => act(s, 'approved')}><CheckCircle2 className="w-3 h-3 mr-1" /> Freigeben</Button>
                        <Button size="sm" variant="destructive" disabled={!canAct} onClick={() => act(s, 'rejected')}><XCircle className="w-3 h-3 mr-1" /> Ablehnen</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {states.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Keine offenen Genehmigungen.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
