import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { runAiSearch, type AiSearchResult } from '@/lib/esc/ai/search';

const EXAMPLES = [
  'Zeige alle freien Servicetechniker nächste Woche in Berlin',
  'Welche Schulungsräume sind morgen verfügbar?',
  'Welche Vorführgeräte sind im August frei?',
];

export default function AiSearch() {
  const { appointments } = useAppointments();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<AiSearchResult | null>(null);

  const run = (query: string) => {
    setQ(query);
    setRes(runAiSearch(query, appointments));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SearchIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Intelligente Suche</h1>
      </div>
      <Card>
        <CardContent className="p-3 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. freie Servicetechniker nächste Woche in Berlin" onKeyDown={(e) => e.key === 'Enter' && run(q)} />
          <Button onClick={() => run(q)}>Suchen</Button>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => run(ex)} className="text-[11.5px] px-2 py-1 rounded-md border border-border/60 hover:bg-primary/10 text-muted-foreground">{ex}</button>
        ))}
      </div>
      {res && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{res.intent}</CardTitle>
            <div className="text-[11px] text-muted-foreground">{res.explanation}</div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            {res.rows.length === 0 && <div className="text-[12px] text-muted-foreground py-2">Keine Treffer.</div>}
            {res.rows.map((r) => (
              <div key={r.id} className="py-1.5 flex justify-between text-[12.5px]">
                <span>{r.name}</span>
                <span className="text-muted-foreground text-[11.5px]">{r.hint}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
