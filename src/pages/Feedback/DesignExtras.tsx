import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Trash2, Loader2, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SurveyDesign, mergeDesign, DEFAULT_DESIGN } from '@/lib/feedback/design';

/** Eigene Design-Vorlagen speichern / anwenden / löschen. */
export function DesignTemplates({ design, onApply }: { design: SurveyDesign; onApply: (d: SurveyDesign) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await (supabase as any)
      .from('survey_design_templates')
      .select('id, name, description, design, is_system')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!name.trim()) { toast.error('Bitte einen Namen vergeben'); return; }
    setBusy(true);
    const { error } = await (supabase as any).from('survey_design_templates').insert({
      name: name.trim(), design: design as any, category: 'eigene', is_system: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(''); toast.success('Design-Vorlage gespeichert'); load();
  }

  async function remove(id: string) {
    if (!confirm('Vorlage löschen?')) return;
    const { error } = await (supabase as any)
      .from('survey_design_templates').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Eigene Vorlagen</h3>
      <div className="flex gap-2">
        <Input placeholder="Name der Vorlage (z. B. ALIX Standard 2026)" value={name} onChange={e => setName(e.target.value)} />
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-1 hidden sm:inline">Speichern</span>
        </Button>
      </div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Noch keine eigenen Vorlagen gespeichert.</p>}
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
            <div className="h-8 w-12 rounded border border-border/60 shrink-0" style={{
              background: `linear-gradient(135deg, ${mergeDesign(r.design).colors.bg}, ${mergeDesign(r.design).colors.surface})`,
            }}>
              <div className="h-1.5 w-5 m-1.5 rounded-full" style={{ background: mergeDesign(r.design).colors.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{r.name}</div>
              {r.description && <div className="text-[11px] text-muted-foreground truncate">{r.description}</div>}
            </div>
            <Button size="sm" variant="outline" onClick={() => { onApply(mergeDesign(r.design)); toast.success('Vorlage angewendet'); }}>
              <Download className="h-4 w-4 mr-1" />Anwenden
            </Button>
            {!r.is_system && (
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

/** KI-Design-Assistent: erzeugt aus einem Wunschtext eine Design-Konfiguration. */
export function DesignAiAssistant({ design, onApply }: { design: SurveyDesign; onApply: (d: SurveyDesign) => void }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!prompt.trim()) { toast.error('Bitte Wunsch beschreiben'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-center-chat', {
        body: {
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Du bist ein UI-Designer für Online-Umfragen. Antworte ausschließlich mit JSON, das diesem Schema entspricht: ' +
                JSON.stringify({
                  layout: 'card|fullscreen|split|minimal|chat',
                  font: 'system|inter|dmsans|manrope|playfair|lora|spacegrotesk',
                  radius: 0,
                  shadow: 'none|soft|strong',
                  buttonStyle: 'solid|outline|pill',
                  progress: 'bar|dots|steps|none',
                  animation: 'slide|fade|zoom|none',
                  colors: { bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#999999', primary: '#c9a227', primaryText: '#000000', border: '#222222' },
                  background: { type: 'solid|gradient|image', gradientFrom: '#000000', gradientTo: '#111111', angle: 135 },
                }) +
                ' Achte auf starke Lesbarkeit und ausreichenden Kontrast (WCAG AA). Keine Erklärungen.',
            },
            { role: 'user', content: `Aktuelles Design: ${JSON.stringify({ layout: design.layout, colors: design.colors, font: design.font })}\nWunsch: ${prompt}` },
          ],
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const raw = String((data as any)?.content ?? '').replace(/```json|```/g, '').trim();
      const patch = JSON.parse(raw);
      onApply(mergeDesign({ ...design, ...patch, theme: 'custom' }));
      toast.success('KI-Designvorschlag übernommen');
    } catch (e: any) {
      toast.error(e?.message ?? 'KI-Vorschlag fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />KI-Design-Assistent
      </h3>
      <Textarea
        rows={2}
        placeholder="z. B. „modern, hell, medizinisch, blaue Akzente, große runde Buttons“"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {['Premium dunkel mit Gold', 'Hell & medizinisch', 'Verspielt bunt', 'Sehr minimalistisch'].map(p => (
          <Button key={p} size="sm" variant="outline" onClick={() => setPrompt(p)}>{p}</Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}Design erzeugen
        </Button>
        <Button variant="ghost" onClick={() => onApply({ ...DEFAULT_DESIGN })}>Standard</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Der Vorschlag ersetzt Farben, Layout und Typografie — Medien, Texte und Fußzeile bleiben erhalten.</p>
    </CardContent></Card>
  );
}

/** Kleines Kontrast-Warnsystem (WCAG-Annäherung). */
export function ContrastHint({ design }: { design: SurveyDesign }) {
  const pairs: [string, string, string][] = [
    ['Text auf Karte', design.colors.text, design.colors.surface],
    ['Sekundärtext auf Karte', design.colors.muted, design.colors.surface],
    ['Button-Schrift auf Akzent', design.colors.primaryText, design.colors.primary],
  ];
  const bad = pairs.filter(([, a, b]) => contrast(a, b) < 4.5);
  if (bad.length === 0) return null;
  return (
    <Card className="border-amber-500/40"><CardContent className="p-4 space-y-1">
      <div className="text-sm font-medium text-amber-500">Kontrast prüfen</div>
      {bad.map(([label, a, b]) => (
        <div key={label} className="text-xs text-muted-foreground">
          {label}: Kontrast {contrast(a, b).toFixed(1)}:1 (empfohlen ≥ 4.5:1)
        </div>
      ))}
    </CardContent></Card>
  );
}

function lum(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return 0;
  const c = [1, 2, 3].map(i => {
    const v = parseInt(m[i], 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Label-Export für externe Nutzung. */
export const DESIGN_EXTRAS_LABEL = Label;
