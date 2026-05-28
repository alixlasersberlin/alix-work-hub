import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Nur das Kronen-Icon ohne Label */
  iconOnly?: boolean;
  title?: string;
}

/**
 * Premium VIP Badge – goldene Krone, kennzeichnet bevorzugte Kunden und Aufträge.
 * VIP-Einträge erscheinen in allen Listen automatisch an Position 1.
 */
export function VipBadge({ size = 'sm', className, iconOnly, title = 'VIP – bevorzugt' }: Props) {
  const sz = size === 'lg' ? 'h-7 px-2.5 text-sm' : size === 'md' ? 'h-6 px-2 text-xs' : 'h-5 px-1.5 text-[10px]';
  const icon = size === 'lg' ? 'w-4 h-4' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  if (iconOnly) {
    return (
      <span
        title={title}
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-black shadow-[0_0_10px_hsl(45_100%_50%/0.45)] ring-1 ring-amber-200/60',
          size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5',
          className,
        )}
      >
        <Crown className={cn(icon, 'fill-current')} />
      </span>
    );
  }
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold tracking-wider uppercase',
        'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-600 text-black',
        'shadow-[0_0_12px_hsl(45_100%_50%/0.5)] ring-1 ring-amber-200/60',
        sz,
        className,
      )}
    >
      <Crown className={cn(icon, 'fill-current')} />
      VIP
    </span>
  );
}
