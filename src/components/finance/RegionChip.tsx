import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { cn } from '@/lib/utils';

/**
 * Kleiner Region-Chip (🇪🇺 EU / 🇨🇭 CH) für Finance-Seiten.
 */
export function RegionChip({ className }: { className?: string }) {
  const { region } = useAccountingRegion();
  const isCh = region === 'CH';
  const isAll = region === 'ALL';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        isAll
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
          : isCh
          ? 'border-red-500/40 bg-red-500/10 text-red-500'
          : 'border-primary/40 bg-primary/10 text-primary',
        className,
      )}
      title={`Buchungskreis ${region}`}
    >
      <span>{isAll ? '🌐' : isCh ? '🇨🇭' : '🇪🇺'}</span>
      <span>Buchungskreis {isAll ? 'ALLE' : region}</span>
    </span>
  );
}

export default RegionChip;
