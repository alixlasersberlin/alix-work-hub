import { supabase } from '@/integrations/supabase/client';

export const BERATUNG_FORMS_KEY = 'beratung_forms';

export type BeratungFormOverride = {
  /** Optionaler Ersatz für den Danke-Titel */
  thanks_title?: string;
  /** Optionaler Ersatz für den Danke-Text */
  thanks_text?: string;
  /** Optionaler Hinweis unter dem Danke-Text */
  thanks_hint?: string;
  /** Formular aktiv (nur informativ in der Verwaltung) */
  active?: boolean;
  /** Interne Notiz */
  note?: string;
};

export type BeratungFormsConfig = {
  standard: BeratungFormOverride;
  premium: BeratungFormOverride;
};

export const BERATUNG_FORMS_DEFAULTS: BeratungFormsConfig = {
  standard: { active: true },
  premium: { active: true },
};

export type BeratungFormKey = keyof BeratungFormsConfig;

export const BERATUNG_FORMS_META: {
  key: BeratungFormKey;
  name: string;
  description: string;
  routes: string[];
  component: string;
}[] = [
  {
    key: 'standard',
    name: 'Standard-Beratung',
    description: 'Klassischer 12-Schritt-Wizard mit Bildkacheln (Alix Lasers Gold).',
    routes: ['/beratung', '/angebot'],
    component: 'src/components/SalesWizard.tsx',
  },
  {
    key: 'premium',
    name: 'ALIX Premium Beratung',
    description: 'Pearl/Chrome-Variante mit Kategorien (Haarentfernung, Haut, Körper, Tattoo).',
    routes: ['/beratung/premium', '/beratung-alix'],
    component: 'src/components/PremiumSalesWizard.tsx',
  },
];

export async function loadBeratungForms(): Promise<BeratungFormsConfig> {
  try {
    const { data } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', BERATUNG_FORMS_KEY)
      .maybeSingle();
    if (!data?.value) return BERATUNG_FORMS_DEFAULTS;
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return {
      standard: { ...BERATUNG_FORMS_DEFAULTS.standard, ...(parsed?.standard || {}) },
      premium: { ...BERATUNG_FORMS_DEFAULTS.premium, ...(parsed?.premium || {}) },
    };
  } catch {
    return BERATUNG_FORMS_DEFAULTS;
  }
}

export async function saveBeratungForms(cfg: BeratungFormsConfig) {
  return (supabase as any).from('app_settings').upsert(
    { key: BERATUNG_FORMS_KEY, value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
}

/** Liest nur die Overrides eines Formulars (für die öffentlichen Wizards). */
export async function loadBeratungFormOverride(key: BeratungFormKey): Promise<BeratungFormOverride> {
  const cfg = await loadBeratungForms();
  return cfg[key] || {};
}
