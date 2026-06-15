import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function Freigabe() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CheckCircle2}
        title="Freigabe"
        subtitle="Angebote und Vorgänge zur Freigabe."
        noBreadcrumbs
      />
      <Card>
        <CardHeader><CardTitle>Offene Freigaben</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Vorgänge, die freigegeben werden müssen.
        </CardContent>
      </Card>
    </div>
  );
}
