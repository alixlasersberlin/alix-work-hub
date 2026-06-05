import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Row {
  id: string;
  order_number: string;
  order_status: string | null;
  deposit_ok: boolean;
  expected_shipment_date: string | null;
  customer_name: string;
  tracking: string;
  tracking_note_id: string | null;
  trackingDirty?: boolean;
  dateDirty?: boolean;
}

export default function PortalAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, order_status, deposit_ok, expected_shipment_date, customer_id, customers(company_name, contact_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!orders) { setRows([]); setLoading(false); return; }

    const ids = orders.map(o => o.id);
    const { data: notes } = await supabase
      .from('order_notes')
      .select('id, order_id, note_text, updated_at')
      .in('order_id', ids)
      .eq('note_type', 'portal_tracking')
      .order('updated_at', { ascending: false });

    const trackByOrder = new Map<string, { id: string; text: string }>();
    (notes || []).forEach(n => {
      if (!trackByOrder.has(n.order_id)) trackByOrder.set(n.order_id, { id: n.id, text: n.note_text || '' });
    });

    setRows(orders.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      order_status: o.order_status,
      deposit_ok: o.deposit_ok,
      expected_shipment_date: o.expected_shipment_date ? o.expected_shipment_date.slice(0, 10) : null,
      customer_name: o.customers?.company_name || o.customers?.contact_name || '—',
      tracking: trackByOrder.get(o.id)?.text || '',
      tracking_note_id: trackByOrder.get(o.id)?.id || null,
    })));
    setLoading(false);
  }

  function update(id: string, patch: Partial<Row>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function save(row: Row) {
    try {
      if (row.dateDirty) {
        const { error } = await supabase.from('orders')
          .update({ expected_shipment_date: row.expected_shipment_date || null })
          .eq('id', row.id);
        if (error) throw error;
      }
      if (row.trackingDirty) {
        if (row.tracking_note_id) {
          const { error } = await supabase.from('order_notes')
            .update({ note_text: row.tracking })
            .eq('id', row.tracking_note_id);
          if (error) throw error;
        } else if (row.tracking.trim()) {
          const { data, error } = await supabase.from('order_notes').insert({
            order_id: row.id,
            note_text: row.tracking.trim(),
            note_type: 'portal_tracking',
            is_internal: false,
            created_by: user?.id,
          }).select('id').single();
          if (error) throw error;
          update(row.id, { tracking_note_id: data.id });
        }
      }
      update(row.id, { trackingDirty: false, dateDirty: false });
      toast.success(`Auftrag ${row.order_number} gespeichert.`);
    } catch (e: any) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    }
  }

  const filtered = rows.filter(r => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return r.order_number.toLowerCase().includes(f) || r.customer_name.toLowerCase().includes(f);
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Globe className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Kundenportal</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Status der öffentlichen Statusabfrage unter <a href="/portal" target="_blank" rel="noopener" className="text-primary underline">/portal</a>.
        Der Portal-Status wird automatisch aus den Auftragsdaten abgeleitet. Hier können Sie pro Auftrag eine Trackingnummer und ein voraussichtliches Lieferdatum pflegen.
      </p>

      <div className="mb-4 relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Suche nach Auftragsnr. oder Kunde..." className="pl-9 bg-secondary border-border" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Auftragsnr.</th>
                  <th className="text-left px-4 py-3">Kunde</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Anzahlung</th>
                  <th className="text-left px-4 py-3">Lieferdatum</th>
                  <th className="text-left px-4 py-3">Trackingnummer</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-2 font-mono text-xs">{r.order_number}</td>
                    <td className="px-4 py-2">{r.customer_name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.order_status || '—'}</td>
                    <td className="px-4 py-2">{r.deposit_ok ? '✓' : '—'}</td>
                    <td className="px-4 py-2">
                      <Input
                        type="date"
                        value={r.expected_shipment_date || ''}
                        onChange={e => update(r.id, { expected_shipment_date: e.target.value || null, dateDirty: true })}
                        className="h-8 bg-secondary border-border w-40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={r.tracking}
                        onChange={e => update(r.id, { tracking: e.target.value, trackingDirty: true })}
                        placeholder="z.B. DHL 1Z..."
                        className="h-8 bg-secondary border-border w-52"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(r.dateDirty || r.trackingDirty) && (
                        <Button size="sm" className="gold-gradient text-primary-foreground" onClick={() => save(r)}>
                          <Save className="w-3.5 h-3.5 mr-1" /> Speichern
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Keine Aufträge gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Hinweis: Datum: {format(new Date(), 'yyyy-MM-dd')} · Tracking wird intern als Notiz vom Typ <code>portal_tracking</code> gespeichert.
      </p>
    </div>
  );
}
