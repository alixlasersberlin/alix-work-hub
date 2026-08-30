import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  /** Sprechender Feldname, z. B. "Kurzbeschreibung der Smart-KI-Funktion" */
  fieldLabel: string;
  /** Aktueller Inhalt – wird ggf. verbessert statt neu erfunden */
  current?: string;
  /** Zusatzhinweis für die KI */
  hint?: string;
  maxChars?: number;
  productId?: string;
  context?: Record<string, unknown>;
  disabled?: boolean;
  className?: string;
  onGenerated: (text: string) => void;
}

/** Kleiner KI-Button, der den Inhalt eines einzelnen Feldes erzeugt. */
export function AiFieldButton({
  fieldLabel, current, hint, maxChars = 300, productId, context, disabled, className, onGenerated,
}: Props) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ph-ai-field', {
        body: { fieldLabel, current, hint, maxChars, productId, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.text) throw new Error('Keine Antwort erhalten');
      onGenerated(String(data.text));
      toast.success('Inhalt mit KI erzeugt');
    } catch (e: any) {
      toast.error(e?.message ?? 'KI-Generierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={className ?? 'h-8 w-8 shrink-0'}
          disabled={disabled || loading}
          onClick={run}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4 text-primary" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Mit KI erzeugen</TooltipContent>
    </Tooltip>
  );
}
