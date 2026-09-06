import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Lock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { CatalogView } from '@/components/producthub/CatalogRenderer';

const db = supabase as any;

export default function KatalogPublic() {
  const { slug } = useParams();
  const [state, setState] = useState<'loading' | 'ok' | 'locked' | 'missing' | 'expired'>('loading');
  const [data, setData] = useState<any>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: cat } = await db.from('ph_catalogs').select('*').eq('slug', slug).maybeSingle();
      if (!cat || !cat.is_public || cat.status !== 'published') { setState('missing'); return; }
      if (cat.expires_at && new Date(cat.expires_at) < new Date()) { setState('expired'); return; }
      const [items, pages] = await Promise.all([
        db.from('ph_catalog_items').select('*').eq('catalog_id', cat.id).order('sort_order'),
        db.from('ph_catalog_pages').select('*').eq('catalog_id', cat.id).order('sort_order'),
      ]);
      const ids = (items.data || []).map((i: any) => i.product_id);
      const prods = ids.length ? await db.from('ph_products').select('*').in('id', ids) : { data: [] };
      setData({ cat, items: items.data || [], pages: pages.data || [], products: prods.data || [] });
      setState(cat.access_password ? 'locked' : 'ok');
    })();
  }, [slug]);

  useEffect(() => {
    if (!data?.cat) return;
    document.title = `${data.cat.name} · ALIX Lasers`;
    const m = document.querySelector('meta[name="robots"]') || document.createElement('meta');
    m.setAttribute('name', 'robots');
    m.setAttribute('content', data.cat.noindex === false ? 'index,follow' : 'noindex,nofollow');
    document.head.appendChild(m);
  }, [data]);

  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (state === 'missing') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Dieser Katalog ist nicht verfügbar.</div>;
  if (state === 'expired') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Dieser Katalog ist abgelaufen.</div>;

  if (state === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <Lock className="w-6 h-6 mx-auto" />
          <h1 className="text-lg font-semibold">{data.cat.name}</h1>
          <Input type="password" placeholder="Zugangscode" value={pw} onChange={e => setPw(e.target.value)} />
          {err && <div className="text-xs text-destructive">{err}</div>}
          <Button className="w-full" onClick={() => (pw === data.cat.access_password ? setState('ok') : setErr('Zugangscode falsch'))}>
            Katalog öffnen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 py-6 px-3">
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
        <h1 className="text-white text-lg font-semibold">{data.cat.name}</h1>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />Drucken / PDF</Button>
      </div>
      <CatalogView
        catalog={data.cat} items={data.items} products={data.products} pages={data.pages}
        publicUrl={window.location.href}
      />
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } .ph-cat-page { break-after: page; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; } }`}</style>
    </div>
  );
}
