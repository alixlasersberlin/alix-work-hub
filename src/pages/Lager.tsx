import PageShell from '@/components/PageShell';
import { Warehouse } from 'lucide-react';

export default function Lager() {
  return (
    <PageShell title="Lager" icon={Warehouse} description="Lagerverwaltung">
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Lagerverwaltung – Inhalt folgt.
      </div>
    </PageShell>
  );
}
