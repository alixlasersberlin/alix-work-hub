import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Natives <select> im Look der shadcn-SelectTrigger-Komponente.
 * Wird in Dialogen genutzt, wo das Radix-Select-Popover blockiert werden kann.
 */
export function NativeSelect({ value, onChange, placeholder, className, disabled, children }: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'flex h-10 w-full appearance-none items-center rounded-md border border-input bg-background px-3 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}
