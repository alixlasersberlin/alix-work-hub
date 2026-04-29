import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Factory, Users as UsersIcon, FileText, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ProductionOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name, email)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Bestellung wirklich löschen?')) return;
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Bestellung gelöscht');
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Factory className="w-6 h-6" /> ORDER – Produktionsbestellungen
          </h1>
          <p className="text-sm text-muted-foreground">Bestellungen an die Produktion verwalten und versenden</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/order/zulieferer')}>
            <UsersIcon className="w-4 h-4 mr-2" /> Zulieferer
          </Button>
          <Button onClick={() => navigate('/order/neu')}>
            <Plus className="w-4 h-4 mr-2" /> Neue Bestellung
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Noch keine Bestellungen vorhanden.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="p-3">Bestell-/Auftragsnr.</th>
                <th className="p-3">Interne Nummer</th>
                <th className="p-3">Zulieferer</th>
                <th className="p-3">Modell</th>
                <th className="p-3">Bearbeiter</th>
                <th className="p-3">Liefertermin</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-mono">{r.order_number}</td>
                  <td className="p-3 font-mono uppercase">{r.sonderwuensche || '—'}</td>
                  <td className="p-3">{r.supplier?.name || '—'}</td>
                  <td className="p-3">{r.modellname || '—'}</td>
                  <td className="p-3">{r.bearbeiter}</td>
                  <td className="p-3">{r.liefertermin ? format(new Date(r.liefertermin), 'dd.MM.yyyy') : '—'}</td>
                  <td className="p-3">
                    {(() => {
                      const ps = r.payment_status || 'Nein';
                      const cls = ps === 'Ja'
                        ? 'bg-green-500/15 text-green-500'
                        : ps === 'Teilweise'
                          ? 'bg-yellow-500/15 text-yellow-500'
                          : 'bg-destructive/15 text-destructive';
                      return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{ps}</span>;
                    })()}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{r.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Button asChild size="sm" variant="ghost"><Link to={`/order/${r.id}`}><FileText className="w-4 h-4" /></Link></Button>
                    <Button asChild size="sm" variant="ghost"><Link to={`/order/${r.id}/bearbeiten`}><Pencil className="w-4 h-4" /></Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
