import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Languages, Image as ImageIcon, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Stats {
  total: number;
  active: number;
  draft: number;
  withoutImage: number;
  withoutTranslation: number;
  pricesPending: number;
}

export default function KatalogDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const client = supabase as any;
      const [items, active, draft, images, descs, pricesPending] = await Promise.all([
        client.from('catalog_items').select('id', { count: 'exact', head: true }),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).in('status', ['aktiv', 'freigegeben']),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).eq('status', 'entwurf'),
        client.from('catalog_item_images').select('item_id'),
        client.from('catalog_item_descriptions').select('item_id, translation_status'),
        client.from('catalog_item_prices').select('id', { count: 'exact', head: true }).eq('price_status', 'zur_freigabe'),
      ]);
      const total = items.count ?? 0;
      const itemIdsWithImage = new Set((images.data ?? []).map((r: any) => r.item_id));
      const itemIdsApproved = new Set(
        (descs.data ?? []).filter((r: any) => r.translation_status === 'freigegeben').map((r: any) => r.item_id)
      );
      setStats({
        total,
        active: active.count ?? 0,
        draft: draft.count ?? 0,
        withoutImage: Math.max(0, total - itemIdsWithImage.size),
        withoutTranslation: Math.max(0, total - itemIdsApproved.size),
        pricesPending: pricesPending.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: 'Artikel gesamt', value: stats?.total ?? '…', icon: Package, tone: 'text-primary' },
    { label: 'Aktiv / freigegeben', value: stats?.active ?? '…', icon: CheckCircle2, tone: 'text-emerald-500' },
    { label: 'Entwürfe', value: stats?.draft ?? '…', icon: Tag, tone: 'text-amber-500' },
    { label: 'Ohne Bild', value: stats?.withoutImage ?? '…', icon: ImageIcon, tone: 'text-orange-500' },
    { label: 'Ohne freigegebene Übersetzung', value: stats?.withoutTranslation ?? '…', icon: Languages, tone: 'text-blue-500' },
    { label: 'Preise zur Freigabe', value: stats?.pricesPending ?? '…', icon: AlertTriangle, tone: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={`h-5 w-5 ${c.tone}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
