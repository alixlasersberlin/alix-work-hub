import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Loader2, Package } from 'lucide-react';

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPA}/functions/v1/catalog-share-resolve?token=${encodeURIComponent(token ?? '')}`);
        const j = await res.json();
        if (!res.ok) { setError(j.error ?? 'error'); return; }
        setData(j);
      } catch (e: any) {
        setError('network');
      } finally { setLoading(false); }
    })();
  }, [token]);

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
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="text-lg font-bold tracking-tight">AlixWork</div>
          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
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
              <img key={i} src={src} alt={item.name} className="rounded-md border object-cover w-full aspect-square" />
            ))}
          </div>
        )}

        {description?.short_text && (
          <Card className="p-6">
            <p className="text-lg">{description.short_text}</p>
          </Card>
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

        {description?.long_text && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Beschreibung</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{description.long_text}</p>
          </Card>
        )}
        {description?.technical_text && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Technische Daten</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{description.technical_text}</p>
          </Card>
        )}
        {description?.scope_text && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Lieferumfang</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{description.scope_text}</p>
          </Card>
        )}
        {description?.warranty_text && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Garantie</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{description.warranty_text}</p>
          </Card>
        )}
      </main>
      <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
        AlixWork · Katalog
      </footer>
    </div>
  );
}
