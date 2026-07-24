import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

interface Row {
  id: string;
  order_id: string;
  order_number: string | null;
  requested_by_name: string | null;
  reason: string | null;
  proposed_changes: Record<string, unknown>;
  original_snapshot: Record<string, unknown>;
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export default function Freigaben() {
  const { isAdmin, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin') || isAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('order_change_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (filter === 'pending') q = q.eq('status', 'pending');
    const { data } = await q;
    setRows((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  useEffect(() => {
    const ch = supabase
      .channel('order-change-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_change_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [filter]);

  const decide = async (row: Row, approve: boolean) => {
    setBusy(row.id);
    const fn = approve ? 'apply_order_change_request' : 'reject_order_change_request';
    const { error } = await supabase.rpc(fn as any, { _id: row.id, _note: notes[row.id] || null });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? 'Freigegeben – Änderung übernommen' : 'Abgelehnt');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Auftrags-Freigaben
          </h1>
          <p className="text-sm text-muted-foreground">
            Änderungsvorschläge zu bestehenden Aufträgen – Freigabe durch Super Admin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>Offen</Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Alle</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Keine Freigaben vorhanden.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Auftrag {r.order_number ?? r.order_id.slice(0, 8)}
                      <Link to={`/auftraege/${r.order_id}`} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                        öffnen <ExternalLink className="w-3 h-3" />
                      </Link>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.requested_by_name ?? 'Unbekannt'} · {new Date(r.created_at).toLocaleString('de-DE')}
                    </div>
                  </div>
                  <Badge variant={r.status === 'pending' ? 'default' : r.status === 'approved' ? 'secondary' : 'destructive'}>
                    {r.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.reason && (
                  <div className="text-sm"><span className="font-medium">Begründung:</span> {r.reason}</div>
                )}
                <div className="rounded border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr><th className="text-left p-2">Feld</th><th className="text-left p-2">Vorher</th><th className="text-left p-2">Neu</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(r.proposed_changes || {}).map(([k, v]) => (
                        <tr key={k} className="border-t border-border">
                          <td className="p-2 font-mono">{k}</td>
                          <td className="p-2 text-muted-foreground">{fmt((r.original_snapshot as any)?.[k])}</td>
                          <td className="p-2">{fmt(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {r.status === 'pending' && isSuperAdmin && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Notiz (optional)"
                      rows={2}
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, true)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Freigeben & anwenden
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => decide(r, false)}>
                        <XCircle className="w-4 h-4 mr-1" /> Ablehnen
                      </Button>
                    </div>
                  </div>
                )}

                {r.status !== 'pending' && (
                  <div className="text-xs text-muted-foreground">
                    {r.status === 'approved' ? '✓ Freigegeben' : '✗ Abgelehnt'} von {r.reviewed_by_name ?? '—'}
                    {r.reviewed_at ? ` am ${new Date(r.reviewed_at).toLocaleString('de-DE')}` : ''}
                    {r.review_note ? ` · ${r.review_note}` : ''}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(v: unknown) {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
  if (typeof v === 'object') return <code className="text-[10px]">{JSON.stringify(v)}</code>;
  return String(v);
}
