import { useAiSuggestions } from '@/hooks/esc/useAiSuggestions';
import { SuggestionCard, EmptySuggestions } from '@/components/esc/ai/SuggestionCard';
import { Boxes } from 'lucide-react';

export default function AiResources() {
  const { open, act } = useAiSuggestions();
  const items = open.filter((s) => s.kind === 'resource' || s.kind === 'capacity');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Ressourcenoptimierung</h1>
      </div>
      {items.length === 0 ? <EmptySuggestions /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((s) => <SuggestionCard key={s.id} s={s} onAct={act} />)}
        </div>
      )}
    </div>
  );
}
