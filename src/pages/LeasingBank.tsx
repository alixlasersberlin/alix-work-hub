import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark } from 'lucide-react';

export default function LeasingBank() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Leasing Bank</h1>
          <p className="text-muted-foreground text-sm">Verwaltung der Leasing-Bank Finanzierungen.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre Leasing-Bank Finanzierungen.
        </CardContent>
      </Card>
    </div>
  );
}
