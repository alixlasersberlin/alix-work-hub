import { useState } from 'react';
import { Loader2, Sparkles, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export type AiMode = 'draft' | 'improve' | 'shorten' | 'expand' | 'check';

const MODES: { mode: AiMode; label: string }[] = [
  { mode: 'draft', label: 'Vorschlag' },
  { mode: 'improve', label: 'Verbessern' },
  { mode: 'shorten', label: 'Kürzen' },
  { mode: 'expand', label: 'Ergänzen' },
  { mode: 'check', label: 'Prüfen' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  taskId?: string;
  stepId?: string;
  hint?: string;
  disabled?: boolean;
  /** 'check' liefert Hinweise statt Feldinhalt – Ergebnis wird nur angezeigt. */
  modes?: AiMode[];
}

export default function AiAssistField({ value, onChange, taskId, stepId, hint, disabled, modes }: Props) {
  const [busy, setBusy] = useState<AiMode | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const run = async (mode: AiMode) => {
    setBusy(mode);
    setNotes(null);
    try {
      const { data, error } = await supabase.functions.invoke('compliance-ai-assist', {
        body: { mode, task_id: taskId, step_id: stepId, hint, text: value },
      });
      const payload: any = data;
      if (error || payload?.error) throw new Error(payload?.error || error?.message || 'KI nicht erreichbar');
      const text: string = payload.text;
      if (mode === 'check') {
        setNotes(text);
      } else {
        setPrevious(value);
        onChange(text);
        toast.success('KI-Vorschlag übernommen – bitte fachlich prüfen.');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const list = MODES.filter((m) => !modes || modes.includes(m.mode));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> KI
        </span>
        {list.map((m) => (
          <Button
            key={m.mode}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={disabled || busy !== null || (m.mode !== 'draft' && !value.trim())}
            onClick={() => run(m.mode)}
          >
            {busy === m.mode ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            {m.label}
          </Button>
        ))}
        {previous !== null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            disabled={disabled}
            onClick={() => { onChange(previous); setPrevious(null); }}
          >
            <Undo2 className="w-3 h-3 mr-1" /> Rückgängig
          </Button>
        )}
      </div>
      {notes && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px] whitespace-pre-wrap">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">KI-Prüfhinweise</div>
          {notes}
        </div>
      )}
    </div>
  );
}
