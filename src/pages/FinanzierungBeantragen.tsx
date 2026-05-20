import { FileSignature } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FinanzierungBeantragen() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileSignature className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Finanzierung beantragen</h1>
          <p className="text-muted-foreground text-sm">
            Neue Finanzierungsanfrage für einen Auftrag erstellen.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In Vorbereitung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Hier kannst du in Kürze einen Auftrag auswählen und eine Finanzierungsanfrage an die Bank stellen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
