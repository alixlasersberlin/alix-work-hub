import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';

export interface SeoAiResult {
  seo_title: string;
  meta_description: string;
  h1: string;
  main_keyword: string;
  secondary_keywords: string[];
  og_title: string;
  og_description: string;
  url_slug: string;
}

interface Props {
  productId?: string;
  channel?: string;
  /** Bisherige SEO-Daten – die KI verbessert sie statt neu zu erfinden */
  current?: Record<string, unknown>;
  disabled?: boolean;
  label?: string;
  onApply: (result: SeoAiResult) => void;
}

/** Erzeugt per KI ein komplettes SEO-Paket (Titel, Description, Keywords, OG) mit Vorschau. */
export function SeoAiButton({ productId, channel, current, disabled, label = 'SEO mit KI erzeugen', onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SeoAiResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ph-ai-seo', {
        body: { productId, channel, current },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as SeoAiResult);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? 'SEO-Generierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const Row = ({ title, value }: { title: string; value: string }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{title}</Label>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={disabled || loading} onClick={run}>
        {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1 text-primary" />}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>KI-SEO-Vorschlag</DialogTitle></DialogHeader>
          {result && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <Row title={`SEO Titel (${result.seo_title?.length ?? 0} Zeichen)`} value={result.seo_title} />
              <Row title={`Meta Description (${result.meta_description?.length ?? 0} Zeichen)`} value={result.meta_description} />
              <Row title="H1" value={result.h1} />
              <Row title="URL Slug" value={result.url_slug} />
              <Row title="Hauptkeyword" value={result.main_keyword} />
              <div>
                <Label className="text-xs text-muted-foreground">Nebenkeywords</Label>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(result.secondary_keywords || []).map(k => (
                    <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                  ))}
                  {(result.secondary_keywords || []).length === 0 && <span className="text-sm">—</span>}
                </div>
              </div>
              <Row title="OpenGraph Titel" value={result.og_title} />
              <Row title="OpenGraph Beschreibung" value={result.og_description} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Verwerfen</Button>
            <Button
              onClick={() => { if (result) { onApply(result); setOpen(false); toast.success('SEO-Vorschlag übernommen – bitte speichern'); } }}
            >Übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
