import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Datenschutz</h1>
        <p className="text-sm text-muted-foreground mt-1">DSGVO · Datenexport · Löschung · Anonymisierung · Aufbewahrung · Einwilligungen</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { t: "Datenexport (SAR)", d: "Exportiere alle personenbezogenen Daten eines Benutzers." },
          { t: "Kontolöschung", d: "Anonymisierung und Löschung nach Aufbewahrungsfrist." },
          { t: "Aufbewahrungsfristen", d: "Regelbasierte Retention pro Modul." },
          { t: "Einwilligungen", d: "Verwaltung von Consent-Records (Marketing, Analytics)." },
        ].map((c) => (
          <Card key={c.t} className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader><CardTitle className="text-sm">{c.t}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.d}</span>
              <Button variant="outline" size="sm">Öffnen</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
