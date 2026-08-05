import { AlertCircle, CheckCircle2, HelpCircle, Landmark, MinusCircle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BankStatus = 'offen' | 'sicher' | 'vorschlag' | 'verbucht' | 'zurueckgestellt' | 'ignoriert' | 'dublette';

const MAP: Record<string, { label: string; cls: string; Icon: any }> = {
  sicher: { label: 'Übereinstimmung gefunden', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', Icon: CheckCircle2 },
  vorschlag: { label: 'Zuordnung prüfen', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30', Icon: HelpCircle },
  offen: { label: 'Keine Zuordnung gefunden', cls: 'bg-red-500/15 text-red-500 border-red-500/30', Icon: AlertCircle },
  verbucht: { label: 'Verbucht', cls: 'bg-sky-500/15 text-sky-500 border-sky-500/30', Icon: Landmark },
  zurueckgestellt: { label: 'Zurückgestellt', cls: 'bg-muted text-muted-foreground border-border', Icon: MinusCircle },
  ignoriert: { label: 'Ignoriert', cls: 'bg-muted text-muted-foreground border-border', Icon: MinusCircle },
  dublette: { label: 'Mögliche Dublette', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30', Icon: Copy },
};

export function BankStatusBadge({ status, score, className }: { status: string; score?: number; className?: string }) {
  const cfg = MAP[status] ?? MAP.offen;
  const Icon = cfg.Icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', cfg.cls, className)}
      title={typeof score === 'number' ? `${score} % Übereinstimmung` : cfg.label}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {cfg.label}
      {typeof score === 'number' && score > 0 && status !== 'verbucht' && <span className="opacity-70">· {score}%</span>}
    </span>
  );
}

export default BankStatusBadge;
