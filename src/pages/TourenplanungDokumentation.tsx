import { Link } from 'react-router-dom';
import {
  BookOpen, ArrowLeft, LayoutDashboard, CalendarDays, Map, Truck, Users,
  Settings, Wrench, Bot, BarChart3, Archive, Package, Satellite, MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';

type Entry = { path: string; label: string; desc: string; roles: string[] };
type Section = { icon: typeof BookOpen; title: string; intro: string; entries: Entry[] };

const PLAN = ['Admin', 'Super Admin', 'Tourenplanung'];
const PLAN_RO = [...PLAN, 'Order', 'Read Only Audit'];

const sections: Section[] = [
  {
    icon: LayoutDashboard,
    title: 'Übersicht & Steuerung',
    intro: 'Einstieg in die Tagesarbeit: Kennzahlen, offene Einsätze und Auslastung.',
    entries: [
      { path: '/tourenplanung/dashboard', label: 'Touren-Dashboard', desc: 'KPIs zu heutigen Touren, offenen und überfälligen Einsätzen, aktiven Technikern und Ø Einsatzdauer.', roles: PLAN_RO },
      { path: '/tourenplanung', label: 'Tourenplanung (Liste)', desc: 'Alle Tourenpläne mit Status, Termin, Techniker und Kunde. Zentrale Arbeitsliste der Disposition.', roles: PLAN_RO },
      { path: '/dispatch', label: 'Dispatch Center', desc: 'Operatives Cockpit für Termine, Touren, Fahrzeuge und Fahrer.', roles: PLAN_RO },
    ],
  },
  {
    icon: CalendarDays,
    title: 'Termine & Planung',
    intro: 'Von der eingehenden Anforderung bis zum fest eingeplanten Einsatz.',
    entries: [
      { path: '/dispatch/ungeplant', label: 'Ungeplante Aufträge', desc: 'Pool aller Einsätze ohne Termin. Basis für die Tagesplanung.', roles: PLAN },
      { path: '/dispatch/termine', label: 'Termine', desc: 'Alle Serviceeinsätze mit Zeitfenster, Status und Zuordnung.', roles: PLAN_RO },
      { path: '/dispatch/tagesplanung', label: 'Tagesplanung', desc: 'Drag-&-Drop-Zuordnung von Terminen auf Fahrer und Fahrzeuge inkl. Konfliktprüfung.', roles: PLAN },
      { path: '/tourenplanung/neu', label: 'Tourenplan anlegen', desc: 'Manuelles Anlegen eines Einsatzes mit Kunde, Adresse, Termin und Techniker.', roles: PLAN },
      { path: '/tourenplanung/kalender', label: 'Touren-Kalender', desc: 'Kalendarische Sicht auf alle geplanten Einsätze (Tag/Woche/Monat).', roles: PLAN_RO },
      { path: '/tourenplanung/karte', label: 'Touren-Karte', desc: 'Geografische Darstellung der Einsätze zur Bündelung nach Region/PLZ.', roles: PLAN_RO },
    ],
  },
  {
    icon: Truck,
    title: 'Touren & Ausführung',
    intro: 'Zusammengestellte Touren, deren Freigabe und Nachbereitung.',
    entries: [
      { path: '/dispatch/touren', label: 'Touren', desc: 'Übersicht aller Touren mit Tour-Nr., Datum, Fahrer, Fahrzeug, km und Fahrzeit.', roles: PLAN_RO },
      { path: '/dispatch/retouren', label: 'Retouren', desc: 'Rückholungen und Geräterücknahmen als eigener Einsatztyp.', roles: PLAN },
      { path: '/dispatch/spediteure', label: 'Spediteure', desc: 'Externe Transportdienstleister und deren Aufträge.', roles: PLAN },
      { path: '/dispatch/archiv', label: 'Archiv', desc: 'Abgeschlossene Touren inkl. Protokollen, Unterschriften und Fotos.', roles: PLAN_RO },
    ],
  },
  {
    icon: Users,
    title: 'Ressourcen',
    intro: 'Stammdaten, ohne die keine Tour geplant werden kann.',
    entries: [
      { path: '/dispatch/fahrer', label: 'Fahrer', desc: 'Fahrer/Techniker mit Qualifikationen, Verfügbarkeit und Region.', roles: PLAN },
      { path: '/dispatch/fahrzeuge', label: 'Fahrzeuge', desc: 'Fuhrpark mit Kennzeichen, Kapazität und Status.', roles: PLAN },
      { path: '/dispatch/wartung', label: 'Wartung', desc: 'Wartungs- und Prüftermine der Fahrzeuge inkl. Fälligkeitswarnungen.', roles: PLAN },
      { path: '/dispatch/telematik', label: 'Telematik', desc: 'Anbindung von GPS-/Telematikdaten für Live-Positionen und ETA.', roles: PLAN },
    ],
  },
  {
    icon: BarChart3,
    title: 'Auswertung & KI',
    intro: 'Kosten, Qualität und automatisierte Optimierungsvorschläge.',
    entries: [
      { path: '/dispatch/performance', label: 'Performance', desc: 'Pünktlichkeit, Auslastung, km je Einsatz und Erfolgsquote.', roles: PLAN_RO },
      { path: '/dispatch/kosten', label: 'Kosten', desc: 'Tour- und Fahrzeugkosten (km-Pauschalen, Zeiten, externe Fracht).', roles: PLAN_RO },
      { path: '/dispatch/ki', label: 'KI-Assistent', desc: 'Vorschläge zur Routenoptimierung, Bündelung und Terminverschiebung.', roles: PLAN },
    ],
  },
  {
    icon: Settings,
    title: 'Einstellungen & Kommunikation',
    intro: 'Konfiguration der Planung und Kundeninformation.',
    entries: [
      { path: '/tourenplanung/einstellungen', label: 'Einstellungen Tourenplanung', desc: 'Standardzeiten, Zeitfenster, Statuswerte und Planungsregeln.', roles: PLAN },
      { path: '/dispatch/einstellungen', label: 'Einstellungen Dispatch', desc: 'Fahrzeug-/Fahrerdefaults, Kostensätze, Optimierungsparameter.', roles: PLAN },
      { path: '/tourenplanung/sms-vorlage', label: 'SMS-Vorlage', desc: 'Textvorlagen für Terminbestätigung und Ankündigung an Kunden.', roles: PLAN },
      { path: '/tourenplanung/reparaturannahme', label: 'Reparaturannahme', desc: 'Erfassung von Reparaturfällen, die zu einem Einsatz führen.', roles: PLAN },
    ],
  },
];

const glossar = [
  ['Tourenplan', 'Ein einzelner Einsatz (Lieferung, Installation, Service, Abholung) bei einem Kunden.'],
  ['Tour', 'Zusammenfassung mehrerer Einsätze eines Tages zu einer Fahrt mit Fahrer und Fahrzeug.'],
  ['Ungeplant', 'Einsatz ist angelegt, hat aber noch kein Datum und keine Ressource.'],
  ['Zeitfenster', 'Dem Kunden zugesagter Zeitraum, in dem der Techniker eintrifft.'],
  ['ETA', 'Voraussichtliche Ankunftszeit, berechnet aus Distanz und Durchschnittsgeschwindigkeit.'],
  ['Einsatzprotokoll', 'Ergebnis des Einsatzes inkl. Unterschrift, Fotos und Arbeitszeiten.'],
];

export default function TourenplanungDokumentation() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Dokumentation · Tourenplanung"
        subtitle="Aufbau, Module und Begriffe der Tourenplanung und des Dispatch Centers."
        noBreadcrumbs
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/hilfe"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück zur Hilfe</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/hilfe/tourenplanung/arbeitsanleitung">Zur Arbeitsanleitung</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Map className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Worum geht es?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Die Tourenplanung steuert alle Kundeneinsätze: Lieferung, Installation, Einweisung,
            Service, Reparaturabholung und Retoure. Sie besteht aus zwei verbundenen Bereichen:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-foreground font-medium">Tourenplanung</span> – der einzelne Einsatz je Kunde (Termin, Techniker, Status, Protokoll).</li>
            <li><span className="text-foreground font-medium">Dispatch Center</span> – die Bündelung der Einsätze zu Touren mit Fahrzeug, Fahrer, Route, Kosten und Auswertung.</li>
          </ul>
          <p>
            Datenquelle sind Aufträge aus Zoho bzw. AlixWork. Ein Einsatz entsteht entweder automatisch
            aus einem lieferbereiten Auftrag oder manuell über „Tourenplan anlegen“.
          </p>
        </CardContent>
      </Card>

      {sections.map((s) => (
        <Card key={s.title}>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <s.icon className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg">{s.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{s.intro}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.entries.map((e) => (
              <div key={e.path} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={e.path} className="font-medium text-primary hover:underline">{e.label}</Link>
                  <span className="text-xs text-muted-foreground">{e.path}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{e.desc}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {e.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Package className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Statuswerte</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p><span className="text-foreground font-medium">Entwurf</span> – Einsatz erfasst, noch nicht disponiert.</p>
          <p><span className="text-foreground font-medium">Geplant</span> – Datum und Techniker gesetzt.</p>
          <p><span className="text-foreground font-medium">Bestätigt</span> – Termin mit dem Kunden abgestimmt (SMS/E-Mail versendet).</p>
          <p><span className="text-foreground font-medium">In Arbeit</span> – Techniker hat den Einsatz gestartet.</p>
          <p><span className="text-foreground font-medium">Erledigt</span> – Protokoll und Unterschrift liegen vor.</p>
          <p><span className="text-foreground font-medium">Fehlgeschlagen</span> – Kunde nicht angetroffen oder Einsatz nicht durchführbar → neu planen.</p>
          <p><span className="text-foreground font-medium">Storniert</span> – Einsatz entfällt.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <MessageSquare className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Glossar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {glossar.map(([term, desc]) => (
            <div key={term} className="text-sm">
              <span className="font-medium">{term}</span>
              <span className="text-muted-foreground"> — {desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Bot className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Technische Hinweise</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Einsätze liegen in <code>route_plans</code>, Touren in <code>delivery_tours</code>, Ressourcen in <code>dispatch_drivers</code> und <code>dispatch_vehicles</code>.</p>
          <p>Zugriff ist über RLS an die Rollen Admin, Super Admin und Tourenplanung gebunden; Löschen ist ausschließlich Super Admin erlaubt.</p>
          <p>Fahrzeiten/ETA werden aus Geokoordinaten bzw. PLZ-Distanzen berechnet; Telematikdaten können über den Telematik-Endpoint eingespielt werden.</p>
          <div className="flex gap-2 pt-2">
            <Wrench className="h-4 w-4" />
            <Satellite className="h-4 w-4" />
            <Archive className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
