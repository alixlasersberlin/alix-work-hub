import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Truck, Send } from 'lucide-react';
import { useRepairPermissions } from '@/lib/repair/permissions';

const CARRIERS = ['DHL', 'DPD', 'UPS', 'GLS', 'FedEx', 'Hermes', 'Spedition', 'Selbstabholer', 'Sonstige'];
const RELEVANT = ['Reparatur abgeschlossen', 'An Tourenplanung übergeben', 'Ausgeliefert'];

export default function Rueckversand() {
  const { toast } = useToast();
  const perms = useRepairPermissions();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await sbRepair
      .from('repair_orders')
      .select('id, repair_number, customer_name, customer_email, device_brand, device_model, repair_status, shipping_carrier, shipping_tracking_number, shipping_tracking_url, shipped_at, shipping_note')
      .in('repair_status', RELEVANT)
      .order('updated_at', { ascending: false })
      .limit(500);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    const patch: any = {
      shipping_carrier: edit.shipping_carrier || null,
      shipping_tracking_number: edit.shipping_tracking_number || null,
      shipping_tracking_url: edit.shipping_tracking_url || null,
      shipping_note: edit.shipping_note || null,
    };
    if (edit._setShipped) {
      patch.shipped_at = new Date().toISOString();
      patch.repair_status = 'Ausgeliefert';
    }
    const { error } = await sbRepair.from('repair_orders').update(patch).eq('id', edit.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: edit._setShipped ? 'Versand erfasst – Kunde wird benachrichtigt' : 'Versanddaten gespeichert' });
    setEdit(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Rückversand</h2>
        </div>
        <p className="text-xs text-muted-foreground">Versanddienstleister & Tracking erfassen. Beim Setzen auf „Ausgeliefert" wird der Kunde automatisch per E-Mail informiert.</p>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reparatur</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Gerät</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dienstleister</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Versendet</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Lädt…</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Keine versandbereiten Reparaturen</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/reparatur/${r.id}`} className="text-primary hover:underline font-mono text-xs">{r.repair_number}</Link></TableCell>
                <TableCell>{r.customer_name}</TableCell>
                <TableCell className="text-xs">{[r.device_brand, r.device_model].filter(Boolean).join(' ') || '–'}</TableCell>
                <TableCell><Badge variant="outline">{r.repair_status}</Badge></TableCell>
                <TableCell>{r.shipping_carrier || '–'}</TableCell>
                <TableCell className="font-mono text-xs">{r.shipping_tracking_number || '–'}</TableCell>
                <TableCell className="text-xs">{r.shipped_at ? new Date(r.shipped_at).toLocaleDateString('de-DE') : '–'}</TableCell>
                <TableCell>
                  {perms.canEditShipping && (
                    <Button size="sm" variant="outline" onClick={() => setEdit({ ...r })}>Bearbeiten</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Rückversand · {edit?.repair_number}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Versanddienstleister</Label>
                <Select value={edit.shipping_carrier || ''} onValueChange={(v) => setEdit({ ...edit, shipping_carrier: v })}>
                  <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
                  <SelectContent>{CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Trackingnummer</Label><Input value={edit.shipping_tracking_number || ''} onChange={(e) => setEdit({ ...edit, shipping_tracking_number: e.target.value })} /></div>
              <div><Label className="text-xs">Tracking-URL</Label><Input value={edit.shipping_tracking_url || ''} onChange={(e) => setEdit({ ...edit, shipping_tracking_url: e.target.value })} placeholder="https://…" /></div>
              <div><Label className="text-xs">Notiz</Label><Textarea rows={3} value={edit.shipping_note || ''} onChange={(e) => setEdit({ ...edit, shipping_note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button variant="secondary" onClick={() => { save(); }}>Speichern</Button>
            <Button onClick={() => { setEdit({ ...edit, _setShipped: true }); setTimeout(save, 0); }}>
              <Send className="w-4 h-4 mr-1" />Als versendet markieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
