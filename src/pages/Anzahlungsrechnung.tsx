import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';

export default function Anzahlungsrechnung() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Anzahlungsrechnungen</h1>
          <p className="text-muted-foreground text-sm">Verwaltung der Anzahlungsrechnungen.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre Anzahlungsrechnungen.
        </CardContent>
      </Card>
    </div>
  );
}
