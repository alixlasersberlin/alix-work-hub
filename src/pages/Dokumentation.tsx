import { Link } from 'react-router-dom';
import {
  BookOpen, LayoutDashboard, SearchCheck, Package, TrendingUp, ClipboardList,
  ShoppingCart, Factory, Warehouse, MapPin, FileText, Banknote, Landmark,
  Workflow, HelpCircle, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Entry = { path: string; label: string; desc: string; roles: string[] };
type Section = {
  icon: typeof BookOpen;
  title: string;
  intro: string;
  entries: Entry[];
};

const sections: Section[] = [
  {
    icon: LayoutDashboard, title: 'Dashboard', intro: 'Rollenbasierte Startseite mit KPIs zu Aufträgen, Finanzen und Operations.',
    entries: [
      { path: '/', label: 'Dashboard', desc: 'Übersicht aller relevanten Kennzahlen für die eigene Rolle.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
    ],
  },
  {
    icon: SearchCheck, title: 'Detailsuche', intro: 'Globale Suche über Aufträge, Kunden und Belege.',
    entries: [
      { path: '/detailsuche', label: 'Detailsuche', desc: 'Volltextsuche mit Filtern über alle Datensätze.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
    ],
  },
  {
    icon: Package, title: 'Artikel', intro: 'Stammdaten zu Produkten, Kategorien, Katalog und Wareneingang.',
    entries: [
      { path: '/verkauf/artikel-uebersicht', label: 'Artikel-Übersicht', desc: 'KPI-Übersicht über Artikel und Bestände.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/artikel', label: 'Alle Artikel', desc: 'Vollständige Artikelliste mit Such- und Filterfunktion.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/artikel/kategorie', label: 'Kategorie', desc: 'Verwaltung der Artikelkategorien.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/artikel/katalog', label: 'Katalog', desc: 'Strukturierter Produktkatalog für den Vertrieb.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/artikel/wareneingang', label: 'Wareneingang', desc: 'Erfassung neuer Lieferungen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
    ],
  },
  {
    icon: TrendingUp, title: 'Verkäufe', intro: 'Vom Kundenstamm über Angebote bis zur Rechnung.',
    entries: [
      { path: '/verkauf', label: 'Übersicht', desc: 'KPI-Dashboard für Verkaufsaktivitäten.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/kunden', label: 'Kunden', desc: 'Kundenstammdaten mit Detailansicht und Bearbeitung.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/angebot/neu', label: 'Angebot erstellen', desc: 'Neues Angebot für einen Kunden anlegen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung'] },
      { path: '/verkauf/angebote', label: 'Angebote', desc: 'Liste aller offenen und abgeschlossenen Angebote.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/freigabe', label: 'Freigabe', desc: 'Aufträge in der Freigabe-Warteschleife.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/auftraege', label: 'Aufträge', desc: 'Zentrale Auftragsübersicht inkl. Status und Synchronisation mit Zoho.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/auftraege/in-klaerung', label: 'In Klärung', desc: 'Aufträge, die noch geklärt werden müssen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/anzahlungsrechnung', label: 'Anzahlungsrechnung', desc: 'Anzahlungsrechnungen erfassen und verfolgen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/finance/rechnungen', label: 'Rechnung', desc: 'Rechnungsübersicht (geteilt mit Buchhaltung).', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/verkauf/gutschriften', label: 'Gutschriften', desc: 'Gutschriften zu Rechnungen verwalten.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
    ],
  },
  {
    icon: ClipboardList, title: 'Prio-Listen', intro: 'Operative Listen für Priorisierung, Anwaltsfälle und Lieferungen.',
    entries: [
      { path: '/prio-liste', label: 'Prio-Liste', desc: 'Priorisierte Aufträge in Bearbeitung.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/prio-liste/hold', label: 'Hold', desc: 'Pausierte Aufträge auf Wiedervorlage.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/anwaltsliste', label: 'Anwaltsliste', desc: 'Aufträge mit juristischer Bearbeitung.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/geliefert', label: 'Auftrag geliefert', desc: 'Vollständig ausgelieferte Aufträge.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/teilgeliefert', label: 'Teilgeliefert', desc: 'Aufträge mit Teillieferungen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
    ],
  },
  {
    icon: ShoppingCart, title: 'Bestellungen', intro: 'Beschaffung und Produktions-Bestellungen inkl. Reklamationen. Super-Admin-Freigabe erforderlich.',
    entries: [
      { path: '/order/timeline', label: 'Timeline Bestellungen', desc: 'Zeitstrahl aller Bestellungen.', roles: ['Admin', 'Super Admin'] },
      { path: '/order/frei-bestellung', label: 'Bestellung möglich', desc: 'Aufträge, die zur Bestellung bereit sind.', roles: ['Admin', 'Super Admin'] },
      { path: '/order/reklamation', label: 'Bestellung Reklamation', desc: 'Reklamations-Bestellungen verwalten.', roles: ['Admin', 'Super Admin'] },
      { path: '/order', label: 'Factory Orders', desc: 'Bestellungen an Werke / Lieferanten.', roles: ['Admin', 'Super Admin'] },
    ],
  },
  {
    icon: Factory, title: 'Production', intro: 'Lieferanten-Portal für eingehende und ausgehende Produktionsaufträge.',
    entries: [
      { path: '/production/order-in', label: 'Order In', desc: 'Eingehende Aufträge für die Produktion.', roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
      { path: '/production', label: 'Liste', desc: 'Aktive Produktionsaufträge.', roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
      { path: '/production/fertig', label: 'Fertig', desc: 'Abgeschlossene Produktionsaufträge.', roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
      { path: '/production/factory-invoice', label: 'Factory Invoice', desc: 'Werks-Rechnungen einsehen und prüfen.', roles: ['Admin', 'Super Admin', 'FACTORY INVOICE'] },
    ],
  },
  {
    icon: Warehouse, title: 'Lagerbestand', intro: 'Übersicht über Leihgeräte, Lagergeräte und Equipment-Status.',
    entries: [
      { path: '/lager/leihgeraete', label: 'Leihgeräte', desc: 'Verleihgeräte und deren aktueller Status.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/lagergeraete', label: 'Lagergeräte', desc: 'Neugeräte im Lagerbestand.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/equipment-area/unterwegs', label: 'Unterwegs', desc: 'Geräte auf dem Transportweg.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/equipment-area/produktion', label: 'Produktion', desc: 'Geräte in der Produktion.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/equipment-area/warehouse', label: 'Warehouse', desc: 'Geräte im Warehouse.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/equipment-area/hold', label: 'Hold', desc: 'Geräte mit Hold-Status.', roles: ['Admin', 'Super Admin'] },
      { path: '/lager/equipment-area/ausgeliefert', label: 'Ausgeliefert', desc: 'Bereits ausgelieferte Geräte.', roles: ['Admin', 'Super Admin'] },
    ],
  },
  {
    icon: MapPin, title: 'Tourenplanung', intro: 'Planung und Verwaltung von Liefertouren.',
    entries: [
      { path: '/tourenplanung', label: 'Übersicht', desc: 'Übersicht aller Tourenpläne.', roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'] },
      { path: '/tourenplanung/neu', label: 'Neue Tour', desc: 'Neuen Tourenplan anlegen.', roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
      { path: '/tourenplanung/einstellungen', label: 'Einstellungen', desc: 'Konfiguration für Tourenplanung (Fahrzeiten, Regeln).', roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
    ],
  },
  {
    icon: FileText, title: 'Versand', intro: 'Versanddokumente und Zahlungsmandate.',
    entries: [
      { path: '/papiere', label: 'Übersicht', desc: 'Übersicht aller Versandpapiere.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/versand/lieferscheine', label: 'Lieferscheine', desc: 'Lieferscheine ausstellen und einsehen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/versand/ratenplan', label: 'Ratenplan', desc: 'Ratenpläne zu Aufträgen.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/versand/mietkauf', label: 'Mietkauf', desc: 'Mietkauf-Verträge.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
      { path: '/versand/sepa-mandat', label: 'SEPA Mandat', desc: 'SEPA-Lastschriftmandate verwalten.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Finance'] },
    ],
  },
  {
    icon: Banknote, title: 'Buchhaltung', intro: 'Finanzdaten, Rechnungen und Zahlungsüberwachung.',
    entries: [
      { path: '/finance', label: 'Übersicht', desc: 'Finanz-KPIs und Auswertungen.', roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/ratenzahler', label: 'Ratenzahler', desc: 'Übersicht aller Ratenzahler.', roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/rechnungen', label: 'Rechnungen', desc: 'Alle ausgestellten Rechnungen.', roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/offene-posten', label: 'Offene Posten', desc: 'Unbezahlte Rechnungen.', roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/unpaid-zoho', label: 'Unbezahlte Rechnungen (Zoho)', desc: 'Offene Posten aus Zoho Books.', roles: ['Admin', 'Super Admin', 'Finance'] },
    ],
  },
  {
    icon: Landmark, title: 'Finanzierungen', intro: 'Bank-/Leasing-Finanzierungen für Aufträge.',
    entries: [
      { path: '/finanzierungen/leasing-bank', label: 'Verfügbare Aufträge', desc: 'Aufträge, die für eine Bankfinanzierung in Frage kommen.', roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen'] },
      { path: '/finanzierungen/beantragen', label: 'Finanzierung beantragen', desc: 'Neue Bankfinanzierung anstoßen.', roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen'] },
      { path: '/finanzierungen/anfragen-offen', label: 'Anfragen offen', desc: 'Offene Finanzierungsanfragen.', roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen'] },
      { path: '/finanzierungen/zusagen-bank', label: 'Zusagen Bank', desc: 'Erfolgreich finanzierte Anfragen.', roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen'] },
      { path: '/finanzierungen/absagen-bank', label: 'Absagen Bank', desc: 'Abgelehnte Finanzierungsanfragen.', roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen'] },
    ],
  },
  {
    icon: Workflow, title: 'Operations', intro: 'Administrative Werkzeuge: Benutzer, Rollen, Import, Monitoring.',
    entries: [
      { path: '/geraetetypen', label: 'Gerätetypen', desc: 'Statistik aller Gerätetypen im System.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/import', label: 'Import', desc: 'Datenimport / Zoho-Synchronisation steuern.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Read Only Audit'] },
      { path: '/system', label: 'Monitoring', desc: 'System- und Job-Monitoring.', roles: ['Admin', 'Super Admin', 'Read Only Audit'] },
      { path: '/benutzer', label: 'Benutzer', desc: 'Benutzerverwaltung und Einladungen.', roles: ['Admin', 'Super Admin'] },
      { path: '/order/zulieferer', label: 'Lieferanten', desc: 'Lieferantenstammdaten pflegen.', roles: ['Admin', 'Super Admin'] },
      { path: '/rollen', label: 'Rollen', desc: 'Rollendefinitionen einsehen und ändern.', roles: ['Admin', 'Super Admin'] },
      { path: '/datensicherung', label: 'Datensicherung', desc: 'Backups erstellen und herunterladen.', roles: ['Admin', 'Super Admin'] },
      { path: '/operation/logfiles', label: 'Logfiles', desc: 'System- und Audit-Logs einsehen.', roles: ['Admin', 'Super Admin', 'Read Only Audit'] },
      { path: '/operation/email-vorlagen', label: 'E-Mail Vorlagen', desc: 'Transaktions-E-Mails bearbeiten.', roles: ['Admin', 'Super Admin', 'Auftragsverwaltung'] },
    ],
  },
  {
    icon: HelpCircle, title: 'Hilfe', intro: 'Support, Dokumentation und Kontakt.',
    entries: [
      { path: '/hilfe', label: 'Hilfe', desc: 'Support-Kontakt, FAQ und Dokumentation.', roles: ['Alle Rollen'] },
    ],
  },
];

type WorkflowDetail = { workflow: string[]; guidelines: string[]; events?: string[] };

const workflowDetails: Record<string, WorkflowDetail> = {
  'Dashboard': {
    workflow: [
      'Beim Login werden Rolle und Berechtigungen geladen.',
      'Das Dashboard rendert je Rolle die relevanten KPI-Karten (Aufträge, Touren, Finanzen).',
      'Daten werden via Supabase-Queries geladen und über React Query gecached (Auto-Refresh alle 15 min).',
      'Klick auf eine KPI-Karte führt direkt in den jeweiligen Detail-Bereich.',
    ],
    guidelines: [
      'Keine Schreiboperationen vom Dashboard aus.',
      'Nur aggregierte Zahlen — Rohdaten gehören in die jeweiligen Module.',
      'Bei fehlender Rolle für eine KPI wird die Karte ausgeblendet, nicht gesperrt.',
    ],
  },
  'Detailsuche': {
    workflow: [
      'Suchbegriff wird in Auftragsnummer, Kundenname, Rechnungsnummer und Artikelnummer geprüft.',
      'Treffer werden gruppiert nach Entität angezeigt.',
      'Per Klick erfolgt der Sprung in die Detailansicht des Treffers.',
    ],
    guidelines: [
      'Suche respektiert Rollen — nur freigegebene Entitäten werden angezeigt.',
      'Suchanfragen werden in den Logfiles erfasst (Audit).',
    ],
  },
  'Artikel': {
    workflow: [
      'Artikel werden über die Zoho-Synchronisation aus dem Items-Modul geladen.',
      'Kategorien und Kataloge ordnen Artikel logisch für Vertrieb und Produktion.',
      'Wareneingang erfasst neue Lieferungen und schreibt Bestände im Lager fort.',
    ],
    guidelines: [
      'Artikelnummern stammen aus Zoho und werden nie lokal geändert.',
      'Kataloge dienen ausschließlich der Anzeige — keine Preislogik.',
      'Wareneingang erzeugt ein Audit-Event je erfasstem Gerät.',
    ],
  },
  'Verkäufe': {
    workflow: [
      'Angebot wird erstellt → Freigabe durch Auftragsverwaltung → Auftrag entsteht.',
      'Auftrag wird automatisch mit Zoho synchronisiert (order_number bleibt unverändert).',
      'Anzahlungsrechnung und Schlussrechnung werden aus dem Auftrag generiert.',
      'Gutschriften referenzieren immer die ursprüngliche Rechnung.',
    ],
    guidelines: [
      'Zoho ist die Quelle der Wahrheit für Aufträge, Kunden und Rechnungen.',
      'Manuelle Änderungen an Auftragsnummern sind verboten — nur Anzeige-Kombinationen erlaubt.',
      'Freigabe-Prozess ist verpflichtend, bevor ein Auftrag in die Produktion geht.',
      'Finanzdaten (Rechnungsbeträge) sind nach Erzeugung unveränderlich.',
    ],
  },
  'Prio-Listen': {
    workflow: [
      'Aufträge werden anhand von Status, Liefertermin und Priorität in Listen sortiert.',
      'Mitarbeiter ziehen aus der Prio-Liste die nächsten Aufgaben.',
      'Hold-Status pausiert einen Auftrag mit Wiedervorlage-Datum.',
      'Anwaltsliste markiert Fälle in juristischer Bearbeitung.',
    ],
    guidelines: [
      'Statuswechsel werden protokolliert (Wer/Wann/Warum).',
      'Hold benötigt einen Grund und ein Wiedervorlage-Datum.',
      'Geliefert/Teilgeliefert-Status wird nur durch Tourenplanung oder Auftragsverwaltung gesetzt.',
    ],
  },
  'Bestellungen': {
    workflow: [
      'Bestellung wird durch Auftragsverwaltung angelegt (production_orders).',
      'Status: draft → pending_approval → approved.',
      'Super Admin prüft und genehmigt die Bestellung (approval_status, approved_by, approved_at).',
      'Erst nach Freigabe wird die PDF generiert und an den Lieferanten gesendet.',
      'Reklamationen folgen demselben Genehmigungsprozess.',
    ],
    guidelines: [
      'KEINE PDF-Erstellung oder -Versand vor Super-Admin-Freigabe.',
      'Lieferanten sehen ausschließlich freigegebene Bestellungen.',
      'Reklamationen sind als solche zu kennzeichnen (mode=reclamation).',
      'Jede Genehmigung erzeugt einen Audit-Eintrag.',
    ],
  },
  'Production': {
    workflow: [
      'Lieferant meldet sich an und sieht ausschließlich seine freigegebenen Bestellungen.',
      'Order In: neue Aufträge bestätigen.',
      'Liste: Bearbeitung laufender Aufträge mit Statuswechseln.',
      'Fertig: Abschluss meldet das Gerät als produktionsfertig.',
      'Factory Invoice: Werks-Rechnung wird hochgeladen und geprüft.',
    ],
    guidelines: [
      'Lieferanten haben ausschließlich Zugriff auf eigene Aufträge (RLS).',
      'Statuswechsel ohne vorherigen Schritt sind nicht zulässig.',
      'Rechnungsbeträge müssen mit der freigegebenen Bestellung übereinstimmen.',
    ],
  },
  'Lagerbestand': {
    workflow: [
      'Geräte werden im Wareneingang erfasst und einer Lager-Area zugeordnet.',
      'Statuswechsel (Warehouse → Produktion → Unterwegs → Ausgeliefert) erfolgt manuell oder automatisch via Tourenplan.',
      'Hold-Status entfernt das Gerät vorübergehend aus der Verfügbarkeit.',
    ],
    guidelines: [
      'Jede Statusänderung wird mit Zeitstempel und User dokumentiert.',
      'Leihgeräte und Lagergeräte werden getrennt verwaltet.',
      'Ausgelieferte Geräte sind dem Auftrag fest zugeordnet.',
    ],
  },
  'Tourenplanung': {
    workflow: [
      'Aufträge mit Status „lieferbereit" erscheinen in der Planung.',
      'Tourenplan bündelt mehrere Aufträge nach Region und Fahrzeit.',
      'Fahrzeiten werden über die Google-Maps-Edge-Function berechnet.',
      'Nach Auslieferung werden Aufträge automatisch auf „geliefert" gesetzt.',
    ],
    guidelines: [
      'Operative Planung ändert keine Stammdaten (nur Status und Tourzuordnung).',
      'Einstellungen (Fahrer, Fahrzeuge) sind Admin/Tourenplanung vorbehalten.',
      'Touren-Historie bleibt zur Nachverfolgung erhalten.',
    ],
  },
  'Versand': {
    workflow: [
      'Nach Auslieferung werden Versandpapiere automatisch generiert.',
      'Lieferschein wird per E-Mail an den Kunden gesendet (Customer-Shipping-Notice).',
      'Ratenplan oder Mietkauf werden bei entsprechender Zahlart erzeugt.',
      'SEPA-Mandate werden vom Kunden digital unterschrieben.',
    ],
    guidelines: [
      'Versandpapiere sind nach Erstellung unveränderlich (Audit).',
      'SEPA-Mandate folgen den geltenden Banken-Vorgaben (Gläubiger-ID, Mandatsreferenz).',
      'Mietkauf-Verträge müssen vor Lieferung vorliegen.',
    ],
  },
  'Buchhaltung': {
    workflow: [
      'Rechnungen werden aus Zoho Books synchronisiert (Edge Function).',
      'Offene Posten zeigen unbezahlte Rechnungen mit Fälligkeit.',
      'Ratenzahler werden eigenständig überwacht (Plan vs. Ist).',
      'Mahnstufen werden automatisch berechnet (1–3) anhand Tagen Überfälligkeit.',
    ],
    guidelines: [
      'Finanzdaten sind read-only aus Sicht der App (Quelle: Zoho).',
      'Manuelle Zahlungseingänge werden in Zoho gebucht, nicht in der App.',
      'Zugriff nur für Rollen Finance und Admin.',
    ],
  },
  'Finanzierungen': {
    workflow: [
      'Auftrag wird zur Finanzierung freigegeben (Verfügbare Aufträge).',
      'Finanzierung wird beantragt → Anfrage geht per E-Mail an die Bank.',
      'Status durchläuft: Anfrage offen → Zusage Bank ODER Absage Bank.',
      'Bei Zusage wird der Auftrag mit der Finanzierungsreferenz verknüpft.',
    ],
    guidelines: [
      'Bank-Korrespondenz wird zentral protokolliert (bank_financing_requests).',
      'Rolle „Finanzierungen" sieht ausschließlich diesen Bereich.',
      'Absagen müssen mit Grund dokumentiert werden.',
    ],
  },
  'Operations': {
    workflow: [
      'Admins verwalten Benutzer (Einladung, Sperren, Rollen-Zuweisung).',
      'Import-Modul startet Zoho-Synchronisationen (Aufträge, Kunden, Rechnungen).',
      'Monitoring zeigt Status aller Edge Functions und Sync-Jobs.',
      'Logfiles enthalten sicherheitsrelevante Ereignisse.',
      'Backups werden nächtlich automatisch erstellt und nach Hetzner gespiegelt.',
    ],
    guidelines: [
      'Benutzer-Anlage geschieht ausschließlich über Einladung (kein Self-Signup).',
      'Rollen-Änderungen sind audit-pflichtig.',
      'E-Mail-Vorlagen werden zentral gepflegt und versioniert.',
      'Datensicherung muss regelmäßig auf Wiederherstellbarkeit getestet werden.',
    ],
  },
  'Hilfe': {
    workflow: [
      'Support-Anfragen werden per E-Mail an das IT-Team gesendet.',
      'Diese Dokumentation gibt einen Überblick über alle Module.',
      'Häufige Fragen werden im FAQ-Bereich gepflegt.',
    ],
    guidelines: [
      'Sensible Daten (Passwörter, Tokens) niemals per E-Mail teilen.',
      'IT-Team reagiert innerhalb der vereinbarten Service-Zeiten.',
    ],
  },
};

export default function Dokumentation() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Dokumentation</h1>
            <p className="text-muted-foreground text-sm">
              Komplette Übersicht aller Module und Unterpunkte von Alix Work.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/hilfe"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück zur Hilfe</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Über diese Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Die Anwendung „Alix Work" bündelt alle operativen Prozesse von Auftragsverwaltung über
            Produktion und Lager bis hin zu Buchhaltung und Finanzierungen. Sichtbarkeit und Zugriff
            werden über Rollen gesteuert (RBAC) — Admins sehen alles, spezialisierte Rollen nur die
            für sie freigegebenen Bereiche.
          </p>
          <p>
            Klicken Sie auf einen Eintrag, um direkt in den jeweiligen Bereich zu springen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Allgemeine Richtlinien</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>RBAC:</strong> Jede Aktion wird durch Rollen abgesichert. Nur freigegebene Rollen sehen bzw. ändern Daten.</li>
            <li><strong>MFA-Pflicht:</strong> Alle Benutzer müssen Multi-Factor-Authentication eingerichtet haben.</li>
            <li><strong>Audit-Trail:</strong> Sicherheitsrelevante Aktionen werden in Logfiles protokolliert.</li>
            <li><strong>Zoho als Quelle der Wahrheit:</strong> Stammdaten (Aufträge, Kunden, Rechnungen) werden aus Zoho synchronisiert. Die <code>order_number</code> ist unveränderlich.</li>
            <li><strong>Datenhaltung:</strong> Supabase ist das primäre Backend mit Row-Level-Security. Keine neuen Tabellen ohne Abstimmung.</li>
            <li><strong>Auto-Refresh:</strong> Listen aktualisieren sich automatisch alle 15 Minuten und beim erneuten Fokussieren des Tabs.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {sections.map((section) => {
          const detail = workflowDetails[section.title];
          return (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <section.icon className="h-6 w-6 text-primary mt-1" />
                <div className="flex-1">
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{section.intro}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {detail && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                      <h4 className="text-sm font-semibold mb-2 text-foreground">Wirkungsweise</h4>
                      <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                        {detail.workflow.map((w, i) => <li key={i}>{w}</li>)}
                      </ol>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                      <h4 className="text-sm font-semibold mb-2 text-foreground">Richtlinien</h4>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                        {detail.guidelines.map((g, i) => <li key={i}>{g}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2 text-foreground">Menüpunkte</h4>
                  <ul className="divide-y divide-border">
                    {section.entries.map((e) => (
                      <li key={e.path + e.label} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={e.path} className="font-medium text-primary hover:underline">
                            {e.label}
                          </Link>
                          <p className="text-sm text-muted-foreground">{e.desc}</p>
                          <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{e.path}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 sm:max-w-[50%] sm:justify-end">
                          {e.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
