import { Link } from 'react-router-dom';
import {
  ClipboardList, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck,
  CalendarDays, Truck, Users, Settings, BarChart3, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/infinity/PageHeader';

type Step = {
  title: string;
  who: string;
  where: string;
  path?: string;
  actions: string[];
  result: string;
  note?: string;
};

type Section = { id: string; title: string; icon: typeof Truck; intro: string; steps: Step[] };

const sections: Section[] = [
  {
    id: 'stammdaten',
    title: 'A · Vorbereitung (einmalig)',
    icon: Settings,
    intro: 'Ohne gepflegte Stammdaten kann keine Tour disponiert werden.',
    steps: [
      {
        title: '1. Fahrer und Fahrzeuge anlegen',
        who: 'Tourenplanung / Admin',
        where: 'Dispatch → Fahrer bzw. Fahrzeuge',
        path: '/dispatch/fahrer',
        actions: [
          'Je Techniker Name, Region, Qualifikationen und Verfügbarkeit erfassen.',
          'Je Fahrzeug Kennzeichen, Kapazität, Startadresse und Status pflegen.',
          'Inaktive Fahrer/Fahrzeuge deaktivieren statt löschen.',
        ],
        result: 'Ressourcen stehen in der Tagesplanung zur Auswahl.',
      },
      {
        title: '2. Planungsregeln und Vorlagen setzen',
        who: 'Tourenplanung / Admin',
        where: 'Tourenplanung → Einstellungen, SMS-Vorlage',
        path: '/tourenplanung/einstellungen',
        actions: [
          'Standard-Einsatzdauer, Zeitfenster und Arbeitszeiten festlegen.',
          'Kostensätze (km, Stunde) unter Dispatch → Einstellungen hinterlegen.',
          'SMS-Text für Terminbestätigung prüfen und freigeben.',
        ],
        result: 'Planung und Kundenkommunikation laufen einheitlich.',
      },
    ],
  },
  {
    id: 'planung',
    title: 'B · Tagesablauf Disposition',
    icon: CalendarDays,
    intro: 'Der wiederkehrende Arbeitsablauf der Tourenplanung – morgens und laufend.',
    steps: [
      {
        title: '1. Tagesstart: Dashboard prüfen',
        who: 'Tourenplanung',
        where: 'Tourenplanung → Dashboard',
        path: '/tourenplanung/dashboard',
        actions: [
          'Heutige Touren, offene und überfällige Einsätze sichten.',
          'Fehlgeschlagene Einsätze des Vortags identifizieren und neu einplanen.',
        ],
        result: 'Tagesprioritäten stehen fest.',
      },
      {
        title: '2. Ungeplante Einsätze sichten',
        who: 'Tourenplanung',
        where: 'Dispatch → Ungeplant',
        path: '/dispatch/ungeplant',
        actions: [
          'Neue lieferbereite Aufträge prüfen (Liefertermin, Adresse, PLZ, Gerät).',
          'Fehlende Daten beim Vertrieb / in der Auftragsmaske nachfordern.',
          'Einsätze nach Region und Dringlichkeit vorsortieren.',
        ],
        result: 'Klarer Pool an planbaren Einsätzen.',
        note: 'Einsätze ohne vollständige Adresse oder Telefonnummer nicht einplanen.',
      },
      {
        title: '3. Termin mit dem Kunden abstimmen',
        who: 'Tourenplanung',
        where: 'Tourenplan-Detail',
        actions: [
          'Kunde telefonisch oder per SMS kontaktieren, Zeitfenster vereinbaren.',
          'Termin im Tourenplan eintragen, Status auf „Bestätigt“ setzen.',
          'Bestätigungs-SMS/E-Mail versenden.',
        ],
        result: 'Termin ist verbindlich und dokumentiert.',
      },
      {
        title: '4. Tour zusammenstellen',
        who: 'Tourenplanung',
        where: 'Dispatch → Tagesplanung',
        path: '/dispatch/tagesplanung',
        actions: [
          'Termine per Drag & Drop auf Fahrer und Fahrzeug ziehen.',
          'Reihenfolge nach Region/PLZ optimieren, Karte zur Kontrolle nutzen.',
          'Konflikthinweise (Doppelbelegung, Arbeitszeit, Kapazität) auflösen.',
          'Optional KI-Assistent für Optimierungsvorschläge starten.',
        ],
        result: 'Tour mit Fahrer, Fahrzeug, Stoppreihenfolge, km und Fahrzeit.',
      },
      {
        title: '5. Tour freigeben',
        who: 'Tourenplanung / Admin',
        where: 'Dispatch → Touren',
        path: '/dispatch/touren',
        actions: [
          'Tour im Detail prüfen (Auslastung, Fahrzeit, Pausen).',
          'Status auf „Freigegeben“ setzen – Tour erscheint in der Fahrer-App.',
        ],
        result: 'Fahrer sieht die Tour mobil inkl. Adressen und Aufgaben.',
      },
    ],
  },
  {
    id: 'durchfuehrung',
    title: 'C · Durchführung im Feld',
    icon: Truck,
    intro: 'Was der Techniker vor Ort tut und was die Disposition begleitet.',
    steps: [
      {
        title: '1. Einsatz starten',
        who: 'Techniker / Fahrer',
        where: 'Mobile App',
        actions: [
          'Tour öffnen, Stopp auswählen, „Start“ drücken (Arbeitszeit läuft).',
          'Navigation aus der App heraus starten.',
        ],
        result: 'Status wechselt auf „In Arbeit“, Disposition sieht Fortschritt live.',
      },
      {
        title: '2. Einsatz dokumentieren',
        who: 'Techniker / Fahrer',
        where: 'Mobile App',
        actions: [
          'Checkliste abarbeiten, Fotos aufnehmen, Seriennummer erfassen.',
          'Kundenunterschrift einholen.',
          'Bei Abweichungen Bemerkung erfassen.',
        ],
        result: 'Vollständiges Einsatzprotokoll ist gespeichert.',
        note: 'Ohne Netz arbeitet die App offline – Daten werden später automatisch übertragen.',
      },
      {
        title: '3. Einsatz abschließen oder als fehlgeschlagen melden',
        who: 'Techniker / Fahrer',
        where: 'Mobile App',
        actions: [
          'Erfolgreich: „Erledigt“ setzen – Protokoll geht an die Zentrale.',
          'Nicht durchführbar: „Fehlgeschlagen“ mit Grund setzen.',
        ],
        result: 'Einsatz ist abgeschlossen und auswertbar.',
      },
    ],
  },
  {
    id: 'nachbereitung',
    title: 'D · Nachbereitung',
    icon: RefreshCw,
    intro: 'Tagesabschluss und Übergabe an Folgeprozesse.',
    steps: [
      {
        title: '1. Tag abschließen',
        who: 'Tourenplanung',
        where: 'Dispatch → Touren / Archiv',
        path: '/dispatch/archiv',
        actions: [
          'Alle Einsätze des Tages auf Endstatus prüfen.',
          'Fehlgeschlagene Einsätze sofort neu terminieren.',
          'Fehlende Protokolle beim Techniker nachfordern.',
        ],
        result: 'Keine offenen Einsätze aus dem Vortag.',
      },
      {
        title: '2. Folgeprozesse anstoßen',
        who: 'Tourenplanung',
        where: 'Auftrag / Finance',
        actions: [
          'Lieferung dokumentiert → Auftrag geht in Rechnungsstellung.',
          'Reparatur-/Retourenfälle an die zuständige Abteilung übergeben.',
          'Bei Mietkauf: Liefertermin für den Ratenplan bestätigen.',
        ],
        result: 'Kaufmännische Prozesse laufen ohne Verzögerung weiter.',
      },
      {
        title: '3. Auswertung',
        who: 'Tourenplanung / Leitung',
        where: 'Dispatch → Performance und Kosten',
        path: '/dispatch/performance',
        actions: [
          'Pünktlichkeit, Auslastung, km/Einsatz und Erfolgsquote prüfen.',
          'Auffällige Kostenpositionen klären.',
          'Wartungsfälligkeiten der Fahrzeuge kontrollieren.',
        ],
        result: 'Planung wird laufend verbessert.',
      },
    ],
  },
  {
    id: 'speditionsversand',
    title: 'E · Speditionsversand',
    icon: Truck,
    intro: 'Wenn das Gerät nicht mit eigener Tour, sondern über eine Spedition zum Kunden geht.',
    steps: [
      {
        title: '1. Spedition zuordnen',
        who: 'Tourenplanung',
        where: 'Dispatch → Speditionsversand',
        path: '/dispatch/speditionsversand',
        actions: [
          '„Neuer Speditionsversand" öffnen und Auftrag bzw. Liefertermin auswählen.',
          'Spedition wählen, Abholdatum und vereinbarten Preis eintragen.',
          'Hinweise zur Sendung erfassen (z. B. Hebebühne, Avisierung).',
        ],
        result: 'Sendung ist angelegt, Status „Angefragt".',
      },
      {
        title: '2. Frachtauftrag an die Spedition senden',
        who: 'Tourenplanung',
        where: 'Dispatch → Speditionsversand',
        path: '/dispatch/speditionsversand',
        actions: [
          'Frachtauftrag als PDF prüfen (Abhol-/Lieferadresse, Gerät, Seriennummer, Preis).',
          'PDF per E-Mail an die Spedition senden – der Versand wird protokolliert.',
          'Nach der Abholung Status auf „Abgeholt" setzen.',
        ],
        result: 'Spedition hat den Frachtauftrag, Abholung ist dokumentiert.',
      },
      {
        title: '3. Kunde informieren und Zustellung nachhalten',
        who: 'Tourenplanung',
        where: 'Dispatch → Speditionsversand',
        path: '/dispatch/speditionsversand',
        actions: [
          'Sendungsnummer der Spedition eintragen.',
          'Versandavis mit Sendungsnummer an den Kunden senden.',
          'Status auf „Unterwegs" und nach Zustellung auf „Zugestellt" setzen.',
        ],
        result: 'Kunde ist informiert, Sendung ist lückenlos dokumentiert.',
      },
    ],
  },
];


const rules = [
  'Kein Einsatz ohne vollständige Adresse, PLZ und Telefonnummer.',
  'Jeder Kundentermin wird bestätigt, bevor die Tour freigegeben wird.',
  'Statuswerte immer aktuell halten – das Dashboard ist die Grundlage aller Rückfragen.',
  'Fehlgeschlagene Einsätze noch am selben Tag neu terminieren.',
  'Löschen von Touren oder Einsätzen ist ausschließlich Super Admin erlaubt – sonst stornieren.',
  'Kundendaten und Fotos nur in AlixWork speichern, nie in privaten Messengern.',
];

export default function TourenplanungArbeitsanleitung() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Arbeitsanleitung · Tourenplanung"
        subtitle="Schritt-für-Schritt-Ablauf für Disposition, Techniker und Nachbereitung."
        noBreadcrumbs
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/hilfe"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück zur Hilfe</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/hilfe/tourenplanung/dokumentation">Zur Dokumentation</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Rollen und Zuständigkeiten</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p><span className="text-foreground font-medium">Tourenplanung</span> – plant Termine, stellt Touren zusammen, gibt frei, betreut den Kunden.</p>
          <p><span className="text-foreground font-medium">Techniker / Fahrer</span> – führt Einsätze durch und dokumentiert sie mobil.</p>
          <p><span className="text-foreground font-medium">Admin / Super Admin</span> – Stammdaten, Einstellungen, Freigaben und Korrekturen.</p>
          <p><span className="text-foreground font-medium">Vertrieb</span> – liefert vollständige Auftragsdaten als Planungsgrundlage.</p>
        </CardContent>
      </Card>

      {sections.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <s.icon className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg">{s.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{s.intro}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.steps.map((st, i) => (
              <div key={st.title}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{st.title}</span>
                  <Badge variant="outline" className="text-[10px]">{st.who}</Badge>
                  {st.path ? (
                    <Link to={st.path} className="text-xs text-primary hover:underline">{st.where}</Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">{st.where}</span>
                  )}
                </div>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
                  {st.actions.map((a) => <li key={a}>{a}</li>)}
                </ul>
                <div className="flex items-start gap-2 text-sm mt-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{st.result}</span>
                </div>
                {st.note && (
                  <div className="flex items-start gap-2 text-sm mt-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{st.note}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Verbindliche Regeln</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <BarChart3 className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Tages-Checkliste</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>☐ Dashboard geprüft, überfällige Einsätze bearbeitet</p>
          <p>☐ Ungeplante Einsätze gesichtet und terminiert</p>
          <p>☐ Kundenbestätigungen versendet</p>
          <p>☐ Touren zusammengestellt und freigegeben</p>
          <p>☐ Laufende Einsätze überwacht</p>
          <p>☐ Tagesabschluss: alle Einsätze auf Endstatus</p>
          <p>☐ Folgeprozesse (Rechnung, Reparatur, Ratenplan) angestoßen</p>
        </CardContent>
      </Card>
    </div>
  );
}
