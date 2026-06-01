import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Section, BUG_STATUS, CAPA_STATUS } from './_shared';

export default function Berichte() {
  const [bugs, setBugs] = useState<Record<string, number>>({});
  const [capas, setCapas] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [b, c] = await Promise.all([
        sb.from('bugs').select('status'),
        sb.from('capas').select('status'),
      ]);
      const bag = (rows: any[] | null) => (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      setBugs(bag(b.data));
      setCapas(bag(c.data));
    })();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Bugs nach Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {BUG_STATUS.map(s => (
            <div key={s} className="flex justify-between border-b border-border pb-1">
              <span className="text-sm">{s.replace(/_/g, ' ')}</span>
              <span className="font-mono font-medium">{bugs[s] ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>CAPA nach Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {CAPA_STATUS.map(s => (
            <div key={s} className="flex justify-between border-b border-border pb-1">
              <span className="text-sm">{s.replace(/_/g, ' ')}</span>
              <span className="font-mono font-medium">{capas[s] ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Hinweis</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Diese Übersicht ist eine erste Auswertung. Erweiterte Berichte (CSV-Export, Zeitreihen, Verantwortlichkeiten) können bei Bedarf ergänzt werden.
        </CardContent>
      </Card>
    </div>
  );
}
