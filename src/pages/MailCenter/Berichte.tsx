import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function MailCenterBerichte() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Berichte</h2>
        <p className="text-sm text-muted-foreground">Auswertungen zu Versand, Engagement und Kampagnenerfolg.</p>
      </div>
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="w-10 h-10 opacity-40 mb-3" />
            <p className="text-sm">Noch keine Berichte verfügbar.</p>
            <p className="text-xs">Diagramme & Exporte folgen nach der Datenanbindung.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
