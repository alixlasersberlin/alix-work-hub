import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

const STATUS_META: Record<string, { label: string; variant: any; icon: any }> = {
  none:     { label: 'Keine Freigabe nötig', variant: 'outline',   icon: Clock },
  pending:  { label: 'Wartet auf Freigabe',  variant: 'secondary', icon: Clock },
  approved: { label: 'Freigegeben',          variant: 'default',   icon: CheckCircle2 },
  rejected: { label: 'Abgelehnt',            variant: 'destructive', icon: XCircle },
};

export function ApprovalPanel({ doc, onChange }: { doc: any; onChange: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const status = doc?.approval_status ?? 'none';
  const meta = STATUS_META[status] ?? STATUS_META.none;
  const Icon = meta.icon;

  async function setStatus(next: 'pending' | 'approved' | 'rejected') {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { approval_status: next, approval_note: note || null };
    if (next === 'approved' || next === 'rejected') {
      payload.approved_by = u.user?.id ?? null;
      payload.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('alixdocs2_documents').update(payload).eq('id', doc.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Status aktualisiert');
    onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4" /> Vier-Augen-Freigabe</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {doc?.approved_at && (
          <p className="text-xs text-muted-foreground">
            {new Date(doc.approved_at).toLocaleString('de-DE')}
          </p>
        )}
        {doc?.approval_note && <p className="text-xs italic">„{doc.approval_note}"</p>}
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz zur Freigabe (optional)" rows={2} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('pending')}>Zur Freigabe</Button>
          <Button size="sm" disabled={busy} onClick={() => setStatus('approved')}><CheckCircle2 className="w-3 h-3 mr-1" /> Freigeben</Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setStatus('rejected')}><XCircle className="w-3 h-3 mr-1" /> Ablehnen</Button>
        </div>
      </CardContent>
    </Card>
  );
}
