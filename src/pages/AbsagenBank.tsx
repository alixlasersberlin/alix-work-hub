import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function AbsagenBank() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <XCircle className="h-7 w-7 text-destructive" />
        <div>
          <h1 className="text-3xl font-bold">Absagen Bank</h1>
          <p className="text-muted-foreground text-sm">Übersicht der abgelehnten Leasing-Anfragen.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre Absagen.
        </CardContent>
      </Card>
    </div>
  );
}
