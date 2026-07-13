import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, Languages, Image as ImageIcon, Tag, AlertTriangle, CheckCircle2,
  ShieldCheck, Upload, FileDown, Send, ScrollText, ArrowRight,
} from 'lucide-react';

interface Stats {
  total: number;
  active: number;
  draft: number;
  withoutImage: number;
  withoutTranslation: number;
  pricesPending: number;
  itemsPending: number;
}

interface LogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_at: string;
  performed_by: string | null;
  change_summary: string | null;
  field_name?: string | null;
  note?: string | null;
}

export default function KatalogDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<LogEntry[]>([]);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const client = supabase as any;
      const [items, active, draft, images, descs, pricesPending, itemsPending, log, pending] = await Promise.all([
        client.from('catalog_items').select('id', { count: 'exact', head: true }),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).in('status', ['aktiv', 'freigegeben']),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).eq('status', 'entwurf'),
        client.from('catalog_item_images').select('item_id'),
        client.from('catalog_item_descriptions').select('item_id, translation_status'),
        client.from('catalog_item_prices').select('id', { count: 'exact', head: true }).eq('price_status', 'zur_freigabe').is('approved_at', null),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).eq('status', 'zur_pruefung').is('approved_at', null),
        client.from('catalog_change_log').select('id, entity_type, entity_id, action, performed_at, performed_by, change_summary').order('performed_at', { ascending: false }).limit(15),
        client.from('catalog_items').select('id, sku, name, submitted_at').eq('status', 'zur_pruefung').is('approved_at', null).order('submitted_at', { ascending: true }).limit(5),
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
        itemsPending: itemsPending.count ?? 0,
      });
      setRecent(log.data ?? []);
      setPendingItems(pending.data ?? []);
    })();
  }, []);

  const cards = [
    { label: 'Artikel gesamt', value: stats?.total ?? '…', icon: Package, tone: 'text-primary' },
    { label: 'Aktiv / freigegeben', value: stats?.active ?? '…', icon: CheckCircle2, tone: 'text-emerald-500' },
    { label: 'Entwürfe', value: stats?.draft ?? '…', icon: Tag, tone: 'text-amber-500' },
    { label: 'Ohne Bild', value: stats?.withoutImage ?? '…', icon: ImageIcon, tone: 'text-orange-500' },
    { label: 'Ohne freigegebene Übersetzung', value: stats?.withoutTranslation ?? '…', icon: Languages, tone: 'text-blue-500' },
    { label: 'Offene Freigaben', value: (stats ? stats.pricesPending + stats.itemsPending : '…'), icon: AlertTriangle, tone: 'text-red-500' },
  ];

  const quickActions = [
    { to: '/katalog/artikel', label: 'Artikel bearbeiten', icon: Package },
    { to: '/katalog/freigabe', label: 'Freigabe-Center', icon: ShieldCheck },
    { to: '/katalog/import', label: 'Import', icon: Upload },
    { to: '/katalog/export', label: 'Export & Preisliste', icon: FileDown },
    { to: '/katalog/versand', label: 'Freigabelinks', icon: Send },
    { to: '/katalog/protokolle', label: 'Änderungsprotokoll', icon: ScrollText },
  ];

  const actionBadge = (a: string) => {
    if (a?.includes('approve') || a?.includes('freigab')) return <Badge className="bg-emerald-600/20 text-emerald-500 border-emerald-600/40">{a}</Badge>;
    if (a?.includes('submit') || a?.includes('prüf')) return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40">{a}</Badge>;
    if (a?.includes('delete') || a?.includes('reject')) return <Badge variant="destructive">{a}</Badge>;
    return <Badge variant="secondary">{a}</Badge>;
  };

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Schnellzugriff</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Button key={a.to} asChild variant="outline" size="sm" className="justify-start">
                <Link to={a.to}><a.icon className="h-4 w-4 mr-2" />{a.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Wartet auf Freigabe</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/katalog/freigabe">Alle <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingItems.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Artikel-Prüfungen.</p>}
            {pendingItems.map((p) => (
              <Link key={p.id} to={`/katalog/artikel/${p.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                <div>
                  <div className="font-medium truncate max-w-[220px]">{p.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{p.sku}</div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString('de-DE') : '—'}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Letzte Aktivitäten</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/katalog/protokolle">Verlauf <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
            {recent.map((r) => (
              <div key={r.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {actionBadge(r.action)}
                  <span className="text-muted-foreground">{r.entity_type}</span>
                  <span className="ml-auto text-muted-foreground">{new Date(r.performed_at).toLocaleString('de-DE')}</span>
                </div>
                {r.change_summary && <div className="text-muted-foreground mt-0.5 line-clamp-2">{r.change_summary}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
