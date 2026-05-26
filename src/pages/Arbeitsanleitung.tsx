import { ClipboardList, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Factory, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Step = {
  title: string;
  who: string;
  where: string;
  actions: string[];
  result: string;
  note?: string;
};

const bestellungenSteps: Step[] = [
  {
    title: '1. Bedarf prüfen',
    who: 'Vertrieb / Auftragsmanagement',
    where: 'Auftrag → Reiter „Production"',
    actions: [
      'Auftrag im Modul „Aufträge" öffnen.',
      'Prüfen, welche Artikel produziert oder beim Lieferanten bestellt werden müssen.',
      'Verfügbarkeit im Lager prüfen (Bestand vs. benötigte Menge).',
    ],
    result: 'Liste der zu bestellenden Positionen steht fest.',
  },
  {
    title: '2. Bestellung anlegen',
    who: 'Vertrieb / Auftragsmanagement',
    where: 'Bestellungen → „Neue Bestellung"',
    actions: [
      'Lieferanten auswählen (Pflichtfeld).',
      'Artikel mit Menge, Preis und gewünschtem Liefertermin erfassen.',
      'Referenz auf den auslösenden Auftrag setzen (Zoho-Nummer bleibt unverändert).',
      'Bestellung speichern → Status „Entwurf".',
    ],
    result: 'Bestellung liegt im Status „Entwurf" vor und wartet auf Freigabe.',
    note: 'Anhänge (Zeichnungen, Spezifikationen) bitte direkt an der Bestellung hochladen.',
  },
  {
    title: '3. Freigabe einholen',
    who: 'Super Admin',
    where: 'Bestellungen → Detailansicht',
    actions: [
      'Bestellung aufrufen und Inhalt prüfen (Mengen, Preise, Lieferant).',
      'Auf „Freigeben" klicken → setzt approval_status = approved, approved_by und approved_at.',
      'Bei Rückfragen: Bestellung mit Kommentar zurückweisen.',
    ],
    result: 'Bestellung ist freigegeben. Erst jetzt sichtbar für Lieferant und PDF-Versand möglich.',
    note: 'Ohne Super-Admin-Freigabe sind PDF-Download und E-Mail-Versand technisch gesperrt.',
  },
  {
    title: '4. An Lieferant senden',
    who: 'Einkauf / Auftragsmanagement',
    where: 'Bestellungen → Detailansicht',
    actions: [
      'PDF generieren und prüfen.',
      'Bestellung per E-Mail an den Lieferanten senden (Button „Senden").',
      'Status wechselt automatisch auf „Versendet".',
    ],
    result: 'Lieferant hat die Bestellung erhalten, Versanddatum ist dokumentiert.',
  },
  {
    title: '5. Wareneingang erfassen',
    who: 'Lager / Production',
    where: 'Verkauf → Artikel → Wareneingang',
    actions: [
      'Eingegangene Ware der Bestellung zuordnen.',
      'Mengen und Seriennummern erfassen.',
      'Bei Abweichung: Reklamation an Lieferant einleiten (eigener Workflow).',
    ],
    result: 'Lagerbestand ist erhöht, Bestellung erhält Status „Geliefert".',
  },
];

const productionSteps: Step[] = [
  {
    title: '1. Auftrag in Production übernehmen',
    who: 'Production-Leitung',
    where: 'Production → Übersicht',
    actions: [
      'Neue Aufträge aus dem Eingangsstapel sichten.',
      'Auftrag öffnen, Stückliste und Liefertermin prüfen.',
      'Auftrag einem Produktionsbereich (Equipment-Area) zuweisen.',
    ],
    result: 'Auftrag erscheint im jeweiligen Bereich und ist für die Mitarbeiter sichtbar.',
  },
  {
    title: '2. Material & Bestellungen prüfen',
    who: 'Production / Einkauf',
    where: 'Lagerbestand + Bestellungen',
    actions: [
      'Verfügbarkeit aller Bauteile im Lager prüfen.',
      'Fehlende Teile über Modul „Bestellungen" anstoßen (siehe Bestellprozess oben).',
      'Lieferzeiten mit dem geplanten Produktionsstart abgleichen.',
    ],
    result: 'Produktion ist materialseitig abgesichert.',
  },
  {
    title: '3. Produktion durchführen',
    who: 'Production-Mitarbeiter',
    where: 'Production → Equipment-Bereich',
    actions: [
      'Auftrag auf „In Bearbeitung" setzen.',
      'Arbeitsschritte abarbeiten, Zwischenstände im Auftrag dokumentieren.',
      'Bei Problemen: Auftrag in den „Hold"-Status setzen und Grund angeben.',
    ],
    result: 'Gerät durchläuft die Fertigung, Status ist jederzeit nachvollziehbar.',
  },
  {
    title: '4. Qualitätskontrolle & Fertigstellung',
    who: 'Production-Leitung',
    where: 'Production → Auftrag',
    actions: [
      'Endprüfung durchführen, Seriennummer vergeben/erfassen.',
      'Status auf „Fertig" setzen.',
      'Gerät dem Lager (Lagergeräte) oder direkt der Tourenplanung zuweisen.',
    ],
    result: 'Gerät ist auslieferbereit und sichtbar im Lager / in der Tourenplanung.',
  },
  {
    title: '5. Reklamationen',
    who: 'Production + Super Admin',
    where: 'Production → Reklamationen',
    actions: [
      'Reklamation als eigene Production-Bestellung anlegen.',
      'Super Admin gibt die Reklamation frei (gleicher Workflow wie Bestellung).',
      'Nach Freigabe: PDF/E-Mail an Lieferant möglich.',
    ],
    result: 'Reklamation ist dokumentiert und beim Lieferanten platziert.',
    note: 'Auch Reklamationen unterliegen der Super-Admin-Freigabepflicht.',
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold">
          {index + 1}
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">{step.title}</CardTitle>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{step.who}</Badge>
            <Badge variant="outline">{step.where}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1.5">
          {step.actions.map((a, i) => (
            <li key={i} className="flex gap-2 text-muted-foreground">
              <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-primary/70" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p className="text-xs"><span className="font-medium text-foreground">Ergebnis:</span> {step.result}</p>
        </div>
        {step.note && (
          <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">{step.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Arbeitsanleitung() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Arbeitsanleitung</h1>
          <p className="text-muted-foreground text-sm">
            Schritt-für-Schritt-Übersicht für die tägliche Arbeit. Start: Bestellungen und Production.
          </p>
        </div>
        <Link
          to="/hilfe"
          className="ml-auto text-sm text-primary hover:underline"
        >
          ← Zurück zur Hilfe
        </Link>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 pt-6 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Wichtige Grundregel</p>
            <p className="text-muted-foreground">
              Production-Bestellungen (inkl. Reklamationen) müssen vom Super Admin freigegeben werden,
              bevor ein PDF erzeugt, versendet oder vom Lieferanten eingesehen werden kann.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Bestellungen – Ablauf</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Vom erkannten Bedarf bis zum Wareneingang. Jeder Schritt zeigt, wer was wo macht und welcher
          Status danach erreicht ist.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {bestellungenSteps.map((s, i) => (
            <StepCard key={s.title} step={s} index={i} />
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Production – Ablauf</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Vom übernommenen Auftrag bis zur Fertigstellung und Übergabe an Lager oder Tour. Greift
          direkt in den Bestellprozess, wenn Material fehlt.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {productionSteps.map((s, i) => (
            <StepCard key={s.title} step={s} index={i} />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weitere Bereiche</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Folgen in Kürze: Tourenplanung, Versand, Buchhaltung und Finanzierungen –
          jeweils als Schritt-für-Schritt-Anleitung.
        </CardContent>
      </Card>
    </div>
  );
}
