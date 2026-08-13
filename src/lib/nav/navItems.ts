import {
  LayoutDashboard, LayoutGrid, ClipboardList, MapPin, Banknote, Users, LogOut, Shield, ShieldCheck, Menu, X, ChevronLeft, Building2, Cloud, Server, ListOrdered, Sun, Moon, Gavel, Truck, PackageCheck, BarChart3, Factory, ShoppingCart, ChevronDown, TrendingUp, Workflow, AlertTriangle, Calendar, CalendarDays, FileText, FileSignature, Warehouse, Settings, Package, FilePlus, BookOpen, Receipt, Undo2, CreditCard, CheckCircle2, FolderTree, ScrollText, Inbox, Mail, Landmark, SearchCheck, Pause, Clock, HelpCircle, Star, Lock, Globe, Wrench, Ticket, User, Flame,
  PenSquare, Send, FileEdit, MessageSquare, MessageCircle, Sparkles, FileCheck2, Files, Phone, PhoneCall, CheckSquare, CalendarClock, Megaphone, Activity, MailX, MailCheck, HeartPulse, TestTube2, Rocket, Database, Upload, FileUp, FileDown, BadgeCheck, GraduationCap, Brain, AlertOctagon, LineChart, ListChecks, Cog, Boxes, Repeat, Wallet, Hash, ClipboardCheck, Gift, Download
} from 'lucide-react';
import { Briefcase, Bell, BellRing, Package as PackageIcon, Eye, Home, UserCheck, Radio, ShieldAlert, Trophy, Plus, Image as ImageIcon, Target, Globe2, Zap, Quote } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen, PackageSearch, Cpu, ListTree, Layers, GitBranch } from 'lucide-react';
import { Smartphone as SmartphoneIcon, Contact as ContactIcon } from 'lucide-react';


export type NavChild = { path: string; label: string; icon: typeof LayoutDashboard; roles: string[] | null; children?: NavChild[] };
export type NavItem = NavChild & { children?: NavChild[] };

export const navItems: NavItem[] = [
  {
    path: '/geraetesperren', label: 'GERÄTESPERREN', icon: Lock,
    roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'],
    children: [
      { path: '/geraetesperren', label: 'Übersicht', icon: Lock, roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'] },
      { path: '/geraetesperren/bearbeitung', label: 'Bearbeitung', icon: Lock, roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'] },
    ],
  },

  {
    path: '/', label: 'DASHBOARDS', icon: LayoutDashboard,
    roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Read Only Audit', 'Österreich'],
    children: [
      { path: '/dashboards/verkauf', label: 'Verkauf', icon: TrendingUp, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Vertrieb', 'Vertriebsleitung', 'SACHBEARBEITUNG'] },
      { path: '/management-dashboard', label: 'Management Dashboard', icon: BarChart3, roles: ['Super Admin'] },
      { path: '/konzern/dashboard', label: 'Konzern-Dashboard', icon: TrendingUp, roles: ['Super Admin'] },
      { path: '/dashboard/bestellungen', label: 'Bestellungen', icon: ShoppingCart, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Bestellwesen', 'SACHBEARBEITUNG', 'Finance'] },
      { path: '/finance/offene-anzahlungen', label: 'Offene Anzahlungen', icon: Wallet, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Vertrieb', 'Vertriebsleitung', 'SACHBEARBEITUNG', 'Finance', 'Tourenplanung', 'Read Only Audit'] },
    ],
  },

  {
    path: '/dokumente', label: 'ALIXDOCS', icon: FolderTree,
    roles: null,
    children: [
      { path: '/dokumente/dashboard', label: 'Dashboard', icon: SearchCheck, roles: null },
      { path: '/dokumente', label: 'Dokumentensuche', icon: SearchCheck, roles: null },
      { path: '/dokumente/bulk-import', label: 'Bulk Import', icon: CheckCircle2, roles: null },
      { path: '/dokumente/ai-suche', label: 'AI-Suche ✨', icon: Sparkles, roles: ['Admin', 'Super Admin'] },
      { path: '/dokumente/compliance-export', label: 'Compliance-Export', icon: Sparkles, roles: ['Admin', 'Super Admin'] },

    ],
  },




  {
    path: '/ai-center', label: 'ALIX AI DIENSTE', icon: Sparkles,
    roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Serviceleitung', 'Service', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Österreich', 'SACHBEARBEITUNG'],
    children: [
      { path: '/ai-center', label: 'AI Center', icon: Sparkles, roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Serviceleitung', 'Service', 'Technik', 'Finance', 'Österreich'] },
      { path: '/ai-service-center', label: 'AI Service Center', icon: Sparkles, roles: ['Admin', 'Super Admin', 'Service', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'SACHBEARBEITUNG'] },
      { path: '/auftragsstatus', label: 'Auftragsstatus', icon: Activity, roles: null },
      { path: '/finance/ai-insights', label: 'KI-Analyse (Finance)', icon: Sparkles, roles: ['Admin', 'Super Admin', 'Finance', 'Geschäftsführung'] },

      {
        path: '/aic', label: 'Alix Intelligence', icon: Brain, roles: ['Super Admin'],
        children: [
          { path: '/aic', label: 'Dashboard', icon: LayoutDashboard, roles: ['Super Admin'] },
          { path: '/aic/unternehmen', label: 'Unternehmen', icon: Building2, roles: ['Super Admin'] },
          { path: '/aic/forderungen', label: 'Forderungen', icon: AlertOctagon, roles: ['Super Admin'] },
          { path: '/aic/vertrieb', label: 'Vertrieb', icon: TrendingUp, roles: ['Super Admin'] },
          { path: '/aic/service', label: 'Service', icon: Wrench, roles: ['Super Admin'] },
          { path: '/aic/mitarbeiter', label: 'Mitarbeiter', icon: Users, roles: ['Super Admin'] },
          { path: '/aic/forecasts', label: 'Forecasts', icon: LineChart, roles: ['Super Admin'] },
          { path: '/aic/tasks', label: 'KI-Aufgaben', icon: ListChecks, roles: ['Super Admin'] },
          { path: '/aic/berichte', label: 'Berichte', icon: FileText, roles: ['Super Admin'] },
        ],
      },
    ],
  },
  {
    path: '/esc', label: 'TEAMKALENDER', icon: CalendarDays,
    roles: null,
    children: [
      { path: '/esc',                label: 'Übersicht',      icon: LayoutDashboard, roles: null },
      { path: '/esc/kalender',       label: 'Kalender',       icon: CalendarDays,    roles: null },
      { path: '/esc/buchungen',      label: 'Buchungsportal', icon: Globe,           roles: null },
      { path: '/esc/bestaetigungen', label: 'Bestätigungen',  icon: CheckCircle2,    roles: null },
    ],
  },
  {
    path: '/tickets/dashboard', label: 'TICKETS', icon: Ticket,
    roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'],
    children: [
      { path: '/tickets/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'] },
      { path: '/tickets', label: 'Alle Tickets', icon: Ticket, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'] },
      { path: '/tickets?new=1', label: 'Neues Ticket', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'] },
      { path: '/tickets/kalender', label: 'Ticket-Kalender', icon: CalendarDays, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'] },
      { path: '/tickets?mine=1', label: 'Meine Tickets', icon: User, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Vertrieb'] },
    ],
  },
  {
    path: '/mailcenter', label: 'KONTAKT', icon: HelpCircle,
    roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Marketing', 'Finance', 'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Serviceleitung', 'Service', 'Tourenplanung', 'Bestellwesen', 'Order', 'Auftragsverwaltung', 'QM', 'Read Only', 'Read Only Audit', 'Österreich', 'SACHBEARBEITUNG'],
    children: [
  {
    path: '/mailcenter', label: 'ALIX i-COM', icon: Mail,
    roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Marketing', 'Finance', 'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Tourenplanung', 'Bestellwesen', 'Order', 'Read Only', 'Read Only Audit', 'Österreich', 'SACHBEARBEITUNG'],
    children: [
      { path: '/mailcenter', label: 'Dashboard', icon: LayoutDashboard, roles: null },
      { path: '/tickets', label: 'Ticketliste', icon: Ticket, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
      { path: '/tickets/kalender', label: 'Ticket-Kalender', icon: CalendarDays, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
      { path: '/mailcenter/schreiben', label: 'E-Mail schreiben', icon: PenSquare, roles: null },
      { path: '/mailcenter/intern', label: 'Interne Nachrichten', icon: MessageSquare, roles: null },
      { path: '/mailcenter/telefonnotizen', label: 'Telefonnotizen', icon: Phone, roles: null },
      { path: '/mailcenter/aufgaben', label: 'Aufgaben', icon: CheckSquare, roles: null },
      { path: '/tickets?new=1', label: 'Neues Ticket', icon: Ticket, roles: null },
      {
        path: '/mailcenter/schreiben', label: 'E-Mail', icon: Mail, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/gesendet', label: 'Gesendet', icon: Send, roles: ['Super Admin'] },
          { path: '/mailcenter/entwuerfe', label: 'Entwürfe', icon: FileEdit, roles: ['Super Admin'] },
          { path: '/mailcenter/intern', label: 'Interne Nachrichten', icon: MessageSquare, roles: null },
          { path: '/mailcenter/schreiben', label: 'E-Mail schreiben', icon: PenSquare, roles: null },
          { path: '/mailcenter/kampagnen', label: 'Kampagnen', icon: Megaphone, roles: ['Super Admin'] },
          { path: '/mailcenter/vorlagen', label: 'Vorlagen', icon: FileText, roles: ['Super Admin'] },
          { path: '/mailcenter/automationen', label: 'Automationen', icon: Workflow, roles: ['Super Admin'] },
          { path: '/mailcenter/ki-assistent', label: 'KI-Assistent', icon: Sparkles, roles: null },
          { path: '/mailcenter/tracking', label: 'Tracking', icon: Activity, roles: ['Super Admin'] },
          { path: '/mailcenter/abmeldungen', label: 'Abmeldungen', icon: MailX, roles: ['Super Admin'] },
          { path: '/mailcenter/domains', label: 'Domains', icon: Globe, roles: ['Super Admin'] },
          { path: '/mailcenter/spam', label: 'Spam & Zustellbarkeit', icon: Shield, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/mailcenter/telefonie', label: 'Telefon', icon: PhoneCall, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/telefonie', label: 'Telefonie (3CX)', icon: PhoneCall, roles: null },
          { path: '/mailcenter/telefonnotizen', label: 'Telefonnotizen', icon: Phone, roles: null },
          { path: '/mailcenter/gespraechsprotokolle', label: 'Gesprächsprotokolle', icon: ClipboardList, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/mailcenter/aufgaben', label: 'Aufgaben', icon: CheckSquare, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/aufgaben', label: 'Aufgaben', icon: CheckSquare, roles: ['Super Admin'] },
          { path: '/mailcenter/wiedervorlagen', label: 'Wiedervorlagen', icon: CalendarClock, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/mailcenter/dokumente', label: 'Dokumente', icon: Files, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/dokumente', label: 'Dokumenten-Center', icon: Files, roles: ['Super Admin'] },
          { path: '/mailcenter/versandnachweise', label: 'Versandnachweise', icon: FileCheck2, roles: ['Super Admin'] },
          { path: '/mailcenter/dokumente-vorlagen', label: 'Dok.-Vorlagen', icon: FileText, roles: ['Super Admin'] },
          { path: '/mailcenter/dokumente-automationen', label: 'Dok.-Automationen', icon: Workflow, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/mailcenter/systemstatus', label: 'Status & Logs', icon: HeartPulse, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/systemstatus', label: 'Systemstatus', icon: HeartPulse, roles: ['Super Admin'] },
          { path: '/mailcenter/audit-log', label: 'Audit-Log', icon: ScrollText, roles: ['Super Admin'] },
          { path: '/mailcenter/fehlerprotokoll', label: 'Fehlerprotokoll', icon: AlertTriangle, roles: ['Super Admin'] },
          { path: '/mailcenter/tracking', label: 'Tracking', icon: Activity, roles: ['Super Admin'] },
          { path: '/mailcenter/berichte', label: 'Berichte', icon: BarChart3, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/mailcenter/einstellungen', label: 'Setup', icon: Settings, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Super Admin'] },
          { path: '/mailcenter/berechtigungen', label: 'Berechtigungen', icon: ShieldCheck, roles: ['Super Admin'] },
          { path: '/mailcenter/domains', label: 'Domains', icon: Globe, roles: ['Super Admin'] },
          { path: '/mailcenter/backup', label: 'Backup Center', icon: Database, roles: ['Super Admin'] },
          { path: '/mailcenter/import', label: 'Import', icon: Upload, roles: ['Super Admin'] },
          { path: '/mailcenter/export', label: 'Export', icon: FileDown, roles: ['Super Admin'] },
          { path: '/mailcenter/spam', label: 'Spam & Zustellbarkeit', icon: Shield, roles: ['Super Admin'] },
          { path: '/mailcenter/testcenter', label: 'Testcenter', icon: TestTube2, roles: ['Super Admin'] },
          { path: '/mailcenter/qualitaetssicherung', label: 'Qualitätssicherung', icon: BadgeCheck, roles: ['Super Admin'] },
          { path: '/mailcenter/systemvalidierung', label: 'Systemvalidierung', icon: FileSignature, roles: ['Super Admin'] },
          { path: '/mailcenter/produktivfreigabe', label: 'Produktivfreigabe', icon: Rocket, roles: ['Super Admin'] },
        ],
      },
    ],
  },
      {
        path: '/bewertungen', label: 'BEWERTUNGEN', icon: Star, roles: null,
        children: [
          { path: '/bewertungen', label: 'Übersicht', icon: LayoutDashboard, roles: null },
          { path: '/bewertungen/geliefert', label: 'Aufträge geliefert', icon: Truck, roles: null },
          { path: '/bewertungen/abgegeben', label: 'Abgegebene Bewertungen', icon: Star, roles: null },
          { path: '/bewertungen/geschlossen', label: 'Geschlossen', icon: Lock, roles: null },
          { path: '/bewertungen/frontend', label: 'Frontend', icon: Cloud, roles: null },
        ],
      },
    ],
  },


  {
    path: '/customer-care', label: 'CUSTOMER CARE', icon: HeartPulse,
    roles: null,
    children: [],
  },






  {
    path: '/verkauf', label: 'VERKAUF', icon: TrendingUp,
    roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Finanzierungen', 'FACTORY INVOICE', 'Lieferant', 'Bestellwesen', 'Read Only Audit', 'Read Only', 'Geschäftsführung', 'Marketing', 'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Serviceleitung', 'Service', 'QM', 'SACHBEARBEITUNG', 'Katalog', 'Katalog Preise', 'Vertriebsleitung'],
    children: [
      {
        path: '/katalog', label: 'KATALOG', icon: BookOpen,
        roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise', 'Vertrieb', 'Vertriebsleitung', 'Marketing', 'Service', 'Geschäftsführung'],
        children: [
          { path: '/katalog', label: 'Übersicht', icon: LayoutDashboard, roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise', 'Vertrieb', 'Vertriebsleitung', 'Marketing', 'Service', 'Geschäftsführung'] },
          { path: '/katalog/artikel', label: 'Artikel', icon: Package, roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise', 'Vertrieb', 'Vertriebsleitung', 'Marketing', 'Service', 'Geschäftsführung'] },
          { path: '/katalog/kategorien', label: 'Kategorien', icon: FolderTree, roles: ['Super Admin', 'Admin', 'Katalog'] },
          { path: '/katalog/laender', label: 'Länder & Währungen', icon: Globe, roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise'] },
          { path: '/katalog/niederlassungen', label: 'Niederlassungen', icon: Building2, roles: ['Super Admin', 'Admin', 'Katalog'] },
          { path: '/katalog/preisregeln', label: 'Preisregeln', icon: ListChecks, roles: ['Super Admin', 'Admin', 'Katalog Preise'] },
          { path: '/katalog/import', label: 'Import', icon: Upload, roles: ['Super Admin', 'Admin', 'Katalog'] },
          { path: '/katalog/export', label: 'Export', icon: FileDown, roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise', 'Vertrieb', 'Vertriebsleitung', 'Marketing'] },
          { path: '/katalog/versand', label: 'Freigabelinks', icon: Send, roles: ['Super Admin', 'Admin', 'Katalog', 'Vertrieb', 'Vertriebsleitung'] },
          { path: '/katalog/freigabe', label: 'Freigabe-Center', icon: ShieldCheck, roles: ['Super Admin', 'Admin', 'Katalog Preise'] },
          { path: '/katalog/protokolle', label: 'Änderungsprotokoll', icon: ScrollText, roles: ['Super Admin', 'Admin', 'Katalog', 'Katalog Preise'] },
        ],
      },

      {
        path: '/kunden', label: 'KUNDEN', icon: Building2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'],
        children: [
          { path: '/kunden', label: 'Kunden', icon: Building2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/kunden/alixsmart-status', label: 'AlixSmart Anmeldestatus', icon: UserCheck, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Kundenservice'] },
          { path: '/kunden/alixsmart-analytics', label: 'AlixSmart Analytics', icon: UserCheck, roles: ['Admin', 'Super Admin', 'Geschäftsführung'] },
          { path: '/admin/alixsmart-settings', label: 'AlixSmart Automatik', icon: UserCheck, roles: ['Admin', 'Super Admin'] },
          { path: '/admin/alixsmart-deepsync', label: 'AlixSmart Deep-Sync', icon: UserCheck, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/verkauf/artikel-uebersicht', label: 'ARTIKEL', icon: Package, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'],
        children: [
          { path: '/verkauf/artikel', label: 'Alle Artikel', icon: Package, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/artikel/kategorie', label: 'Kategorie', icon: FolderTree, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/artikel/katalog', label: 'Katalog', icon: BookOpen, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/artikel/wareneingang', label: 'Wareneingang', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
        ],
      },
      {
        path: '/verkauf/angebote', label: 'ANGEBOTE', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Vertrieb', 'Vertriebsleitung', 'SACHBEARBEITUNG'],
        children: [
          { path: '/verkauf/neue-anfrage', label: 'Neue Anfrage', icon: Sparkles, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Vertriebsleitung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/anfragen', label: 'Anfragen', icon: Inbox, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Vertriebsleitung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/angebot/neu', label: 'Angebot erstellen', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/angebote', label: 'Angebote', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/angebotsanalyse', label: 'Angebotsanalyse', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Vertriebsleitung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/nachfassen', label: 'Nachfassen', icon: CalendarClock, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Vertriebsleitung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/angebotskalender', label: 'Angebotskalender', icon: CalendarDays, roles: ['Admin', 'Super Admin', 'Vertrieb', 'Vertriebsleitung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/verkauf/freigabe', label: 'Freigabe', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
        ],
      },
      {
        path: '/auftraege', label: 'AUFTRÄGE', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Bereitstellung', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Finance', 'Österreich', 'Finanzierungen', 'FACTORY INVOICE', 'Lieferant', 'Read Only Audit', 'SACHBEARBEITUNG'],
        children: [
          { path: '/operation/auslieferungsfreigabe', label: 'Auslieferungsfreigabe', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Order', 'Auftragsverwaltung', 'Bereitstellung', 'Tourenplanung', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Finance'] },
          { path: '/auftraege/gesucht', label: 'Aufträge gesucht', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order'] },

          { path: '/auftraege', label: 'Aufträge', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/auftraege-at', label: 'Aufträge AT', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Finanzierungen', 'FACTORY INVOICE', 'Lieferant', 'Read Only Audit', 'SACHBEARBEITUNG'] },
          { path: '/auftraege-ch', label: 'Aufträge CH', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Finanzierungen', 'FACTORY INVOICE', 'Lieferant', 'Read Only Audit', 'SACHBEARBEITUNG', 'Österreich'] },
          
          { path: '/auftraege/pdf-import', label: 'Aufträge Import PDF', icon: FileUp, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Vertrieb', 'Geschäftsführung', 'SACHBEARBEITUNG'] },
          { path: '/mediapaket', label: 'Mediapaket', icon: PackageIcon, roles: ['Admin', 'Super Admin', 'Order', 'Mediapaket', 'Auftragsverwaltung', 'SACHBEARBEITUNG'] },
          { path: '/bonitaet', label: 'Bonität prüfen', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Vertriebsleitung', 'Vertrieb', 'Finance'] },

        ],
      },
      {
        path: '/crm/after-sales', label: 'AFTER SALES', icon: HeartPulse,
        roles: ['Admin', 'Super Admin', 'After Sales', 'Vertrieb', 'Marketing', 'Service', 'Geschäftsführung', 'Order', 'SACHBEARBEITUNG', 'Kundenservice', 'Auftragsverwaltung'],
        children: [
          { path: '/crm/after-sales', label: 'After Sales', icon: HeartPulse, roles: ['Admin','Super Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung'] },
          { path: '/crm/after-sales/erledigt', label: 'Erledigte Fälle', icon: CheckCircle2, roles: ['Admin','Super Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung'] },
          { path: '/crm/after-sales/reports', label: 'Reports & Export', icon: BarChart3, roles: ['Admin','Super Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung'] },
        ],
      },
      {
        path: '/bonitaet', label: 'BONITÄT & FINANZIERUNG', icon: ShieldCheck,
        roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Vertriebsleitung', 'Vertrieb', 'Finance'],
        children: [
          { path: '/bonitaet', label: 'ALIX CREDIT SCORE®', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Vertriebsleitung', 'Vertrieb', 'Finance'] },
          { path: '/bonitaet/neu', label: 'Neue Prüfung', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Geschäftsführung', 'Vertriebsleitung', 'Vertrieb', 'Finance'] },
          { path: '/bonitaet/richtlinien', label: 'Richtlinien', icon: ShieldCheck, roles: ['Super Admin'] },
        ],
      },
      {
        path: '/auftraege-gruppe', label: 'AUFTRAGS STATUS', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'],
        children: [
          { path: '/prio-liste', label: 'Prio-Liste', icon: ListOrdered, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/prio-liste/hold', label: 'Hold', icon: Pause, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/anwaltsliste', label: 'Anwaltsliste', icon: Gavel, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/geliefert', label: 'Auftrag geliefert', icon: Truck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/teilgeliefert', label: 'Teilgeliefert', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
        ],
      },
    ],
  },
  {
    path: '/auftragsverwaltung', label: 'EINKAUF', icon: ClipboardList,
    roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Lieferant', 'FACTORY INVOICE', 'Bestellwesen', 'Read Only Audit', 'Read Only', 'Geschäftsführung', 'Marketing', 'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Serviceleitung', 'Service', 'QM', 'SACHBEARBEITUNG'],
    children: [
      {
        path: '/auftragsverwaltung/bestellungen', label: 'BESTELLWESEN', icon: ShoppingCart, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Lieferant', 'FACTORY INVOICE', 'Bestellwesen', 'SACHBEARBEITUNG'],
        children: [
          { path: '/order/frei-bestellung', label: 'Bestellung möglich', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/order/reklamation', label: 'Bestellung Reklamation', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/order', label: 'Factory Orders', icon: Factory, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/order/freigabe', label: 'Freigabe', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/bestellwesen/ersatzteile', label: 'Ersatzteil-Bestellvorschläge', icon: Package, roles: ['Admin', 'Super Admin', 'Bestellwesen', 'Order', 'Technik', 'SACHBEARBEITUNG'] },
          { path: '/ersatzteilmanagement', label: 'Ersatzteilmanagement', icon: Boxes, roles: ['Admin', 'Super Admin', 'Bestellwesen', 'Order', 'Technik', 'Reparaturannahme', 'Serviceleitung', 'Service', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/production/order-in', label: 'Order In', icon: Inbox, roles: ['Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
          { path: '/production', label: 'Liste', icon: ListOrdered, roles: ['Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
          { path: '/production/fertig', label: 'Fertig produziert', icon: CheckCircle2, roles: ['Super Admin', 'Lieferant', 'FACTORY INVOICE'] },
          { path: '/production/factory-invoice', label: 'Factory Invoice', icon: Receipt, roles: ['Super Admin', 'FACTORY INVOICE'] },
        ],
      },
    ],
  },



  {
    path: '/warehouse-logistics', label: 'LAGER & WERKSTATT', icon: Warehouse,
    roles: null,
    children: [
      {
        path: '/lagerverwaltung', label: 'LAGERVERWALTUNG', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'],
        children: [
          { path: '/lager/leihgeraete', label: 'Leihgeräte', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/lager/lagergeraete', label: 'Lagergeräte', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/lager/equipment-area/unterwegs', label: 'Unterwegs', icon: Truck, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/lager/equipment-area/produktion', label: 'Produktion', icon: Factory, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/lager/equipment-area/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/lager/equipment-area/hold', label: 'Hold', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/lager/equipment-area/ausgeliefert', label: 'Ausgeliefert', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/geraetesperren', label: 'Gerätesperren', icon: Lock, roles: null },
        ],
      },
      {

        path: '/reparatur', label: 'SERVICE & REPARATUR', icon: Wrench, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Finance', 'QM', 'Österreich', 'Reparaturannahme', 'Technik', 'Service', 'Serviceleitung', 'Kundenservice', 'SACHBEARBEITUNG'],
        children: [
          // — Überblick —
          { path: '/reparatur', label: 'Dashboard', icon: LayoutDashboard, roles: null },
          { path: '/service-cockpit', label: 'Service Cockpit', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Serviceleitung'] },
          // — Reparatur-Prozess (Ablauf) —
          { path: '/reparatur/neu', label: '1 · Annahme (neue Reparatur)', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'Finance', 'QM', 'Reparaturannahme', 'Technik', 'Service', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/reparatur/werkstattannahme', label: '2 · Werkstattannahme', icon: PackageCheck, roles: null },
          { path: '/reparatur/kostenvoranschlaege', label: '3 · Kostenvoranschläge', icon: Receipt, roles: ['Admin', 'Super Admin', 'Finance', 'Reparaturannahme', 'Technik', 'Service', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/reparatur/technik', label: '4 · Technik-Arbeitsaufträge', icon: Wrench, roles: null },
          { path: '/reparatur/ersatzteile', label: '5 · Ersatzteilbedarf', icon: Package, roles: null },
          { path: '/reparatur/rueckversand', label: '6 · Rückversand', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Reparaturannahme', 'Technik', 'Service', 'Österreich', 'Tourenplanung', 'SACHBEARBEITUNG'] },
          { path: '/reparatur/auftraege', label: 'Alle Reparaturaufträge', icon: ClipboardList, roles: null },
          { path: '/reparatur/archiv', label: 'Reparaturarchiv', icon: FileText, roles: null },
          // — Wartung & Garantie —
          { path: '/wartungscenter', label: 'Wartungscenter', icon: Wrench, roles: ['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung', 'SACHBEARBEITUNG'] },
          { path: '/wartungsmanagement', label: 'Wartungsmanagement', icon: Cog, roles: ['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung', 'SACHBEARBEITUNG'] },
          { path: '/garantiecenter', label: 'Garantiecenter', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Vertrieb', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/garantie-kulanz', label: 'Garantie & Kulanz', icon: ShieldCheck, roles: ['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung', 'SACHBEARBEITUNG'] },
          // — Geräte-Historie —
          { path: '/geraeteakte', label: 'Geräteakte', icon: FileText, roles: ['Admin', 'Super Admin', 'Technik', 'Kundenservice', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Tourenplanung', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/geraete-lebenslauf', label: 'Geräte-Lebenslauf', icon: Activity, roles: ['Admin', 'Super Admin', 'Technik', 'Kundenservice', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Finance', 'SACHBEARBEITUNG'] },
          // — Kommunikation & Übergaben —
          { path: '/whatsapp', label: 'WhatsApp Service Center', icon: MessageSquare, roles: ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung', 'SACHBEARBEITUNG'] },
          { path: '/ai-service-center', label: 'AI Service Center', icon: Sparkles, roles: ['Admin', 'Super Admin', 'Service', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'SACHBEARBEITUNG'] },
          { path: '/reparatur/finance', label: 'Übergabe Finance', icon: Receipt, roles: null },
          { path: '/reparatur/tourenplanung', label: 'Übergabe Tourenplanung', icon: MapPin, roles: null },
        ],

      },



    ],
  },

  // GERÄTESPERREN wurde in die Kopfzeile verschoben (siehe GeraetesperrenMenu)


  {

    path: '/tourenplanung', label: 'TOURENPLANUNG', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'],
    children: [
      { path: '/tourenplanung', label: 'Übersicht', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
      { path: '/tourenplanung/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'SACHBEARBEITUNG'] },
      { path: '/tourenplanung/kalender', label: 'Kalender', icon: Calendar, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'Technik', 'SACHBEARBEITUNG'] },
      { path: '/tourenplanung/karte', label: 'Karte', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'Technik', 'SACHBEARBEITUNG'] },
      { path: '/tourenplanung/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'SACHBEARBEITUNG'] },
      { path: '/dispatch/speditionsversand', label: 'Speditionsversand', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
      { path: '/m', label: 'Mobile Techniker-App', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Technik', 'Service', 'Reparaturannahme', 'SACHBEARBEITUNG'] },
      {
        path: '/dispatch', label: 'ALIX DISPATCH CENTER', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'],
        children: [
          { path: '/dispatch', label: 'Dispatch-Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/meine-touren', label: 'Meine Touren (Mobil)', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG', 'Technik', 'Service'] },
          { path: '/dispatch/termine', label: 'Liefertermine', icon: Calendar, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/ungeplant', label: 'Ungeplante Auslieferungen', icon: PackageSearch, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },

          { path: '/dispatch/touren', label: 'Touren', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/speditionsversand', label: 'Speditionsversand', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/spediteure', label: 'Spediteure', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/fahrzeuge', label: 'Fahrzeuge', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/fahrer', label: 'Fahrer', icon: Users, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/performance', label: 'Performance & CO₂', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Order', 'SACHBEARBEITUNG'] },
          { path: '/dispatch/wartung', label: 'Wartung & Prüfungen', icon: Settings, roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
          { path: '/dispatch/telematik', label: 'Telematik', icon: Truck, roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
          { path: '/dispatch/einstellungen', label: 'Dispatch-Einstellungen', icon: Settings, roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
        ],
      },
      {
        path: '/papiere', label: 'VERSAND', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'],
        children: [
          { path: '/papiere', label: 'Übersicht', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/versand/lieferscheine', label: 'Lieferscheine', icon: Truck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/versand/ratenplan', label: 'Ratenplan', icon: Banknote, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/versand/mietkauf', label: 'Mietkauf', icon: FileSignature, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
          { path: '/versand/sepa-mandat', label: 'SEPA Mandat', icon: CreditCard, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich', 'SACHBEARBEITUNG'] },
        ],
      },
    ],
  },
  {
    path: '/finance', label: 'BUCHHALTUNG', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'],
    children: [
      {
        path: '/finance/dashboard', label: 'DASHBOARD', icon: Banknote, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/dashboard', label: 'Dashboard', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/cockpit', label: 'Finance Cockpit', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/controlling', label: 'Controlling-Cockpit', icon: Activity, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/finance-controlling', label: 'Finance Controlling', icon: Activity, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
        ],
      },
      {
        path: '/finance/anzahlungen', label: 'ANZAHLUNGEN', icon: Wallet, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/offene-anzahlungen', label: 'Offene Anzahlungen', icon: Wallet, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/finance/rechnungen', label: 'RECHNUNGEN', icon: FileText, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/rechnungen', label: 'Rechnungen', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/vermietung', label: 'Mietkauf Geräte', icon: Repeat, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/rechnungsvorschlaege', label: 'Rechnungsvorschläge (Reparaturen)', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/offene-posten', label: 'Offene Posten', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/zahlungen', label: 'Zahlungen', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/verkauf/gutschriften', label: 'Gutschriften', icon: Undo2, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/eingangsrechnungen', label: 'Eingangsrechnungen', icon: Inbox, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/belege', label: 'Belegarchiv', icon: Files, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/p2p', label: 'Procure-to-Pay', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/bank', label: 'Bankimport', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/sepa', label: 'SEPA Lastschriften', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/qr-rechnung', label: 'QR-Rechnung 🇨🇭', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung CH'] },
          { path: '/finance/ch-lastschriften', label: 'CH Lastschriften (LSV+/BDD) 🇨🇭', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung CH'] },
          { path: '/finance/camt054', label: 'CAMT.054 Import 🇨🇭', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung CH'] },
          { path: '/finance/bank-abgleich-ch', label: 'Bank-Abgleich 🇨🇭', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung CH'] },
          { path: '/finance/treasury', label: 'Treasury', icon: Banknote, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/finance/raten', label: 'RATENZAHLER', icon: ScrollText, roles: ['Admin', 'Super Admin'],
        children: [
          {
            path: '/finance/wiederkehrende-zahler', label: 'Wiederkehrende Zahler', icon: Repeat, roles: ['Admin', 'Super Admin'],
            children: [
              { path: '/finance/wiederkehrende-zahler', label: 'Übersicht', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen', label: 'Zahlungserinnerungen', icon: Bell, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen?tab=faelligkeiten', label: 'Fälligkeiten', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen?tab=sammelversand', label: 'Sammelversand', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen?tab=einzelversand', label: 'Einzelversand', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen?tab=historie', label: 'Versandhistorie', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/wz-erinnerungen?tab=einstellungen', label: 'Einstellungen', icon: Repeat, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/raten-pruefung', label: 'RATEN ÜBERPRÜFUNG (Versandstopp)', icon: SearchCheck, roles: ['Admin', 'Super Admin'] },
              { path: '/finance/raten-ende-legal', label: 'RATEN ENDE LEGAL', icon: Gavel, roles: ['Admin', 'Super Admin'] },
            ],
          },
          { path: '/finance/bestandsuebersicht', label: 'Bestandsübersicht', icon: Repeat, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/vertraege', label: 'PRÜFUNG', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/raten', label: 'Laufende Raten', icon: ScrollText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/ratenplan-sync', label: 'Ratenplan synchronisieren', icon: Repeat, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/alix-flex', label: 'SEPA MANDAT', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          {
            path: '/finanzierungen', label: 'FREMD LEASING', icon: Landmark, roles: ['Admin', 'Super Admin'],
            children: [
              { path: '/finanzierungen/leasing-bank', label: 'Verfügbare Aufträge', icon: Landmark, roles: ['Admin', 'Super Admin'] },
              { path: '/finanzierungen/beantragen', label: 'Finanzierung beantragen', icon: FileSignature, roles: ['Admin', 'Super Admin'] },
              { path: '/finanzierungen/anfragen-offen', label: 'Anfragen offen', icon: Clock, roles: ['Admin', 'Super Admin'] },
              { path: '/finanzierungen/zusagen-bank', label: 'Zusagen Bank', icon: CheckCircle2, roles: ['Admin', 'Super Admin'] },
              { path: '/finanzierungen/absagen-bank', label: 'Absagen Bank', icon: X, roles: ['Admin', 'Super Admin'] },
            ],
          },
        ],
      },
      {
        path: '/finance/mahnwesen', label: 'MAHNUNGEN', icon: AlertTriangle, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/collect', label: 'ALIX COLLECT', icon: AlertTriangle, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/liste', label: 'Prioritätenliste', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/aufgaben', label: 'Aufgaben & Wiedervorlagen', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/auswertungen', label: 'Collect Auswertungen', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/limits', label: 'Kreditlimits & Sperren', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/cockpit', label: 'Executive Cockpit', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/health', label: 'Customer Health Score', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/playbooks', label: 'Collections Playbooks', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/gebuehren', label: 'Gebühren & Zinsen', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/einstellungen', label: 'Mahnstufen-Konfiguration', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/verkaeufer', label: 'Verkäuferbewertung', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/freigaben', label: 'Governance & Freigaben', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/recht', label: 'Recht & Inkasso', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/geraete', label: 'Geräte & Remote-Sperren', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/akte', label: 'Digitale Akte', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/schriftverkehr', label: 'Schriftverkehr & Zahl-Links', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/collect/copilot', label: 'Finance AI', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/mahnwesen', label: 'Mahnwesen', icon: FileText, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/finance/kassenbuch', label: 'KASSENBUCH & JOURNAL', icon: BookOpen, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/kassenbuch', label: 'Kassenbuch', icon: BookOpen, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/buchungsjournal', label: 'Buchungsjournal', icon: ScrollText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/zahlungsuebersicht', label: 'Zahlungsübersicht', icon: Wallet, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/bankbuchungen', label: 'Bankbuchungen', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/datev-export', label: 'Export DATEV', icon: FileDown, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/audit-revision', label: 'Audit & Revision', icon: ShieldCheck, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/stammdaten', label: 'Stammdaten (Kontenrahmen · Perioden)', icon: Database, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
        ],
      },
      {
        path: '/finance/provision', label: 'PROVISION MITARBEITER', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'],
        children: [
          { path: '/finance/provision', label: 'Übersicht', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/offene', label: 'Offene Provisionen', icon: Clock, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/freizugeben', label: 'Freizugebende Provisionen', icon: Lock, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/provision/freigegeben', label: 'Freigegebene Provisionen', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/auszahlungen', label: 'Auszahlungsübersicht', icon: Banknote, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/stornierte', label: 'Stornierte Provisionen', icon: X, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/abrechnungen', label: 'Provisionsabrechnungen', icon: FileText, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/zuordnung', label: 'Mitarbeiter-Zuordnung', icon: Users, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/provision/regeln', label: 'Provisionsregeln', icon: Database, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/provision/auswertungen', label: 'Auswertungen', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/provision/audit', label: 'Provisions-Audit', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/provision/einstellungen', label: 'Einstellungen', icon: Repeat, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/finance/anwaltsfaelle', label: 'ANWALTSFÄLLE', icon: Gavel, roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'],
        children: [
          { path: '/finance/anwaltsfaelle', label: 'Anwaltsfälle', icon: Gavel, roles: ['Admin', 'Super Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Buchhaltung Admin'] },
        ],
      },
      {
        path: '/finance/bwa', label: 'STATISTIK', icon: BarChart3, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/anlagen', label: 'Anlagenbuchhaltung', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/anlagen/afa-lauf', label: 'AfA-Lauf', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/anlagenspiegel', label: 'Anlagenspiegel & Inventar', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/bwa', label: 'BWA', icon: BarChart3, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/guv', label: 'GuV', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/bilanz', label: 'Bilanz', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/jahresabschluss', label: 'Jahresabschluss', icon: Lock, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/perioden', label: 'Periodenabschluss & Sperre', icon: Lock, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/datev', label: 'DATEV', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/steuer', label: 'Steuer-Auswertung', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/meldewesen', label: 'Steuer & Meldewesen', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/steuerkonto', label: 'Steuerkonto & Zahllast', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/budget', label: 'Budgetplanung', icon: BarChart3, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/soll-ist', label: 'Soll-Ist-Vergleich', icon: TrendingUp, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/forecast', label: 'Rolling Forecast', icon: LineChart, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kostenstellen-report', label: 'Kostenstellen-Report', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/deckungsbeitrag', label: 'Deckungsbeitrag DB1/DB2', icon: TrendingUp, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/segmentbericht', label: 'Segmentbericht', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/kontenblaetter', label: 'Kontenblätter', icon: FileText, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/saldenbilanz', label: 'Saldenbilanz', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/revisionsexport', label: 'Revisionsexport', icon: FileText, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/lohnbuchhaltung', label: 'Lohnbuchhaltung & SV', icon: Users, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/liquiditaet', label: 'Liquiditätsplanung', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/konsolidierung', label: 'Konsolidierung', icon: BarChart3, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/intercompany', label: 'Intercompany', icon: Activity, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/fx', label: 'Devisenkurse', icon: Banknote, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/konzern-guv', label: 'Konzern-GuV (EU+CH)', icon: Globe2, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/konzern-bilanz', label: 'Konzern-Bilanz (EU+CH)', icon: Globe2, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/ausgeliefert', label: 'AUSGELIEFERT · Faktura-Kontrolle', icon: Truck, roles: ['Admin', 'Super Admin', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'] },
          { path: '/finance/ai-insights', label: 'KI-Analyse', icon: Sparkles, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/anomalien', label: 'Anomalien', icon: AlertTriangle, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/ask', label: 'KI-Assistent (Fragen)', icon: MessageCircle, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/reports', label: 'Report Builder', icon: BarChart3, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/schedules', label: 'Berichts-Zeitpläne', icon: Activity, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/management-pack', label: 'Management-Pack', icon: FileText, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/stakeholders', label: 'Stakeholder-Portale', icon: Users, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/freigaben', label: 'Freigaben', icon: CheckSquare, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/automations', label: 'Automations', icon: Cog, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/compliance', label: 'Compliance', icon: BadgeCheck, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/einstellungen/systemstatus', label: 'Systemstatus', icon: FileText, roles: ['Admin', 'Super Admin'] },
        ],
      },
      {
        path: '/finance/kontoauszuege', label: 'BANK & KONTOAUSZÜGE', icon: Landmark, roles: ['Admin', 'Super Admin'],
        children: [
          { path: '/finance/kontoauszuege/import', label: 'Kontoauszüge importieren', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/buchungen', label: 'Importierte Buchungen', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/offen', label: 'Offene Zuordnungen', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/verbucht', label: 'Bereits verbuchte Zahlungen', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/historie', label: 'Importhistorie', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/quote', label: 'Rücklastschriftquote', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/konten', label: 'Bankkonten', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/regeln', label: 'Importregeln', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/datev', label: 'DATEV-Export', icon: Landmark, roles: ['Admin', 'Super Admin'] },
          { path: '/finance/kontoauszuege/bank-api', label: 'Bank-API / EBICS', icon: Landmark, roles: ['Admin', 'Super Admin'] },
        ],
      },
    ],
  },











  {
    path: '/connect', label: 'ALIX CONNECT', icon: MessageSquare, roles: ['Super Admin'],
    children: [
      { path: '/connect/team', label: 'Team Chat', icon: MessageSquare, roles: null },
      { path: '/connect/inbox', label: 'Unified Inbox', icon: Inbox, roles: null },
      { path: '/connect/telefonie', label: 'Telefonie (3CX)', icon: PhoneCall, roles: null },
      { path: '/connect/wallboard', label: 'Wallboard', icon: Activity, roles: null },
      { path: '/connect/queues', label: 'Warteschlangen & Agenten', icon: Users, roles: null },
      { path: '/connect/ivr', label: 'IVR & Öffnungszeiten', icon: PhoneCall, roles: ['Admin','Super Admin'] },
      { path: '/connect/forwarding', label: 'Rufumleitung & Follow-Me', icon: PhoneCall, roles: null },
      { path: '/connect/journal', label: 'Anruf-Journal (CRM)', icon: PhoneCall, roles: null },
      { path: '/connect/analytics-anrufe', label: 'Call-Analytics & Reports', icon: BarChart3, roles: null },
      { path: '/connect/compliance', label: 'Recording Compliance', icon: PhoneCall, roles: ['Admin','Super Admin'] },
      { path: '/connect/contacts', label: 'Kontakte', icon: Users, roles: null },
      { path: '/connect/websites', label: 'Webseiten', icon: Globe, roles: ['Admin','Super Admin'] },
      { path: '/connect/analytics', label: 'Website Analytics', icon: BarChart3, roles: null },
      { path: '/connect/settings', label: 'Rollout Status', icon: Settings, roles: ['Admin','Super Admin'] },
      { path: '/connect/realtime-collab', label: 'Realtime Collab', icon: Users, roles: ['Admin','Super Admin'] },
      { path: '/connect/compliance-automation', label: 'Compliance Automation', icon: ShieldCheck, roles: ['Admin','Super Admin'] },
      { path: '/connect/revenue-attribution', label: 'Revenue Attribution', icon: TrendingUp, roles: ['Admin','Super Admin'] },
      { path: '/connect/sales-forecast', label: 'Sales Forecast', icon: TrendingUp, roles: ['Admin','Super Admin'] },
      { path: '/connect/conversation-qa', label: 'Conversation QA', icon: ShieldCheck, roles: ['Admin','Super Admin'] },
    ],
  },


  {
    path: '/operation', label: 'OPERATIONS', icon: Workflow, roles: ['Super Admin', 'Admin'],
    children: [
      // 1) Freigaben & Genehmigungen
      {
        path: '#freigaben', label: 'FREIGABEN', icon: ShieldCheck, roles: ['Super Admin', 'Admin'],
        children: [
          { path: '/operation/auslieferungsfreigabe', label: 'Auslieferungsfreigabe', icon: ShieldCheck, roles: ['Super Admin', 'Admin'] },
          { path: '/freigaben', label: 'Auftrags-Freigaben', icon: CheckCircle2, roles: ['Super Admin'] },
          { path: '/order/timeline', label: 'Timeline Bestellungen', icon: Calendar, roles: ['Super Admin'] },
        ],
      },

      // 2) Produktion & Beschaffung
      {
        path: '/produktion', label: 'PRODUKTION & BESCHAFFUNG', icon: Factory,
        roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'],
        children: [
          { path: '/produktion', label: 'Dashboard', icon: LayoutDashboard, roles: null },
          { path: '/produktion/geraete', label: 'Geräte', icon: Cpu, roles: null },
          { path: '/produktion/baugruppen', label: 'Baugruppen', icon: Boxes, roles: null },
          { path: '/produktion/einzelteile', label: 'Einzelteile', icon: Wrench, roles: null },
          { path: '/produktion/stueckliste', label: 'Stückliste (BOM)', icon: ListTree, roles: null },
          { path: '/produktion/stuecklistenbaum', label: 'Stücklisten-Explorer', icon: ListTree, roles: null },
          { path: '/produktion/explosionszeichnungen', label: 'Explosionszeichnungen', icon: Layers, roles: null },
          { path: '/produktion/hersteller', label: 'Hersteller (MFR)', icon: Factory, roles: null },
          { path: '/produktion/hersteller-dashboard', label: 'Hersteller-Dashboard', icon: BarChart3, roles: null },
          { path: '/produktion/hersteller-dubletten', label: 'Hersteller-Dubletten', icon: Factory, roles: null },
          { path: '/produktion/bom-import', label: 'BOM- & Hersteller-Import', icon: Upload, roles: null },
          { path: '/produktion/lieferanten', label: 'Lieferanten', icon: Factory, roles: null },
          { path: '/produktion/beschaffung', label: 'Beschaffung (Bezugsquellen)', icon: PackageCheck, roles: null },
          { path: '/produktion/materialbedarf', label: 'Materialbedarf (MRP)', icon: ClipboardList, roles: null },
          { path: '/produktion/bestellungen', label: 'Bestellungen', icon: PackageCheck, roles: null },
          { path: '/produktion/wareneingang', label: 'Wareneingang & Prüfung', icon: PackageCheck, roles: null },
          { path: '/produktion/auftraege', label: 'Produktionsaufträge', icon: Factory, roles: null },
          { path: '/produktion/fertigungssteuerung', label: 'Fertigungssteuerung', icon: Factory, roles: null },
          { path: '/produktion/arbeitsanweisungen', label: 'Arbeitsanweisungen', icon: FileText, roles: null },
          { path: '/produktion/seriennummern', label: 'Serien- & Chargenvergabe', icon: Package, roles: null },
          { path: '/produktion/rueckverfolgbarkeit', label: 'Rückverfolgbarkeit', icon: ClipboardCheck, roles: null },
          { path: '/produktion/ersatzteilkatalog', label: 'Ersatzteilkatalog', icon: Package, roles: null },
          { path: '/produktion/stammdatenimport', label: 'Stammdaten-Import', icon: Upload, roles: null },
        ],
      },

      // 2b) ALIX Software Compliance (IEC 62304)
      {
        path: '/produktion/software', label: 'SOFTWARE COMPLIANCE', icon: Cpu,
        roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'],
        children: [
          { path: '/produktion/software', label: 'Dashboard', icon: LayoutDashboard, roles: null },
          { path: '/produktion/software/traceability', label: 'Traceability Matrix', icon: ListTree, roles: null },
          { path: '/produktion/software/requirements', label: 'Requirements', icon: ListChecks, roles: null },
          { path: '/produktion/software/units', label: 'Software Architecture', icon: Boxes, roles: null },
          { path: '/produktion/software/risiken', label: 'Software Risks', icon: ShieldAlert, roles: null },
          { path: '/produktion/software/verifikation', label: 'Unit Verification', icon: CheckCircle2, roles: null },
          { path: '/produktion/software/integration', label: 'Integration Tests', icon: GitBranch, roles: null },
          { path: '/produktion/software/systemtests', label: 'System Tests', icon: ClipboardCheck, roles: null },
          { path: '/produktion/software/bugs', label: 'Bugs & Issues', icon: AlertOctagon, roles: null },
          { path: '/produktion/software/releases', label: 'Version Management', icon: Hash, roles: null },
          { path: '/produktion/software/team', label: 'Development Team', icon: Users, roles: null },
          { path: '/produktion/hardware-dokumentation', label: 'Hardware Documentation', icon: Cpu, roles: null },
          { path: '/produktion/software/anwenderbefragung', label: 'User Survey', icon: ClipboardList, roles: null },
          { path: '/produktion/software/klassifizierung', label: 'Safety Classification', icon: Layers, roles: null },
          { path: '/produktion/software/plaene', label: 'Pläne (SDP · SCMP)', icon: FileText, roles: null },
          { path: '/produktion/software/soup', label: 'SOUP / OTS Liste', icon: Package, roles: null },
          { path: '/produktion/software/risikomassnahmen', label: 'Risikomaßnahmen', icon: ShieldCheck, roles: null },
          { path: '/produktion/software/anomalien', label: 'Anomalienliste', icon: AlertTriangle, roles: null },
          { path: '/produktion/software/problem-reports', label: 'Problem Resolution', icon: HelpCircle, roles: null },
          { path: '/produktion/software/freigaben', label: 'Elektronische Freigaben', icon: FileSignature, roles: null },
        ],
      },


      // 3) Qualität & Compliance (MDR / CE / ISO 13485)
      {
        path: '#qualitaet', label: 'QUALITÄT & COMPLIANCE', icon: ShieldCheck,
        roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'QM', 'Medical'],
        children: [
          { path: '/iso', label: 'ISO Audit Center', icon: ShieldCheck, roles: ['Super Admin', 'Admin', 'QM'] },
          { path: '/produktion/konformitaet', label: 'Konformität (CE/MDR)', icon: ShieldCheck, roles: null },
          { path: '/produktion/risikomanagement', label: 'Risikomanagement (ISO 14971)', icon: ShieldCheck, roles: null },
          { path: '/produktion/pruefplaene', label: 'Prüfpläne', icon: ClipboardCheck, roles: null },
          { path: '/produktion/pruefmerkmale', label: 'Prüfmerkmale', icon: ClipboardList, roles: null },
          { path: '/produktion/pruefprotokolle', label: 'Prüfprotokolle', icon: ClipboardCheck, roles: null },
          { path: '/produktion/pruefmittel', label: 'Prüfmittel & Kalibrierung', icon: ClipboardCheck, roles: null },
          { path: '/produktion/geraeteakte', label: 'Geräteakte (Technische Akte)', icon: FileText, roles: null },
          { path: '/produktion/dokumente', label: 'Technische Dokumentation', icon: FileCheck2, roles: null },
          { path: '/produktion/aenderungen', label: 'Änderungen (ECR/ECO)', icon: GitBranch, roles: null },
          { path: '/produktion/aenderungsfreigabe', label: 'Änderungsfreigabe', icon: GitBranch, roles: null },
          { path: '/produktion/lieferantenbewertung', label: 'Lieferantenbewertung', icon: Factory, roles: null },
          { path: '/produktion/qualitaetskennzahlen', label: 'Qualitätskennzahlen', icon: BarChart3, roles: null },
        ],
      },

      // 4) Dokumente & Signaturen (AlixDocs + ALIX SIGN PRO)
      {
        path: '#dokumente-signaturen', label: 'DOKUMENTE & SIGNATUREN', icon: FolderTree, roles: ['Super Admin', 'Admin'],
        children: [
          { path: '/alixdocs', label: 'AlixDocs Enterprise Hub', icon: FolderTree, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs/aufgaben', label: 'Aufgaben', icon: FolderTree, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs2/inbox', label: 'Posteingang', icon: FolderTree, roles: ['Super Admin', 'Admin'] },
          { path: '/dokumente', label: 'Dokumenten-Suche', icon: Files, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs2/ai', label: 'KI-Suche ✨', icon: Sparkles, roles: ['Super Admin', 'Admin'] },
          { path: '/dokumente/freigaben', label: 'Freigaben-Inbox', icon: CheckCircle2, roles: ['Super Admin', 'Admin'] },
          { path: '/dokumente/smart-review', label: 'Smart Review', icon: SearchCheck, roles: ['Super Admin'] },
          { path: '/dokumente/duplikate', label: 'Duplikate', icon: SearchCheck, roles: ['Super Admin'] },
          { path: '/dokumente/lernregeln', label: 'Lern-Regeln 🧠', icon: Sparkles, roles: ['Super Admin'] },
          { path: '/m/alixdocs', label: 'Mobile Erfassung 📱', icon: SearchCheck, roles: ['Super Admin'] },
          { path: '/signaturen', label: 'ALIX SIGN — Übersicht', icon: FileSignature, roles: ['Super Admin'] },
          { path: '/signaturen/neu', label: 'ALIX SIGN — Neue Anfrage', icon: FilePlus, roles: ['Super Admin'] },
          { path: '/signaturen/bulk', label: 'ALIX SIGN — Serien-Versand', icon: Send, roles: ['Super Admin'] },
          { path: '/signaturen/genehmigungen', label: 'ALIX SIGN — Genehmigungen', icon: CheckCircle2, roles: ['Super Admin'] },
          { path: '/signaturen/cockpit', label: 'ALIX SIGN — Cockpit & Analytics', icon: BarChart3, roles: ['Super Admin'] },
          { path: '/signaturen/dashboard', label: 'ALIX SIGN — SLA-Dashboard', icon: BarChart3, roles: ['Super Admin'] },
          { path: '/admin/signaturen', label: 'Setup — Stempel & Templates', icon: Settings, roles: ['Super Admin'] },
          { path: '/admin/signaturen/facsimile', label: 'Setup — Facsimile-Unterschrift', icon: Settings, roles: ['Super Admin'] },
          { path: '/admin/sign-marketplace', label: 'Setup — Marketplace & White-Label', icon: Settings, roles: ['Super Admin'] },
          { path: '/admin/sign-api-docs', label: 'Setup — Partner-API', icon: Settings, roles: ['Super Admin'] },
          { path: '/admin/alixdocs/chains', label: 'Setup — Freigabeketten', icon: Workflow, roles: ['Super Admin'] },
          { path: '/alixdocs2/doctypes', label: 'Setup — Dokumententypen', icon: FolderTree, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs2/workflows', label: 'Setup — Workflows & Warnungen', icon: Workflow, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs2/nextcloud', label: 'Setup — Nextcloud', icon: Cloud, roles: ['Super Admin'] },
          { path: '/admin/alixdocs/reindex', label: 'KI-Reindex & Duplikate', icon: Sparkles, roles: ['Super Admin'] },
          { path: '/admin/alixdocs/reports', label: 'Reporting & Audit-Export', icon: FileDown, roles: ['Super Admin'] },
          { path: '/alixdocs2/compliance', label: 'Compliance-Export', icon: FileDown, roles: ['Super Admin', 'Admin'] },
          { path: '/admin/alixdocs/heatmap', label: 'Share Heatmap 🔥', icon: Flame, roles: ['Super Admin', 'Admin'] },
          { path: '/alixdocs2/papierkorb', label: 'Papierkorb', icon: FolderTree, roles: ['Super Admin', 'Admin'] },
        ],
      },

      // 5) Tickets & Portale
      {
        path: '#tickets-portale', label: 'TICKETS & PORTALE', icon: Ticket, roles: ['Super Admin', 'Admin'],
        children: [
          { path: '/tickets', label: 'Ticketliste', icon: Ticket, roles: ['Super Admin', 'Admin'] },
          { path: '/operation/ticket-abteilungen', label: 'Abteilungen (Routing)', icon: FolderTree, roles: ['Super Admin'] },
          { path: '/tickets/sync', label: 'Sync-Monitor', icon: Activity, roles: ['Super Admin'] },
          { path: '/tickets/api-sync', label: 'API-Sync Einstellungen', icon: Settings, roles: ['Super Admin'] },
          { path: '/portal-admin', label: 'Kundenportal', icon: Globe, roles: ['Super Admin'] },
          { path: '/operation/kundenportal', label: 'Kundenportal Konfiguration', icon: Globe, roles: ['Super Admin'] },
          { path: '/mediapaket/admin', label: 'Mediapaket-Konfigurator', icon: PackageIcon, roles: ['Super Admin'] },
        ],
      },

      // 6) Kommunikation & Vorlagen
      {
        path: '#kommunikation', label: 'KOMMUNIKATION & VORLAGEN', icon: Mail, roles: ['Super Admin'],
        children: [
          { path: '/operation/email-vorlagen', label: 'E-Mail Vorlagen', icon: Mail, roles: ['Super Admin'] },
          { path: '/operation/sms-konfiguration', label: 'SMS Konfiguration', icon: MessageSquare, roles: ['Super Admin'] },
          { path: '/operation/anzahlung-mahnung-konfiguration', label: 'Anzahlungs-Mahnung Konfiguration', icon: Bell, roles: ['Super Admin'] },
          { path: '/operation/news', label: 'News & Begrüßung', icon: Megaphone, roles: ['Super Admin'] },
        ],
      },

      // 7) ALIX KI
      {
        path: '#alix-ki', label: 'ALIX KI', icon: Sparkles, roles: ['Super Admin'],
        children: [
          { path: '/operation/alix-copilot', label: 'ALIX Copilot Konfiguration', icon: Sparkles, roles: ['Super Admin'] },
          { path: '/operations/alix-copilot-config', label: 'ALIX Copilot Steuerzentrale', icon: Sparkles, roles: ['Super Admin'] },
        ],
      },

      // 8) Feedback & Rewards
      {
        path: '/umfragen/dashboard', label: 'FEEDBACK & REWARDS', icon: ClipboardCheck,
        roles: ['Admin', 'Super Admin', 'Marketing', 'Geschäftsführung', 'Kundenservice', 'Service', 'Vertrieb', 'Vertriebsleitung', 'QM', 'Feedback'],
        children: [
          { path: '/umfragen/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
          { path: '/umfragen', label: 'Umfragen', icon: ClipboardCheck, roles: null },
          { path: '/umfragen/bibliothek', label: 'Vorlagen-Bibliothek', icon: Sparkles, roles: null },
          { path: '/umfragen/antworten', label: 'Antworten', icon: MessageSquare, roles: null },
          { path: '/umfragen/auswertung', label: 'Auswertung', icon: Sparkles, roles: null },
          { path: '/umfragen/statistik', label: 'Statistik', icon: BarChart3, roles: null },
          { path: '/umfragen/benchmark', label: 'Benchmark & Trends', icon: BarChart3, roles: null },
          { path: '/umfragen/automatisierung', label: 'Automatisierung', icon: Zap, roles: ['Admin', 'Super Admin', 'Marketing', 'Feedback'] },
          { path: '/umfragen/testimonials', label: 'Testimonials', icon: Quote, roles: null },
          { path: '/umfragen/empfaenger', label: 'Empfängerliste', icon: Users, roles: null },
          { path: '/umfragen/geschenke', label: 'Geschenke', icon: Gift, roles: null },
          { path: '/umfragen/belohnungen', label: 'Belohnungszusagen', icon: Gift, roles: null },
          { path: '/umfragen/gutscheincodes', label: 'Gutscheincodes', icon: Ticket, roles: null },
          { path: '/umfragen/import', label: 'Upload & Import', icon: Upload, roles: null },
          { path: '/umfragen/vorlagen', label: 'E-Mail-Vorlagen', icon: Mail, roles: ['Admin', 'Super Admin', 'Marketing'] },
          { path: '/umfragen/protokoll', label: 'Versand-Protokoll', icon: MailCheck, roles: null },
          { path: '/umfragen/exporte', label: 'Exporte', icon: Download, roles: null },
          { path: '/umfragen/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Admin', 'Super Admin'] },
        ],
      },

      // 9) Social Media
      {
        path: '#social-media', label: 'SOCIAL MEDIA', icon: Megaphone, roles: ['Super Admin','Admin','Marketing','Grafiker'],
        children: [
          { path: '/social/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/onboarding', label: 'Onboarding-Wizard', icon: Rocket, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/plattformen', label: 'Plattformen & Zugangsdaten', icon: Users, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/fragebogen', label: 'Marketing-Fragebogen', icon: FileText, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/kalender', label: 'Content-Kalender', icon: Calendar, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/beitrag/neu', label: 'Neuer Beitrag', icon: Plus, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/freigaben', label: 'Freigaben', icon: CheckCircle2, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/medien', label: 'Medien-Bibliothek', icon: ImageIcon, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/analytics', label: 'Analytics', icon: BarChart3, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/veroeffentlichung', label: 'Publishing-Queue', icon: Send, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/kampagnen', label: 'Kampagnen & Ads', icon: Target, roles: ['Super Admin','Admin','Marketing'] },
          { path: '/social/wettbewerber', label: 'Wettbewerber & Trends', icon: TrendingUp, roles: ['Super Admin','Admin','Marketing','Grafiker'] },
          { path: '/social/reports', label: 'Reports & Kundenlinks', icon: FileText, roles: ['Super Admin','Admin','Marketing'] },
        ],
      },

      // 10) Teamkalender Setup
      {
        path: '#teamk-setup', label: 'TEAMKALENDER SETUP', icon: CalendarDays, roles: ['Super Admin'],
        children: [
          { path: '/esc/ressourcen',    label: 'Ressourcen',    icon: Boxes,     roles: ['Super Admin'] },
          { path: '/esc/mitarbeiter',   label: 'Mitarbeiter',   icon: Users,     roles: ['Super Admin'] },
          { path: '/esc/abteilungen',   label: 'Abteilungen',   icon: Building2, roles: ['Super Admin'] },
          { path: '/esc/einstellungen', label: 'Einstellungen', icon: Settings,  roles: ['Super Admin'] },
        ],
      },

      // 11) Mandanten – CMR
      {
        path: '#cmr', label: 'CMR', icon: Building2, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'],
        children: [
          { path: '/cmr', label: 'CMR Dashboard', icon: BarChart3, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/dokumente', label: 'Belege & Vorgänge', icon: FileText, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/kunden', label: 'Kunden CMR', icon: Users, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/artikel', label: 'Artikelstamm', icon: Package, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/projekte', label: 'Projekte CMR', icon: Briefcase, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/abos', label: 'Abrechnungen', icon: Repeat, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/sammelrechnungen', label: 'Sammelabrechnung', icon: Repeat, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/betrieb', label: 'Betrieb & Portale', icon: Activity, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/zeiten', label: 'Zeiterfassung', icon: Clock, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/buchhaltung', label: 'Buchhaltung CMR', icon: Wallet, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/mahnwesen', label: 'Mahnwesen CMR', icon: BellRing, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR', 'CMR Viewer'] },
          { path: '/cmr/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Super Admin'] },
        ],
      },

      // 12) Mandanten – Alix Medical
      {
        path: '#med', label: 'ALIX MEDICAL', icon: Building2, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'],
        children: [
          { path: '/med', label: 'Medical Dashboard', icon: BarChart3, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'] },
          { path: '/med/belege', label: 'Belege', icon: FileText, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'] },
          { path: '/med/artikel', label: 'Artikelstamm', icon: Package, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'] },
          { path: '/med/buchhaltung', label: 'Buchhaltung Medical', icon: Wallet, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'] },
          { path: '/med/compliance', label: 'MDR / CE / ISO', icon: Activity, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical'] },
          { path: '/med/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Super Admin'] },
        ],
      },

      // 13) Lizenzmanagement
      {
        path: '#license', label: 'LIZENZMANAGEMENT', icon: BadgeCheck, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'],
        children: [
          { path: '/license', label: 'Alix License Dashboard', icon: BarChart3, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/cockpit', label: 'Lizenz-Cockpit', icon: LineChart, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/marken', label: 'Marken', icon: Star, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/lizenznehmer', label: 'Lizenznehmer', icon: Building2, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/vertraege', label: 'Lizenzverträge', icon: FileSignature, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/saetze', label: 'Royalty-Sätze', icon: Hash, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/produkte', label: 'Produktlizenzen', icon: Package, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/royalties', label: 'Lizenzabrechnung', icon: Receipt, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/rechnungen', label: 'Lizenzrechnungen', icon: FileText, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/intercompany', label: 'Intercompany-Rechnungen', icon: Repeat, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/auswertungen', label: 'Auswertungen', icon: LineChart, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/laufzeiten', label: 'Vertragslaufzeiten', icon: CalendarClock, roles: ['Super Admin', 'Admin', 'Geschäftsführung', 'License Manager'] },
          { path: '/license/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Super Admin', 'Admin', 'License Manager'] },
        ],
      },

      // 14) Benutzer & Rechte
      {
        path: '#benutzer-rechte', label: 'BENUTZER & RECHTE', icon: Users, roles: ['Super Admin', 'Admin'],
        children: [
          { path: '/benutzer', label: 'Benutzer', icon: Users, roles: ['Super Admin'] },
          { path: '/rollen', label: 'Rollen', icon: Shield, roles: ['Super Admin'] },
          { path: '/admin/rollen-freigaben', label: 'Rollen & Freigaben', icon: ShieldCheck, roles: ['Super Admin'] },
          { path: '/order/zulieferer', label: 'Lieferanten', icon: Users, roles: ['Super Admin'] },
          { path: '/mandanten', label: 'Mandanten', icon: Building2, roles: ['Super Admin'] },
          { path: '/workspaces-admin', label: 'Workspaces', icon: LayoutGrid, roles: ['Admin', 'Super Admin'] },
          { path: '/admin/mobile-sync', label: 'Mobile Sync', icon: SmartphoneIcon, roles: ['Admin', 'Super Admin'] },
          { path: '/einstellungen/mobile-geraete', label: 'Meine mobilen Geräte', icon: ContactIcon, roles: ['Admin', 'Super Admin'] },

        ],
      },

      // 15) Sicherheit & Betrieb (Fort Knox)
      {
        path: '#fort-knox', label: 'SICHERHEIT & BETRIEB', icon: Lock, roles: ['Super Admin'],
        children: [
          { path: '/operation/security-center', label: 'Alix Security Center', icon: Shield, roles: ['Super Admin'] },
          { path: '/security-center', label: 'Security Center (Rechte)', icon: Shield, roles: ['Super Admin'] },
          { path: '/operation/datensicherung', label: 'Security Base', icon: ShieldCheck, roles: ['Super Admin'] },
          { path: '/datensicherung', label: 'Datensicherung', icon: Shield, roles: ['Super Admin'] },
          { path: '/operation/systemwartung', label: 'Systemwartung', icon: AlertTriangle, roles: ['Super Admin'] },
          { path: '/operation/performance', label: 'Performance Center', icon: Activity, roles: ['Super Admin'] },
          { path: '/operation/system-health', label: 'System Health Center', icon: HeartPulse, roles: ['Super Admin'] },
          { path: '/system', label: 'Monitoring', icon: Server, roles: ['Super Admin'] },
          { path: '/lager/doppelte-reservierungen', label: 'Doppelte Reservierungen', icon: AlertTriangle, roles: ['Super Admin'] },
        ],
      },

      // 16) Audit Center
      {
        path: '#audit-center', label: 'AUDIT CENTER', icon: ShieldCheck, roles: ['Super Admin'],
        children: [
          { path: '/audit-center', label: 'Übersicht', icon: LayoutDashboard, roles: ['Super Admin'] },
          { path: '/audit-center/live', label: 'Live-Monitor', icon: Radio, roles: ['Super Admin'] },
          { path: '/audit-center/timeline', label: 'Activity Timeline', icon: Activity, roles: ['Super Admin'] },
          { path: '/audit-center/changes', label: 'Änderungs-Log', icon: FileText, roles: ['Super Admin'] },
          { path: '/audit-center/security', label: 'Sicherheits-Alerts', icon: ShieldAlert, roles: ['Super Admin'] },
          { path: '/audit-center/employees', label: 'Mitarbeiter-Profile', icon: Users, roles: ['Super Admin'] },
          { path: '/audit-center/ups', label: 'Ultimate Productivity Score', icon: Trophy, roles: ['Super Admin'] },
          { path: '/audit-center/reports', label: 'Compliance Reports', icon: FileDown, roles: ['Super Admin'] },
          { path: '/operation/logfiles', label: 'Logfiles', icon: ScrollText, roles: ['Super Admin'] },
        ],
      },

      // 17) Auswertungen
      {
        path: '#stats', label: 'AUSWERTUNGEN', icon: BarChart3, roles: ['Super Admin'],
        children: [
          { path: '/mailcenter/executive', label: 'Executive Dashboard', icon: TrendingUp, roles: ['Super Admin'] },
          { path: '/konzern/dashboard', label: 'Konzern-Dashboard', icon: TrendingUp, roles: ['Super Admin'] },
          { path: '/verkauf/anfragen/dashboard', label: 'Anfragen Dashboard', icon: BarChart3, roles: ['Super Admin'] },
          { path: '/geraetetypen', label: 'Gerätetypen', icon: BarChart3, roles: ['Super Admin'] },
          { path: '/connect/customer-360', label: 'Kunde 360°', icon: Users, roles: ['Super Admin'] },
        ],
      },

      // 18) System & Import
      {
        path: '#system', label: 'SYSTEM & IMPORT', icon: Cog, roles: ['Super Admin', 'Admin'],
        children: [
          { path: '/import', label: 'Import', icon: Cloud, roles: ['Super Admin', 'Admin'] },
          { path: '/operation/nummernkreise', label: 'Nummernkreise', icon: Hash, roles: ['Super Admin'] },
          { path: '/operation/auftrags-import', label: 'Auftragsabgleich – Import', icon: Upload, roles: ['Super Admin', 'Admin'] },
          { path: '/operation/auftrags-abgleich', label: 'Auftragsabgleich', icon: ListChecks, roles: ['Super Admin', 'Admin'] },
          { path: '/verkauf/anfragen/import', label: 'Anfragen Import', icon: Upload, roles: ['Super Admin'] },
          { path: '/verkauf/angebot/import', label: 'Angebote Data Import', icon: Upload, roles: ['Super Admin'] },
          { path: '/operation/angebotskalender-config', label: 'Angebotskalender Konfiguration', icon: Calendar, roles: ['Super Admin'] },
        ],
      },
    ],
  },
];
