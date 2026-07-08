import { useAiSuggestions } from '@/hooks/esc/useAiSuggestions';
import { SuggestionCard, EmptySuggestions } from '@/components/esc/ai/SuggestionCard';
import { Map } from 'lucide-react';

export default function AiRoutes() {
  const { open, act } = useAiSuggestions();
  const items = open.filter((s) => s.kind === 'route');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Tourenoptimierung</h1>
        <span className="text-[11px] text-muted-foreground ml-2">Änderungen werden erst nach Bestätigung übernommen.</span>
      </div>
      {items.length === 0 ? <EmptySuggestions /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((s) => <SuggestionCard key={s.id} s={s} onAct={act} />)}
        </div>
      )}
    </div>
  );
}
