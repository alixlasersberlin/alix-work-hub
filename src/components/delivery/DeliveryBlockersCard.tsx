import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldAlert, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { BLOCKER_TYPES, BLOCKER_LABELS } from '@/lib/delivery/control-tower';

const db = supabase as any;

interface Props {
  orderId: string;
  compact?: boolean;
  onChanged?: () => void;
}

export default function DeliveryBlockersCard({ orderId, compact, onChanged }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [internal, setInternal] = useState('');
  const [customerMsg, setCustomerMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await db
      .from('order_delivery_blockers')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  async function addBlocker() {
    if (!type) return;
    setBusy('add');
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from('order_delivery_blockers').insert({
      order_id: orderId,
      blocker_type: type,
      severity,
      internal_note: internal || null,
      customer_visible_message: customerMsg || null,
      created_by: auth?.user?.id ?? null,
    });
    setBusy(null);
    if (error) { toast.error('Blocker konnte nicht angelegt werden'); return; }
    await db.from('order_delivery_events').insert({
      order_id: orderId,
      event_type: 'blocker_added',
      title: `Blocker: ${BLOCKER_LABELS[type] ?? type}`,
      description: internal || null,
      visible_to_customer: false,
    });
    setType(''); setInternal(''); setCustomerMsg(''); setSeverity('medium'); setAdding(false);
    toast.success('Blocker angelegt');
    await load();
    onChanged?.();
  }

  async function resolve(id: string, blockerType: string) {
    setBusy(id);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from('order_delivery_blockers').update({
      blocker_status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: auth?.user?.id ?? null,
    }).eq('id', id);
    setBusy(null);
    if (error) { toast.error('Blocker konnte nicht gelöst werden'); return; }
    await db.from('order_delivery_events').insert({
      order_id: orderId,
      event_type: 'blocker_resolved',
      title: `Blocker gelöst: ${BLOCKER_LABELS[blockerType] ?? blockerType}`,
      visible_to_customer: false,
    });
    toast.success('Blocker gelöst');
    await load();
    onChanged?.();
  }

  const open = rows.filter((r) => r.blocker_status !== 'resolved');

  const body = (
    <div className="space-y-2">
      {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Keine Blocker erfasst.</p>}
      {rows.map((b) => (
        <div key={b.id} className="rounded-md border p-2.5 text-sm space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={b.blocker_status === 'resolved' ? 'outline' : 'destructive'}>
              {BLOCKER_LABELS[b.blocker_type] ?? b.blocker_type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(b.created_at).toLocaleString('de-DE')}
            </span>
            {b.blocker_status !== 'resolved' && (
              <Button size="sm" variant="outline" className="ml-auto" disabled={busy === b.id} onClick={() => resolve(b.id, b.blocker_type)}>
                {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />} Lösen
              </Button>
            )}
            {b.blocker_status === 'resolved' && b.resolved_at && (
              <span className="ml-auto text-xs text-muted-foreground">gelöst am {new Date(b.resolved_at).toLocaleDateString('de-DE')}</span>
            )}
          </div>
          {b.internal_note && <div className="text-muted-foreground">Intern: {b.internal_note}</div>}
          {b.customer_visible_message && <div className="text-muted-foreground">Portaltext: {b.customer_visible_message}</div>}
        </div>
      ))}

      {adding ? (
        <div className="rounded-md border p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Blockertyp</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
                <SelectContent>
                  {BLOCKER_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Schweregrad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">niedrig</SelectItem>
                  <SelectItem value="medium">mittel</SelectItem>
                  <SelectItem value="high">hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Interne Notiz (nie im Portal sichtbar)</Label>
            <Textarea rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Kundenfreundlicher Portaltext (optional)</Label>
            <Input value={customerMsg} onChange={(e) => setCustomerMsg(e.target.value)} placeholder="z. B. Ein Bauteil befindet sich noch in der Bereitstellung." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addBlocker} disabled={!type || busy === 'add'}>
              {busy === 'add' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Blocker anlegen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Blocker hinzufügen
        </Button>
      )}
    </div>
  );

  if (compact) return body;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Blocker {open.length > 0 && <Badge variant="destructive">{open.length} offen</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
