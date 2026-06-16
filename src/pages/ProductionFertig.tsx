import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function ProductionFertig() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CheckCircle2}
        title="Production – Fertig produziert"
        subtitle="Abgeschlossene Produktionsaufträge."
        noBreadcrumbs
      />
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen abgeschlossene Produktionsaufträge.
        </CardContent>
      </Card>
    </div>
  );
}
