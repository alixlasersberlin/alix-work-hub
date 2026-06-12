import { Sparkles, Check, Download, Layers, Wand2, Rocket, Monitor, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useExperienceMode, type ExperienceMode } from '@/hooks/useExperienceMode';
import { useDesignVariant, type DesignVariant } from '@/hooks/useDesignVariant';
import { detectUiLang, t } from '@/i18n/ui';
import { cn } from '@/lib/utils';

interface Option {
  value: ExperienceMode;
  key: string;
  descKey: string;
  icon: typeof Sparkles;
}

const OPTIONS: Option[] = [
  { value: 'classic', key: 'experience.classic', descKey: 'experience.classicDesc', icon: Layers },
  { value: 'premium', key: 'experience.premium', descKey: 'experience.premiumDesc', icon: Wand2 },
  { value: 'mega',    key: 'experience.mega',    descKey: 'experience.megaDesc',    icon: Rocket },
];

export default function ExperienceModeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { mode, setMode } = useExperienceMode();
  const { variant, setVariant } = useDesignVariant();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lang = detectUiLang();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = OPTIONS.find(o => o.value === mode) ?? OPTIONS[0];

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={t('experience.title', lang)}
        title={t('experience.title', lang)}
        className={cn(
          'group flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-2 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/60 hover:bg-card hover:shadow-sm',
          collapsed && 'justify-center'
        )}
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        {!collapsed && (
          <span className="flex flex-col items-start min-w-0 leading-tight">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('experience.title', lang)}
            </span>
            <span className="text-xs font-semibold truncate">
              {t(active.key, lang)}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('experience.title', lang)}
          className="absolute bottom-full left-0 right-0 mb-2 z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-2 animate-fade-in"
          style={{ backgroundColor: 'hsl(var(--popover))', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
        >
          <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('experience.title', lang)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setMode(opt.value); }}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold">{t(opt.key, lang)}</span>
                    <span className="block text-[10px] text-muted-foreground leading-tight">
                      {t(opt.descKey, lang)}
                    </span>
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary mt-1" />}
                </button>
              );
            })}
          </div>

          <a
            href="/backgrounds/alixwork-premium-background.jpg"
            download="alixwork-premium-background.jpg"
            className="mt-2 flex items-center justify-center gap-2 w-full rounded-md border border-border bg-background hover:bg-muted/60 px-3 py-2 text-[11px] font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('experience.download', lang)}
          </a>
        </div>
      )}
    </div>
  );
}
