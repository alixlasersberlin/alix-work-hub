import { useAiSuggestions } from '@/hooks/esc/useAiSuggestions';
import { SuggestionCard, EmptySuggestions } from '@/components/esc/ai/SuggestionCard';
import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiSuggestionKind } from '@/lib/esc/ai/types';

const KIND_LABEL: Record<AiSuggestionKind, string> = {
  schedule: 'Termine', resource: 'Ressourcen', route: 'Touren', capacity: 'Kapazität',
  no_show: 'No-Show', follow_up: 'Follow-up', service: 'Service', training: 'Schulung', reminder: 'Erinnerungen',
};

export default function AiRecommendations() {
  const { open, act } = useAiSuggestions();
  const byKind = open.reduce<Record<string, typeof open>>((acc, s) => {
    (acc[s.kind] = acc[s.kind] ?? []).push(s); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Empfehlungen</h1>
      </div>
      {open.length === 0 && <EmptySuggestions />}
      {Object.entries(byKind).map(([k, list]) => (
        <Card key={k}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{KIND_LABEL[k as AiSuggestionKind] ?? k}</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((s) => <SuggestionCard key={s.id} s={s} onAct={act} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
