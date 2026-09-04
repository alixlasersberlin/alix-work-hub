import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Sparkles, AlertTriangle } from 'lucide-react';
import type { CapaAny, StepCheck } from '@/lib/capa/steps';
import { CAPA_STEPS } from '@/lib/capa/steps';

const MODES: { key: string; label: string }[] = [
  { key: 'summary', label: 'Reklamation zusammenfassen' },
  { key: 'missing', label: 'Fehlende Informationen & Nachweise' },
  { key: 'similar', label: 'Ähnliche Fälle bewerten' },
  { key: 'root_cause', label: 'Mögliche Root Causes' },
  { key: 'five_why', label: '5-Why vorbereiten' },
  { key: 'ishikawa', label: 'Ishikawa vorbereiten' },
  { key: 'actions', label: 'Maßnahmen vorschlagen' },
  { key: 'report', label: 'CAPA-Zusammenfassung' },
];

export function MagicCapaPanel({ capa, actions, checks }: { capa: CapaAny; actions: CapaAny[]; checks: StepCheck[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ mode: string; text: string } | null>(null);

  const openItems = checks.filter(c => !c.skipped && !c.complete);

  async function run(mode: string) {
    setBusy(mode);
    const { data, error } = await supabase.functions.invoke('capa-ai-assist', { body: { capa_id: capa.id, mode } });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? 'KI-Anfrage fehlgeschlagen');
      return;
    }
    setResult({ mode, text: (data as any).text ?? '' });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-semibold">MAGIC CAPA</h3>
          <Badge variant="outline" className="text-amber-500 border-amber-500/40">KI-VORSCHLAG – PRÜFUNG ERFORDERLICH</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Die KI unterstützt bei Analyse und Formulierung. Sie entscheidet nicht über Vigilanz, FSCA, Risikofreigabe,
          QMB-Freigabe oder den CAPA-Abschluss.
        </p>
        <div className="flex flex-wrap gap-2">
          {MODES.map(m => (
            <Button key={m.key} size="sm" variant="outline" disabled={!!busy} onClick={() => run(m.key)}>
              {busy === m.key ? 'Analysiere …' : m.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-amber-500" />Was fehlt aktuell?</div>
        {openItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alle Pflichtangaben der relevanten Schritte sind erfasst.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {openItems.map(c => (
              <li key={c.no}>
                <span className="font-medium">{c.no}. {CAPA_STEPS[c.no - 1].short}:</span>{' '}
                <span className="text-muted-foreground">{c.missing.slice(0, 4).join(', ')}{c.missing.length > 4 ? ' …' : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="text-xs text-muted-foreground">Maßnahmen erfasst: {actions.length}</div>
      </div>

      {result && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <Badge variant="outline" className="text-amber-500 border-amber-500/40">KI-VORSCHLAG – PRÜFUNG ERFORDERLICH</Badge>
          <Textarea rows={16} value={result.text} onChange={e => setResult({ ...result, text: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.text); toast.success('In Zwischenablage kopiert'); }}>
              Kopieren
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Verwerfen</Button>
          </div>
        </div>
      )}
    </div>
  );
}
