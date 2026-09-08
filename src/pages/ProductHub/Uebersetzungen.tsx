import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages, Loader2, Sparkles, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  PH_LOCALES, PH_TARGET_LOCALES, PH_TR_STATUS, phDeleteGlossaryTerm, phLoadAllTranslations,
  phLoadGlossary, phSaveGlossaryTerm, phTranslate, type PhGlossaryTerm, type PhTrStatus,
} from '@/lib/producthub/i18n';
import { phListProducts } from '@/lib/producthub/api';
import { WebsiteSyncPanel } from '@/components/producthub/WebsiteSyncPanel';
import { CatalogAuditPanel } from '@/components/producthub/CatalogAuditPanel';
import { EnApprovalQueue } from '@/components/producthub/EnApprovalQueue';

import type { PhProduct } from '@/lib/producthub/config';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function StatusCell({ status }: { status: PhTrStatus }) {
  const m = PH_TR_STATUS[status];
  return <span className={`text-xs px-2 py-0.5 rounded ${m.tone}`} title={m.label}>{m.icon}</span>;
}

export default function Uebersetzungen() {
  const nav = useNavigate();
  const [products, setProducts] = useState<PhProduct[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, PhTrStatus>>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fLocale, setFLocale] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, trs] = await Promise.all([phListProducts(), phLoadAllTranslations()]);
      setProducts(prods);
      const m: Record<string, Record<string, PhTrStatus>> = {};
      trs.forEach(t => {
        m[t.product_id] = m[t.product_id] || {};
        m[t.product_id][t.locale] = t.status as PhTrStatus;
      });
      setMatrix(m);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const statusOf = (pid: string, l: string): PhTrStatus =>
    (matrix[pid]?.[l] ?? (l === 'de' ? 'approved' : 'missing')) as PhTrStatus;

  const filtered = useMemo(() => products.filter(p => {
    const s = q.trim().toLowerCase();
    if (s && ![p.name, p.model, p.sku, p.product_group].some(v => (v || '').toLowerCase().includes(s))) return false;
    if (fStatus !== 'all') {
      const locales = fLocale === 'all' ? PH_TARGET_LOCALES : [fLocale];
      if (!locales.some(l => statusOf(p.id, l) === fStatus)) return false;
    }
    return true;
  }), [products, q, fLocale, fStatus, matrix]);

  const missingCount = useMemo(() => filtered.reduce((n, p) =>
    n + PH_TARGET_LOCALES.filter(l => ['missing', 'outdated'].includes(statusOf(p.id, l))).length, 0),
    [filtered, matrix]);

  const runMissing = async () => {
    setBusy(true);
    try {
      const targets = filtered
        .filter(p => PH_TARGET_LOCALES.some(l => ['missing', 'outdated'].includes(statusOf(p.id, l))))
        .slice(0, 25);
      const res = await phTranslate({
        productIds: targets.map(p => p.id),
        locales: fLocale === 'all' ? [...PH_TARGET_LOCALES] : [fLocale],
        overwrite: false,
      });
      toast.success(`${res.filter((r: any) => r.ok).length} Übersetzungen als KI-Entwurf erstellt`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Übersetzungen" subtitle="Zentrale Sprachpflege aller Geräte – Deutsch ist Master" icon={Languages} />

      <Tabs defaultValue="uebersicht">
        <TabsList>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="websync">Website Sync</TabsTrigger>
          <TabsTrigger value="glossar">Translation Glossary</TabsTrigger>
        </TabsList>


        <TabsContent value="uebersicht" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-xs">Suche</Label>
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Gerät, Modell, SKU, Kategorie" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sprache</Label>
                <Select value={fLocale} onValueChange={setFLocale}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Sprachen</SelectItem>
                    {PH_TARGET_LOCALES.map(l => (
                      <SelectItem key={l} value={l}>{PH_LOCALES.find(x => x.code === l)!.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {(Object.keys(PH_TR_STATUS) as PhTrStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{PH_TR_STATUS[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={busy || !missingCount} onClick={() => setConfirmAll(true)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Alle fehlenden Übersetzungen erstellen ({missingCount})
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gerät</TableHead>
                      {PH_LOCALES.map(l => <TableHead key={l.code} className="text-center w-16">{l.flag} {l.code.toUpperCase()}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => nav(`/product-hub/geraete/${p.id}`)}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.model || p.sku || p.alix_product_id}</div>
                        </TableCell>
                        {PH_LOCALES.map(l => (
                          <TableCell key={l.code} className="text-center"><StatusCell status={statusOf(p.id, l.code)} /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Geräte gefunden</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(Object.keys(PH_TR_STATUS) as PhTrStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1">
                <span className={`px-1.5 py-0.5 rounded ${PH_TR_STATUS[s].tone}`}>{PH_TR_STATUS[s].icon}</span>
                {PH_TR_STATUS[s].label}
              </span>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="websync"><WebsiteSyncPanel canWrite /></TabsContent>

        <TabsContent value="glossar"><GlossaryPanel /></TabsContent>

      </Tabs>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fehlende Übersetzungen erstellen</AlertDialogTitle>
            <AlertDialogDescription>
              Es werden {missingCount} Sprachversionen als KI-Entwurf erzeugt (max. 25 Geräte pro Durchlauf).
              Bereits geprüfte oder freigegebene Übersetzungen werden dabei nicht überschrieben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={runMissing}>Jetzt erstellen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GlossaryPanel() {
  const [terms, setTerms] = useState<PhGlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [mode, setMode] = useState<'protected' | 'fixed'>('protected');

  const load = async () => {
    setLoading(true);
    try { setTerms(await phLoadGlossary()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const t = term.trim();
    if (!t) return;
    try {
      await phSaveGlossaryTerm({ term: t, mode, translations: {}, active: true });
      setTerm(''); toast.success('Begriff gespeichert'); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const setTranslation = async (row: PhGlossaryTerm, locale: string, value: string) => {
    const translations = { ...(row.translations || {}), [locale]: value };
    setTerms(ts => ts.map(t => t.id === row.id ? { ...t, translations } : t));
    try { await phSaveGlossaryTerm({ ...row, translations }); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Geschützte Begriffe werden von der KI nie übersetzt. Begriffe mit verbindlicher Übersetzung
          werden in jeder Sprache immer gleich übersetzt.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Begriff</Label>
            <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="z. B. BlueIce" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Art</Label>
            <Select value={mode} onValueChange={v => setMode(v as any)}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="protected">Nie übersetzen (Marke/Produkt)</SelectItem>
                <SelectItem value="fixed">Verbindliche Übersetzung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Hinzufügen</Button>
        </div>

        {loading ? <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Begriff</TableHead>
                <TableHead>Art</TableHead>
                {PH_TARGET_LOCALES.map(l => <TableHead key={l}>{l.toUpperCase()}</TableHead>)}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.term}</TableCell>
                  <TableCell>
                    <Badge variant={t.mode === 'protected' ? 'outline' : 'secondary'}>
                      {t.mode === 'protected' ? 'Nie übersetzen' : 'Verbindlich'}
                    </Badge>
                  </TableCell>
                  {PH_TARGET_LOCALES.map(l => (
                    <TableCell key={l}>
                      {t.mode === 'fixed' ? (
                        <Input
                          className="h-8 w-32" dir={l === 'ar' ? 'rtl' : 'ltr'}
                          defaultValue={t.translations?.[l] ?? ''}
                          onBlur={e => setTranslation(t, l, e.target.value)}
                        />
                      ) : <span className="text-xs text-muted-foreground">unverändert</span>}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      try { await phDeleteGlossaryTerm(t.id!); toast.success('Gelöscht'); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
