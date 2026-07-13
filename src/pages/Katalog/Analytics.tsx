import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Eye, Ban, Clock, Link2, TrendingUp, Languages, History } from 'lucide-react';

interface ShareLink {
  id: string;
  token: string;
  title: string | null;
  view_count: number | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  item_ids: string[] | null;
}
interface ChangeLog {
  id: string;
  entity: string;
  action: string;
  created_at: string;
  user_id: string | null;
  diff: any;
}
interface LangCoverage { code: string; name: string; count: number; }

export default function KatalogAnalytics() {
  const client = supabase as any;
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [itemsCount, setItemsCount] = useState(0);
  const [langCoverage, setLangCoverage] = useState<LangCoverage[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: sl },
        { data: cl },
        { count: iCount },
        { data: langs },
        { data: descs },
      ] = await Promise.all([
        client.from('catalog_share_links').select('id, token, title, view_count, created_at, expires_at, revoked_at, item_ids').order('created_at', { ascending: false }).limit(500),
        client.from('catalog_change_log').select('id, entity, action, created_at, user_id, diff').eq('entity', 'catalog_item_prices').order('created_at', { ascending: false }).limit(50),
        client.from('catalog_items').select('id', { count: 'exact', head: true }).in('status', ['freigegeben', 'aktiv']),
        client.from('catalog_languages').select('code, name').eq('is_active', true),
        client.from('catalog_item_descriptions').select('language_code, item_id').eq('status', 'freigegeben'),
      ]);

      setLinks((sl ?? []) as ShareLink[]);
      setChanges((cl ?? []) as ChangeLog[]);
      setItemsCount(iCount ?? 0);

      // Coverage pro Sprache: distinct items
      const perLang: Record<string, Set<string>> = {};
      (descs ?? []).forEach((d: any) => {
        (perLang[d.language_code] ||= new Set()).add(d.item_id);
      });
      setLangCoverage(
        (langs ?? []).map((l: any) => ({ code: l.code, name: l.name, count: perLang[l.code]?.size ?? 0 }))
          .sort((a: LangCoverage, b: LangCoverage) => b.count - a.count),
      );

      // Artikel-Namen laden für Top-Artikel
      const allIds = Array.from(new Set((sl ?? []).flatMap((l: any) => l.item_ids ?? [])));
      if (allIds.length) {
        const { data: its } = await client.from('catalog_items').select('id, name').in('id', allIds);
        const map: Record<string, string> = {};
        (its ?? []).forEach((i: any) => { map[i.id] = i.name; });
        setItemNames(map);
      }

      setLoading(false);
    })();
  }, [client]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const totalViews = links.reduce((s, l) => s + (l.view_count ?? 0), 0);
    const active = links.filter((l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at).getTime() > now));
    const revoked = links.filter((l) => !!l.revoked_at).length;
    const expiring = active.filter((l) => l.expires_at && new Date(l.expires_at).getTime() - now < 3 * 86400000).length;
    return { totalLinks: links.length, active: active.length, totalViews, revoked, expiring };
  }, [links]);

  const topItems = useMemo(() => {
    const cnt: Record<string, { views: number; links: number }> = {};
    links.forEach((l) => {
      (l.item_ids ?? []).forEach((id) => {
        cnt[id] ||= { views: 0, links: 0 };
        cnt[id].views += l.view_count ?? 0;
        cnt[id].links += 1;
      });
    });
    return Object.entries(cnt)
      .map(([id, v]) => ({ id, name: itemNames[id] ?? id.slice(0, 8), ...v }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [links, itemNames]);

  if (loading) return <div className="p-6 text-muted-foreground">Lade Analytics…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Katalog-Analytics</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Link2 className="h-4 w-4" />} label="Share-Links" value={kpis.totalLinks} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Aktiv" value={kpis.active} tone="emerald" />
        <Kpi icon={<Eye className="h-4 w-4" />} label="Aufrufe gesamt" value={kpis.totalViews} tone="primary" />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Läuft < 3 Tage" value={kpis.expiring} tone="amber" />
        <Kpi icon={<Ban className="h-4 w-4" />} label="Widerrufen" value={kpis.revoked} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Top-Artikel nach Aufrufen</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Artikel</TableHead><TableHead className="text-right">Aufrufe</TableHead><TableHead className="text-right">Links</TableHead></TableRow></TableHeader>
              <TableBody>
                {topItems.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Noch keine Daten</TableCell></TableRow>}
                {topItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-right font-medium">{r.views}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.links}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4" /> Übersetzungs-Abdeckung</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {langCoverage.length === 0 && <div className="text-sm text-muted-foreground">Keine Sprachen konfiguriert</div>}
            {langCoverage.map((l) => {
              const pct = itemsCount ? Math.round((l.count / itemsCount) * 100) : 0;
              return (
                <div key={l.code}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span><span className="font-mono text-xs mr-2">{l.code.toUpperCase()}</span>{l.name}</span>
                    <span className="text-muted-foreground">{l.count} / {itemsCount} · {pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Letzte Preisänderungen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Aktion</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {changes.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Keine Änderungen protokolliert</TableCell></TableRow>}
              {changes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.action}</Badge></TableCell>
                  <TableCell className="text-xs font-mono max-w-[600px] truncate" title={JSON.stringify(c.diff)}>
                    {JSON.stringify(c.diff)?.slice(0, 140)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'primary' | 'emerald' | 'amber' | 'destructive' }) {
  const color = tone === 'primary' ? 'text-primary'
    : tone === 'emerald' ? 'text-emerald-600'
    : tone === 'amber' ? 'text-amber-600'
    : tone === 'destructive' ? 'text-destructive'
    : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span>{icon}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
