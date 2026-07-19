import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Loader2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function AlixDocsApprovals() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('alixdocs_approval_states')
      .select('id, status, current_step, current_approver, created_at, document_id, alixdocs_documents(title, mime_type)')
      .eq('status', 'pending')
      .eq('current_approver', user?.id ?? '')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const decide = async (state_id: string, decision: 'approved' | 'rejected') => {
    const { data, error } = await supabase.functions.invoke('alixdocs-approval-decide', {
      body: { state_id, decision, comment: comment[state_id] ?? null },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(decision === 'approved' ? 'Freigegeben' : 'Abgelehnt');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Workflow className="w-6 h-6" /> AlixDocs · Freigaben</h1>
        <p className="text-sm text-muted-foreground">Deine offenen Dokument-Freigaben.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Offen ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Dokument</TableHead><TableHead>Schritt</TableHead><TableHead>Erstellt</TableHead><TableHead>Kommentar</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.alixdocs_documents?.title ?? r.document_id}</TableCell>
                    <TableCell><Badge variant="outline">Schritt {r.current_step + 1}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="w-64">
                      <Textarea rows={1} placeholder="Optional" value={comment[r.id] ?? ''} onChange={e => setComment({ ...comment, [r.id]: e.target.value })} />
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" onClick={() => decide(r.id, 'approved')}><CheckCircle2 className="w-3 h-3 mr-1" /> Freigeben</Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(r.id, 'rejected')}><XCircle className="w-3 h-3 mr-1" /> Ablehnen</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Keine offenen Freigaben.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
