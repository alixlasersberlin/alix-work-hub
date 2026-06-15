import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

export default function Gutschriften() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Undo2}
        title="Gutschriften"
        subtitle="Verwaltung der Gutschriften."
        noBreadcrumbs
      />
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre Gutschriften.
        </CardContent>
      </Card>
    </div>
  );
}
