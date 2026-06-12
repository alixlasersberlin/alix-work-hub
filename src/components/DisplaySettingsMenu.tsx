import { useEffect, useRef, useState } from 'react';
import { Settings2, Download, Type, Check } from 'lucide-react';
import { useFontScale, type FontScale } from '@/hooks/useFontScale';
import { Button } from '@/components/ui/button';
import { detectUiLang, setUiLang, t, type UiLang } from '@/i18n/ui';
import { cn } from '@/lib/utils';

const SCALES: { value: FontScale; key: string; shortcut: string }[] = [
  { value: 'sm', key: 'display.small', shortcut: 'A−' },
  { value: 'md', key: 'display.normal', shortcut: 'A' },
  { value: 'lg', key: 'display.large', shortcut: 'A+' },
  { value: 'xl', key: 'display.xlarge', shortcut: 'A++' },
  { value: 'a11y', key: 'display.a11y', shortcut: '♿' },
];

const LANGS: { code: UiLang; label: string }[] = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
  { code: 'tr', label: 'TR' },
  { code: 'ar', label: 'AR' },
  { code: 'vi', label: 'VI' },
];

export default function DisplaySettingsMenu() {
  const { scale, setScale } = useFontScale();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<UiLang>(() => detectUiLang());
  const wrapRef = useRef<HTMLDivElement>(null);

  // initial lang attribute
  useEffect(() => { setUiLang(lang); }, [lang]);

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

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('display.settings', lang)}
        title={t('display.settings', lang)}
      >
        <Settings2 className="w-4 h-4" />
      </Button>

      {open && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-3 z-[200] animate-fade-in',
          )}
          style={{ backgroundColor: 'hsl(var(--popover))', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          role="dialog"
          aria-label={t('display.settings', lang)}
        >
          <div className="flex items-center gap-2 px-1 pb-2 border-b border-border/70 mb-2">
            <Type className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('display.fontSize', lang)}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1 mb-3">
            {SCALES.map((s) => {
              const active = scale === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-md border px-1 py-2 text-[11px] transition-all',
                    active
                      ? 'border-primary/60 bg-primary/10 text-primary font-semibold shadow-sm'
                      : 'border-border bg-background hover:bg-muted/60',
                  )}
                  title={t(s.key, lang)}
                  aria-pressed={active}
                  aria-label={t(s.key, lang)}
                >
                  <span className="text-base leading-none">{s.shortcut}</span>
                </button>
              );
            })}
          </div>

          <div className="px-1 py-1 text-[10px] text-muted-foreground mb-2">
            {SCALES.find((s) => s.value === scale)?.key && t(SCALES.find((s) => s.value === scale)!.key, lang)}
          </div>

          <div className="flex items-center gap-2 px-1 pb-2 border-t border-border/70 pt-3 mt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('design.switchView', lang)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 mb-3">
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    'rounded-md border px-1 py-1.5 text-[11px] font-medium transition-all',
                    active
                      ? 'border-primary/60 bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background hover:bg-muted/60',
                  )}
                >
                  {l.label}
                  {active && <Check className="inline w-3 h-3 ml-1 -mt-0.5" />}
                </button>
              );
            })}
          </div>

          <a
            href="/backgrounds/alixwork-premium-background.jpg"
            download="alixwork-premium-background.jpg"
            className="flex items-center justify-center gap-2 w-full rounded-md border border-border bg-background hover:bg-muted/60 px-3 py-2 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('design.downloadBackground', lang)}
          </a>
        </div>
      )}
    </div>
  );
}
