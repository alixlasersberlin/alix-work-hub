import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Loader2, CheckCircle2, Lock, Rocket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export type FieldKey =
  | 'product_name' | 'model' | 'wavelengths' | 'power' | 'cooling' | 'fluence'
  | 'pulse_duration' | 'frequency' | 'spot_sizes' | 'laser_class' | 'intended_use';

const FIELDS: { key: FieldKey; label: string; column: string; critical: boolean }[] = [
  { key: 'product_name', label: 'Product Name', column: 'name', critical: true },
  { key: 'model', label: 'Model', column: 'model', critical: true },
  { key: 'wavelengths', label: 'Wavelengths', column: 'wavelengths', critical: true },
  { key: 'power', label: 'Power', column: 'power', critical: true },
  { key: 'cooling', label: 'Cooling', column: 'cooling', critical: true },
  { key: 'fluence', label: 'Fluence', column: 'fluence', critical: true },
  { key: 'pulse_duration', label: 'Pulse Duration', column: 'pulse_duration', critical: true },
  { key: 'frequency', label: 'Frequency', column: 'frequency', critical: true },
  { key: 'spot_sizes', label: 'Spot Sizes', column: 'spot_sizes', critical: true },
  { key: 'laser_class', label: 'Laser Class', column: 'laser_class', critical: true },
  { key: 'intended_use', label: 'Intended Use', column: 'intended_use', critical: true },
];

const SPEC_HINTS: Record<FieldKey, string[]> = {
  product_name: ['produktname', 'name'],
  model: ['modell', 'model', 'typ'],
  wavelengths: ['wellenlänge', 'wellenlangen', 'wavelength'],
  power: ['leistung', 'power', 'watt'],
  cooling: ['kühlung', 'kuehlung', 'cooling'],
  fluence: ['fluence', 'energiedichte', 'j/cm'],
  pulse_duration: ['impulsdauer', 'pulsdauer', 'pulse'],
  frequency: ['frequenz', 'frequency', 'hz'],
  spot_sizes: ['spot', 'spotgröße', 'spotgroesse'],
  laser_class: ['laserklasse', 'laser class', 'klasse'],
  intended_use: ['zweckbestimmung', 'intended use', 'indikation'],
};

const MARKETING_TERMS = ['boost', 'fusion', 'simultan', 'wellenlängen', '3/4', 'smart', 'hybrid'];

const VERIFICATIONS = [
  { v: 'unverified', l: 'unverified' },
  { v: 'website_only', l: 'website_only' },
  { v: 'documentation_verified', l: 'documentation_verified' },
  { v: 'regulatory_verified', l: 'regulatory_verified' },
];
const SOURCES = ['DE', 'COM', 'tech_specs', 'Technical Documentation', 'Manual Entry'];

function specsToPairs(specs: any): { label: string; value: string }[] {
  if (!specs) return [];
  const out: { label: string; value: string }[] = [];
  if (Array.isArray(specs)) {
    for (const s of specs) if (s?.label) out.push({ label: String(s.label), value: String(s.value ?? '') });
  } else if (typeof specs === 'object') {
    for (const [k, v] of Object.entries(specs)) {
      if (v && typeof v === 'object' && (v as any).label) out.push({ label: String((v as any).label), value: String((v as any).value ?? '') });
      else if (typeof v === 'string' && !['source_hash', 'target_hash', 'source_project', 'subcategory'].includes(k)) out.push({ label: k, value: v });
    }
  }
  return out;
}

function pickSpec(pairs: { label: string; value: string }[], key: FieldKey): string | null {
  const hints = SPEC_HINTS[key];
  const hit = pairs.find(p => hints.some(h => p.label.toLowerCase().includes(h)));
  return hit ? hit.value : null;
}

function liveValue(snapshot: any, key: FieldKey): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const direct: Record<FieldKey, string[]> = {
    product_name: ['name', 'title', 'product_name'],
    model: ['model', 'model_name'],
    wavelengths: ['wavelengths'],
    power: ['power'],
    cooling: ['cooling'],
    fluence: ['fluence'],
    pulse_duration: ['pulse_duration'],
    frequency: ['frequency'],
    spot_sizes: ['spot_sizes', 'spot_size'],
    laser_class: ['laser_class'],
    intended_use: ['intended_use'],
  };
  for (const k of direct[key]) {
    const v = snapshot[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (Array.isArray(v) && v.length) return v.join(', ');
  }
  const fromSpecs = pickSpec(specsToPairs(snapshot.tech_specs), key);
  if (fromSpecs) return fromSpecs;
  return null;
}

export function parseWavelengths(raw: string | null): number[] {
  if (!raw) return [];
  const nums = (raw.match(/\d{3,4}/g) || []).map(Number).filter(n => n >= 300 && n <= 12000);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export function extractClaims(raw: string | null): string[] {
  if (!raw) return [];
  const low = raw.toLowerCase();
  return MARKETING_TERMS.filter(t => low.includes(t));
}

export default function ProductHubMasterReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const canApprove = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));

  const [products, setProducts] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Record<string, any>>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [draft, setDraft] = useState<Record<string, { value: string; source: string; verification: string }>>({});
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    const { data } = await db.from('ph_products').select('*');
    setProducts(data || []);
    return data || [];
  };

  const loadProduct = async (pid: string) => {
    const [{ data: p }, { data: ch }, { data: rv }, { data: dc }, { count }] = await Promise.all([
      db.from('ph_products').select('*').eq('id', pid).maybeSingle(),
      db.from('ph_product_channels').select('*').eq('product_id', pid),
      db.from('ph_master_fields').select('*').eq('product_id', pid),
      db.from('ph_documents').select('*').eq('product_id', pid),
      db.from('ph_media').select('id', { count: 'exact', head: true }).eq('product_id', pid),
    ]);
    setProduct(p); setChannels(ch || []); setDocs(dc || []); setMediaCount(count || 0);
    const map: Record<string, any> = {};
    for (const r of rv || []) map[r.field_name] = r;
    setReviews(map);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await loadProducts();
      let pid = id;
      if (!pid) {
        const blue = list.find((p: any) => p.slug === 'alix-blueice-smart-ki') || list[0];
        pid = blue?.id;
        if (pid) navigate(`/product-hub/master-review/${pid}`, { replace: true });
      }
      if (pid) await loadProduct(pid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const specPairs = useMemo(() => specsToPairs(product?.tech_specs), [product]);
  const deSnap = useMemo(() => channels.find(c => c.channel_code === 'de')?.remote_snapshot, [channels]);
  const comSnap = useMemo(() => channels.find(c => c.channel_code === 'com')?.remote_snapshot, [channels]);

  const rows = useMemo(() => FIELDS.map(f => {
    const master = f.key === 'product_name' ? product?.name : product?.[f.column];
    const spec = pickSpec(specPairs, f.key);
    return {
      ...f,
      master: master ?? null,
      spec,
      de: liveValue(deSnap, f.key),
      com: liveValue(comSnap, f.key),
      review: reviews[f.key] || null,
    };
  }), [product, specPairs, deSnap, comSnap, reviews]);

  const setDraftFor = (key: string, patch: Partial<{ value: string; source: string; verification: string }>) =>
    setDraft(d => ({ ...d, [key]: { value: '', source: 'tech_specs', verification: 'website_only', ...(d[key] || {}), ...patch } }));

  const confirmField = async (row: any) => {
    if (!canApprove) { toast.error('Nur Admin / Super Admin darf Master-Felder freigeben'); return; }
    const d = draft[row.key] || { value: '', source: 'Manual Entry', verification: 'unverified' };
    const value = (d.value ?? '').trim();
    if (!value) { toast.error('Kein Wert gewählt'); return; }
    if (d.source === 'tech_specs' || d.source === 'DE' || d.source === 'COM') {
      if (['documentation_verified', 'regulatory_verified'].includes(d.verification)) {
        toast.error('Website-/tech_specs-Werte dürfen maximal website_only sein');
        return;
      }
    }
    setBusy(true);
    try {
      const previous = row.master ?? null;
      const patch: Record<string, any> = { [row.column]: value };
      if (row.key === 'product_name') {
        const aliases: string[] = Array.from(new Set([...(product.aliases || []), ...(previous && previous !== value ? [previous] : [])]));
        patch.aliases = aliases;
        patch.source_name = product.source_name || previous || null;
      }
      if (row.key === 'wavelengths') {
        patch.wavelengths_nm = parseWavelengths(value);
        const claims = extractClaims([row.spec, row.de, row.com, value].filter(Boolean).join(' '));
        if (claims.length) patch.technology_claims = Array.from(new Set([...(product.technology_claims || []), ...claims]));
      }
      await db.from('ph_products').update({ ...patch, updated_by: user?.id ?? null }).eq('id', product.id);

      await db.from('ph_master_fields').upsert({
        product_id: product.id,
        field_name: row.key,
        proposed_value: row.spec ?? row.de ?? row.com ?? null,
        master_value: value,
        previous_value: previous,
        source_of_truth: d.source,
        verification_status: d.verification,
        decision_status: 'approved',
        approved_by: user?.id ?? null,
        approved_by_email: user?.email ?? null,
        approved_at: new Date().toISOString(),
      }, { onConflict: 'product_id,field_name' });

      await db.from('ph_field_history').insert({
        product_id: product.id,
        alix_product_id: product.alix_product_id,
        field_name: row.column,
        old_value: previous ? String(previous) : null,
        new_value: value,
        is_critical: true,
        source: `master_review:${d.source}`,
        approval_status: 'approved',
        changed_by: user?.id ?? null,
        changed_by_email: user?.email ?? null,
      });

      toast.success(`${row.label} als Master bestätigt`);
      await loadProduct(product.id);
    } catch (e: any) {
      toast.error(e.message || 'Freigabe fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const readiness = useMemo(() => {
    const missing: string[] = [];
    for (const r of rows) {
      const approved = r.review?.decision_status === 'approved';
      if (!r.master || !approved) missing.push(r.label);
    }
    const realDocs = docs.filter(d => d.resource_type !== 'landing_page');
    const landing = docs.filter(d => d.resource_type === 'landing_page');
    if (mediaCount === 0) missing.push('Media');
    if (realDocs.length === 0) missing.push('Documents');
    const de = channels.find(c => c.channel_code === 'de');
    const com = channels.find(c => c.channel_code === 'com');
    if (!de) missing.push('DE Channel');
    if (!com) missing.push('COM Channel');
    return { ready: missing.length === 0, missing, realDocs: realDocs.length, landing: landing.length };
  }, [rows, docs, mediaCount, channels]);

  const prepareCanary = async () => {
    if (!readiness.ready) { toast.error('BlueIce ist noch NOT READY'); return; }
    setBusy(true);
    try {
      const payload: any[] = [];
      for (const channel of ['de', 'com']) {
        const snap = channel === 'de' ? deSnap : comSnap;
        for (const r of rows) {
          const oldV = liveValue(snap, r.key);
          if ((oldV || '') === (r.master || '')) continue;
          payload.push({
            product_id: product.id,
            channel_code: channel,
            field_key: r.column,
            old_value: oldV,
            new_value: r.master,
            status: 'DRAFT',
            requested_by: user?.id ?? null,
            notes: 'BlueIce Canary Vorbereitung – keine Live-Änderung',
          });
        }
      }
      if (!payload.length) { toast.info('Keine Abweichungen – nichts vorzubereiten'); return; }
      const { error } = await db.from('ph_publish_queue').insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} Diff-Einträge als DRAFT vorbereitet (keine Live-Daten verändert)`);
    } catch (e: any) {
      toast.error(e.message || 'Vorbereitung fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const priorityList = useMemo(() => {
    const score = (p: any) => (p.manual_override ? 1000 : 0) + (p.featured ? 500 : 0) + specsToPairs(p.tech_specs).length;
    const incomplete = (p: any) => FIELDS.some(f => !(f.key === 'product_name' ? p.name : p[f.column]));
    return products
      .filter(p => (onlyIncomplete ? incomplete(p) : true))
      .sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)));
  }, [products, onlyIncomplete]);

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade Master Data Review…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Master Data Review" subtitle="Kritische Master-Felder werden ausschließlich manuell bestätigt – keine automatische Übernahme" icon={ShieldCheck} />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Geräte</CardTitle>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={onlyIncomplete} onCheckedChange={setOnlyIncomplete} id="incomplete" />
              <label htmlFor="incomplete" className="text-xs text-muted-foreground">Master-Daten vervollständigen</label>
            </div>
          </CardHeader>
          <CardContent className="p-2 max-h-[70vh] overflow-auto space-y-1">
            {priorityList.map(p => (
              <button key={p.id} onClick={() => navigate(`/product-hub/master-review/${p.id}`)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted ${p.id === product?.id ? 'bg-muted font-medium' : ''}`}>
                <div className="flex items-center gap-1.5">
                  {p.manual_override && <Lock className="h-3 w-3 text-amber-500" />}
                  <span className="truncate">{p.name}</span>
                </div>
              </button>
            ))}
            {!priorityList.length && <div className="p-2 text-xs text-muted-foreground">Keine Geräte im Filter</div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {product && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">{product.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {product.manual_override && <Badge variant="outline" className="border-amber-500 text-amber-600">Manual Override aktiv</Badge>}
                  <Badge variant="outline">Phase B</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div>Aliases: {(product.aliases || []).join(', ') || '—'} · Source Name: {product.source_name || '—'}</div>
                <div>Technology Claims: {(product.technology_claims || []).join(', ') || '—'} · Wavelengths (nm): {(product.wavelengths_nm || []).join(', ') || '—'}</div>
                <div>Vorgeschlagener Produktname: <span className="text-foreground font-medium">Alix BlueIce Smart KI</span> (Bestehende Bezeichnungen bleiben als Alias erhalten)</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Feldvergleich &amp; Entscheidung</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Feld</TableHead>
                    <TableHead>Aktueller Master</TableHead>
                    <TableHead>tech_specs</TableHead>
                    <TableHead>DE Live</TableHead>
                    <TableHead>COM Live</TableHead>
                    <TableHead className="w-[420px]">Entscheidung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => {
                    const d = draft[r.key] || { value: '', source: 'tech_specs', verification: 'website_only' };
                    const approved = r.review?.decision_status === 'approved';
                    return (
                      <TableRow key={r.key} className="align-top">
                        <TableCell className="font-medium">{r.label}</TableCell>
                        <TableCell className="text-xs">{r.master || <Badge variant="destructive">REVIEW REQUIRED</Badge>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{r.spec || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{r.de || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{r.com || '—'}</TableCell>
                        <TableCell>
                          {approved ? (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> bestätigt</div>
                              <div className="text-muted-foreground">Quelle: {r.review.source_of_truth} · {r.review.verification_status}</div>
                              <div className="text-muted-foreground">{r.review.approved_by_email} · {new Date(r.review.approved_at).toLocaleString('de-DE')}</div>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDraftFor(r.key, { value: String(r.master || '') })}>erneut ändern</Button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1">
                                {[['tech_specs', r.spec], ['DE', r.de], ['COM', r.com]].map(([src, val]: any) => val ? (
                                  <Button key={src} size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                    onClick={() => setDraftFor(r.key, { value: String(val), source: src, verification: 'website_only' })}>
                                    {src} übernehmen
                                  </Button>
                                ) : null)}
                              </div>
                              {r.key === 'intended_use' ? (
                                <Textarea rows={2} value={d.value} placeholder="Zweckbestimmung nur aus geprüfter Quelle"
                                  onChange={e => setDraftFor(r.key, { value: e.target.value })} />
                              ) : (
                                <Input value={d.value} placeholder="Wert manuell eingeben"
                                  onChange={e => setDraftFor(r.key, { value: e.target.value })} />
                              )}
                              {r.key === 'wavelengths' && d.value && (
                                <div className="text-[11px] text-muted-foreground">
                                  numerisch: [{parseWavelengths(d.value).join(', ')}] · Claims: {extractClaims(d.value).join(', ') || '—'}
                                </div>
                              )}
                              <div className="flex gap-1.5">
                                <Select value={d.source} onValueChange={v => setDraftFor(r.key, { source: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={d.verification} onValueChange={v => setDraftFor(r.key, { verification: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{VERIFICATIONS.map(s => <SelectItem key={s.v} value={s.v} className="text-xs">{s.l}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <Button size="sm" className="h-7 text-xs w-full" disabled={busy || !canApprove} onClick={() => confirmField(r)}>
                                Wert als Master bestätigen
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Master Readiness</CardTitle>
              <Badge className={readiness.ready ? 'bg-emerald-600' : 'bg-destructive'}>{readiness.ready ? 'READY' : 'NOT READY'}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>Medien: {mediaCount} · echte Dokumente: {readiness.realDocs} · Landingpage-Links: {readiness.landing} · DE/COM Channel: {channels.map(c => c.channel_code).join(', ') || '—'}</div>
              {!readiness.ready && <div className="text-destructive">Fehlend: {readiness.missing.join(', ')}</div>}
              <Button size="sm" variant="outline" disabled={!readiness.ready || busy} onClick={prepareCanary}>
                <Rocket className="h-3.5 w-3.5 mr-1.5" /> BlueIce Canary vorbereiten (nur Diff-Vorschau)
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/product-hub/canary"><Rocket className="h-3.5 w-3.5 mr-1.5" /> DE Canary Safety Panel</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/product-hub/com-canary"><Rocket className="h-3.5 w-3.5 mr-1.5" /> COM Canary Safety Panel</a>
              </Button>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
