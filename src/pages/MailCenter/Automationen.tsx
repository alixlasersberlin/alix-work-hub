import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Workflow, Plus } from 'lucide-react';

export default function MailCenterAutomationen() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Automationen</h2>
          <p className="text-sm text-muted-foreground">Trigger-basierte E-Mail-Strecken (z. B. Lagereingang, Lieferung, Bewertung).</p>
        </div>
        <Button disabled><Plus className="w-4 h-4 mr-2" /> Neue Automation</Button>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Workflow className="w-4 h-4 text-primary" /> Regeln
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Workflow className="w-10 h-10 opacity-40 mb-3" />
            <p className="text-sm">Noch keine Automationen konfiguriert.</p>
            <p className="text-xs">Die Logik wird in einem späteren Schritt mit den Vorlagen verknüpft.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
