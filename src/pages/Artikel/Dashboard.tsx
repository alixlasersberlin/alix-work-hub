import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Boxes, AlertTriangle, Globe, ShieldCheck, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { pmQuality, pmScoreTone, pmStatusLabel } from '@/lib/produktmaster/config';

const db = supabase as any;

export default function ArtikelDashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [comp, setComp] = useState<any[]>([]);
  const [seo, setSeo] = useState<any[]>([]);
  const [media, setMedia] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Record<string, number>>({});
  const [attrs, setAttrs] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [p, pr, c, s, m, d, a] = await Promise.all([
        db.from('ph_products').select('*').order('updated_at', { ascending: false }),
        db.from('ph_prices').select('*'),
        db.from('ph_compliance').select('*'),
        db.from('ph_seo').select('*'),
        db.from('ph_media').select('product_id'),
        db.from('ph_documents').select('product_id'),
        db.from('ph_attribute_values').select('product_id'),
      ]);
      const cnt = (arr: any[]) => {
        const r: Record<string, number> = {};
        (arr || []).forEach((x: any) => { r[x.product_id] = (r[x.product_id] || 0) + 1; });
        return r;
      };
      setProducts(p.data || []); setPrices(pr.data || []); setComp(c.data || []); setSeo(s.data || []);
      setMedia(cnt(m.data)); setDocs(cnt(d.data)); setAttrs(cnt(a.data));
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => products.map(p => {
    const bundle = {
      product: p,
      prices: prices.find(x => x.product_id === p.id && !x.variant_id),
      compliance: comp.find(x => x.product_id === p.id),
      seo: seo.find(x => x.product_id === p.id),
      mediaCount: media[p.id] || 0,
      docCount: docs[p.id] || 0,
      attrCount: attrs[p.id] || 0,
    };
    return { p, bundle, quality: pmQuality(bundle) };
  }), [products, prices, comp, seo, media, docs, attrs]);

  const kpi = useMemo(() => ({
    total: rows.length,
    active: rows.filter(r => ['published', 'approved'].includes(r.p.status)).length,
    draft: rows.filter(r => r.p.status === 'draft').length,
    review: rows.filter(r => r.p.status === 'review').length,
    approved: rows.filter(r => r.p.status === 'approved').length,
    published: rows.filter(r => r.p.status === 'published').length,
    noData: rows.filter(r => r.quality.total < 70).length,
    noMedia: rows.filter(r => !r.bundle.mediaCount && !r.p.hero_image_url).length,
    noDocs: rows.filter(r => !r.bundle.docCount).length,
    compWarn: rows.filter(r => r.bundle.compliance?.approval_status !== 'approved').length,
  }), [rows]);

  const worst = useMemo(() => [...rows].sort((a, b) => a.quality.total - b.quality.total).slice(0, 8), [rows]);
  const latest = useMemo(() => rows.slice(0, 8), [rows]);

  const Tile = ({ label, value, icon: Icon, to }: any) => (
    <Card className="hover:border-primary/40 transition-colors">
      <Link to={to || '/artikel/liste'}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Link>
    </Card>
  );

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader title="Artikel & Produkte" subtitle="ALIX PRODUCT MASTER – eine Datenquelle für alle Kanäle" icon={Boxes} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Tile label="Artikel gesamt" value={kpi.total} icon={Boxes} />
        <Tile label="Aktiv" value={kpi.active} icon={ShieldCheck} />
        <Tile label="Entwürfe" value={kpi.draft} icon={FileText} />
        <Tile label="In Prüfung" value={kpi.review} icon={AlertTriangle} />
        <Tile label="Freigegeben" value={kpi.approved} icon={ShieldCheck} />
        <Tile label="Veröffentlicht" value={kpi.published} icon={Globe} to="/artikel/website" />
        <Tile label="Fehlende Daten" value={kpi.noData} icon={AlertTriangle} />
        <Tile label="Ohne Bilder" value={kpi.noMedia} icon={ImageIcon} />
        <Tile label="Ohne Dokumente" value={kpi.noDocs} icon={FileText} />
        <Tile label="Compliance offen" value={kpi.compWarn} icon={ShieldCheck} to="/artikel/compliance" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Datenqualität – größter Handlungsbedarf</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {worst.map(({ p, quality }) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <Link to={`/artikel/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <span className={`tabular-nums font-semibold ${pmScoreTone(quality.total)}`}>{quality.total} %</span>
                </div>
                <Progress value={quality.total} className="h-1.5" />
                <div className="text-[11px] text-muted-foreground">
                  {quality.sections.flatMap(s => s.missing).slice(0, 3).join(' · ') || 'vollständig'}
                </div>
              </div>
            ))}
            {worst.length === 0 && <div className="text-sm text-muted-foreground">Keine Artikel vorhanden.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Änderungen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {latest.map(({ p, quality }) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <Link to={`/artikel/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <div className="text-[11px] text-muted-foreground">
                    {p.sku || '—'} · {new Date(p.updated_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{pmStatusLabel(p.status)}</Badge>
                  <span className={`text-xs tabular-nums ${pmScoreTone(quality.total)}`}>{quality.total} %</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
