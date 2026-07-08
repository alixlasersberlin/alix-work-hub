import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CalendarClock, Clock, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useAiSuggestions } from '@/hooks/esc/useAiSuggestions';
import { SuggestionCard, EmptySuggestions } from '@/components/esc/ai/SuggestionCard';

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[12px] font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-primary/70" />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}

export default function AiDashboard() {
  const { open, act } = useAiSuggestions();
  const groups = useMemo(() => ({
    critical: open.filter((s) => s.priority === 'critical' || s.priority === 'high'),
    medium:   open.filter((s) => s.priority === 'medium'),
    info:     open.filter((s) => s.priority === 'low' || s.priority === 'info'),
  }), [open]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">AI Dashboard</h1>
        <span className="text-[11px] text-muted-foreground ml-2">Alle Vorschläge sind Empfehlungen – Entscheidungen bleiben bei Ihnen.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={AlertTriangle} label="Kritisch / Hoch" value={groups.critical.length} />
        <Kpi icon={Clock} label="Mittel" value={groups.medium.length} />
        <Kpi icon={TrendingUp} label="Info / Niedrig" value={groups.info.length} />
        <Kpi icon={CalendarClock} label="Offene Vorschläge" value={open.length} />
      </div>

      {open.length === 0 ? <EmptySuggestions /> : (
        <div className="space-y-4">
          {(['critical', 'medium', 'info'] as const).map((g) => groups[g].length > 0 && (
            <div key={g} className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {g === 'critical' ? 'Handlungsbedarf' : g === 'medium' ? 'Empfehlung' : 'Hinweis'}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {groups[g].map((s) => <SuggestionCard key={s.id} s={s} onAct={act} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
