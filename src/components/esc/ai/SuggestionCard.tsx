import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Sparkles, XCircle } from 'lucide-react';
import type { AiSuggestion } from '@/lib/esc/ai/types';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES: Record<AiSuggestion['priority'], string> = {
  critical: 'text-red-500 border-red-500/40',
  high:     'text-orange-500 border-orange-500/40',
  medium:   'text-amber-500 border-amber-500/40',
  low:      'text-primary border-primary/30',
  info:     'text-muted-foreground border-border',
};

export function SuggestionCard({ s, onAct }: { s: AiSuggestion; onAct: (id: string, action: 'accepted' | 'dismissed') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={cn('border', PRIORITY_STYLES[s.priority])}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <CardTitle className="text-[13.5px] font-semibold">{s.title}</CardTitle>
          <Badge variant="outline" className="ml-auto text-[10px] uppercase">{s.priority}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-[12.5px] text-foreground/85">{s.reason}</div>
        <div className="text-[11.5px] text-muted-foreground flex items-start gap-1">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{s.benefit}</span>
        </div>
        {open && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Datengrundlage</div>
            {s.evidence.map((e, i) => (
              <div key={i} className="text-[12px] flex justify-between gap-2">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-mono">{String(e.value ?? '—')}</span>
              </div>
            ))}
            <div className="text-[10px] text-muted-foreground/80 pt-1">Konfidenz: {(s.confidence * 100).toFixed(0)}%</div>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          {s.status === 'open' ? (
            <>
              <Button size="sm" onClick={() => onAct(s.id, 'accepted')} className="h-7 px-2.5 text-[12px]">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Übernehmen
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAct(s.id, 'dismissed')} className="h-7 px-2.5 text-[12px]">
                <XCircle className="w-3.5 h-3.5 mr-1" />Ignorieren
              </Button>
            </>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              {s.status === 'accepted' ? 'Übernommen' : s.status === 'dismissed' ? 'Ignoriert' : 'Abgelaufen'}
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} className="h-7 px-2 text-[12px] ml-auto">
            {open ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptySuggestions() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground text-[13px]">
        <AlertTriangle className="w-5 h-5 mx-auto mb-2 opacity-60" />
        Keine Empfehlungen aktuell – alle Daten unauffällig.
      </CardContent>
    </Card>
  );
}
