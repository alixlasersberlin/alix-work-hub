import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PH_MEDIA_KINDS } from '@/lib/producthub/config';

const db = supabase as any;

export default function ProductHubMedien() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await db.from('ph_media').select('*, ph_products(name)').order('created_at', { ascending: false });
      setRows(data || []);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter(m =>
    (kind === 'all' || m.kind === kind) &&
    (!q || `${m.ph_products?.name} ${m.title} ${m.kind}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, kind]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Medien" subtitle="Zentrale Medienbibliothek je Gerät (keine Duplikate)" icon={ImageIcon} />
      <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
        <Input className="max-w-xs" placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          <Badge variant={kind === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setKind('all')}>alle</Badge>
          {PH_MEDIA_KINDS.map(k => (
            <Badge key={k} variant={kind === k ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setKind(k)}>{k}</Badge>
          ))}
        </div>
      </CardContent></Card>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {filtered.map(m => (
          <Card key={m.id}><CardContent className="p-2 space-y-1">
            {m.media_type === 'image'
              ? <div className="w-full aspect-square rounded bg-white flex items-center justify-center overflow-hidden"><img src={m.url} alt={m.alt_text || m.title || m.ph_products?.name || 'Produktbild'} loading="lazy" className="max-w-full max-h-full object-contain" /></div>
              : <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground border rounded">Video</div>}
            <div className="text-[11px] font-medium truncate">{m.ph_products?.name}</div>
            <div className="flex gap-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{m.kind}</Badge>
              {(m.channels || []).map((c: string) => <Badge key={c} className="text-[10px]">{c.toUpperCase()}</Badge>)}
            </div>
          </CardContent></Card>
        ))}
        {filtered.length === 0 && <div className="text-sm text-muted-foreground col-span-full">Keine Medien vorhanden.</div>}
      </div>
    </div>
  );
}
