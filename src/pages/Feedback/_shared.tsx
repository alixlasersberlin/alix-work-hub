import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LucideIcon } from 'lucide-react';

export const SURVEY_STATUS: Record<string, string> = {
  entwurf: 'Entwurf',
  pruefung: 'Zur Prüfung',
  geplant: 'Geplant',
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  beendet: 'Beendet',
  archiviert: 'Archiviert',
};

export const QUESTION_TYPES: { value: string; label: string; hasOptions?: boolean }[] = [
  { value: 'text', label: 'Textantwort (einzeilig)' },
  { value: 'textarea', label: 'Textantwort (mehrzeilig)' },
  { value: 'yesno', label: 'Ja / Nein' },
  { value: 'single', label: 'Einfachauswahl', hasOptions: true },
  { value: 'multi', label: 'Mehrfachauswahl', hasOptions: true },
  { value: 'dropdown', label: 'Dropdown', hasOptions: true },
  { value: 'stars', label: 'Sternebewertung 1–5' },
  { value: 'scale10', label: 'Skala 1–10' },
  { value: 'slider', label: 'Zufriedenheits-Slider' },
  { value: 'nps', label: 'Net Promoter Score 0–10' },
  { value: 'matrix', label: 'Matrixfrage', hasOptions: true },
  { value: 'ranking', label: 'Rangfolge', hasOptions: true },
  { value: 'date', label: 'Datum' },
  { value: 'number', label: 'Zahlenwert' },
  { value: 'upload', label: 'Datei-Upload' },
  { value: 'consent', label: 'Zustimmung (Checkbox)' },
  { value: 'signature', label: 'Digitale Unterschrift' },
  { value: 'heading', label: 'Überschrift' },
  { value: 'description', label: 'Beschreibungstext' },
  { value: 'divider', label: 'Trennlinie' },
  { value: 'media', label: 'Bild oder Video' },
  { value: 'contact_ok', label: 'Kontaktfreigabe' },
  { value: 'testimonial_ok', label: 'Testimonial-Freigabe' },
];

export const REWARD_TYPES = [
  'gutschein', 'rabatt', 'verbrauchsmaterial', 'filter', 'wartung', 'social_beitrag',
  'schulungsmodul', 'beratungstermin', 'pdf', 'ebook', 'download', 'versandartikel',
  'frei', 'verlosung',
];

export const LANGUAGES = [
  { code: 'de', label: 'Deutsch' }, { code: 'en', label: 'Englisch' },
  { code: 'fr', label: 'Französisch' }, { code: 'it', label: 'Italienisch' },
  { code: 'nl', label: 'Niederländisch' }, { code: 'pl', label: 'Polnisch' },
  { code: 'tr', label: 'Türkisch' }, { code: 'ar', label: 'Arabisch' },
  { code: 'vi', label: 'Vietnamesisch' }, { code: 'ru', label: 'Russisch' },
];

export function Kpi({ label, value, icon: Icon, tone }: { label: string; value: ReactNode; icon?: LucideIcon; tone?: 'green' | 'red' | 'amber' }) {
  const toneCls = tone === 'green' ? 'text-emerald-400' : tone === 'red' ? 'text-destructive' : tone === 'amber' ? 'text-amber-400' : 'text-primary';
  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
          {Icon && <Icon className={`h-4 w-4 ${toneCls}`} />}
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    aktiv: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    entwurf: 'bg-muted text-muted-foreground',
    pausiert: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    beendet: 'bg-primary/15 text-primary border-primary/30',
    archiviert: 'bg-muted text-muted-foreground',
  };
  return <Badge variant="outline" className={map[status ?? ''] ?? ''}>{SURVEY_STATUS[status ?? ''] ?? status ?? '–'}</Badge>;
}

export function FeedbackHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
