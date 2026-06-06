import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, Plus } from 'lucide-react';

export default function MailCenterKampagnen() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Kampagnen</h2>
          <p className="text-sm text-muted-foreground">Übersicht aller Newsletter- und Marketingkampagnen.</p>
        </div>
        <Button disabled><Plus className="w-4 h-4 mr-2" /> Neue Kampagne</Button>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Kampagnenliste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Megaphone className="w-10 h-10 opacity-40 mb-3" />
            <p className="text-sm">Noch keine Kampagnen angelegt.</p>
            <p className="text-xs">Die Datenanbindung folgt im nächsten Schritt.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
