// Lightweight local store for AI suggestions & protocol.
// Uses localStorage so nothing is written to shared DB tables (per Prompt-7 rules).
// A future migration can swap this for a Supabase table without changing the UI.

import type { AiSettings, AiSuggestion, AiStatus } from './types';
import { DEFAULT_AI_SETTINGS } from './types';

const SUGGESTIONS_KEY = 'esc.ai.suggestions.v1';
const PROTOCOL_KEY = 'esc.ai.protocol.v1';
const SETTINGS_KEY = 'esc.ai.settings.v1';

const listeners = new Set<() => void>();
export function subscribeAi(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function notify() { listeners.forEach((l) => l()); }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  notify();
}

export function getSuggestions(): AiSuggestion[] {
  return read<AiSuggestion[]>(SUGGESTIONS_KEY, []);
}
export function saveSuggestions(next: AiSuggestion[]) {
  write(SUGGESTIONS_KEY, next);
}

export interface AiProtocolEntry {
  id: string;
  suggestionId: string;
  kind: AiSuggestion['kind'];
  title: string;
  status: AiStatus;
  actedBy?: string;
  actedAt: string;
  outcome?: string;
  reason: string;
}
export function getProtocol(): AiProtocolEntry[] {
  return read<AiProtocolEntry[]>(PROTOCOL_KEY, []);
}
export function appendProtocol(entry: AiProtocolEntry) {
  const next = [entry, ...getProtocol()].slice(0, 500);
  write(PROTOCOL_KEY, next);
}

export function actOnSuggestion(id: string, status: 'accepted' | 'dismissed', by?: string, outcome?: string) {
  const items = getSuggestions();
  const idx = items.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const now = new Date().toISOString();
  const updated = { ...items[idx], status, actedAt: now, actedBy: by, outcome };
  items[idx] = updated;
  saveSuggestions(items);
  appendProtocol({
    id: crypto.randomUUID(),
    suggestionId: id,
    kind: updated.kind,
    title: updated.title,
    status,
    actedBy: by,
    actedAt: now,
    outcome,
    reason: updated.reason,
  });
}

export function getSettings(): AiSettings {
  return { ...DEFAULT_AI_SETTINGS, ...read<Partial<AiSettings>>(SETTINGS_KEY, {}) };
}
export function saveSettings(next: AiSettings) { write(SETTINGS_KEY, next); }
