import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, Pencil, Download } from 'lucide-react';
import { format } from 'date-fns';
import { generateProductionOrderPdf } from '@/lib/production-order-pdf';
import { toast } from 'sonner';

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: po } = await supabase
        .from('production_orders')
        .select('*, supplier:suppliers(*)')
        .eq('id', id).single();
      const { data: its } = await supabase.from('production_order_items').select('*').eq('production_order_id', id).order('item_order');
      setData(po); setItems(its || []); setLoading(false);
    })();
  }, [id]);

  const downloadPdf = () => {
    if (!data) return;
    const pdf = generateProductionOrderPdf({
      order_number: data.order_number,
      modellname: data.modellname,
      farbe: data.farbe,
      power_handstueck: data.power_handstueck,
      bearbeiter: data.bearbeiter,
      liefertermin: data.liefertermin,
      sonderwuensche: data.sonderwuensche,
      seriennummer: data.seriennummer,
      anmerkungen: data.anmerkungen,
      supplier: data.supplier,
      items,
    });
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = pdf.filename; a.click();
    URL.revokeObjectURL(url);
    toast.success('PDF heruntergeladen');
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="p-6">Bestellung nicht gefunden.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/order')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
      </Button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold gold-text">Bestellung {data.order_number}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPdf}><Download className="w-4 h-4 mr-2" /> PDF</Button>
          <Button asChild><Link to={`/order/${data.id}/bearbeiten`}><Pencil className="w-4 h-4 mr-2" /> Bearbeiten</Link></Button>
        </div>
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Zulieferer</h2>
        <div className="text-sm">
          <div className="font-medium">{data.supplier?.name}</div>
          <div className="text-muted-foreground">{data.supplier?.email}</div>
          {data.supplier?.phone && <div className="text-muted-foreground">{data.supplier.phone}</div>}
          {data.supplier?.address && <div className="text-muted-foreground whitespace-pre-line">{data.supplier.address}</div>}
        </div>
      </Card>

      <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Modell:</span> {data.modellname || '—'}</div>
        <div><span className="text-muted-foreground">Farbe:</span> {data.farbe}</div>
        <div><span className="text-muted-foreground">Power Handstück:</span> {data.power_handstueck}</div>
        <div><span className="text-muted-foreground">Bearbeiter:</span> {data.bearbeiter}</div>
        <div><span className="text-muted-foreground">Liefertermin:</span> {format(new Date(data.liefertermin), 'dd.MM.yyyy')}</div>
        <div><span className="text-muted-foreground">Seriennummer:</span> {data.seriennummer || '—'}</div>
        <div><span className="text-muted-foreground">Status:</span> {data.status}</div>
        <div><span className="text-muted-foreground">Gesendet am:</span> {data.sent_at ? format(new Date(data.sent_at), 'dd.MM.yyyy HH:mm') : '—'}</div>
        {data.sonderwuensche && <div className="col-span-2"><span className="text-muted-foreground">Sonderwünsche:</span><br/>{data.sonderwuensche}</div>}
        {data.anmerkungen && <div className="col-span-2"><span className="text-muted-foreground">Anmerkungen:</span><br/>{data.anmerkungen}</div>}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Positionen</h2>
        {items.length === 0 ? <p className="text-muted-foreground text-sm">Keine</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border"><tr className="text-left">
              <th className="p-2">Artikel</th><th className="p-2">Beschreibung</th><th className="p-2 text-right">Menge</th>
            </tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b border-border">
                  <td className="p-2">{it.item_name}</td>
                  <td className="p-2 text-muted-foreground">{it.description || '—'}</td>
                  <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
