import { HelpCircle, Mail, BookOpen, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Hilfe() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Hilfe</h1>
          <p className="text-muted-foreground text-sm">Support, Dokumentation und Kontakt.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Support kontaktieren</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Bei technischen Problemen oder Fragen wenden Sie sich an das IT-Team.</p>
            <a href="mailto:it@alix-finance.de" className="inline-flex items-center gap-2 text-primary hover:underline">
              <Mail className="h-4 w-4" /> it@alix-finance.de
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <BookOpen className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Dokumentation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Anleitungen und Handbücher zu allen Modulen werden hier in Kürze bereitgestellt.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <HelpCircle className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Häufige Fragen</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>FAQ-Bereich folgt. Senden Sie uns Ihre häufigsten Fragen per E-Mail.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
