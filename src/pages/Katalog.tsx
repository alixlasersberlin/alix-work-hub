import PageShell from '@/components/PageShell';
import { BookOpen } from 'lucide-react';

export default function Katalog() {
  return (
    <PageShell title="Katalog" subtitle="Produktkatalog – Übersicht und Pflege">
      <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-lg gold-gradient flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-primary-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Katalog</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Hier entsteht der Produktkatalog. Inhalte werden in Kürze ergänzt.
        </p>
      </div>
    </PageShell>
  );
}
