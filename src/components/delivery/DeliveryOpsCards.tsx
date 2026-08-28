import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, MapPin, History, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { ETA_STATE_LABELS, type EtaState } from '@/lib/delivery/control-tower';

const db = supabase as any;

interface Props {
  orderId: string;
  onChanged?: () => void;
}

function dt(v?: string | null) {
  return v ? new Date(v).toLocaleString('de-DE') : '—';
}

function d(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('de-DE') : '—';
}

export default function DeliveryOpsCards({ orderId, onChanged }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      db.from('order_delivery_address_requests').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      db.from('order_delivery_eta_history').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(25),
      db.from('order_delivery_comms').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(25),
    ]);
    setRequests(a.data ?? []);
    setHistory(b.data ?? []);
    setComms(c.data ?? []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  async function review(req: any, accept: boolean) {
    setBusy(req.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await db
        .from('order_delivery_address_requests')
        .update({ status: accept ? 'accepted' : 'rejected', reviewed_by: auth?.user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', req.id);

      if (accept) {
        await db
          .from('order_delivery_status')
          .update({ address_confirmed: true, address_confirmed_at: new Date().toISOString() })
          .eq('order_id', orderId);
      }

      await db.from('order_delivery_events').insert({
        order_id: orderId,
        title: accept ? 'Adressänderung übernommen' : 'Adressänderung abgelehnt',
        description: req.note ?? null,
        visible_to_customer: accept,
      });

      toast.success(accept ? 'Adressänderung übernommen' : 'Adressänderung abgelehnt');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Aktion fehlgeschlagen');
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Lade Lieferdaten …
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Adressanfragen des Kunden
            {requests.some((r) => r.status === 'open') && (
              <Badge variant="destructive" className="text-[10px]">
                {requests.filter((r) => r.status === 'open').length} offen
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">Keine Anfragen.</p>}
          {requests.map((r) => {
            const p = r.proposed ?? {};
            return (
              <div key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{dt(r.created_at)}</span>
                  <Badge variant={r.status === 'open' ? 'destructive' : 'outline'} className="text-[10px]">
                    {r.status === 'open' ? 'offen' : r.status === 'accepted' ? 'übernommen' : 'abgelehnt'}
                  </Badge>
                </div>
                <div className="text-sm">
                  {[p.company, p.attention, p.street, [p.zip, p.city].filter(Boolean).join(' '), p.country]
                    .filter(Boolean)
                    .join(' · ') || 'Keine Adressdaten übermittelt'}
                </div>
                {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
                {r.status === 'open' && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === r.id} onClick={() => review(r, true)}>
                      {busy === r.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                      Übernehmen
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => review(r, false)}>
                      <X className="w-4 h-4 mr-1.5" /> Ablehnen
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> ETA-Historie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Terminänderungen.</p>}
            {history.map((h) => (
              <div key={h.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="text-xs text-muted-foreground">{dt(h.created_at)} · {h.source}</div>
                <div>
                  {d(h.old_date)} → <span className="font-medium">{d(h.new_date)}</span>
                  {h.new_state && (
                    <span className="text-muted-foreground"> ({ETA_STATE_LABELS[h.new_state as EtaState] ?? h.new_state})</span>
                  )}
                </div>
                {h.reason && <div className="text-muted-foreground">{h.reason}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Kommunikationsprotokoll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comms.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Nachrichten protokolliert.</p>}
            {comms.map((c) => (
              <div key={c.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="text-xs text-muted-foreground">
                  {dt(c.created_at)} · {c.channel} · {c.direction === 'inbound' ? 'eingehend' : 'ausgehend'}
                  {!c.success && <span className="text-destructive"> · Fehler</span>}
                </div>
                <div className="font-medium">{c.subject || c.event_key || '—'}</div>
                {c.recipient && <div className="text-muted-foreground text-xs">{c.recipient}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
