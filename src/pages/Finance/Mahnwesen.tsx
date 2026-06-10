import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function FinanceMahnwesen() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader icon={<AlertTriangle className="w-6 h-6 text-amber-500" />} title="Mahnwesen" subtitle="Phase 3 – wird vorbereitet" />
      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-10 text-center text-muted-foreground">
        Das Mahnwesen-Modul wird in einer späteren Phase aktiviert. Datenstruktur ist bereits vorbereitet (Mahnstufen, letzte Mahnung, Mahngebühren).
      </div>
    </div>
  );
}
