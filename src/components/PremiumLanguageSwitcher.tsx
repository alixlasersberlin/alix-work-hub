import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P_LANGS, type PLang } from '@/i18n/premium-wizard';

interface Props {
  lang: PLang;
  onChange: (l: PLang) => void;
  className?: string;
}

/** Heller Sprachumschalter für die Premium-Beratungsstrecke (DE · EN · ES · RU). */
export default function PremiumLanguageSwitcher({ lang, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = P_LANGS.find((l) => l.code === lang) ?? P_LANGS[0];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Sprache wählen / Choose language"
        className="flex items-center gap-2 h-10 rounded-full border !border-slate-200 !bg-white/80 px-3 text-[13px] !text-slate-700 backdrop-blur-md shadow-[0_10px_30px_-20px_rgba(15,23,42,0.5)] hover:!bg-white transition"
      >
        <Globe className="h-4 w-4 opacity-60" />
        <span className="text-base leading-none">{current.flag}</span>
        <span className="tracking-[0.12em] uppercase">{current.code}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border !border-slate-200 !bg-white p-1 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.5)]"
        >
          {P_LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === lang}
              onClick={() => {
                onChange(l.code);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm !text-slate-700 transition hover:!bg-slate-100',
                l.code === lang && '!bg-sky-50 !text-sky-700',
              )}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              <span className="text-xs opacity-60 uppercase">{l.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
