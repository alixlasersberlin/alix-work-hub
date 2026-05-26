import {
  ClipboardList, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck,
  Factory, ShoppingCart, LayoutDashboard, Search, Package, Tag, ListChecks,
  Warehouse, Map, Truck, Calculator, Banknote, Settings, HelpCircle,
} from 'lucide-react';
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

type Section = {
  id: string;
  title: string;
  icon: typeof ShoppingCart;
  intro: string;
  steps: Step[];
};

const sections: Section[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    intro: 'Tagesstart: Überblick über KPIs, offene Aufgaben und Hinweise.',
    steps: [
      {
        title: '1. Tagesstart prüfen',
        who: 'Alle Rollen',
        where: 'Dashboard',
        actions: [
          'KPI-Kacheln gemäß eigener Rolle sichten (Umsatz, offene Aufträge, Tourenstatus etc.).',
          'Warnhinweise und ungelesene Benachrichtigungen prüfen.',
          'Bei Abweichungen direkt in das jeweilige Modul abspringen.',
        ],
        result: 'Klarer Überblick über Tagesprioritäten.',
      },
    ],
  },
  {
    id: 'detailsuche',
    title: 'Detailsuche',
    icon: Search,
    intro: 'Modulübergreifende Suche nach Kunden, Aufträgen, Geräten und Rechnungen.',
    steps: [
      {
        title: '1. Suchbegriff eingeben',
        who: 'Alle Rollen mit Auftragsrechten',
        where: 'Detailsuche',
        actions: [
          'Name, Auftrags-/Zoho-Nummer, Seriennummer oder Rechnungsnummer eingeben.',
          'Filter (Modul, Status, Zeitraum) bei Bedarf setzen.',
          'Ergebnis öffnen → springt direkt in das Quellmodul.',
        ],
        result: 'Datensatz ist gefunden und im Originalkontext bearbeitbar.',
        note: 'Suche ist 300 ms gedrosselt – kurz auf Ergebnisse warten.',
      },
    ],
  },
  {
    id: 'artikel',
    title: 'Verkauf · Artikel',
    icon: Tag,
    intro: 'Stammdaten der Artikel, Katalog, Kategorien und Wareneingang.',
    steps: [
      {
        title: '1. Artikel pflegen',
        who: 'Vertrieb / Produktmanagement',
        where: 'Verkauf → Artikel',
        actions: [
          'Neuen Artikel anlegen oder bestehenden öffnen.',
          'Pflichtfelder (Bezeichnung, Kategorie, Preis) ausfüllen.',
          'Bilder/Dokumente anhängen, Katalogzuordnung prüfen.',
        ],
        result: 'Artikel steht in Angeboten, Aufträgen und Bestellungen zur Verfügung.',
      },
      {
        title: '2. Wareneingang buchen',
        who: 'Lager',
        where: 'Verkauf → Artikel → Wareneingang',
        actions: [
          'Lieferschein gegen Bestellung prüfen.',
          'Mengen, Seriennummern und Lagerplatz erfassen.',
          'Speichern → Bestand wird automatisch erhöht.',
        ],
        result: 'Lagerbestand und Bestellstatus sind aktualisiert.',
      },
    ],
  },
  {
    id: 'verkaeufe',
    title: 'Verkäufe (Angebote & Aufträge)',
    icon: ShoppingCart,
    intro: 'Vom Kundenanfrage zum verbindlichen Auftrag.',
    steps: [
      {
        title: '1. Angebot erstellen',
        who: 'Vertrieb',
        where: 'Verkauf → Angebote → „Neues Angebot"',
        actions: [
          'Kunde auswählen oder neu anlegen.',
          'Artikel mit Menge und Preis hinzufügen, Rabatte/Sonderpreise setzen.',
          'Anzahlungsbedingung und Liefertermin definieren.',
          'PDF generieren und an Kunden senden.',
        ],
        result: 'Angebot ist beim Kunden, Status „Versendet".',
      },
      {
        title: '2. Auftrag aus Angebot',
        who: 'Vertrieb',
        where: 'Angebot → „In Auftrag wandeln"',
        actions: [
          'Bestätigung des Kunden hinterlegen (E-Mail/Unterschrift).',
          'Angebot in Auftrag umwandeln – Zoho-Nummer wird übernommen, nicht überschrieben.',
          'Anzahlungsrechnung erstellen, sobald Anzahlung fällig ist.',
        ],
        result: 'Auftrag ist aktiv und für Production/Tourenplanung sichtbar.',
      },
    ],
  },
  {
    id: 'prio',
    title: 'Prio-Listen',
    icon: ListChecks,
    intro: 'Tagesaktuelle Priorisierung offener Aufträge (Hold, Klärung, geliefert).',
    steps: [
      {
        title: '1. Listen abarbeiten',
        who: 'Vertrieb / Auftragsmanagement',
        where: 'Prio-Listen',
        actions: [
          'Hold-Liste prüfen: Blockierende Gründe klären (Zahlung, Material, Kunde).',
          'In-Klärung-Liste: offene Punkte mit Kunde/Lieferant abstimmen.',
          'Bei Erledigung: Auftrag aus der Liste nehmen oder Status anpassen.',
        ],
        result: 'Aufträge sind nicht blockiert und können fortlaufen.',
      },
    ],
  },
  {
    id: 'bestellungen',
    title: 'Bestellungen',
    icon: ShoppingCart,
    intro: 'Vom erkannten Bedarf bis zum Wareneingang beim Lieferanten.',
    steps: [
      {
        title: '1. Bedarf prüfen',
        who: 'Vertrieb / Auftragsmanagement',
        where: 'Auftrag → Reiter „Production"',
        actions: [
          'Auftrag öffnen und zu bestellende Positionen identifizieren.',
          'Lagerbestand prüfen.',
        ],
        result: 'Bestelliste steht fest.',
      },
      {
        title: '2. Bestellung anlegen',
        who: 'Vertrieb / Auftragsmanagement',
        where: 'Bestellungen → „Neue Bestellung"',
        actions: [
          'Lieferant, Artikel, Menge, Preis, Liefertermin erfassen.',
          'Referenz auf auslösenden Auftrag setzen (Zoho-Nummer bleibt unverändert).',
          'Speichern → Status „Entwurf".',
        ],
        result: 'Bestellung wartet auf Super-Admin-Freigabe.',
        note: 'Anhänge (Zeichnungen) direkt an der Bestellung hochladen.',
      },
      {
        title: '3. Freigabe einholen',
        who: 'Super Admin',
        where: 'Bestellungen → Detailansicht',
        actions: [
          'Inhalt prüfen, „Freigeben" klicken.',
          'Bei Rückfragen: mit Kommentar zurückweisen.',
        ],
        result: 'approval_status = approved, PDF/Versand jetzt möglich.',
        note: 'Ohne Freigabe sind PDF-Download und E-Mail-Versand technisch gesperrt.',
      },
      {
        title: '4. An Lieferant senden',
        who: 'Einkauf',
        where: 'Bestellungen → Detailansicht',
        actions: ['PDF prüfen.', 'Per E-Mail an Lieferanten senden.'],
        result: 'Status „Versendet", Versanddatum dokumentiert.',
      },
      {
        title: '5. Wareneingang',
        who: 'Lager',
        where: 'Verkauf → Artikel → Wareneingang',
        actions: ['Ware der Bestellung zuordnen.', 'Bei Abweichung: Reklamation einleiten.'],
        result: 'Bestand erhöht, Bestellung „Geliefert".',
      },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    icon: Factory,
    intro: 'Vom übernommenen Auftrag bis zur Fertigstellung.',
    steps: [
      {
        title: '1. Auftrag übernehmen',
        who: 'Production-Leitung',
        where: 'Production → Übersicht',
        actions: ['Eingang sichten, Stückliste prüfen, Equipment-Area zuweisen.'],
        result: 'Auftrag ist für Mitarbeiter sichtbar.',
      },
      {
        title: '2. Material prüfen',
        who: 'Production / Einkauf',
        where: 'Lagerbestand + Bestellungen',
        actions: ['Verfügbarkeit prüfen.', 'Fehlende Teile als Bestellung anstoßen.'],
        result: 'Produktion materialseitig abgesichert.',
      },
      {
        title: '3. Produktion durchführen',
        who: 'Production-Mitarbeiter',
        where: 'Production → Equipment-Bereich',
        actions: [
          'Auf „In Bearbeitung" setzen.',
          'Arbeitsschritte dokumentieren.',
          'Bei Problemen: „Hold" mit Grund.',
        ],
        result: 'Status jederzeit nachvollziehbar.',
      },
      {
        title: '4. Qualitätskontrolle',
        who: 'Production-Leitung',
        where: 'Production → Auftrag',
        actions: ['Endprüfung, Seriennummer vergeben.', 'Status „Fertig" setzen.'],
        result: 'Gerät auslieferbereit, sichtbar in Lager/Tourenplanung.',
      },
      {
        title: '5. Reklamationen',
        who: 'Production + Super Admin',
        where: 'Production → Reklamationen',
        actions: ['Reklamation als Production-Bestellung anlegen.', 'Super Admin freigeben lassen.'],
        result: 'Reklamation dokumentiert und beim Lieferanten platziert.',
        note: 'Auch Reklamationen unterliegen der Super-Admin-Freigabepflicht.',
      },
    ],
  },
  {
    id: 'lagerbestand',
    title: 'Lagerbestand',
    icon: Warehouse,
    intro: 'Übersicht aller Geräte nach Zustand: Lager, Produktion, unterwegs, ausgeliefert, Hold, Leihgeräte.',
    steps: [
      {
        title: '1. Bestand prüfen',
        who: 'Lager',
        where: 'Lagerbestand → jeweilige Unterliste',
        actions: [
          'Liste nach Status auswählen (Lager, Produktion, unterwegs, ausgeliefert, Hold).',
          'Seriennummer scannen oder filtern.',
          'Statuswechsel ausschließlich über vorgesehene Buttons – kein Direkt-Edit.',
        ],
        result: 'Tatsächlicher Bestand stimmt mit System überein.',
      },
      {
        title: '2. Leihgeräte verwalten',
        who: 'Lager / Vertrieb',
        where: 'Lagerbestand → Leihgeräte',
        actions: ['Ausgabe und Rückgabe erfassen.', 'Rückgabetermin überwachen.'],
        result: 'Leihgeräte sind eindeutig zuordenbar.',
      },
    ],
  },
  {
    id: 'tourenplanung',
    title: 'Tourenplanung',
    icon: Map,
    intro: 'Planung und Durchführung von Auslieferungs- und Servicetouren.',
    steps: [
      {
        title: '1. Tour erstellen',
        who: 'Tourenplaner',
        where: 'Tourenplanung → „Neue Tour"',
        actions: [
          'Datum, Fahrzeug und Fahrer wählen.',
          'Aufträge/Geräte per Drag & Drop zuordnen.',
          'Fahrzeiten werden automatisch via Google Maps berechnet.',
        ],
        result: 'Tour ist geplant, Reihenfolge optimiert.',
      },
      {
        title: '2. Tour durchführen',
        who: 'Fahrer',
        where: 'Tourenplanung → Tour-Detail',
        actions: ['Stopps abarbeiten, Lieferung/Service bestätigen.', 'Unterschrift/Foto erfassen.'],
        result: 'Tourstatus aktualisiert sich live.',
      },
      {
        title: '3. Tour abschließen',
        who: 'Tourenplaner',
        where: 'Tourenplanung → Tour-Detail',
        actions: ['Tour finalisieren → audit_locked.', 'Abweichungen dokumentieren.'],
        result: 'Tour ist abgeschlossen und unveränderlich archiviert.',
        note: 'Nach Abschluss keine inhaltlichen Änderungen mehr möglich.',
      },
    ],
  },
  {
    id: 'versand',
    title: 'Versand',
    icon: Truck,
    intro: 'Lieferscheine, Ratenpläne und Versanddokumente.',
    steps: [
      {
        title: '1. Lieferschein erzeugen',
        who: 'Lager / Versand',
        where: 'Versand → Lieferscheine',
        actions: ['Auftrag wählen, Positionen prüfen.', 'PDF erzeugen, Kunde benachrichtigen.'],
        result: 'Lieferschein ist erstellt und versendet.',
      },
      {
        title: '2. Ratenplan überwachen',
        who: 'Buchhaltung',
        where: 'Versand → Ratenplan',
        actions: ['Fällige Raten prüfen.', 'Bei Verzug Erinnerung auslösen.'],
        result: 'Zahlungsfluss bleibt im Plan.',
      },
    ],
  },
  {
    id: 'buchhaltung',
    title: 'Buchhaltung',
    icon: Calculator,
    intro: 'Rechnungen, Anzahlungen, Gutschriften, offene Posten.',
    steps: [
      {
        title: '1. Rechnung stellen',
        who: 'Buchhaltung',
        where: 'Buchhaltung → Rechnungen',
        actions: [
          'Auftrag auswählen, Rechnung erstellen (Anzahlung oder Schluss).',
          'PDF prüfen und an Kunden senden.',
        ],
        result: 'Rechnung ist im System und beim Kunden.',
      },
      {
        title: '2. Offene Posten verfolgen',
        who: 'Buchhaltung',
        where: 'Buchhaltung → Offene Posten',
        actions: [
          'Alle 15 Minuten automatischer Sync unbezahlter Rechnungen aus Zoho.',
          'Mahnstufe setzen, Mahnung versenden.',
        ],
        result: 'Forderungen werden konsequent eingetrieben.',
      },
      {
        title: '3. Gutschriften & Korrekturen',
        who: 'Buchhaltung',
        where: 'Buchhaltung → Gutschriften',
        actions: ['Bezug zur Originalrechnung herstellen.', 'Gutschrift versenden und buchen.'],
        result: 'Korrektur ist sauber dokumentiert.',
      },
    ],
  },
  {
    id: 'finanzierungen',
    title: 'Finanzierungen',
    icon: Banknote,
    intro: 'Bankanfragen, Zusagen, Absagen, Leasing.',
    steps: [
      {
        title: '1. Finanzierung beantragen',
        who: 'Vertrieb / Finanzierungen',
        where: 'Finanzierungen → „Beantragen"',
        actions: [
          'Auftrag und Kunde wählen, Unterlagen anhängen.',
          'Banken auswählen → Anfragen werden parallel versendet.',
        ],
        result: 'Anfragen stehen bei den Banken.',
      },
      {
        title: '2. Rückmeldungen pflegen',
        who: 'Finanzierungen',
        where: 'Finanzierungen → Zusagen/Absagen',
        actions: ['Bank-Antworten erfassen.', 'Bei Zusage Konditionen mit Kunden klären.'],
        result: 'Finanzierungslage je Auftrag transparent.',
      },
      {
        title: '3. Vertrag & Auszahlung',
        who: 'Finanzierungen / Buchhaltung',
        where: 'Finanzierungen → Leasing/Bank',
        actions: ['SEPA-Mandat / Vertrag unterschreiben lassen.', 'Auszahlung dokumentieren.'],
        result: 'Auftrag ist finanziert und freigegeben.',
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations (System)',
    icon: Settings,
    intro: 'Nur für System-Rollen: Benutzer, Logs, E-Mail-Vorlagen, Backups, Imports.',
    steps: [
      {
        title: '1. Benutzer & Rollen',
        who: 'Super Admin',
        where: 'Operations → Benutzer',
        actions: [
          'Neuen Mitarbeiter anlegen oder Status setzen (aktiv/blockiert).',
          'Rolle zuweisen – steuert sämtliche Modulrechte.',
          'MFA-Pflicht prüfen.',
        ],
        result: 'Zugriffe sind korrekt vergeben.',
        note: 'Rollen werden ausschließlich über user_roles verwaltet – nie im Profil.',
      },
      {
        title: '2. Imports & Sync',
        who: 'System-Admin',
        where: 'Operations → Import Management',
        actions: ['Zoho-Sync starten / Status prüfen.', 'Fehlerprotokoll auswerten.'],
        result: 'Stammdaten und Rechnungen sind aktuell.',
      },
      {
        title: '3. Backups & Logs',
        who: 'System-Admin',
        where: 'Operations → Backups / Logfiles',
        actions: [
          'Nightly-Backup-Status prüfen.',
          'Bei Auffälligkeiten Logfiles analysieren.',
        ],
        result: 'System ist gesichert und nachvollziehbar.',
      },
      {
        title: '4. E-Mail-Vorlagen',
        who: 'Admin',
        where: 'Operations → E-Mail-Vorlagen',
        actions: ['Vorlagen pflegen, Platzhalter testen.'],
        result: 'Alle Ausgangs-Mails verwenden geprüfte Templates.',
      },
    ],
  },
  {
    id: 'hilfe',
    title: 'Hilfe',
    icon: HelpCircle,
    intro: 'Support, Dokumentation und diese Arbeitsanleitung.',
    steps: [
      {
        title: '1. Hilfe nutzen',
        who: 'Alle',
        where: 'Hilfe',
        actions: [
          'Dokumentation für technisches Verständnis öffnen.',
          'Arbeitsanleitung für Schritt-für-Schritt-Abläufe nutzen.',
          'Bei ungelösten Problemen: Support per E-Mail kontaktieren.',
        ],
        result: 'Frage ist beantwortet oder Ticket ist gestellt.',
      },
    ],
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <Card>
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
            Schritt-für-Schritt-Anleitung für alle Abteilungen und Menüpunkte.
          </p>
        </div>
        <Link to="/hilfe" className="ml-auto text-sm text-primary hover:underline">
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

      {/* Inhaltsverzeichnis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inhalt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:border-primary/60 hover:bg-primary/5 transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{s.title}</span>
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {sections.map((section, idx) => {
        const Icon = section.icon;
        return (
          <div key={section.id} className="space-y-4">
            {idx > 0 && <Separator />}
            <section id={section.id} className="space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">{section.intro}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {section.steps.map((s, i) => (
                  <StepCard key={s.title} step={s} index={i} />
                ))}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
