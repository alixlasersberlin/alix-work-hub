import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FeedbackHeader, Kpi } from './_shared';
import { Quote, Copy, Check, X, Globe } from 'lucide-react';
import { toast } from 'sonner';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-testimonials-public`;

export default function FeedbackTestimonials() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await (supabase as any).from('survey_testimonials')
      .select('*').order('created_at', { ascending: false }).limit(500);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, values: Record<string, unknown>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...values } : r));
    const { error } = await (supabase as any).from('survey_testimonials').update(values).eq('id', id);
    if (error) toast.error(error.message);
  }

  const published = rows.filter(r => r.status === 'freigegeben' && r.published_at);
  const filtered = useMemo(
    () => rows.filter(r => !q || `${r.quote} ${r.author_name ?? ''} ${r.company_name ?? ''}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const embed = `<div id="alix-testimonials"></div>
<script src="${FN_URL}?format=js&limit=6&accent=%23c9a227&interval=6000" async></script>`;

  const embedJson = `<div id="alix-testimonials"></div>
<script>
fetch("${FN_URL}?limit=6").then(r=>r.json()).then(d=>{
  document.getElementById("alix-testimonials").innerHTML =
    (d.items||[]).map(t=>'<blockquote style="margin:0 0 1rem;padding:1rem;border-left:3px solid #c9a227">'
      + t.quote + '<footer style="opacity:.7;font-size:.85em;margin-top:.5rem">'
      + [t.author,t.company].filter(Boolean).join(', ') + '</footer></blockquote>').join("");
});
</script>`;


  return (
    <div className="space-y-5">
      <FeedbackHeader title="Testimonials & Widget" subtitle="Freigegebene Kundenstimmen für Website und Marketing" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Kundenstimmen gesamt" value={rows.length} icon={Quote} />
        <Kpi label="Veröffentlicht" value={published.length} icon={Globe} tone="green" />
        <Kpi label="Wartet auf Freigabe" value={rows.filter(r => r.status !== 'freigegeben').length} icon={Check} tone="amber" />
      </div>

      <Card><CardContent className="p-5 space-y-3">
        <Label>Website-Einbettung – Carousel (empfohlen)</Label>
        <p className="text-xs text-muted-foreground">Fertiges Slider-Design mit Autoplay, Punkten und Akzentfarbe – einfach einfügen.</p>
        <Textarea readOnly rows={3} value={embed} className="font-mono text-xs" />
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(embed); toast.success('Carousel-Code kopiert'); }}>
          <Copy className="h-4 w-4 mr-2" />Carousel-Code kopieren
        </Button>
        <div className="pt-3 border-t border-border space-y-3">
          <Label>Alternative: eigene Gestaltung (JSON-Ausgabe)</Label>
          <Textarea readOnly rows={8} value={embedJson} className="font-mono text-xs" />
          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(embedJson); toast.success('Code kopiert'); }}>
            <Copy className="h-4 w-4 mr-2" />JSON-Code kopieren
          </Button>
        </div>
      </CardContent></Card>


      <Input placeholder="Suche in Kundenstimmen …" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className={t.status === 'freigegeben' ? 'border-emerald-500/30 text-emerald-400' : ''}>
                  {t.status}
                </Badge>
                {t.published_at && <span className="text-xs text-muted-foreground">veröffentlicht {new Date(t.published_at).toLocaleDateString('de-DE')}</span>}
              </div>
              <p className="text-sm italic">„{t.quote}"</p>
              <p className="text-xs text-muted-foreground">
                {[t.allow_name ? t.author_name : 'anonym', t.allow_company ? t.company_name : null].filter(Boolean).join(' · ')}
              </p>
              <div className="flex gap-2">
                {t.status !== 'freigegeben' && (
                  <Button size="sm" onClick={() => patch(t.id, { status: 'freigegeben' })}>
                    <Check className="h-4 w-4 mr-1" />Freigeben
                  </Button>
                )}
                {t.status === 'freigegeben' && !t.published_at && (
                  <Button size="sm" onClick={() => patch(t.id, { published_at: new Date().toISOString() })}>
                    <Globe className="h-4 w-4 mr-1" />Veröffentlichen
                  </Button>
                )}
                {t.published_at && (
                  <Button size="sm" variant="outline" onClick={() => patch(t.id, { published_at: null })}>
                    <X className="h-4 w-4 mr-1" />Zurückziehen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Keine Kundenstimmen gefunden.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
