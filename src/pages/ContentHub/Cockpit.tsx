import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers, Loader2, RefreshCw, Rocket, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { pmQuality, pmScoreTone, pmStatusLabel, pmComplianceLabel, pmComplianceTone } from '@/lib/produktmaster/config';
import { CH_CHANNELS, CH_LAMP_LABEL, CH_LAMP_TONE, chLamp } from '@/lib/contenthub/config';
import { chCheck, chLoadChannelState, chPublish } from '@/lib/contenthub/api';

const db = supabase as any;

export default function ContentHubCockpit() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [comp, setComp] = useState<any[]>([]);
  const [seo, setSeo] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ media: any; docs: any; attrs: any }>({ media: {}, docs: {}, attrs: {} });
  const [state, setState] = useState<Record<string, Record<string, any>>>({});
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [p, pr, c, s, m, d, a, cs] = await Promise.all([
      db.from('ph_products').select('*').order('name'),
      db.from('ph_prices').select('*'),
      db.from('ph_compliance').select('*'),
      db.from('ph_seo').select('*'),
      db.from('ph_media').select('product_id'),
      db.from('ph_documents').select('product_id'),
      db.from('ph_attribute_values').select('product_id'),
      chLoadChannelState(),
    ]);
    const cnt = (arr: any[]) => {
      const r: Record<string, number> = {};
      (arr || []).forEach((x: any) => { r[x.product_id] = (r[x.product_id] || 0) + 1; });
      return r;
    };
    setProducts(p.data || []); setPrices(pr.data || []); setComp(c.data || []); setSeo(s.data || []);
    setCounts({ media: cnt(m.data), docs: cnt(d.data), attrs: cnt(a.data) });
    setState(cs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter(p => !needle || `${p.name} ${p.sku} ${p.model} ${p.brand}`.toLowerCase().includes(needle))
      .map(p => {
        const bundle = {
          product: p,
          prices: prices.find(x => x.product_id === p.id && !x.variant_id),
          compliance: comp.find(x => x.product_id === p.id),
          seo: seo.find(x => x.product_id === p.id),
          mediaCount: counts.media[p.id] || 0,
          docCount: counts.docs[p.id] || 0,
          attrCount: counts.attrs[p.id] || 0,
        };
        return { p, bundle, quality: pmQuality(bundle).total, compliance: bundle.compliance };
      });
  }, [products, prices, comp, seo, counts, q]);

  const selectedIds = Object.keys(sel).filter(k => sel[k]);

  const runCheck = async () => {
    setBusy(true);
    try {
      const ids = selectedIds.length ? selectedIds : rows.map(r => r.p.id);
      const res = await chCheck(ids.slice(0, 100));
      const h: Record<string, string> = {};
      let drifted = 0;
      res.forEach(r => { if (r.hash) h[r.product_id] = r.hash; if (r.drift?.length) drifted++; });
      setHashes(prev => ({ ...prev, ...h }));
      toast.success(drifted ? `${drifted} Produkt(e) weichen von der veröffentlichten Version ab` : 'Alle geprüften Kanäle sind konsistent');
    } catch (e: any) {
      toast.error(e.message || 'Prüfung fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const runPublish = async () => {
    if (!selectedIds.length) return;
    setBusy(true);
    try {
      const res = await chPublish(selectedIds);
      const ok = res.filter(r => r.published).length;
      const blocked = res.filter(r => r.blocked?.length);
      if (ok) toast.success(`${ok} Produkt(e) auf allen Kanälen veröffentlicht`);
      if (blocked.length) toast.error(`${blocked.length} blockiert: ${blocked[0].blocked?.[0]}`);
      setSel({});
      load();
    } catch (e: any) {
      toast.error(e.message || 'Veröffentlichung fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="ALIX Content Hub"
        subtitle="EDIT ONCE · CHECK ONCE · APPROVE ONCE · PUBLISH EVERYWHERE"
        icon={Layers}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runCheck} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Konsistenz prüfen</span>
            </Button>
            <Button size="sm" onClick={runPublish} disabled={busy || !selectedIds.length}>
              <Rocket className="h-4 w-4 mr-2" />
              Alles neu veröffentlichen{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </Button>
          </div>
        }
      />

      <Card><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <Input className="max-w-sm" placeholder="Suche Name, SKU, Modell…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {(['ok', 'stale', 'never'] as const).map(l => (
            <span key={l} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${CH_LAMP_TONE[l]}`} />{CH_LAMP_LABEL[l]}
            </span>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="p-2 w-8"></th>
              <th className="p-2 text-left">Produkt</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Qualität</th>
              <th className="p-2 text-left">Compliance</th>
              {CH_CHANNELS.map(c => <th key={c.code} className="p-2 text-center whitespace-nowrap">{c.label}</th>)}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={12} className="p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
            {!loading && rows.map(({ p, quality, compliance }) => (
              <tr key={p.id} className="border-t hover:bg-muted/20">
                <td className="p-2"><Checkbox checked={!!sel[p.id]} onCheckedChange={v => setSel(s => ({ ...s, [p.id]: !!v }))} /></td>
                <td className="p-2">
                  <Link to={`/content-hub/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <div className="text-[11px] text-muted-foreground">{[p.model, p.sku].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="p-2"><Badge variant="outline" className="text-[10px]">{pmStatusLabel(p.status)}</Badge></td>
                <td className={`p-2 font-semibold ${pmScoreTone(quality)}`}>{quality}%</td>
                <td className="p-2">
                  <Badge className={`text-[10px] ${pmComplianceTone(compliance?.approval_status)}`}>
                    {pmComplianceLabel(compliance?.approval_status)}
                  </Badge>
                </td>
                {CH_CHANNELS.map(c => {
                  const lamp = chLamp(state[p.id]?.[c.code], hashes[p.id]);
                  return (
                    <td key={c.code} className="p-2 text-center">
                      <TooltipProvider><Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-block h-3 w-3 rounded-full ${CH_LAMP_TONE[lamp]}`} />
                        </TooltipTrigger>
                        <TooltipContent>{c.label}: {CH_LAMP_LABEL[lamp]}</TooltipContent>
                      </Tooltip></TooltipProvider>
                    </td>
                  );
                })}
                <td className="p-2 text-right">
                  <Button asChild size="sm" variant="ghost"><Link to={`/content-hub/${p.id}`}>Öffnen</Link></Button>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">
                <ShieldAlert className="h-5 w-5 mx-auto mb-2" />Keine Produkte gefunden.
              </td></tr>
            )}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
