// ALIX CONTENT HUB — EDIT ONCE · CHECK ONCE · APPROVE ONCE · PUBLISH EVERYWHERE
import { Globe, FileSignature, FileText, Columns3, UserRound, Megaphone } from 'lucide-react';

export const CH_CHANNELS = [
  { code: 'website', label: 'Website', hint: 'alix-lasers.de Produktseite', icon: Globe },
  { code: 'offer', label: 'Angebot', hint: 'Positionstext, Technik, Lieferumfang', icon: FileSignature },
  { code: 'datasheet', label: 'Datenblatt', hint: 'A4 PDF mit Stand-Datum', icon: FileText },
  { code: 'comparison', label: 'Vergleich', hint: 'Produktvergleichstabelle', icon: Columns3 },
  { code: 'portal', label: 'Kundenportal', hint: 'AlixSmart Kundenansicht', icon: UserRound },
  { code: 'social', label: 'Social Media', hint: 'Textbausteine je Plattform', icon: Megaphone },
] as const;

export type ChChannelCode = typeof CH_CHANNELS[number]['code'];

export const chChannelLabel = (c: string) => CH_CHANNELS.find(x => x.code === c)?.label ?? c;

export type ChLamp = 'ok' | 'stale' | 'never';

export function chLamp(state: any | undefined, currentHash?: string | null): ChLamp {
  if (!state?.published_at) return 'never';
  if (state.is_stale) return 'stale';
  if (currentHash && state.published_hash && state.published_hash !== currentHash) return 'stale';
  return 'ok';
}

export const CH_LAMP_TONE: Record<ChLamp, string> = {
  ok: 'bg-emerald-500',
  stale: 'bg-amber-500',
  never: 'bg-muted-foreground/40',
};

export const CH_LAMP_LABEL: Record<ChLamp, string> = {
  ok: 'Aktuell',
  stale: 'Veraltet',
  never: 'Nie veröffentlicht',
};

export const CH_STAGES = ['ENTWURF', 'VORSCHAU', 'COMPLIANCE-CHECK', 'FREIGEBEN', 'VERÖFFENTLICHEN', 'SYNC alix-lasers.de'];
