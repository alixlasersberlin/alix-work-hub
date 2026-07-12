import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Database, Search, Shield } from 'lucide-react';

type Row = {
  id: string;
  schema_name: string;
  table_name: string;
  classification: number;
  category: string | null;
  notes: string | null;
};

const CLASSES = [
  { level: 1, label: 'Öffentlich', color: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' },
  { level: 2, label: 'Intern', color: 'bg-sky-500/10 border-sky-500/40 text-sky-500' },
  { level: 3, label: 'Vertraulich', color: 'bg-amber-500/10 border-amber-500/40 text-amber-500' },
  { level: 4, label: 'Streng vertraulich', color: 'bg-red-500/10 border-red-500/40 text-red-500' },
];

export default function DataClasses() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (supabase as any).from('security_data_classification')
      .select('id, schema_name, table_name, classification, category, notes')
      .order('classification', { ascending: false })
      .then(({ data }: any) => { setRows(data ?? []); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.table_name.toLowerCase().includes(s) ||
      (r.category ?? '').toLowerCase().includes(s) ||
      (r.notes ?? '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  const byClass = (level: number) => filtered.filter(r => r.classification === level);
  const cls = (level: number) => CLASSES.find(c => c.level === level) ?? CLASSES[0];

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Database className="w-5 h-5" /> Datenklassifizierung</h2>
        <p className="text-xs text-muted-foreground">Visuelle Übersicht der klassifizierten Datenbereiche im System.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Noch keine Datenklassifizierungen erfasst. Nutzen Sie <code>public.security_data_classification</code>,
          um Tabellen den Stufen 1–4 zuzuordnen.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CLASSES.map(c => (
              <Card key={c.level} className={`p-3 ${c.color} border`}>
                <div className="text-xs uppercase opacity-80">Stufe {c.level}</div>
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-2xl font-bold mt-1">{rows.filter(r => r.classification === c.level).length}</div>
              </Card>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suche Tabelle / Kategorie / Notiz…" value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div className="space-y-4">
            {[4, 3, 2, 1].map(level => {
              const items = byClass(level);
              if (items.length === 0) return null;
              const c = cls(level);
              return (
                <div key={level}>
                  <h3 className="text-xs uppercase text-muted-foreground mb-2">{c.label} · Stufe {level} ({items.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map(r => (
                      <Card key={r.id} className={`p-3 ${c.color} border`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-sm truncate">{r.schema_name}.{r.table_name}</div>
                          {r.category && <Badge variant="outline" className="text-[10px]">{r.category}</Badge>}
                        </div>
                        {r.notes && <div className="text-xs mt-1 opacity-80 line-clamp-2">{r.notes}</div>}
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
