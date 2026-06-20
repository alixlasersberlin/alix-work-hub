import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function FortKnox() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Lock}
        title="Fort Knox"
        subtitle="Höchste Sicherheitsstufe – Tresor für kritische Daten und Operationen."
      />
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Dieser Bereich wird in Kürze ausgebaut.
        </CardContent>
      </Card>
    </div>
  );
}
