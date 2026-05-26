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
            <a href="mailto:rde@alix-lasers.com" className="inline-flex items-center gap-2 text-primary hover:underline">
              <Mail className="h-4 w-4" /> rde@alix-lasers.com
            </a>
            <p className="text-xs">
              Aktuelle Antwortzeit: bis{' '}
              <span className="font-medium text-foreground">
                {new Date(Date.now() + 6 * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </p>
          </CardContent>
        </Card>

        <Link to="/hilfe/dokumentation" className="block">
          <Card className="hover:border-primary/60 transition-colors h-full">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <BookOpen className="h-6 w-6 text-primary" />
              <CardTitle className="text-lg">Dokumentation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Komplette Übersicht aller Module und Unterpunkte der Anwendung.</p>
            </CardContent>
          </Card>
        </Link>

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
