import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const MENU_SCALE_MIN = 0.8;
export const MENU_SCALE_MAX = 1.4;
export const MENU_SCALE_STEP = 0.05;

const LS_KEY = 'alixwork.uiPrefs';
const EVENT = 'alixwork:ui-prefs';

export type UiPrefs = {
  menuScale: number;
  sidebarCollapsed: boolean;
  sidebarAutoCollapse: boolean;
};

const DEFAULTS: UiPrefs = { menuScale: 1, sidebarCollapsed: false, sidebarAutoCollapse: false };

const clampScale = (v: number) =>
  Math.min(MENU_SCALE_MAX, Math.max(MENU_SCALE_MIN, Number(Number(v).toFixed(2))));

function readLocal(): UiPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return {
      menuScale: Number.isFinite(Number(raw.menuScale)) && raw.menuScale ? clampScale(raw.menuScale) : DEFAULTS.menuScale,
      sidebarCollapsed: !!raw.sidebarCollapsed,
      sidebarAutoCollapse: !!raw.sidebarAutoCollapse,
    };
  } catch {
    return DEFAULTS;
  }
}

let state: UiPrefs = readLocal();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

async function persist() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase.from('user_ui_preferences').upsert(
    {
      user_id: uid,
      menu_scale: state.menuScale,
      sidebar_collapsed: state.sidebarCollapsed,
      sidebar_auto_collapse: state.sidebarAutoCollapse,
    },
    { onConflict: 'user_id' },
  );
}

async function load() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const { data, error } = await supabase
    .from('user_ui_preferences')
    .select('menu_scale, sidebar_collapsed, sidebar_auto_collapse')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return;
  state = {
    menuScale: clampScale(Number(data.menu_scale)),
    sidebarCollapsed: !!data.sidebar_collapsed,
    sidebarAutoCollapse: !!data.sidebar_auto_collapse,
  };
  broadcast();
}

/** Persönliche UI-Einstellungen (Supabase pro Benutzer, localStorage als Cache). */
export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>(state);

  useEffect(() => {
    const sync = () => setPrefs({ ...state });
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', () => { state = readLocal(); sync(); });
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  useEffect(() => {
    if (!loaded) {
      loaded = true;
      load();
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') load();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const update = useCallback((patch: Partial<UiPrefs>) => {
    state = { ...state, ...patch };
    if (patch.menuScale !== undefined) state.menuScale = clampScale(patch.menuScale);
    broadcast();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 500);
  }, []);

  return {
    ...prefs,
    setMenuScale: (v: number) => update({ menuScale: v }),
    setSidebarCollapsed: (v: boolean) => update({ sidebarCollapsed: v }),
    setSidebarAutoCollapse: (v: boolean) => update({ sidebarAutoCollapse: v }),
  };
}

/** Kompatibilitäts-Hook nur für die Menü-/Schriftgröße. */
export function useMenuScale() {
  const { menuScale, setMenuScale } = useUiPrefs();
  return { scale: menuScale, setScale: setMenuScale };
}
