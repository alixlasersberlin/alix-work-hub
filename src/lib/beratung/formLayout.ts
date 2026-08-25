import { supabase } from '@/integrations/supabase/client';
import type { BeratungFormKey } from './formSettings';

export const BERATUNG_LAYOUT_KEY = 'beratung_layout';

/** Beschreibung eines fest im Wizard implementierten Schritts. */
export type BeratungStepDef = {
  /** Interne, unveränderliche Schritt-ID (entspricht dem Index im Wizard-Code). */
  id: number;
  /** Anzeigename in der Verwaltung. */
  name: string;
  /** Kurzbeschreibung der Abfrage. */
  note: string;
  /** Schritte, die nicht ausgeblendet werden dürfen (Pflichtdaten). */
  required?: boolean;
};

export const STANDARD_STEP_DEFS: BeratungStepDef[] = [
  { id: 1, name: 'Interessen', note: 'Mehrfachauswahl der Anwendungsbereiche', required: true },
  { id: 2, name: 'Wunschgerät', note: 'Auswahl Alix Lasers / Alix Beauty Modell' },
  { id: 3, name: 'Weitere Interessen', note: 'Optionale Zusatzinteressen' },
  { id: 4, name: 'Lieferzeitraum', note: 'Wunschzeitraum der Lieferung', required: true },
  { id: 5, name: 'Name & Studio', note: 'Vor-/Nachname, Studio in Deutschland, NISV', required: true },
  { id: 6, name: 'Firma', note: 'Firmenname, Neueröffnung, Bestehensdauer' },
  { id: 7, name: 'Telefon', note: 'Ländervorwahl und Rufnummer', required: true },
  { id: 8, name: 'Finanzierung / Flex', note: 'Preis, Anzahlung, Laufzeit, Plan' },
  { id: 9, name: 'E-Mail', note: 'E-Mail-Adresse', required: true },
  { id: 10, name: 'Beratungsart', note: 'Vor Ort, Telefon, Video …', required: true },
  { id: 11, name: 'Nachricht', note: 'Freitext des Interessenten' },
  { id: 12, name: 'Einwilligungen', note: 'Datenschutz, Kontaktaufnahme, Captcha', required: true },
  { id: 13, name: 'Bewertung', note: 'Service-Bewertung' },
];

export const PREMIUM_STEP_DEFS: BeratungStepDef[] = [
  { id: 1, name: 'Profil', note: 'Name, Firma, E-Mail, Telefon', required: true },
  { id: 2, name: 'Anwendung', note: 'Kategorieauswahl (Haarentfernung, Haut …)', required: true },
  { id: 3, name: 'Bedarf & System', note: 'Lieferzeitraum, Beratungsart, Systeme, Nachricht', required: true },
  { id: 4, name: 'Abschluss', note: 'Einwilligungen und Absenden', required: true },
];

export function stepDefs(form: BeratungFormKey): BeratungStepDef[] {
  return form === 'premium' ? PREMIUM_STEP_DEFS : STANDARD_STEP_DEFS;
}

export type BeratungStepOverride = {
  /** Ersetzt die Überschrift des Schritts. */
  title?: string;
  /** Ersetzt den Hinweistext/Untertitel des Schritts. */
  sub?: string;
  /** Schritt ausblenden. */
  hidden?: boolean;
};

export type BeratungFormLayout = {
  /** Reihenfolge der Schritt-IDs. */
  order: number[];
  /** Überschreibungen je Schritt-ID. */
  steps: Record<string, BeratungStepOverride>;
  /** Überschreibungen für die Startseite des Wizards. */
  intro?: { title?: string; sub?: string; cta?: string };
};

export type BeratungLayoutConfig = Record<BeratungFormKey, BeratungFormLayout>;

export function defaultLayout(form: BeratungFormKey): BeratungFormLayout {
  return { order: stepDefs(form).map((s) => s.id), steps: {}, intro: {} };
}

export const BERATUNG_LAYOUT_DEFAULTS: BeratungLayoutConfig = {
  standard: defaultLayout('standard'),
  premium: defaultLayout('premium'),
};

/** Normalisiert eine gespeicherte Konfiguration (fehlende/unbekannte Schritte korrigieren). */
export function normalizeLayout(form: BeratungFormKey, raw: unknown): BeratungFormLayout {
  const defs = stepDefs(form);
  const valid = defs.map((d) => d.id);
  const cfg = (raw || {}) as Partial<BeratungFormLayout>;
  const order = Array.isArray(cfg.order) ? cfg.order.filter((n) => valid.includes(n)) : [];
  for (const id of valid) if (!order.includes(id)) order.push(id);
  return { order, steps: cfg.steps || {}, intro: cfg.intro || {} };
}

export async function loadBeratungLayout(): Promise<BeratungLayoutConfig> {
  try {
    const { data } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', BERATUNG_LAYOUT_KEY)
      .maybeSingle();
    const parsed = !data?.value
      ? {}
      : typeof data.value === 'string'
        ? JSON.parse(data.value)
        : data.value;
    return {
      standard: normalizeLayout('standard', parsed?.standard),
      premium: normalizeLayout('premium', parsed?.premium),
    };
  } catch {
    return BERATUNG_LAYOUT_DEFAULTS;
  }
}

export async function loadBeratungLayoutFor(form: BeratungFormKey): Promise<BeratungFormLayout> {
  const cfg = await loadBeratungLayout();
  return cfg[form];
}

export async function saveBeratungLayout(cfg: BeratungLayoutConfig) {
  return (supabase as any).from('app_settings').upsert(
    { key: BERATUNG_LAYOUT_KEY, value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
}

/** Sichtbare Schrittfolge (IDs) in konfigurierter Reihenfolge. */
export function visibleSequence(form: BeratungFormKey, layout: BeratungFormLayout | null): number[] {
  const defs = stepDefs(form);
  const l = layout ?? defaultLayout(form);
  const seq = l.order.filter((id) => {
    const def = defs.find((d) => d.id === id);
    if (!def) return false;
    if (def.required) return true;
    return !l.steps?.[String(id)]?.hidden;
  });
  return seq.length ? seq : defs.map((d) => d.id);
}
