import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LANGS, useWizardLang, type Lang } from '@/i18n/wizard';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /** "dark" = glassmorph dunkles Overlay. "light" = neutrales Light-Pill. "transparent" = transparenter Hintergrund, adaptiv zur Umgebung. */
  variant?: 'dark' | 'light' | 'transparent';
}

export default function WizardLanguageSwitcher({ className, variant = 'dark' }: Props) {
  const { lang, setLang } = useWizardLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 240;
      const padding = 12;
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.max(padding, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - padding)),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const current = LANGS.find(l => l.code === lang) || LANGS[0];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition',
          variant === 'dark' && 'border-white/15 bg-white/5 text-white backdrop-blur-md hover:bg-white/10',
          variant === 'light' && 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          variant === 'transparent' && 'border-foreground/15 bg-transparent text-foreground hover:bg-foreground/5 backdrop-blur-sm',
        )}
        aria-label="Sprache wählen / Choose language"
      >
        <Globe className="h-4 w-4 opacity-70" />
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div className={cn(
          'fixed w-60 max-h-[min(28rem,calc(100dvh-5rem))] overflow-y-auto rounded-xl border p-1 shadow-2xl z-[9999]',
          variant === 'dark' && 'border-white/15 bg-popover text-popover-foreground backdrop-blur-xl',
          variant === 'light' && 'border-slate-200 bg-white text-slate-800',
          variant === 'transparent' && 'border-foreground/15 bg-popover/90 text-popover-foreground backdrop-blur-xl',
        )}
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                variant === 'dark' ? 'hover:bg-white/10' : variant === 'light' ? 'hover:bg-slate-100' : 'hover:bg-foreground/5',
                lang === l.code && (variant === 'dark' ? 'bg-cyan-400/10 text-cyan-200' : variant === 'light' ? 'bg-cyan-50 text-cyan-700' : 'bg-primary/10 text-primary'),
              )}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              <span className="text-xs opacity-60">{l.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      , document.body)}
    </div>
  );
}
