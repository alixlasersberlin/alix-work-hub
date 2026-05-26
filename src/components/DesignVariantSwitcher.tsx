import { Sparkles, Monitor, Check, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useDesignVariant, type DesignVariant } from '@/hooks/useDesignVariant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const options: { value: DesignVariant; label: string; description: string; icon: typeof Monitor; beta?: boolean; ultra?: boolean }[] = [
  { value: 'classic', label: 'Classic Design', description: 'Aktuelles AlixWork Design', icon: Monitor },
  { value: 'beta3d', label: 'AlixWork 3D Beta', description: '3D Command Center · Glas · Gold', icon: Sparkles, beta: true },
  { value: 'aurora', label: 'AlixWork Aurora Ultra', description: 'Liquid Glass · Aurora · AI Light', icon: Wand2, ultra: true },
];

export default function DesignVariantSwitcher() {
  const { variant, setVariant } = useDesignVariant();
  const [open, setOpen] = useState(false);

  const active = options.find(o => o.value === variant) ?? options[0];
  const ActiveIcon = active.icon;

  return (
    <div className="fixed bottom-4 left-4 z-[60] print:hidden">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Design wechseln"
            className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:border-primary/60 hover:bg-background/95 hover:shadow-xl"
          >
            <ActiveIcon className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Design</span>
            {variant === 'beta3d' && (
              <Badge variant="outline" className="ml-1 h-4 border-primary/60 px-1 text-[10px] text-primary">
                Beta
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Design-Variante</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map(opt => {
            const Icon = opt.icon;
            const isActive = opt.value === variant;
            return (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setVariant(opt.value)}
                className="flex items-start gap-3 py-2.5"
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{opt.label}</span>
                    {opt.beta && (
                      <Badge variant="outline" className="h-4 border-primary/60 px-1 text-[10px] text-primary">
                        Beta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
