import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const MENU_SCALE_KEY = 'alixwork.menuScale';
export const MENU_SCALE_EVENT = 'alixwork:menu-scale';
export const MENU_SCALE_MIN = 0.8;
export const MENU_SCALE_MAX = 1.4;
export const MENU_SCALE_STEP = 0.05;

const clamp = (v: number) =>
  Math.min(MENU_SCALE_MAX, Math.max(MENU_SCALE_MIN, Number(v.toFixed(2))));

function readLocal(): number {
  if (typeof window === 'undefined') return 1;
  const v = Number(localStorage.getItem(MENU_SCALE_KEY));
  if (!Number.isFinite(v) || v <= 0) return 1;
  return clamp(v);
}

/**
 * Menü-/Schriftgröße der Sidebar.
 * Quelle der Wahrheit ist `user_ui_preferences` in Supabase (pro Benutzer);
 * localStorage dient nur als sofort verfügbarer Cache.
 */
export function useMenuScale() {
  const [scale, setScaleState] = useState<number>(readLocal);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cross-Component-Sync
  useEffect(() => {
    const sync = () => setScaleState(readLocal());
    window.addEventListener(MENU_SCALE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(MENU_SCALE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Beim Start (und bei Login-Wechsel) den gespeicherten Wert des Benutzers laden
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid || cancelled) return;
      const { data, error } = await supabase
        .from('user_ui_preferences')
        .select('menu_scale')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const next = clamp(Number(data.menu_scale));
      try { localStorage.setItem(MENU_SCALE_KEY, String(next)); } catch { /* ignore */ }
      setScaleState(next);
      window.dispatchEvent(new CustomEvent(MENU_SCALE_EVENT));
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setScale = useCallback((value: number) => {
    const next = clamp(value);
    try { localStorage.setItem(MENU_SCALE_KEY, String(next)); } catch { /* ignore */ }
    setScaleState(next);
    window.dispatchEvent(new CustomEvent(MENU_SCALE_EVENT));

    // Persistenz in Supabase (leicht entprellt gegen schnelles Klicken)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      await supabase
        .from('user_ui_preferences')
        .upsert({ user_id: uid, menu_scale: next }, { onConflict: 'user_id' });
    }, 500);
  }, []);

  return { scale, setScale };
}
