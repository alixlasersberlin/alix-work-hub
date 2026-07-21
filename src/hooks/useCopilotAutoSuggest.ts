import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Debounced Ghost-Text-Vorschlag für ein Composer-Feld.
 * Ruft `ac-copilot` (suggestion_type=autocomplete) auf, sobald der User pausiert.
 */
export function useCopilotAutoSuggest(opts: {
  text: string;
  contextId?: string | null;
  contextType?: "chat" | "email" | "ticket";
  enabled?: boolean;
  minLength?: number;
  debounceMs?: number;
}) {
  const {
    text,
    contextId,
    contextType = "chat",
    enabled = true,
    minLength = 8,
    debounceMs = 700,
  } = opts;

  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled || text.trim().length < minLength) {
      setSuggestion("");
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ac-copilot", {
          body: {
            suggestion_type: "autocomplete",
            context_type: contextType,
            context_id: contextId ?? null,
            input: text,
          },
        });
        if (my !== seq.current) return;
        if (error) throw error;
        const raw = String(data?.content ?? "").trim();
        // Vermeide Wiederholung des begonnenen Satzes
        const tail = text.slice(-40).toLowerCase();
        const cleaned = raw.toLowerCase().startsWith(tail)
          ? raw.slice(tail.length)
          : raw;
        setSuggestion(cleaned.trim());
      } catch {
        if (my === seq.current) setSuggestion("");
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [text, contextId, contextType, enabled, minLength, debounceMs]);

  const clear = () => setSuggestion("");
  return { suggestion, loading, clear };
}
