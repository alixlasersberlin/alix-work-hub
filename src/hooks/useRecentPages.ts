import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type RecentEntry = { path: string; label: string; ts: number };

const EVENT = 'alixwork:recents-changed';
const MAX = 8;

function key(userId?: string) {
  return userId ? `alixwork.recents.${userId}` : 'alixwork.recents.anon';
}

function read(userId?: string): RecentEntry[] {
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e: any) => e && typeof e.path === 'string') : [];
  } catch {
    return [];
  }
}

function write(userId: string | undefined, list: RecentEntry[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* ignore */ }
}

export function useRecentPages() {
  const { user } = useAuth();
  const userId = user?.id;
  const [recents, setRecents] = useState<RecentEntry[]>(() => read(userId));

  useEffect(() => {
    setRecents(read(userId));
    const onChange = () => setRecents(read(userId));
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId]);

  const track = useCallback((path: string, label: string) => {
    if (!path || path === '/') return;
    const list = read(userId).filter(e => e.path !== path);
    write(userId, [{ path, label, ts: Date.now() }, ...list]);
  }, [userId]);

  const clear = useCallback(() => write(userId, []), [userId]);

  return { recents, track, clear };
}
