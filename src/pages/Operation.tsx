import { Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Operation() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Workflow className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Operation</h1>
          <p className="text-muted-foreground text-sm">Operative Abläufe und Tools.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier werden die Operations-Funktionen erscheinen.
        </CardContent>
      </Card>
    </div>
  );
}
