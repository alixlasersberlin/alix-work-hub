import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Sparkles, Languages, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  PH_LOCALES, PH_TARGET_LOCALES, PH_TR_LIST_FIELDS, PH_TR_SEO_FIELDS, PH_TR_STATUS, PH_TR_TEXT_FIELDS,
  phApproveTranslation, phIsRtl, phLoadTranslations, phSaveTranslation, phTranslate,
  type PhTranslation, type PhTrStatus,
} from '@/lib/producthub/i18n';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Listenfeld als Zeilen-Editor (eine Zeile = ein Eintrag). */
function ListField({ label, value, rtl, disabled, onChange }: {
  label: string; value: string[]; rtl: boolean; disabled?: boolean; onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} <span className="text-muted-foreground">(eine Zeile pro Eintrag)</span></Label>
      <Textarea
        rows={4}
        dir={rtl ? 'rtl' : 'ltr'}
        className={rtl ? 'text-right' : ''}
        disabled={disabled}
        value={(value ?? []).join('\n')}
        onChange={e => onChange(e.target.value.split('\n').map(s => s.trimStart()).filter((s, i, a) => s !== '' || i < a.length - 1))}
      />
    </div>
  );
}

export function TranslationsTab({ productId, master, canWrite }: {
  productId: string;
  master: Record<string, any>;
  canWrite: boolean;
}) {
  const [locale, setLocale] = useState<string>('de');
  const [rows, setRows] = useState<Record<string, PhTranslation>>({});
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState<string[] | null>(null);

  const rtl = phIsRtl(locale);

  const load = async () => {
    setLoading(true);
    try {
      const list = await phLoadTranslations(productId);
      const map: Record<string, PhTranslation> = {};
      list.forEach(r => { map[r.locale] = r; });
      setRows(map);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [productId]);

  useEffect(() => {
    const r = rows[locale];
    if (r) { setForm({ ...r }); return; }
    // Deutsch: Masterinhalte als Startwert (wird erst beim Speichern übernommen)
    setForm(locale === 'de'
      ? {
        name: master.name ?? '', short_description: master.short_description ?? '',
        long_description: master.long_description ?? '',
        highlights: Array.isArray(master.features) ? master.features : [],
        applications: Array.isArray(master.applications) ? master.applications : [],
        benefits: [], treatments: [], features: [],
        seo_title: master.seo_title ?? '', seo_description: master.seo_description ?? '',
      }
      : { highlights: [], benefits: [], applications: [], treatments: [], features: [] });
  }, [locale, rows, master]);

  const status: PhTrStatus = (rows[locale]?.status ?? 'missing') as PhTrStatus;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (nextStatus?: PhTrStatus) => {
    setSaving(true);
    try {
      await phSaveTranslation({
        product_id: productId,
        locale,
        name: form.name ?? null,
        short_description: form.short_description ?? null,
        long_description: form.long_description ?? null,
        marketing_text: form.marketing_text ?? null,
        notices: form.notices ?? null,
        highlights: form.highlights ?? [],
        benefits: form.benefits ?? [],
        applications: form.applications ?? [],
        treatments: form.treatments ?? [],
        features: form.features ?? [],
        seo_title: form.seo_title ?? null,
        seo_description: form.seo_description ?? null,
        slug: form.slug ?? null,
        status: nextStatus ?? (status === 'missing' ? 'review' : status === 'outdated' ? 'review' : status),
      } as any);
      toast.success('Sprachversion gespeichert');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const runAi = async (locales: string[], overwrite: boolean) => {
    setAiBusy(true);
    try {
      const res = await phTranslate({ productIds: [productId], locales, overwrite });
      const ok = res.filter((r: any) => r.ok).length;
      const skipped = res.filter((r: any) => r.skipped).length;
      const failed = res.filter((r: any) => r.error);
      if (ok) toast.success(`${ok} Sprachversion(en) als KI-Entwurf erstellt`);
      if (skipped) toast.info(`${skipped} Sprache(n) übersprungen (manuell gepflegt/freigegeben)`);
      failed.forEach((f: any) => toast.error(`${f.locale}: ${f.error}`));
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setAiBusy(false); }
  };

  const missing = useMemo(
    () => PH_TARGET_LOCALES.filter(l => !rows[l] || rows[l].status === 'missing' || rows[l].status === 'outdated'),
    [rows],
  );

  const requestAi = (locales: string[]) => {
    const risky = locales.filter(l => ['review', 'approved', 'published'].includes(rows[l]?.status ?? ''));
    if (risky.length) setConfirmOverwrite(locales);
    else runAi(locales, false);
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Sprachleiste */}
      <div className="flex flex-wrap items-center gap-2">
        {PH_LOCALES.map(l => {
          const st = (rows[l.code]?.status ?? (l.code === 'de' ? 'approved' : 'missing')) as PhTrStatus;
          const meta = PH_TR_STATUS[st];
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLocale(l.code)}
              className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                locale === l.code ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {l.master && <Badge variant="outline" className="text-[10px]">Master</Badge>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.tone}`}>{meta.icon}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        {canWrite && (
          <Button size="sm" variant="outline" disabled={aiBusy || !missing.length}
            onClick={() => requestAi(missing)}>
            {aiBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Alle fehlenden Sprachen übersetzen
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={PH_TR_STATUS[status].tone}>{PH_TR_STATUS[status].label}</Badge>
            {rows[locale]?.translated_at && (
              <span className="text-xs text-muted-foreground">
                Übersetzt am {new Date(rows[locale]!.translated_at!).toLocaleDateString('de-DE')}
                {rows[locale]?.translation_source === 'ki' ? ' (KI)' : ''}
              </span>
            )}
            {rows[locale]?.approved_at && (
              <span className="text-xs text-muted-foreground">
                · Freigegeben am {new Date(rows[locale]!.approved_at!).toLocaleDateString('de-DE')}
              </span>
            )}
            <div className="flex-1" />
            {canWrite && locale !== 'de' && (
              <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => requestAi([locale])}>
                {aiBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Mit KI aus Deutsch übersetzen
              </Button>
            )}
            {canWrite && (
              <Button size="sm" onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Speichern
              </Button>
            )}
            {canWrite && rows[locale] && status !== 'approved' && status !== 'published' && (
              <Button size="sm" variant="secondary" onClick={async () => {
                await phApproveTranslation(productId, locale, 'approved'); toast.success('Freigegeben'); load();
              }}>
                <ShieldCheck className="w-4 h-4 mr-1" /> Freigeben
              </Button>
            )}
            {canWrite && status === 'approved' && (
              <Button size="sm" variant="secondary" onClick={async () => {
                await phApproveTranslation(productId, locale, 'published'); toast.success('Veröffentlicht'); load();
              }}>
                Veröffentlichen
              </Button>
            )}
          </div>

          {status === 'outdated' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertTriangle className="w-4 h-4" /> Der deutsche Mastertext wurde geändert – diese Übersetzung ist möglicherweise veraltet.
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Technische Daten, Modell, SKU, Hub-ID, Preise, Bilder und Dokumente sind sprachneutral und werden hier bewusst nicht angezeigt.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {PH_TR_TEXT_FIELDS.map(f => (
              <div key={f.key} className={f.area ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                <Label className="text-xs">{f.label}</Label>
                {f.area
                  ? <Textarea rows={f.rows ?? 4} dir={rtl ? 'rtl' : 'ltr'} className={rtl ? 'text-right' : ''}
                      disabled={!canWrite} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
                  : <Input dir={rtl ? 'rtl' : 'ltr'} className={rtl ? 'text-right' : ''}
                      disabled={!canWrite} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {PH_TR_LIST_FIELDS.map(f => (
              <ListField key={f.key} label={f.label} rtl={rtl} disabled={!canWrite}
                value={form[f.key] ?? []} onChange={v => set(f.key, v)} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {PH_TR_SEO_FIELDS.map(f => (
              <div key={f.key} className={f.area ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                <Label className="text-xs">{f.label}</Label>
                {f.area
                  ? <Textarea rows={3} dir={rtl ? 'rtl' : 'ltr'} className={rtl ? 'text-right' : ''}
                      disabled={!canWrite} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
                  : <Input dir={f.key === 'slug' ? 'ltr' : (rtl ? 'rtl' : 'ltr')} className={f.key !== 'slug' && rtl ? 'text-right' : ''}
                      disabled={!canWrite} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmOverwrite} onOpenChange={o => !o && setConfirmOverwrite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Languages className="w-4 h-4" /> Vorhandene Übersetzung überschreiben?</AlertDialogTitle>
            <AlertDialogDescription>
              Für mindestens eine Sprache liegt bereits eine geprüfte oder freigegebene Übersetzung vor.
              Sie können diese behalten oder durch einen neuen KI-Entwurf ersetzen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button variant="outline" onClick={() => { runAi(confirmOverwrite!, false); setConfirmOverwrite(null); }}>
              Nur fehlende erzeugen
            </Button>
            <AlertDialogAction onClick={() => { runAi(confirmOverwrite!, true); setConfirmOverwrite(null); }}>
              Überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
