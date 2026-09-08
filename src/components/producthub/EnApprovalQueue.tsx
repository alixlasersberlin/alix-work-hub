// Product Hub → Übersetzungen → Freigabe (EN | ES | RU | AR)
// Manuelle Prüfung und Freigabe der KI-Entwürfe je Sprache. BLOCKED wird nie freigegeben.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Pencil, RefreshCw, Sparkles, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { phListProducts } from '@/lib/producthub/api';
import { phApproveTranslation, phTranslate, PH_TR_STATUS } from '@/lib/producthub/i18n';
import {
  PH_LOCALE_SITE, PH_QA_LABEL, PH_READINESS_TONE, phBuildAudit, phGermanSource, phLoadComMap, phLoadQa,
  phLoadTranslationsAllFields, type PhAuditRow,
} from '@/lib/producthub/enReadiness';

const COMPARE_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Produktname' },
  { key: 'short_description', label: 'Kurzbeschreibung' },
  { key: 'long_description', label: 'Langbeschreibung' },
  { key: 'marketing_text', label: 'Marketingtext' },
  { key: 'intended_use', label: 'Zweckbestimmung' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'benefits', label: 'Vorteile' },
  { key: 'applications', label: 'Einsatzgebiete' },
  { key: 'treatments', label: 'Behandlungsarten' },
  { key: 'features', label: 'Merkmale' },
  { key: 'seo_title', label: 'SEO Title' },
  { key: 'seo_description', label: 'Meta Description' },
];

const show = (v: unknown) =>
  Array.isArray(v) ? v.filter(x => typeof x === 'string').join(' · ') : (typeof v === 'string' ? v : '—');

export function EnApprovalQueue({ locale = 'en' }: { locale?: 'en' | 'es' | 'ru' | 'ar' }) {
  const nav = useNavigate();
  const LC = locale.toUpperCase();
  const rtl = locale === 'ar';
  const [rows, setRows] = useState<PhAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [progress, setProgress] = useState(0);
  const [q, setQ] = useState('');
  const [fQa, setFQa] = useState('all');
  const [sel, setSel] = useState<string[]>([]);
  const [detail, setDetail] = useState<PhAuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, trs, qa, com] = await Promise.all([
        phListProducts(), phLoadTranslationsAllFields(['de', locale]), phLoadQa(locale),
        phLoadComMap(PH_LOCALE_SITE[locale] ?? 'com'),
      ]);
      setRows(phBuildAudit(prods, trs, qa, com, locale));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [locale]);

  const filtered = useMemo(() => rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (s && ![r.product.name, r.hubId].some(v => (v || '').toLowerCase().includes(s))) return false;
    if (fQa === 'offen') return r.en && !['approved', 'published'].includes(r.enStatus);
    if (fQa !== 'all') return r.qa?.status === fQa;
    return true;
  }), [rows, q, fQa]);

  const missingEn = rows.filter(r => !r.en || r.enStatus === 'outdated');

  const translateAllEn = async () => {
    setBatch(true); setProgress(0);
    try {
      const ids = missingEn.map(r => r.product.id);
      for (let i = 0; i < ids.length; i += 3) {
        await phTranslate({ productIds: ids.slice(i, i + 3), locales: [locale], overwrite: false });
        setProgress(Math.round(((i + 3) / ids.length) * 100));
      }
      toast.success(`${LC}-Entwürfe erstellt – Freigabe erfolgt manuell.`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBatch(false); setProgress(0); }
  };

  const retranslate = async (r: PhAuditRow) => {
    setBusy(r.product.id);
    try {
      await phTranslate({ productIds: [r.product.id], locales: [locale], overwrite: true });
      toast.success('Neu übersetzt');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const setStatus = async (r: PhAuditRow, status: 'approved' | 'review') => {
    if (status === 'approved' && r.qa?.status === 'blocked') {
      toast.error('BLOCKED darf nicht freigegeben werden.');
      return;
    }
    setBusy(r.product.id);
    try {
      await phApproveTranslation(r.product.id, locale, status);
      toast.success(status === 'approved' ? `${LC} freigegeben` : 'Zurückgestellt');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const approveSelected = async () => {
    const targets = rows.filter(r => sel.includes(r.product.id) && r.qa?.status !== 'blocked' && r.en);
    if (!targets.length) { toast.error('Keine freigebbaren Geräte ausgewählt.'); return; }
    setBatch(true);
    try {
      for (const r of targets) await phApproveTranslation(r.product.id, locale, 'approved');
      toast.success(`${targets.length} Geräte freigegeben`);
      setSel([]); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBatch(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label className="text-xs">Suche</Label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Gerät oder Hub-ID" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quality Check</Label>
            <Select value={fQa} onValueChange={setFQa}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="offen">Nur offene Freigaben</SelectItem>
                <SelectItem value="pass">PASS</SelectItem>
                <SelectItem value="warning">WARNING</SelectItem>
                <SelectItem value="blocked">BLOCKED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={translateAllEn} disabled={batch || !missingEn.length}>
            {batch ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {LC} für alle offenen Geräte erstellen ({missingEn.length})
          </Button>
          <Button variant="outline" disabled={batch || !sel.length} onClick={approveSelected}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Auswahl freigeben ({sel.length})
          </Button>
          <Button variant="ghost" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
        {batch && progress > 0 && <div className="px-4 pb-4"><Progress value={progress} className="h-1.5" /></div>}
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Gerät</TableHead>
                <TableHead className="w-[150px]">Vollständigkeit</TableHead>
                <TableHead>Quality Score</TableHead>
                <TableHead>Warnungen</TableHead>
                <TableHead>{LC} Status</TableHead>
                <TableHead>Website-Mapping</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.product.id}>
                  <TableCell>
                    <Checkbox
                      checked={sel.includes(r.product.id)}
                      disabled={!r.en || r.qa?.status === 'blocked'}
                      onCheckedChange={v => setSel(s => v ? [...s, r.product.id] : s.filter(x => x !== r.product.id))}
                    />
                  </TableCell>
                  <TableCell>
                    <button className="font-medium hover:underline text-left" onClick={() => setDetail(r)}>
                      {r.product.name}
                    </button>
                    <div className="text-[11px] text-muted-foreground font-mono">{r.hubId ?? 'Hub-ID fehlt'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.completeness} className="h-1.5 w-20" />
                      <span className="text-xs text-muted-foreground">{r.completeness}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.qa
                      ? <Badge variant="outline" className={PH_QA_LABEL[r.qa.status].tone}>{PH_QA_LABEL[r.qa.status].label} · {r.qa.score}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs max-w-[260px]">
                    {r.qa?.issues?.length
                      ? <span title={r.qa.issues.map(i => i.message).join('\n')}>{r.qa.issues.length} Hinweis(e): {r.qa.issues[0].message}</span>
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{PH_TR_STATUS[(r.enStatus as keyof typeof PH_TR_STATUS)]?.label ?? r.enStatus}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PH_READINESS_TONE[r.readiness]}>{r.readiness}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" disabled={busy === r.product.id || !r.en || r.qa?.status === 'blocked'}
                      onClick={() => setStatus(r, 'approved')} title="Freigeben">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => nav(`/product-hub/geraete/${r.product.id}`)} title="Bearbeiten">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === r.product.id} onClick={() => retranslate(r)} title="Neu übersetzen">
                      {busy === r.product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === r.product.id || !r.en}
                      onClick={() => setStatus(r, 'review')} title="Zurückstellen">
                      <Clock className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && !loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Keine Geräte in der Freigabe-Queue.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.product.name} – Deutsch ↔ {LC}</DialogTitle></DialogHeader>
          {detail && (() => {
            const de = phGermanSource(detail.product, undefined);
            const en = (detail.en ?? {}) as Record<string, unknown>;
            return (
              <div className="space-y-4">
                {detail.qa?.issues?.length ? (
                  <Card><CardContent className="p-3 space-y-1">
                    <div className="text-sm font-medium">Quality Check – {PH_QA_LABEL[detail.qa.status].label} ({detail.qa.score})</div>
                    <ul className="text-xs list-disc pl-5">
                      {detail.qa.issues.map((i, n) => (
                        <li key={n} className={i.level === 'blocked' ? 'text-destructive' : 'text-amber-500'}>{i.message}</li>
                      ))}
                    </ul>
                  </CardContent></Card>
                ) : null}
                {COMPARE_FIELDS.map(f => (
                  <div key={f.key} className="grid md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">{f.label} · DE</div>
                      <div className="text-sm whitespace-pre-wrap">{show(de[f.key]) || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">{f.label} · {LC}</div>
                      <div className="text-sm whitespace-pre-wrap" dir={rtl ? 'rtl' : 'ltr'}>{show(en[f.key]) || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
