/**
 * Editierbare Texte der Rücklastschrift-Mahn-E-Mail.
 *
 * Gespeichert in app_settings (Key: bank_return_dunning_email) und beim Versand
 * (manuell sowie in der automatischen Eskalation) mit Platzhaltern befüllt.
 */
import { supabase } from '@/integrations/supabase/client';
import { fillPlaceholders } from './returnDunningLetter';

export const RETURN_DUNNING_EMAIL_KEY = 'bank_return_dunning_email';

export interface ReturnDunningEmail {
  subject: string;
  headline: string;
  intro: string;
  warnTitle: string;
  warnBody: string;
  warnBody2: string;
  closing: string;
  senderName: string;
}

export const DEFAULT_RETURN_DUNNING_EMAIL: ReturnDunningEmail = {
  subject: 'Rücklastschrift – offene Forderung zu Rechnung {{rechnung}} und angekündigte Leistungssperre',
  headline: 'Zahlungsaufforderung nach Rücklastschrift',
  intro:
    'die von uns eingezogene Lastschrift wurde am {{datum}} von Ihrem Kreditinstitut zurückgegeben – Grund: {{grund}} ({{code}}). Die betroffene Forderung ist damit wieder offen; die zugehörige Rechnung wurde in unserem System erneut geöffnet.',
  warnTitle: 'Wichtiger Hinweis: bevorstehende Sperre der Leistungen',
  warnBody:
    'Sollte der Gesamtbetrag von {{gesamt}} nicht bis zum {{zahlbar_bis}} vollständig auf unserem Konto eingegangen sein, sind wir gezwungen, sämtliche Leistungen von Alix Lasers mit Wirkung zum {{sperrdatum}} vorübergehend zu sperren.',
  warnBody2:
    'Dies betrifft insbesondere die Freischaltung und den Betrieb Ihres Gerätes, Service- und Wartungsleistungen, Support, Schulungen sowie ausstehende Lieferungen. Die Sperre wird unmittelbar nach vollständigem Zahlungseingang wieder aufgehoben.',
  closing:
    'Sollte die Rücklastschrift auf einem Irrtum Ihres Kreditinstituts beruhen oder haben Sie den Betrag bereits ausgeglichen, setzen Sie sich bitte kurzfristig mit uns in Verbindung.',
  senderName: 'Alix Lasers – Buchhaltung',
};

export async function loadReturnDunningEmail(): Promise<ReturnDunningEmail> {
  const { data } = await supabase.from('app_settings').select('value')
    .eq('key', RETURN_DUNNING_EMAIL_KEY).maybeSingle();
  return { ...DEFAULT_RETURN_DUNNING_EMAIL, ...((data?.value as any) ?? {}) };
}

export async function saveReturnDunningEmail(cfg: ReturnDunningEmail) {
  const { error } = await (supabase.from('app_settings') as any).upsert(
    { key: RETURN_DUNNING_EMAIL_KEY, value: cfg as any }, { onConflict: 'key' },
  );
  if (error) throw error;
}

/** Befüllt alle Textblöcke mit den Platzhalterwerten der Rücklastschrift. */
export function fillReturnDunningEmail(cfg: ReturnDunningEmail, vars: Record<string, string>) {
  const f = (t: string) => fillPlaceholders(t ?? '', vars);
  return {
    subjectOverride: f(cfg.subject),
    headline: f(cfg.headline),
    intro: f(cfg.intro),
    warnTitle: f(cfg.warnTitle),
    warnBody: f(cfg.warnBody),
    warnBody2: f(cfg.warnBody2),
    closing: f(cfg.closing),
    senderName: f(cfg.senderName),
  };
}
