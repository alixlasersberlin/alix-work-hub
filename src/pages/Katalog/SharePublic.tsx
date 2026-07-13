import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, Package, X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

const SUPA = import.meta.env.VITE_SUPABASE_URL;

interface Payload {
  item: { sku: string; name: string; brand: string | null; model: string | null };
  description: { short_text?: string; long_text?: string; technical_text?: string; warranty_text?: string; scope_text?: string } | null;
  images: string[];
  price: { uvp_net?: number; uvp_gross?: number; sale_net?: number; sale_gross?: number; tax_rate?: number } | null;
  language: string;
}

export default function CatalogSharePublic() {
  const { token } = useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPA}/functions/v1/catalog-share-resolve?token=${encodeURIComponent(token ?? '')}`);
        const j = await res.json();
        if (!res.ok) { setError(j.error ?? 'error'); return; }
        setData(j);
      } catch {
        setError('network');
      } finally { setLoading(false); }
    })();
  }, [token]);

  useEffect(() => {
    if (lightbox === null || !data) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? 0 : (i + 1) % data.images.length));
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? 0 : (i - 1 + data.images.length) % data.images.length));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, data]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error || !data) {
    const msg = error === 'expired' ? 'Dieser Link ist abgelaufen.'
      : error === 'revoked' ? 'Dieser Link wurde widerrufen.'
      : error === 'not_found' ? 'Link nicht gefunden.'
      : 'Artikel nicht verfügbar.';
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <Card className="p-8 max-w-md text-center space-y-2">
          <Package className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">{msg}</h1>
          <p className="text-sm text-muted-foreground">Bitte wenden Sie sich an Ihren Ansprechpartner.</p>
        </Card>
      </div>
    );
  }

  const { item, description, images, price } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="text-lg font-bold tracking-tight">AlixWork</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Drucken / PDF
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
          {(item.brand || item.model) && (
            <p className="text-muted-foreground mt-1">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((src, i) => (
              <button key={i} type="button" onClick={() => setLightbox(i)} className="group relative overflow-hidden rounded-md border">
                <img src={src} alt={`${item.name} – Bild ${i + 1}`} loading="lazy" className="object-cover w-full aspect-square transition group-hover:scale-105" />
              </button>
            ))}
          </div>
        )}

        {description?.short_text && (
          <Card className="p-6"><p className="text-lg">{description.short_text}</p></Card>
        )}

        {price && (
          <Card className="p-6">
            <h2 className="font-semibold mb-3">Preis</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {price.uvp_net != null && <div><div className="text-muted-foreground">UVP netto</div><div className="text-lg font-semibold">{Number(price.uvp_net).toFixed(2)}</div></div>}
              {price.uvp_gross != null && <div><div className="text-muted-foreground">UVP brutto</div><div className="text-lg font-semibold">{Number(price.uvp_gross).toFixed(2)}</div></div>}
              {price.tax_rate != null && <div className="col-span-2 text-xs text-muted-foreground">inkl. {Number(price.tax_rate)}% MwSt</div>}
            </div>
          </Card>
        )}

        {description?.long_text && <SectionCard title="Beschreibung" text={description.long_text} />}
        {description?.technical_text && <SectionCard title="Technische Daten" text={description.technical_text} />}
        {description?.scope_text && <SectionCard title="Lieferumfang" text={description.scope_text} />}
        {description?.warranty_text && <SectionCard title="Garantie" text={description.warranty_text} />}
      </main>

      <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground space-y-1 print:hidden">
        <div>AlixWork · Katalog</div>
        <div className="max-w-2xl mx-auto px-4">
          Dieser Link ist personalisiert und zeitlich begrenzt. Die Aufrufe werden zur Missbrauchsprävention protokolliert (Zeitpunkt, Zähler).
          Keine Weitergabe personenbezogener Daten an Dritte. Bei Fragen wenden Sie sich an Ihren Ansprechpartner.
        </div>
      </footer>

      <Dialog open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black/95 border-0">
          {lightbox !== null && (
            <div className="relative">
              <img src={images[lightbox]} alt={item.name} className="w-full max-h-[85vh] object-contain" />
              <button onClick={() => setLightbox(null)} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><X className="h-4 w-4" /></button>
              {images.length > 1 && (
                <>
                  <button onClick={() => setLightbox((lightbox - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronLeft className="h-5 w-5" /></button>
                  <button onClick={() => setLightbox((lightbox + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronRight className="h-5 w-5" /></button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/60 px-2 py-1 rounded">{lightbox + 1} / {images.length}</div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-6 space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </Card>
  );
}
