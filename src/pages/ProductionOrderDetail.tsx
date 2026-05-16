import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, Pencil, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { generateProductionOrderPdf } from '@/lib/production-order-pdf';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [displayOrderNumber, setDisplayOrderNumber] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: po } = await supabase
        .from('production_orders')
        .select('*, supplier:suppliers(*)')
        .eq('id', id).single();
      const { data: its } = await supabase.from('production_order_items').select('*').eq('production_order_id', id).order('item_order');
      setDisplayOrderNumber(po?.production_order_number || po?.order_number || '');
      setData(po); setItems(its || []); setLoading(false);
    })();
  }, [id]);

  const downloadPdf = async (lang: 'bilingual' | 'en' = 'bilingual') => {
    if (!data) return;
    if (data.approval_status !== 'approved') {
      toast.error('Bestellung muss erst von einem Super Admin genehmigt werden.');
      return;
    }
    const pdf = await generateProductionOrderPdf({
      order_number: displayOrderNumber || data.order_number,
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
    }, lang);
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = pdf.filename; a.click();
    URL.revokeObjectURL(url);
    toast.success('PDF heruntergeladen');
  };

  const setApproval = async (status: 'approved' | 'rejected') => {
    if (!id) return;
    let note: string | null = null;
    if (status === 'rejected') {
      note = window.prompt('Ablehnungsgrund (optional):') ?? '';
    }
    setApproving(true);
    const payload: any = {
      approval_status: status,
      approved_by: status === 'approved' ? user?.id : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approval_note: note || null,
    };
    const { error } = await supabase.from('production_orders').update(payload).eq('id', id);
    setApproving(false);
    if (error) return toast.error(error.message);
    toast.success(status === 'approved' ? 'Bestellung genehmigt' : 'Bestellung abgelehnt');
    const { data: po } = await supabase.from('production_orders').select('*, supplier:suppliers(*)').eq('id', id).single();
    setData(po);
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="p-6">Bestellung nicht gefunden.</div>;

  const isReclamation = !!data.is_reclamation;
  const basePath = isReclamation ? '/order/reklamation' : '/order';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(basePath)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
      </Button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold gold-text">
          {isReclamation ? 'Reklamation ' : 'Bestellung '}{displayOrderNumber || data.order_number}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadPdf('bilingual')}><Download className="w-4 h-4 mr-2" /> PDF</Button>
          <Button variant="outline" onClick={() => downloadPdf('en')}><Download className="w-4 h-4 mr-2" /> PDF (EN)</Button>
          <Button asChild><Link to={`${basePath}/${data.id}/bearbeiten`}><Pencil className="w-4 h-4 mr-2" /> Bearbeiten</Link></Button>
        </div>
      </div>

      {/* Genehmigungs-Status */}
      <Card className={cn(
        'p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border',
        data.approval_status === 'approved' && 'border-green-500/40 bg-green-500/5',
        data.approval_status === 'rejected' && 'border-destructive/40 bg-destructive/5',
        (!data.approval_status || data.approval_status === 'pending') && 'border-yellow-500/40 bg-yellow-500/5',
      )}>
        <div className="flex items-center gap-3">
          {data.approval_status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : data.approval_status === 'rejected' ? <XCircle className="w-5 h-5 text-destructive" />
            : <Clock className="w-5 h-5 text-yellow-500" />}
          <div>
            <div className="font-semibold">
              {data.approval_status === 'approved' ? 'Genehmigt' : data.approval_status === 'rejected' ? 'Abgelehnt' : 'Wartet auf Genehmigung'}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.approval_status === 'approved' && data.approved_at
                ? `Freigegeben am ${format(new Date(data.approved_at), 'dd.MM.yyyy HH:mm')}`
                : 'Nur Super Admins können diese Bestellung freigeben. Bis dahin ist der Versand gesperrt.'}
              {data.approval_note && <div className="mt-1">Hinweis: {data.approval_note}</div>}
            </div>
          </div>
        </div>
        {isSuperAdmin && data.approval_status !== 'approved' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setApproval('approved')} disabled={approving} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Genehmigen
            </Button>
            {data.approval_status !== 'rejected' && (
              <Button size="sm" variant="destructive" onClick={() => setApproval('rejected')} disabled={approving}>
                <XCircle className="w-4 h-4 mr-1" /> Ablehnen
              </Button>
            )}
          </div>
        )}
        {isSuperAdmin && data.approval_status === 'approved' && (
          <Button size="sm" variant="outline" onClick={() => setApproval('rejected')} disabled={approving}>
            Genehmigung zurückziehen
          </Button>
        )}
      </Card>

      {isReclamation && data.reclamation_reason && (
        <Card className="p-4 space-y-1 border-destructive/40 bg-destructive/5">
          <h2 className="font-semibold text-destructive">Reklamationsgrund</h2>
          <p className="text-sm whitespace-pre-line">{data.reclamation_reason}</p>
        </Card>
      )}

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
        <div><span className="text-muted-foreground">Hersteller Payment erhalten:</span> {data.payment_status || 'Nein'}</div>
        <div><span className="text-muted-foreground">Gesendet am:</span> {data.sent_at ? format(new Date(data.sent_at), 'dd.MM.yyyy HH:mm') : '—'}</div>
        {data.sonderwuensche && <div className="col-span-2"><span className="text-muted-foreground">Interne Nummer:</span><br/>{data.sonderwuensche}</div>}
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
