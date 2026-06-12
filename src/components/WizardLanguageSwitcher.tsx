import { useState, useRef, useEffect } from 'react';
import { LANGS, useWizardLang, type Lang } from '@/i18n/wizard';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /** "dark" = glassmorph dunkles Overlay (für /beratung). "light" = neutrales Light-Pill. */
  variant?: 'dark' | 'light';
}

export default function WizardLanguageSwitcher({ className, variant = 'dark' }: Props) {
  const { lang, setLang } = useWizardLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = LANGS.find(l => l.code === lang) || LANGS[0];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition',
          variant === 'dark'
            ? 'border-white/15 bg-white/5 text-white backdrop-blur-md hover:bg-white/10'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        )}
        aria-label="Sprache wählen / Choose language"
      >
        <Globe className="h-4 w-4 opacity-70" />
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn(
          'absolute right-0 mt-2 w-48 rounded-xl border p-1 shadow-2xl z-50',
          variant === 'dark'
            ? 'border-white/15 bg-[#0b1228]/95 text-white backdrop-blur-xl'
            : 'border-slate-200 bg-white text-slate-800',
        )}>
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                variant === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100',
                lang === l.code && (variant === 'dark' ? 'bg-cyan-400/10 text-cyan-200' : 'bg-cyan-50 text-cyan-700'),
              )}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              <span className="text-xs opacity-60">{l.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
