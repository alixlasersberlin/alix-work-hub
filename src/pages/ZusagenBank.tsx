import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function ZusagenBank() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Zusagen Bank</h1>
          <p className="text-muted-foreground text-sm">Übersicht der bewilligten Leasing-Anfragen.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre Zusagen.
        </CardContent>
      </Card>
    </div>
  );
}
