// Lightweight in-app event bus for ESC workflow triggers.
// Other modules can subscribe to react to appointment lifecycle changes
// without importing anything from ESC internals.

export type EscEventName =
  | 'event.created' | 'event.updated' | 'event.deleted'
  | 'event.confirmed' | 'event.declined' | 'event.rescheduled'
  | 'event.completed' | 'event.cancelled'
  | 'booking.created' | 'booking.accepted' | 'booking.cancelled'
  | 'service.started' | 'service.finished'
  | 'training.completed';

export interface EscEvent<T = unknown> {
  name: EscEventName;
  at: string;
  actor?: string | null;
  source: 'esc' | 'portal' | 'workflow' | 'system';
  payload: T;
}

type Handler = (e: EscEvent) => void | Promise<void>;
const handlers = new Map<EscEventName, Set<Handler>>();
const wildcards = new Set<Handler>();

export function subscribe(name: EscEventName | '*', fn: Handler): () => void {
  if (name === '*') { wildcards.add(fn); return () => wildcards.delete(fn); }
  const set = handlers.get(name) || new Set();
  set.add(fn);
  handlers.set(name, set);
  return () => set.delete(fn);
}

export async function emit<T>(evt: Omit<EscEvent<T>, 'at'> & { at?: string }): Promise<void> {
  const full: EscEvent<T> = { ...evt, at: evt.at || new Date().toISOString() } as EscEvent<T>;
  const local = handlers.get(full.name);
  const targets = [...(local || []), ...wildcards];
  await Promise.all(targets.map((h) => Promise.resolve().then(() => h(full as EscEvent))));
}
