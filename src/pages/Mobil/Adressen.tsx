import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Navigation, Phone, User, ClipboardList, Cpu, MapPin } from 'lucide-react';
import { mobilSearch, type MobilHit } from '@/lib/mobil/search';
import { mapsHref, telHref, cacheGet, cacheSet } from '@/lib/mobil/utils';
import { toast } from 'sonner';

export default function MobilAdressen() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<MobilHit[]>(cacheGet<MobilHit[]>('lastAddresses') ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await mobilSearch(q);
        const withAddr = r.filter((h) => h.kind === 'kunde' || h.address);
        setHits(withAddr);
        cacheSet('lastAddresses', withAddr.slice(0, 20));
      } catch (e: any) {
        setError(e?.message ?? 'Keine Verbindung – bitte erneut versuchen.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = useMemo(() => hits.slice(0, 40), [hits]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="w-5 h-5" /> Adressen suchen</h1>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, Firma, Straße, PLZ, Ort, Telefon, Auftrag…"
          className="pl-9 h-12 text-base"
        />
      </div>

      {loading && <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {error && <Card className="p-4 text-sm text-destructive">{error}</Card>}
      {!loading && !error && q.trim().length >= 2 && list.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Treffer.</Card>
      )}

      {list.map((h) => (
        <AddressCard key={`${h.kind}-${h.id}`} hit={h} />
      ))}
    </div>
  );
}

export function AddressCard({ hit }: { hit: MobilHit }) {
  const tel = telHref(hit.phone);
  return (
    <Card className="p-4 space-y-3">
      <div>
        <div className="text-base font-bold leading-tight">{hit.title}</div>
        {hit.subtitle && <div className="text-sm text-muted-foreground">{hit.subtitle}</div>}
        {hit.address && <div className="text-sm mt-1">{hit.address}</div>}
        {hit.phone && <div className="text-sm text-muted-foreground">Telefon: {hit.phone}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="h-12" disabled={!hit.address}>
          <a href={hit.address ? mapsHref(hit.address) : undefined}>
            <Navigation className="w-4 h-4 mr-1" /> Navigation
          </a>
        </Button>
        <Button asChild variant="outline" className="h-12" disabled={!tel}>
          <a href={tel}><Phone className="w-4 h-4 mr-1" /> Anrufen</a>
        </Button>
        {hit.customerId && (
          <Button asChild variant="outline" className="h-12">
            <Link to={`/customers/${hit.customerId}`}><User className="w-4 h-4 mr-1" /> Kunde</Link>
          </Button>
        )}
        {hit.orderNumber && (
          <Button asChild variant="outline" className="h-12">
            <Link to={`/mobil/suche?q=${encodeURIComponent(hit.orderNumber)}`}>
              <ClipboardList className="w-4 h-4 mr-1" /> Auftrag
            </Link>
          </Button>
        )}
        {hit.serial && (
          <Button variant="outline" className="h-12" onClick={() => { navigator.clipboard?.writeText(hit.serial!); toast.success('Seriennummer kopiert'); }}>
            <Cpu className="w-4 h-4 mr-1" /> {hit.serial}
          </Button>
        )}
      </div>
    </Card>
  );
}
