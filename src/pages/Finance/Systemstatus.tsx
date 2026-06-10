import { CheckCircle2, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { Settings as SettingsIcon } from 'lucide-react';

const STATUS = [
  { name: 'Zoho Integration', state: 'vorbereitet' },
  { name: 'DATEV Schnittstelle', state: 'vorbereitet' },
  { name: 'Mahnwesen', state: 'vorbereitet' },
  { name: 'Kontoauszugimport', state: 'vorbereitet' },
  { name: 'Sperrmanagement', state: 'vorbereitet' },
];

export default function FinanceSystemstatus() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader icon={<SettingsIcon className="w-6 h-6 text-primary" />} title="Finance Systemstatus" subtitle="Status der vorbereiteten Subsysteme" />
      <div className="grid gap-3 sm:grid-cols-2">
        {STATUS.map(s => (
          <div key={s.name} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 card-glow">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-foreground font-medium">{s.name}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-amber-500">
              <CheckCircle2 className="w-3.5 h-3.5" /> {s.state}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Noch keine aktive Funktion. Die Module werden in den nächsten Phasen aktiviert.</p>
    </div>
  );
}
