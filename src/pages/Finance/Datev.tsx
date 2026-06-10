import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';

export default function FinanceDatev() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader icon={<FileText className="w-6 h-6 text-primary" />} title="DATEV Schnittstelle" subtitle="Phase 4 – wird vorbereitet" />
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
        Die DATEV-Schnittstelle wird in einer späteren Phase aktiviert.
      </div>
    </div>
  );
}
