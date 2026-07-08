import { useEffect, useMemo, useState } from 'react';
import { useAppointments } from './useAppointments';
import { runAiAnalysis } from '@/lib/esc/ai/engine';
import { getSuggestions, saveSuggestions, subscribeAi, getSettings, actOnSuggestion } from '@/lib/esc/ai/store';
import type { AiSuggestion } from '@/lib/esc/ai/types';

export function useAiSuggestions() {
  const { appointments } = useAppointments();
  const [items, setItems] = useState<AiSuggestion[]>(getSuggestions());

  // (Re)compute suggestions whenever appointments change
  useEffect(() => {
    const settings = getSettings();
    const fresh = runAiAnalysis(appointments, settings);
    // preserve already-acted suggestions by title+kind
    const previous = getSuggestions();
    const keepActed = previous.filter((p) => p.status !== 'open');
    const dedup = new Map<string, AiSuggestion>();
    [...keepActed, ...fresh].forEach((s) => dedup.set(`${s.kind}|${s.title}`, s));
    const merged = Array.from(dedup.values());
    saveSuggestions(merged);
    setItems(merged);
  }, [appointments]);

  useEffect(() => {
    const unsub = subscribeAi(() => setItems(getSuggestions()));
    return () => { unsub(); };
  }, []);

  const open = useMemo(() => items.filter((s) => s.status === 'open'), [items]);
  return { suggestions: items, open, act: actOnSuggestion };
}
