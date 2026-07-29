import { useEffect } from 'react';
import { Banknote } from 'lucide-react';
import { useAccountingRegion, type AccountingRegion } from '@/contexts/AccountingRegionContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/**
 * Kompakter Umschalter zwischen Buchhaltung EU und CH.
 * Buchhaltung CH ist ausschließlich für Super Admin sichtbar/wählbar.
 */
export function AccountingRegionSwitcher({ className }: { className?: string }) {
  const { region, setRegion } = useAccountingRegion();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  // Erzwinge EU für Nicht-Super-Admins, falls CH aus localStorage geladen wurde
  useEffect(() => {
    if (!isSuperAdmin && region === 'CH') setRegion('EU');
  }, [isSuperAdmin, region, setRegion]);

  // Nicht-Super-Admins sehen keinen Umschalter (nur EU)
  if (!isSuperAdmin) return null;

  const Item = ({ value, label, flag }: { value: AccountingRegion; label: string; flag: string }) => (
    <button
      type="button"
      onClick={() => setRegion(value)}
      className={cn(
        'flex-1 px-2 py-1 text-[11px] font-semibold tracking-wide rounded-md transition-colors flex items-center justify-center gap-1',
        region === value
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
      title={`Buchhaltung ${label}`}
    >
      <span>{flag}</span>
      <span>{label}</span>
    </button>
  );
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1',
        className,
      )}
      role="group"
      aria-label="Buchhaltungsregion"
    >
      <Banknote className="w-3.5 h-3.5 text-muted-foreground ml-1" />
      <Item value="EU" label="EU" flag="🇪🇺" />
      <Item value="CH" label="CH" flag="🇨🇭" />
    </div>
  );
}

export default AccountingRegionSwitcher;
