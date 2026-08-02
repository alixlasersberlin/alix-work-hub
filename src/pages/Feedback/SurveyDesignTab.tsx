import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Trash2, ImageIcon, Loader2, Monitor, Smartphone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  SurveyDesign, THEMES, LAYOUTS, FONT_PAIRS, DEFAULT_DESIGN,
  applyTheme, mergeDesign, ensureFontLoaded, designVars, backgroundStyle, buttonCss,
} from '@/lib/feedback/design';
import { uploadSurveyMedia, listSurveyMedia, deleteSurveyMedia, resolveMediaUrl } from '@/lib/feedback/media';
import { DesignTemplates, DesignAiAssistant, ContrastHint } from './DesignExtras';


type Props = { design: SurveyDesign; onChange: (d: SurveyDesign) => void; title?: string };

export default function SurveyDesignTab({ design, onChange, title }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const d = mergeDesign(design);

  useEffect(() => { ensureFontLoaded(d.font); }, [d.font]);

  const set = (patch: Partial<SurveyDesign>) => onChange(mergeDesign({ ...d, ...patch }));
  const setColor = (k: keyof SurveyDesign['colors'], v: string) => set({ colors: { ...d.colors, [k]: v } });
  const setBg = (patch: Partial<SurveyDesign['background']>) => set({ background: { ...d.background, ...patch } });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* ---------------- Steuerung ---------------- */}
      <div className="space-y-4">
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Design-Vorlagen</h3>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_DESIGN })}>
              <RotateCcw className="h-4 w-4 mr-1" />Zurücksetzen
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEMES.map(t => (
              <button
                key={t.key}
                onClick={() => onChange(applyTheme(d, t.key))}
                className={`rounded-xl border p-2 text-left transition ${d.theme === t.key ? 'border-primary ring-1 ring-primary/40' : 'border-border hover:border-primary/50'}`}
              >
                <div className="h-10 rounded-lg mb-2 border border-border/60" style={{
                  background: `linear-gradient(135deg, ${t.patch.background?.gradientFrom ?? t.patch.colors?.bg}, ${t.patch.background?.gradientTo ?? t.patch.colors?.surface})`,
                }}>
                  <div className="h-2 w-8 m-2 rounded-full" style={{ background: t.patch.colors?.primary }} />
                </div>
                <div className="text-xs font-medium">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.hint}</div>
              </button>
            ))}
          </div>
        </CardContent></Card>

        <DesignAiAssistant design={d} onApply={onChange} />
        <DesignTemplates design={d} onApply={onChange} />
        <ContrastHint design={d} />


        <Card><CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Layout &amp; Typografie</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {LAYOUTS.map(l => (
              <button key={l.key} onClick={() => set({ layout: l.key })}
                className={`rounded-lg border p-2 text-left text-xs transition ${d.layout === l.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                <div className="font-medium">{l.label}</div>
                <div className="text-[10px] text-muted-foreground">{l.hint}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Schriftart</Label>
              <Select value={d.font} onValueChange={v => { ensureFontLoaded(v); set({ font: v }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_PAIRS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buttons</Label>
              <Select value={d.buttonStyle} onValueChange={(v: any) => set({ buttonStyle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Gefüllt</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="pill">Pill (rund)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ecken-Radius: {d.radius}px</Label>
              <Slider value={[d.radius]} min={0} max={32} step={1} onValueChange={([v]) => set({ radius: v })} className="mt-3" />
            </div>
            <div>
              <Label>Schatten</Label>
              <Select value={d.shadow} onValueChange={(v: any) => set({ shadow: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Schatten</SelectItem>
                  <SelectItem value="soft">Weich</SelectItem>
                  <SelectItem value="strong">Stark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fortschrittsanzeige</Label>
              <Select value={d.progress} onValueChange={(v: any) => set({ progress: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Balken</SelectItem>
                  <SelectItem value="dots">Punkte</SelectItem>
                  <SelectItem value="steps">Schritt X von Y</SelectItem>
                  <SelectItem value="none">Ausblenden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Übergang</Label>
              <Select value={d.animation} onValueChange={(v: any) => set({ animation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide (nach links)</SelectItem>
                  <SelectItem value="fade">Weiches Einblenden</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="none">Ohne Animation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Eine Frage pro Seite</div>
              <div className="text-xs text-muted-foreground">Aus = alle Fragen als scrollbarer Fragebogen</div>
            </div>
            <Switch checked={d.onePerPage} onCheckedChange={v => set({ onePerPage: v })} />
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Farben</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['primary', 'Akzent'], ['primaryText', 'Akzent-Schrift'], ['bg', 'Hintergrund'], ['surface', 'Karte'],
              ['text', 'Text'], ['muted', 'Sekundärtext'], ['border', 'Rahmen'],
            ] as [keyof SurveyDesign['colors'], string][]).map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={d.colors[k]} onChange={e => setColor(k, e.target.value)}
                    className="h-9 w-10 rounded border border-border bg-transparent p-0.5" aria-label={label} />
                  <Input value={d.colors[k]} onChange={e => setColor(k, e.target.value)} className="h-9 font-mono text-xs" />
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Hintergrund</h3>
          <Select value={d.background.type} onValueChange={(v: any) => setBg({ type: v })}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Einfarbig</SelectItem>
              <SelectItem value="gradient">Verlauf</SelectItem>
              <SelectItem value="image">Bild</SelectItem>
            </SelectContent>
          </Select>
          {d.background.type === 'gradient' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label className="text-xs">Von</Label><Input type="color" value={d.background.gradientFrom} onChange={e => setBg({ gradientFrom: e.target.value })} className="h-9 p-1" /></div>
              <div><Label className="text-xs">Bis</Label><Input type="color" value={d.background.gradientTo} onChange={e => setBg({ gradientTo: e.target.value })} className="h-9 p-1" /></div>
              <div><Label className="text-xs">Winkel: {d.background.angle}°</Label><Slider value={[d.background.angle]} min={0} max={360} step={5} onValueChange={([v]) => setBg({ angle: v })} className="mt-3" /></div>
            </div>
          )}
          {d.background.type === 'image' && (
            <div className="space-y-3">
              <MediaField label="Hintergrundbild" value={d.background.imageUrl} onChange={v => setBg({ imageUrl: v })} folder="backgrounds" />
              <div><Label className="text-xs">Abdunkeln: {Math.round(d.background.overlay * 100)}%</Label>
                <Slider value={[d.background.overlay * 100]} min={0} max={90} step={5} onValueChange={([v]) => setBg({ overlay: v / 100 })} className="mt-3" /></div>
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Medien</h3>
          <MediaField label="Logo" value={d.media.logoUrl} onChange={v => set({ media: { ...d.media, logoUrl: v } })} folder="logos" />
          <div><Label className="text-xs">Logo-Höhe: {d.media.logoHeight}px</Label>
            <Slider value={[d.media.logoHeight]} min={20} max={120} step={2} onValueChange={([v]) => set({ media: { ...d.media, logoHeight: v } })} className="mt-3" /></div>
          <MediaField label="Titelbild (Header)" value={d.media.heroUrl} onChange={v => set({ media: { ...d.media, heroUrl: v } })} folder="hero" />
          <div><Label className="text-xs">Titelbild-Höhe: {d.media.heroHeight}px</Label>
            <Slider value={[d.media.heroHeight]} min={80} max={420} step={10} onValueChange={([v]) => set({ media: { ...d.media, heroHeight: v } })} className="mt-3" /></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Startseite &amp; Personalisierung</h3>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Startseite anzeigen</div>
              <div className="text-xs text-muted-foreground">Begrüßung mit Start-Button vor der ersten Frage</div>
            </div>
            <Switch checked={d.startPage.enabled} onCheckedChange={v => set({ startPage: { ...d.startPage, enabled: v } })} />
          </div>
          {d.startPage.enabled && (
            <div className="grid gap-3">
              <div><Label>Überschrift</Label><Input value={d.startPage.headline} onChange={e => set({ startPage: { ...d.startPage, headline: e.target.value } })} placeholder="Ihre Meinung zählt" /></div>
              <div><Label>Text</Label><Textarea rows={3} value={d.startPage.text} onChange={e => set({ startPage: { ...d.startPage, text: e.target.value } })} /></div>
              <div><Label>Button-Beschriftung</Label><Input value={d.startPage.button} onChange={e => set({ startPage: { ...d.startPage, button: e.target.value } })} /></div>
            </div>
          )}
          <div>
            <Label>Persönliche Anrede</Label>
            <Input value={d.personalization.greeting} onChange={e => set({ personalization: { ...d.personalization, greeting: e.target.value } })} placeholder="Hallo {{name}}," />
            <p className="text-[11px] text-muted-foreground mt-1">Platzhalter: {'{{name}}'} · {'{{firma}}'} · {'{{umfrage}}'} — leer lassen zum Ausblenden.</p>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fußzeile &amp; DSGVO</h3>
          <div><Label>Hinweistext</Label><Textarea rows={2} value={d.footer.text} onChange={e => set({ footer: { ...d.footer, text: e.target.value } })} placeholder="Ihre Angaben werden vertraulich behandelt und ausschließlich zur Qualitätsverbesserung genutzt." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Link Datenschutz</Label><Input value={d.footer.privacyUrl} onChange={e => set({ footer: { ...d.footer, privacyUrl: e.target.value } })} placeholder="https://…/datenschutz" /></div>
            <div><Label>Link Impressum</Label><Input value={d.footer.imprintUrl} onChange={e => set({ footer: { ...d.footer, imprintUrl: e.target.value } })} placeholder="https://…/impressum" /></div>
          </div>
        </CardContent></Card>
      </div>

      {/* ---------------- Live-Vorschau ---------------- */}
      <div className="lg:sticky lg:top-4 h-fit space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live-Vorschau</span>
          <div className="flex gap-1">
            <Button size="sm" variant={device === 'desktop' ? 'default' : 'outline'} onClick={() => setDevice('desktop')}><Monitor className="h-4 w-4" /></Button>
            <Button size="sm" variant={device === 'mobile' ? 'default' : 'outline'} onClick={() => setDevice('mobile')}><Smartphone className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className={device === 'mobile' ? 'mx-auto w-[380px] max-w-full' : 'w-full'}>
            <DesignPreview d={d} title={title} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Vorschau -------------------- */

function DesignPreview({ d, title }: { d: SurveyDesign; title?: string }) {
  const [logo, setLogo] = useState('');
  const [hero, setHero] = useState('');
  const [bgImg, setBgImg] = useState('');

  useEffect(() => { resolveMediaUrl(d.media.logoUrl).then(setLogo); }, [d.media.logoUrl]);
  useEffect(() => { resolveMediaUrl(d.media.heroUrl).then(setHero); }, [d.media.heroUrl]);
  useEffect(() => { resolveMediaUrl(d.background.imageUrl).then(setBgImg); }, [d.background.imageUrl]);

  const bg = backgroundStyle({ ...d, background: { ...d.background, imageUrl: bgImg } });
  const card: React.CSSProperties = {
    background: d.layout === 'minimal' ? 'transparent' : d.colors.surface,
    border: d.layout === 'minimal' ? 'none' : `1px solid ${d.colors.border}`,
    borderRadius: d.radius,
    boxShadow: d.layout === 'minimal' ? 'none' : `var(--sv-shadow)`,
  };

  return (
    <div style={{ ...designVars(d), ...bg, minHeight: 520 }} className="p-6">
      {logo && <img src={logo} alt="Logo" style={{ height: d.media.logoHeight }} className="mb-4 object-contain" />}
      <div className="mx-auto max-w-xl space-y-4">
        {hero && <img src={hero} alt="" style={{ height: d.media.heroHeight, borderRadius: d.radius }} className="w-full object-cover" />}
        {d.personalization.greeting && <div style={{ color: d.colors.muted }} className="text-sm">{d.personalization.greeting.replace('{{name}}', 'Frau Meier').replace('{{firma}}', 'Musterpraxis')}</div>}
        <h1 className="text-2xl font-semibold" style={{ color: d.colors.text }}>{title || 'Ihre Erfahrung. Unsere Weiterentwicklung.'}</h1>

        {d.progress === 'bar' && (
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: d.colors.border }}>
            <div className="h-full rounded-full" style={{ width: '40%', background: d.colors.primary }} />
          </div>
        )}
        {d.progress === 'dots' && (
          <div className="flex gap-1.5">{[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < 2 ? d.colors.primary : d.colors.border }} />
          ))}</div>
        )}
        {d.progress === 'steps' && <div className="text-xs" style={{ color: d.colors.muted }}>Frage 2 von 5</div>}

        <div style={card} className="p-5 space-y-4">
          <div className="text-base font-medium" style={{ color: d.colors.text }}>
            2. Wie zufrieden sind Sie mit unserem Service? <span style={{ color: d.colors.primary }}>*</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className="h-9 w-9 grid place-items-center text-sm"
                style={{ ...buttonCss(d, n <= 4 ? 'primary' : 'ghost'), opacity: n <= 4 ? 1 : .7 }}>{n}</span>
            ))}
          </div>
          <div className="text-xs" style={{ color: d.colors.muted }}>Ihre Antwort hilft uns, besser zu werden.</div>
        </div>

        <div className="flex items-center justify-between">
          <span className="px-4 py-2 text-sm" style={buttonCss(d, 'ghost')}>Zurück</span>
          <span className="px-5 py-2 text-sm font-medium" style={buttonCss(d, 'primary')}>
            {d.startPage.enabled ? d.startPage.button : 'Weiter'}
          </span>
        </div>

        {(d.footer.text || d.footer.privacyUrl) && (
          <div className="pt-2 text-[11px]" style={{ color: d.colors.muted }}>
            {d.footer.text}
            {d.footer.privacyUrl && <span className="underline ml-1">Datenschutz</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Medienfeld + Mediathek -------------------- */

function MediaField({ label, value, onChange, folder }: { label: string; value: string; onChange: (v: string) => void; folder: string }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [lib, setLib] = useState<{ path: string; name: string }[] | null>(null);

  useEffect(() => { resolveMediaUrl(value).then(setPreview); }, [value]);

  async function onFile(f?: File | null) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error('Maximal 8 MB pro Datei'); return; }
    setBusy(true);
    try {
      const path = await uploadSurveyMedia(f, folder);
      onChange(path);
      toast.success('Bild hochgeladen');
    } catch (e: any) { toast.error(e?.message ?? 'Upload fehlgeschlagen'); }
    finally { setBusy(false); }
  }

  async function openLib() {
    if (lib) { setLib(null); return; }
    setLib(await listSurveyMedia(folder));
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
        className="rounded-xl border border-dashed border-border p-3 flex items-center gap-3"
      >
        <div className="h-14 w-20 rounded-lg bg-muted/40 grid place-items-center overflow-hidden shrink-0">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Bild-URL oder Datei hierher ziehen" className="h-8 text-xs" />
          <div className="flex gap-2">
            <label>
              <input type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs cursor-pointer hover:bg-muted/40">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Hochladen
              </span>
            </label>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={openLib}>Mediathek</Button>
            {value && <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange('')}><Trash2 className="h-3 w-3" /></Button>}
          </div>
        </div>
      </div>
      {lib && (
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-border p-2">
          {lib.length === 0 && <div className="col-span-4 text-xs text-muted-foreground p-2">Noch keine Bilder in dieser Mediathek.</div>}
          {lib.map(m => <LibItem key={m.path} item={m} onPick={() => { onChange(m.path); setLib(null); }} onDelete={async () => { await deleteSurveyMedia(m.path); setLib(await listSurveyMedia(folder)); }} />)}
        </div>
      )}
    </div>
  );
}

function LibItem({ item, onPick, onDelete }: { item: { path: string; name: string }; onPick: () => void; onDelete: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { resolveMediaUrl(item.path).then(setUrl); }, [item.path]);
  return (
    <div className="relative group">
      <button onClick={onPick} className="block h-16 w-full rounded-lg overflow-hidden border border-border hover:border-primary">
        {url ? <img src={url} alt={item.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-muted/40" />}
      </button>
      <button onClick={onDelete} aria-label="Bild löschen"
        className="absolute -top-1 -right-1 hidden group-hover:grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
