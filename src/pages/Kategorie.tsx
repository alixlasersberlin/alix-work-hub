import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, FolderTree, ChevronRight, Package } from 'lucide-react';

type ZohoItem = {
  id: string;
  name: string | null;
  sku: string | null;
  category_name: string | null;
  brand: string | null;
  status: string | null;
};

export default function Kategorie() {
  const { toast } = useToast();
  const [items, setItems] = useState<ZohoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('zoho_items')
        .select('id,name,sku,category_name,brand,status')
        .order('category_name', { ascending: true })
        .order('name', { ascending: true })
        .limit(5000);
      if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setItems((data as ZohoItem[]) ?? []);
      setLoading(false);
    })();
  }, [toast]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ZohoItem[]>();
    for (const it of items) {
      if (q) {
        const hay = `${it.name ?? ''} ${it.sku ?? ''} ${it.category_name ?? ''} ${it.brand ?? ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const key = it.category_name?.trim() || 'Ohne Kategorie';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'de'));
  }, [items, query]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
          <FolderTree className="w-6 h-6" /> Kategorie
        </h1>
        <p className="text-sm text-muted-foreground">Artikel gruppiert nach Kategorie.</p>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, SKU, Kategorie, Marke..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Keine Artikel gefunden.</Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([cat, list]) => {
            const open = openCat === cat;
            return (
              <Card key={cat} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenCat(open ? null : cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="font-medium">{cat}</span>
                  </div>
                  <Badge variant="secondary">{list.length}</Badge>
                </button>
                {open && (
                  <div className="border-t border-border divide-y divide-border">
                    {list.map((it) => (
                      <Link
                        key={it.id}
                        to="/verkauf/artikel"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/20"
                      >
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{it.name ?? '–'}</span>
                        <span className="font-mono text-xs text-muted-foreground">{it.sku ?? ''}</span>
                        {it.brand && <Badge variant="outline" className="text-xs">{it.brand}</Badge>}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
