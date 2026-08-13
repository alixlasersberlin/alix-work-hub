import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { mobilSearch, KIND_LABEL, type MobilHit } from '@/lib/mobil/search';
import { AddressCard } from './Adressen';

export default function MobilSuche() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [hits, setHits] = useState<MobilHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        setHits(await mobilSearch(q));
      } catch (e: any) {
        setError(e?.message ?? 'Keine Verbindung – bitte erneut versuchen.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const groups = useMemo(() => {
    const order: MobilHit['kind'][] = ['kunde', 'auftrag', 'geraet', 'reparatur', 'tour'];
    return order
      .map((k) => [k, hits.filter((h) => h.kind === k)] as const)
      .filter(([, arr]) => arr.length > 0);
  }, [hits]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><Search className="w-5 h-5" /> Suche</h1>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kunde, Adresse, Auftrag, Gerät, SN, Reparatur, Tour…"
          className="pl-9 h-12 text-base"
        />
      </div>

      {loading && <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {error && <Card className="p-4 text-sm text-destructive">{error}</Card>}
      {!loading && !error && q.trim().length >= 2 && groups.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Treffer.</Card>
      )}

      {groups.map(([kind, arr]) => (
        <div key={kind} className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2">{KIND_LABEL[kind]}</div>
          {arr.map((h) => <AddressCard key={`${h.kind}-${h.id}`} hit={h} />)}
        </div>
      ))}
    </div>
  );
}
