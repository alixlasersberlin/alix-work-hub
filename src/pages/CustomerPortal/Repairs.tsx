import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Loader2, Image as ImageIcon } from 'lucide-react';

type Ctx = { customerId: string };

const statusOrder = ['Eingegangen', 'In Bearbeitung', 'Warten auf Teile', 'Fertig', 'Versand vorbereitet', 'Versendet'];

function StatusTimeline({ current }: { current: string | null }) {
  const idx = current ? statusOrder.findIndex((s) => s.toLowerCase() === current.toLowerCase()) : -1;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {statusOrder.map((s, i) => (
        <Badge key={s} variant={i <= idx ? 'default' : 'outline'} className="text-[10px]">{s}</Badge>
      ))}
    </div>
  );
}

function PhotoFeed({ repairId }: { repairId: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: rps } = await supabase.from('route_plans').select('id').eq('repair_order_id', repairId).limit(50);
      const rpIds = (rps ?? []).map((r: any) => r.id);
      if (!rpIds.length) return setUrls([]);
      const { data: atts } = await supabase
        .from('dispatch_attachments')
        .select('storage_path, attachment_kind, created_at')
        .in('route_plan_id', rpIds)
        .order('created_at', { ascending: false })
        .limit(24);
      const signed = await Promise.all((atts ?? []).map(async (a: any) => {
        const { data } = await supabase.storage.from('dispatch-mobile').createSignedUrl(a.storage_path, 3600);
        return data?.signedUrl;
      }));
      setUrls(signed.filter(Boolean) as string[]);
    })();
  }, [open, repairId]);

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
        <ImageIcon className="w-3 h-3" /> {open ? 'Fotos ausblenden' : 'Fotos vom Techniker anzeigen'}
      </button>
      {open && (
        urls.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2">Noch keine Fotos hochgeladen.</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
            {urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded overflow-hidden bg-muted">
                <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function CustomerPortalRepairs() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5" /> Reparaturen</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine Reparaturen vorhanden.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="p-4 border border-border rounded-md">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{(r as any).repair_number ?? r.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  Eingang: {new Date(r.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <Badge>{r.repair_status ?? 'Eingegangen'}</Badge>
            </div>
            <StatusTimeline current={r.repair_status} />
            {(r as any).problem_description && (
              <p className="text-sm mt-3"><span className="text-muted-foreground">Fehlerbeschreibung: </span>{(r as any).problem_description}</p>
            )}
            <PhotoFeed repairId={r.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
