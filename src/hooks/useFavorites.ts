import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type FavoriteEntry = { path: string; label: string };

const EVENT = 'alixwork:favorites-changed';

function storageKey(userId: string | undefined) {
  return userId ? `alixwork.favorites.${userId}` : 'alixwork.favorites.anon';
}

function read(userId: string | undefined): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.path === 'string') : [];
  } catch {
    return [];
  }
}

function write(userId: string | undefined, list: FavoriteEntry[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* ignore */ }
}

export function useFavorites() {
  const { user } = useAuth();
  const userId = user?.id;
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(() => read(userId));

  useEffect(() => {
    setFavorites(read(userId));
    const onChange = () => setFavorites(read(userId));
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId]);

  const isFavorite = useCallback((path: string) => favorites.some(f => f.path === path), [favorites]);

  const toggle = useCallback((entry: FavoriteEntry) => {
    const current = read(userId);
    const exists = current.some(f => f.path === entry.path);
    const next = exists ? current.filter(f => f.path !== entry.path) : [...current, { path: entry.path, label: entry.label }];
    write(userId, next);
    setFavorites(next);
  }, [userId]);

  const remove = useCallback((path: string) => {
    const next = read(userId).filter(f => f.path !== path);
    write(userId, next);
    setFavorites(next);
  }, [userId]);

  const replaceAll = useCallback((list: FavoriteEntry[]) => {
    write(userId, list);
    setFavorites(list);
  }, [userId]);

  return { favorites, isFavorite, toggle, remove, replaceAll };
}
