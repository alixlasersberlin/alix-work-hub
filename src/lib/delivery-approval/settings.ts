import { supabase } from '@/integrations/supabase/client';
import type { ApprovalStage } from './config';

export const APPROVAL_SETTINGS_KEY = 'delivery_approval_sla';

export interface ApprovalSettings {
  /** Stunden bis eine offene Stufe als überfällig gilt (Erinnerung, danach zyklisch). */
  overdueHours: number;
  /** Eskalationsstufen in Stunden. */
  l1: number;
  l2: number;
  l3: number;
  /** Fristen nur an Werktagen (Mo–Fr) zählen. */
  businessDaysOnly: boolean;
  /** Feiertage als ISO-Datum (YYYY-MM-DD), werden wie Wochenenden behandelt. */
  holidays: string[];
  /** Ein-Klick-Freigabe aus der Erinnerungs-Mail erlauben. */
  oneClickApproval: boolean;
  /** KPI-Zielwerte je Stufe (Ø Stunden bis Freigabe). */
  targets: Record<ApprovalStage | 'total', number>;
  /** Vertretungsregelung: Abwesenheiten mit Vertreter. */
  absences: Absence[];
  /** Monatsreport per E-Mail an die Leitung (1. des Monats). */
  monthlyReport: { enabled: boolean; recipients: string[] };
}

export interface Absence {
  /** E-Mail des abwesenden Freigebers. */
  email: string;
  /** E-Mail des Vertreters, der stattdessen benachrichtigt wird. */
  deputyEmail: string;
  /** ISO-Datum YYYY-MM-DD (inklusive). */
  from: string;
  to: string;
}

export const DEFAULT_APPROVAL_SETTINGS: ApprovalSettings = {
  overdueHours: 12,
  l1: 24,
  l2: 48,
  l3: 72,
  businessDaysOnly: true,
  holidays: [],
  oneClickApproval: true,
  targets: { warehouse: 24, accounting: 8, dispatch: 24, total: 48 },
  absences: [],
  monthlyReport: { enabled: false, recipients: [] },
};

/** Gesetzliche Feiertage Deutschland (bundesweit) + Österreich für 2026. */
export const HOLIDAYS_DE_AT_2026: string[] = [
  '2026-01-01', // Neujahr (DE/AT)
  '2026-01-06', // Heilige Drei Könige (AT)
  '2026-04-03', // Karfreitag (DE)
  '2026-04-06', // Ostermontag (DE/AT)
  '2026-05-01', // Tag der Arbeit (DE/AT)
  '2026-05-14', // Christi Himmelfahrt (DE/AT)
  '2026-05-25', // Pfingstmontag (DE/AT)
  '2026-06-04', // Fronleichnam (AT)
  '2026-08-15', // Mariä Himmelfahrt (AT)
  '2026-10-03', // Tag der Deutschen Einheit (DE)
  '2026-10-26', // Nationalfeiertag (AT)
  '2026-11-01', // Allerheiligen (AT)
  '2026-12-08', // Mariä Empfängnis (AT)
  '2026-12-25', // 1. Weihnachtstag (DE/AT)
  '2026-12-26', // 2. Weihnachtstag (DE/AT)
];

const db = supabase as any;

export async function fetchApprovalSettings(): Promise<ApprovalSettings> {
  const { data } = await db.from('app_settings').select('value').eq('key', APPROVAL_SETTINGS_KEY).maybeSingle();
  let raw: any = data?.value ?? null;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
  return {
    ...DEFAULT_APPROVAL_SETTINGS,
    ...(raw ?? {}),
    targets: { ...DEFAULT_APPROVAL_SETTINGS.targets, ...((raw?.targets as any) ?? {}) },
  };
}

export async function saveApprovalSettings(cfg: ApprovalSettings): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await db.from('app_settings').upsert(
    {
      key: APPROVAL_SETTINGS_KEY,
      value: cfg as any,
      updated_by: u?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
}

/** Ampel-Bewertung eines Ist-Wertes gegen den Zielwert. */
export function targetTone(actual: number | null, target: number): 'ok' | 'warn' | 'bad' | 'none' {
  if (actual == null) return 'none';
  if (actual <= target) return 'ok';
  if (actual <= target * 1.5) return 'warn';
  return 'bad';
}

export const TONE_CLASS: Record<'ok' | 'warn' | 'bad' | 'none', string> = {
  ok: 'text-emerald-400',
  warn: 'text-yellow-400',
  bad: 'text-red-400',
  none: 'text-muted-foreground',
};
