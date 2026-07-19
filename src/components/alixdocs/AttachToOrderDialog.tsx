import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
type OrderHit = { id: string; order_number: string | null; customer_name: string | null };
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Cat = { id: string; code: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source_bucket: string;
  source_path: string;
  defaultTitle?: string;
  defaultCategory?: string;
  source?: string;
}

export default function AttachToOrderDialog({
  open, onOpenChange, source_bucket, source_path,
  defaultTitle = '', defaultCategory = 'sonstiges', source = 'mail_attachment',
}: Props) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [hits, setHits] = useState<OrderHit[]>([]);
  const [q, setQ] = useState('');
  const [orderId, setOrderId] = useState<string>('');
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState(defaultTitle);
  const [conf, setConf] = useState('normal');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('alixdocs_categories').select('id, code, name').order('sort_order')
      .then(({ data }) => setCats((data ?? []) as Cat[]));
    setTitle(defaultTitle); setCategory(defaultCategory); setOrderId(''); setQ('');
  }, [open, defaultTitle, defaultCategory]);

  useEffect(() => {
    if (!q || q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const s = `%${q}%`;
      const { data } = await supabase.from('orders')
        .select('id, order_number, customers:customer_id(name)')
        .or(`order_number.ilike.${s}`)
        .order('created_at', { ascending: false })
        .limit(20);
      const rows: OrderHit[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id, order_number: r.order_number,
        customer_name: r.customers?.name ?? null,
      }));
      // Second search by customer name → orders
      const { data: byCust } = await supabase.from('customers')
        .select('id, name').ilike('name', s).limit(10);
      if (byCust && byCust.length) {
        const ids = byCust.map((c: any) => c.id);
        const { data: co } = await supabase.from('orders')
          .select('id, order_number, customers:customer_id(name)')
          .in('customer_id', ids).order('created_at', { ascending: false }).limit(20);
        for (const r of (co ?? []) as any[]) {
          if (!rows.find(x => x.id === r.id)) {
            rows.push({ id: r.id, order_number: r.order_number, customer_name: r.customers?.name ?? null });
          }
        }
      }
      setHits(rows);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    if (!orderId) { toast.error('Bitte Auftrag auswählen'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-attach-from-storage', {
        body: { source_bucket, source_path, order_id: orderId, category_code: category,
                title: title || undefined, confidentiality_level: conf, source },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.duplicate ? 'Bereits vorhanden – nicht dupliziert' : 'An Auftrag angeheftet');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Anheften fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>An Auftrag anheften</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Auftrag suchen</label>
            <Input placeholder="Auftragsnummer oder Kunde…" value={q} onChange={(e) => setQ(e.target.value)} />
            {hits.length > 0 && (
              <div className="mt-2 border border-border rounded max-h-52 overflow-y-auto">
                {hits.map(h => (
                  <button key={h.id}
                          onClick={() => { setOrderId(h.id); setQ(`${h.order_number ?? ''} — ${h.customer_name ?? ''}`); setHits([]); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${orderId === h.id ? 'bg-primary/10' : ''}`}>
                    <span className="font-mono">{h.order_number ?? h.id.slice(0, 8)}</span> — {h.customer_name ?? '—'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Kategorie</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vertraulichkeit</label>
              <Select value={conf} onValueChange={setConf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="vertraulich">Vertraulich</SelectItem>
                  <SelectItem value="streng_vertraulich">Streng vertraulich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Titel</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="wird automatisch gesetzt" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={busy || !orderId} onClick={submit}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Anheften
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
