import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAtOnly } from '@/hooks/useAtOnly';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, ClipboardList, MapPin, Banknote, Users, LogOut, Shield, ShieldCheck, Menu, X, ChevronLeft, Building2, Cloud, Server, ListOrdered, Sun, Moon, Gavel, Truck, PackageCheck, BarChart3, Factory, ShoppingCart, ChevronDown, TrendingUp, Workflow, AlertTriangle, Calendar, FileText, FileSignature, Warehouse, Settings, Package, FilePlus, BookOpen, Receipt, Undo2, CreditCard, CheckCircle2, FolderTree, ScrollText, Inbox, Mail, Landmark, SearchCheck, Pause, Clock, HelpCircle, Star, Lock, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import WelcomeDialog from '@/components/WelcomeDialog';
import LeoWelcomeDialog from '@/components/LeoWelcomeDialog';
import DesignVariantSwitcher from '@/components/DesignVariantSwitcher';
import AuroraPrioTicker from '@/components/AuroraPrioTicker';
import AuroraTopNav from '@/components/AuroraTopNav';
import { useDesignVariant } from '@/hooks/useDesignVariant';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import alixLogo from '@/assets/alix-logo-gold.png';



const APP_VERSION = '4.0';

type NavChild = { path: string; label: string; icon: typeof LayoutDashboard; roles: string[] | null; children?: NavChild[] };
type NavItem = NavChild & { children?: NavChild[] };

const navItems: NavItem[] = [
  { path: '/', label: 'DASHBOARD', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
  {
    path: '/detailsuche', label: 'DETAILSUCHE', icon: SearchCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Read Only Audit'],
    children: [
      { path: '/detailsuche', label: 'Suche', icon: SearchCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
      { path: '/lager/doppelte-reservierungen', label: 'Doppelte Reservierungen', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order'] },
    ],
  },
  { path: '/geraetesperren', label: 'GERÄTESPERREN', icon: Lock, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
  {
    path: '/auftragsverwaltung', label: 'AUFTRAGSVERWALTUNG', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'],
    children: [
      {
        path: '/kunden', label: 'KUNDEN', icon: Building2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'],
        children: [
          { path: '/kunden', label: 'Kunden', icon: Building2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
        ],
      },
      {
        path: '/verkauf/artikel-uebersicht', label: 'ARTIKEL', icon: Package, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'],
        children: [
          { path: '/verkauf/artikel', label: 'Alle Artikel', icon: Package, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'] },
          { path: '/verkauf/artikel/kategorie', label: 'Kategorie', icon: FolderTree, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'] },
          { path: '/verkauf/artikel/katalog', label: 'Katalog', icon: BookOpen, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'] },
          { path: '/verkauf/artikel/wareneingang', label: 'Wareneingang', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'] },
        ],
      },
      {
        path: '/verkauf', label: 'VERKÄUFE', icon: TrendingUp, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'],
        children: [
          { path: '/verkauf/angebot/neu', label: 'Angebot erstellen', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order'] },
          { path: '/verkauf/angebote', label: 'Angebote', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/verkauf/freigabe', label: 'Freigabe', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/auftraege', label: 'Aufträge', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/auftraege-at', label: 'Aufträge AT', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Finanzierungen', 'FACTORY INVOICE', 'Lieferant', 'Read Only Audit'] },
          { path: '/verkauf/anzahlungsrechnung', label: 'Anzahlungsrechnung', icon: Receipt, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/finance/rechnungen', label: 'Rechnung', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/verkauf/gutschriften', label: 'Gutschriften', icon: Undo2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
        ],
      },
      {
        path: '/auftraege-gruppe', label: 'PRIO-LISTEN', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'],
        children: [
          { path: '/prio-liste', label: 'Prio-Liste', icon: ListOrdered, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/prio-liste/hold', label: 'Hold', icon: Pause, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/anwaltsliste', label: 'Anwaltsliste', icon: Gavel, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/geliefert', label: 'Auftrag geliefert', icon: Truck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
          { path: '/teilgeliefert', label: 'Teilgeliefert', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'] },
        ],
      },
    ],
  },
  {
    path: '/auftragsverwaltung/bestellungen', label: 'BESTELLWESEN', icon: ShoppingCart, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich', 'Lieferant', 'FACTORY INVOICE'],
    children: [
      { path: '/order/timeline', label: 'Timeline Bestellungen', icon: Calendar, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/order/frei-bestellung', label: 'Bestellung möglich', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Order'] },
      { path: '/order/reklamation', label: 'Bestellung Reklamation', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order'] },
      { path: '/order', label: 'Factory Orders', icon: Factory, roles: ['Admin', 'Super Admin', 'Order'] },
      {
        path: '/production', label: 'PRODUCTION', icon: Factory, roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE', 'Order'],
        children: [
          { path: '/production/order-in', label: 'Order In', icon: Inbox, roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE', 'Order'] },
          { path: '/production', label: 'Liste', icon: ListOrdered, roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE', 'Order'] },
          { path: '/production/fertig', label: 'Fertig', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE', 'Order'] },
          { path: '/production/factory-invoice', label: 'Factory Invoice', icon: Receipt, roles: ['Admin', 'Super Admin', 'FACTORY INVOICE'] },
        ],
      },
    ],
  },
  {
    path: '/lagerverwaltung', label: 'LAGERVERWALTUNG', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'],
    children: [
      { path: '/lager/leihgeraete', label: 'Leihgeräte', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/lagergeraete', label: 'Lagergeräte', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/equipment-area/unterwegs', label: 'Unterwegs', icon: Truck, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/equipment-area/produktion', label: 'Produktion', icon: Factory, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/equipment-area/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/equipment-area/hold', label: 'Hold', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
      { path: '/lager/equipment-area/ausgeliefert', label: 'Ausgeliefert', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Order', 'Österreich'] },
    ],
  },
  {
    path: '/tourenplanung', label: 'TOURENPLANUNG', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Österreich'],
    children: [
      { path: '/tourenplanung', label: 'Übersicht', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Österreich'] },
      { path: '/tourenplanung/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
      {
        path: '/papiere', label: 'VERSAND', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'],
        children: [
          { path: '/papiere', label: 'Übersicht', icon: FileText, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/versand/lieferscheine', label: 'Lieferscheine', icon: Truck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/versand/ratenplan', label: 'Ratenplan', icon: Banknote, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/versand/mietkauf', label: 'Mietkauf', icon: FileSignature, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
          { path: '/versand/sepa-mandat', label: 'SEPA Mandat', icon: CreditCard, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Österreich'] },
        ],
      },
    ],
  },

  {
    path: '/finance', label: 'FINANCE', icon: Banknote, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'],
    children: [
      // { path: '/finance/ratenzahler', label: 'Ratenzahler', icon: Banknote, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/alix-flex', label: 'ALIX FLEX', icon: Banknote, roles: ['Admin', 'Super Admin'] },
      { path: '/finance/rechnungen', label: 'Rechnungen', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/offene-posten', label: 'Offene Posten', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/unpaid-zoho', label: 'Unbezahlte Rechnungen (Zoho)', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
      {
        path: '/finanzierungen', label: 'FREMD LEASING', icon: Landmark, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'],
        children: [
          { path: '/finanzierungen/leasing-bank', label: 'Verfügbare Aufträge', icon: Landmark, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'] },
          { path: '/finanzierungen/beantragen', label: 'Finanzierung beantragen', icon: FileSignature, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'] },
          { path: '/finanzierungen/anfragen-offen', label: 'Anfragen offen', icon: Clock, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'] },
          { path: '/finanzierungen/zusagen-bank', label: 'Zusagen Bank', icon: CheckCircle2, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'] },
          { path: '/finanzierungen/absagen-bank', label: 'Absagen Bank', icon: X, roles: ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'] },
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
  {
    path: '/operation', label: 'OPERATIONS', icon: Workflow, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Read Only Audit'],
    children: [
      { path: '/geraetetypen', label: 'Gerätetypen', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance'] },
      { path: '/import', label: 'Import', icon: Cloud, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Read Only Audit'] },
      { path: '/system', label: 'Monitoring', icon: Server, roles: ['Admin', 'Super Admin', 'Read Only Audit'] },
      { path: '/benutzer', label: 'Benutzer', icon: Users, roles: ['Admin', 'Super Admin'] },
      { path: '/order/zulieferer', label: 'Lieferanten', icon: Users, roles: ['Admin', 'Super Admin'] },
      { path: '/rollen', label: 'Rollen', icon: Shield, roles: ['Admin', 'Super Admin'] },
      { path: '/datensicherung', label: 'Datensicherung', icon: Shield, roles: ['Admin', 'Super Admin'] },
      { path: '/operation/logfiles', label: 'Logfiles', icon: ScrollText, roles: ['Admin', 'Super Admin', 'Read Only Audit'] },
      { path: '/operation/email-vorlagen', label: 'E-Mail Vorlagen', icon: Mail, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order'] },
      { path: '/portal-admin', label: 'Kundenportal', icon: Globe, roles: ['Admin', 'Super Admin', 'Order'] },
      { path: '/operation/systemwartung', label: 'Systemwartung', icon: AlertTriangle, roles: ['Super Admin'] },
    ],
  },
  {
    path: '/mdr-ce', label: 'MDR CE', icon: ShieldCheck, roles: null,
    children: [
      { path: '/mdr-ce/iso-13485', label: 'ISO 13485', icon: ShieldCheck, roles: null },
    ],
  },

];

export default function AppLayout() {
  const { profile, roles, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { variant } = useDesignVariant();
  const isAurora = variant === 'aurora';
  const location = useLocation();
  const navigate = useNavigate();
  // Desktop: eingeklappt? (schmale Icon-Leiste)
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: Drawer offen?
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [lagerCounts, setLagerCounts] = useState<Record<string, number>>({});
  const atOnly = useAtOnly();
  // Desktop: flexible Sidebar-Breite (px), per Drag anpassbar, in localStorage gespeichert
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 480;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const v = Number(localStorage.getItem('sidebar_width'));
    return v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : 240;
  });
  const [resizing, setResizing] = useState(false);

  // Globaler Auto-Refresh: remountet die aktuelle Seite alle 60 Minuten,
  // sodass alle Listen & Statistiken neu geladen werden. Zusätzlich bei
  // Tab-Fokus, wenn die letzten Daten älter als 60 Min sind.
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const REFRESH_MS = 15 * 60 * 1000;
    let lastRefresh = Date.now();
    const tick = () => { lastRefresh = Date.now(); setRefreshKey(k => k + 1); };
    const intervalId = window.setInterval(tick, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > REFRESH_MS) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      setResizing(false);
      try { localStorage.setItem('sidebar_width', String(sidebarWidth)); } catch {}
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, sidebarWidth]);

  // Drawer schließen, wenn die Route wechselt
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Geräte-Anzahlen für Lagerbestand-Untermenüs laden
  // - initial + bei Routenwechsel
  // - Auto-Refresh alle 30 Minuten
  // - Realtime-Update bei Änderungen an lager_devices
  // - Refresh bei Tab-Fokus, falls Daten älter als 30 Min sind
  useEffect(() => {
    let cancelled = false;
    let lastLoadedAt = 0;
    const REFRESH_MS = 5 * 60 * 1000; // 5 Minuten

    const load = async () => {
      const { data, error } = await supabase
        .from('lager_devices')
        .select('notes, reserved_order_id');
      if (cancelled || error || !data) return;
      lastLoadedAt = Date.now();
      const getStatus = (n: string | null | undefined) => {
        const m = /\[Status:\s*([^\]]+)\]/.exec(n ?? '');
        return (m?.[1] ?? '').trim();
      };
      const isLeih = (n: string | null | undefined) =>
        (n ?? '').includes('[Typ: Leihgerät]') || (n ?? '').includes('[Leihgerät]');
      let leih = 0, lager = 0, transfer = 0, produktion = 0, hold = 0, warehouse = 0, ausgeliefert = 0;
      for (const d of data as { notes: string | null; reserved_order_id: string | null }[]) {
        const s = getStatus(d.notes);
        if (s === 'Transfer') { transfer++; continue; }
        if (s === 'Produktion') { produktion++; continue; }
        if (s === 'Hold') { hold++; continue; }
        if (s === 'Shell Warehouse') {
          // Reservierte Geräte werden im Warehouse nicht mehr gezählt
          if (!d.reserved_order_id) warehouse++;
          continue;
        }
        if (s === 'Ausgeliefert') { ausgeliefert++; continue; }
        if (isLeih(d.notes)) leih++; else lager++;
      }
      setLagerCounts((prev) => ({
        ...prev,
        '/lager': leih + lager + transfer + produktion + hold + warehouse + ausgeliefert,
        '/lager/leihgeraete': leih,
        '/lager/lagergeraete': lager,
        '/lager/equipment-area/unterwegs': transfer,
        '/lager/equipment-area/produktion': produktion,
        '/lager/equipment-area/hold': hold,
        '/lager/equipment-area/warehouse': warehouse,
        '/lager/equipment-area/ausgeliefert': ausgeliefert,
        '/lager/equipment-area': lager + transfer + produktion + hold + warehouse + ausgeliefert,
      }));
    };

    load();

    // Periodischer Refresh alle 30 Minuten
    const intervalId = window.setInterval(load, REFRESH_MS);

    // Realtime: sofortige Aktualisierung bei jeder Änderung an lager_devices
    // (debounced, um Burst-Events zu bündeln)
    let debounceId: number | undefined;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(load, 400);
    };
    const channel = supabase
      .channel('lager_devices_counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lager_devices' },
        scheduleReload,
      )
      .subscribe();

    // Bei Tab-Fokus: nur neu laden, wenn Daten älter als REFRESH_MS sind
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt > REFRESH_MS) {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Custom Event: Seiten können `window.dispatchEvent(new Event('lager-data-refresh'))`
    // auslösen, sobald sie eigene Daten neu laden – damit aktualisiert sich auch
    // sofort die Zählung im linken Menü.
    const onCustomRefresh = () => scheduleReload();
    window.addEventListener('lager-data-refresh', onCustomRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('lager-data-refresh', onCustomRefresh);
      supabase.removeChannel(channel);
    };
  }, []);

  // Bei jedem Routenwechsel: Menüzählungen neu anfordern
  useEffect(() => {
    window.dispatchEvent(new Event('lager-data-refresh'));
    window.dispatchEvent(new Event('route-plans-refresh'));
  }, [location.pathname]);

  // Anzahl bevorstehender Touren (planned_date >= heute)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from('route_plans')
        .select('*', { count: 'exact', head: true })
        .eq('planning_status', 'offen');
      if (cancelled) return;
      setLagerCounts((prev) => ({ ...prev, '/tourenplanung': count ?? 0 }));
    };
    load();
    const intervalId = window.setInterval(load, 5 * 60 * 1000);
    let debounceId: number | undefined;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(load, 400);
    };
    const channel = supabase
      .channel('route_plans_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_plans' }, scheduleReload)
      .subscribe();
    const onCustomRefresh = () => scheduleReload();
    window.addEventListener('route-plans-refresh', onCustomRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      window.removeEventListener('route-plans-refresh', onCustomRefresh);
      supabase.removeChannel(channel);
    };
  }, []);

  // Anzahl der Bestellungen (production_orders + Bestellung möglich) – Echtzeit
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const baseProdSel = atOnly
        ? supabase.from('production_orders').select('*, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', 'zoho_eu_2')
        : supabase.from('production_orders').select('*', { count: 'exact', head: true });
      const reklaProd = atOnly
        ? supabase.from('production_orders').select('*, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', 'zoho_eu_2').eq('is_reclamation', true)
        : supabase.from('production_orders').select('*', { count: 'exact', head: true }).eq('is_reclamation', true);
      const factoryProd = atOnly
        ? supabase.from('production_orders').select('*, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', 'zoho_eu_2').eq('is_reclamation', false)
        : supabase.from('production_orders').select('*', { count: 'exact', head: true }).eq('is_reclamation', false);
      const approvedProd = atOnly
        ? supabase.from('production_orders').select('*, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', 'zoho_eu_2').eq('approval_status', 'approved')
        : supabase.from('production_orders').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved');
      const freiOrdersQ = atOnly
        ? supabase.from('orders').select('id').eq('source_system', 'zoho_eu_2').eq('deposit_ok', true).not('deposit_ok_by', 'is', null).neq('deposit_ok_by', '').limit(2000)
        : supabase.from('orders').select('id').eq('deposit_ok', true).not('deposit_ok_by', 'is', null).neq('deposit_ok_by', '').limit(2000);
      const [allRes, reklaRes, factoryRes, freiOrdersRes, prodOrderIdsRes, reservedDevsRes, approvedRes] = await Promise.all([
        baseProdSel,
        reklaProd,
        factoryProd,
        freiOrdersQ,
        supabase.from('production_orders').select('order_id').limit(2000),
        supabase.from('lager_devices').select('reserved_order_id').not('reserved_order_id', 'is', null).limit(2000),
        approvedProd,
      ]);
      if (cancelled) return;
      const all = allRes.count ?? 0;
      const rekla = reklaRes.count ?? 0;
      const factory = factoryRes.count ?? 0;
      const usedOrderIds = new Set<string>([
        ...((prodOrderIdsRes.data ?? []).map((r: any) => r.order_id).filter(Boolean)),
        ...((reservedDevsRes.data ?? []).map((r: any) => r.reserved_order_id).filter(Boolean)),
      ]);
      const frei = (freiOrdersRes.data ?? []).filter((o: any) => !usedOrderIds.has(o.id)).length;
      const approved = approvedRes.count ?? 0;
      const fertig = 0;
      setLagerCounts((prev) => ({
        ...prev,
        '/einkauf': frei,
        '/order/timeline': all,
        '/order/reklamation': rekla,
        '/order': factory,
        '/order/frei-bestellung': frei,
        '/production/order-in': approved,
        '/production/fertig': fertig,
        '/production': approved + factory + fertig,
        '__production_liste': factory,
      }));
    };
    load();
    const intervalId = window.setInterval(load, 5 * 60 * 1000);
    let debounceId: number | undefined;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(load, 400);
    };
    const ch1 = supabase
      .channel('production_orders_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, scheduleReload)
      .subscribe();
    const ch2 = supabase
      .channel('orders_counts_einkauf')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleReload)
      .subscribe();
    const ch3 = supabase
      .channel('lager_devices_counts_einkauf')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lager_devices' }, scheduleReload)
      .subscribe();
    const onRefresh = () => scheduleReload();
    window.addEventListener('einkauf-counts-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      window.removeEventListener('einkauf-counts-refresh', onRefresh);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [atOnly]);

  useEffect(() => {
    window.dispatchEvent(new Event('einkauf-counts-refresh'));
  }, [location.pathname]);

  const labelWithCount = (path: string, label: string) => {
    const key = path === '/production' && label === 'Liste' ? '__production_liste' : path;
    const c = lagerCounts[key];
    if (c === undefined) return label;
    if (path === '/einkauf') {
      const factory = lagerCounts['/order'] ?? 0;
      const rekla = lagerCounts['/order/reklamation'] ?? 0;
      return (
        <>
          {label} <span className="text-red-500">({c})</span> <span className="text-blue-500">({factory})</span> <span className="text-red-500">({rekla})</span>
        </>
      );
    }
    const isProductionGroup = path === '/production' && label === 'PRODUCTION';
    const colorClass =
      c === 0
        ? 'text-red-500'
        : path === '/lager' || path === '/tourenplanung' || isProductionGroup
          ? 'text-green-500'
          : undefined;
    return (
      <>
        {label} <span className={colorClass}>({c})</span>
      </>
    );
  };

  // Body-Scroll sperren, wenn Drawer offen
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  const filterByRoles = (item: { roles: string[] | null }) => {
    if (!item.roles) return true;
    return item.roles.some(r => roles.includes(r));
  };

  const atHiddenPaths = new Set<string>([
    '/lager/equipment-area/unterwegs',
    '/lager/equipment-area/produktion',
    '/lager/equipment-area/warehouse',
    '/lager/equipment-area/hold',
  ]);

  const visibleItems = navItems
    .filter(filterByRoles)
    .map(item => ({
      ...item,
      children: item.children
        ?.filter(filterByRoles)
        .filter(c => !atOnly || !atHiddenPaths.has(c.path)),
    }))
    // Hide groups whose children are all hidden by role
    .filter(item => !item.children || item.children.length > 0);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/order') {
      return location.pathname === '/order'
        || (location.pathname.startsWith('/order/') && !location.pathname.startsWith('/order/reklamation') && !location.pathname.startsWith('/order/zulieferer') && !location.pathname.startsWith('/order/timeline'));
    }
    return location.pathname.startsWith(path);
  };

  const toggleGroup = (path: string) => setOpenGroups(s => ({ ...s, [path]: !s[path] }));

  return (
    <div className="h-screen-dvh flex bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menü schließen"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar */}
      <aside
        style={!collapsed ? { ['--sb-w' as any]: `${sidebarWidth}px` } : undefined}
        className={cn(
          "relative flex flex-col border-r border-border bg-sidebar transition-transform duration-200 flex-shrink-0",
          // Mobile: fixed Drawer, slide-in/out
          "fixed inset-y-0 left-0 z-50 w-[260px] pt-safe pb-safe pl-safe md:static md:translate-x-0 md:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop: collapsible Breite (eingeklappt fix, sonst per CSS-Var/Drag)
          collapsed ? "md:w-[60px]" : "md:w-[var(--sb-w)]"
        )}>

        {/* Brand */}
        <div className={cn(
          "flex items-center gap-2.5 border-b border-border h-16 flex-shrink-0",
          collapsed ? "md:px-2 md:justify-center px-4" : "px-4"
        )}>
          {collapsed && !mobileOpen ? (
            <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
          ) : (
            <img
              src={alixLogo}
              alt="Alix Lasers Logo"
              className="h-5 w-auto object-contain max-w-full"
            />
          )}
          {/* Close-Button auf Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>






        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto scroll-touch">
          {visibleItems.map(item => {
            const active = isActive(item.path);
            const hasChildren = item.children && item.children.length > 0;
            const childActive = hasChildren && item.children!.some(c => isActive(c.path));
            const isOpen = openGroups[item.path] ?? childActive;
            const isCollapsedView = collapsed && !mobileOpen;

            if (hasChildren) {
              const isNavigableParent = item.path === '/lager' || item.path === '/verkauf/artikel-uebersicht' || item.path === '/verkauf';
              const rowEl = (
                <div
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150",
                    isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-3" : "px-3.5 py-3 md:py-2.5",
                    childActive
                      ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                      : "text-sidebar-foreground hover:text-primary hover:bg-primary/15"
                  )}
                >
                  {isNavigableParent ? (
                    <Link
                      to={item.path}
                      title={isCollapsedView ? item.label : undefined}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      <item.icon className={cn("w-5 h-5 flex-shrink-0", childActive && "text-primary")} />
                      {!isCollapsedView && (
                        <span className="truncate flex-1 text-left">{item.path === '/tourenplanung' ? item.label : labelWithCount(item.path, item.label)}</span>
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.path)}
                      title={isCollapsedView ? item.label : undefined}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      <item.icon className={cn("w-5 h-5 flex-shrink-0", childActive && "text-primary")} />
                      {!isCollapsedView && (
                        <span className="truncate flex-1 text-left">{item.path === '/tourenplanung' ? item.label : labelWithCount(item.path, item.label)}</span>
                      )}
                    </button>
                  )}
                  {!isCollapsedView && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.path)}
                      aria-label="Untermenü umschalten"
                      className="p-1 -mr-1 rounded hover:bg-sidebar-accent/60"
                    >
                      <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  )}
                </div>
              );
              return (
                <div key={item.path}>
                  {item.path === '/lager' ? (
                    <HoverCard openDelay={150} closeDelay={100}>
                      <HoverCardTrigger asChild>{rowEl}</HoverCardTrigger>
                      <HoverCardContent side="right" align="center" sideOffset={24} collisionPadding={24} avoidCollisions className="w-96 z-[10000] shadow-2xl border-primary/30 bg-popover/95 backdrop-blur-md">
                        <div className="space-y-3">
                          <p className="text-sm font-medium leading-relaxed">
                            Danke, dass du heute die Kunden zufrieden stellst und deinen Chef auch. <span className="text-lg">😊</span>
                          </p>
                          {(() => {
                            const total = lagerCounts['/lager'] ?? 0;
                            const rows: Array<{ label: string; value: number; warn?: boolean; critical?: boolean }> = [
                              { label: 'Lagergeräte', value: lagerCounts['/lager/lagergeraete'] ?? 0, critical: (lagerCounts['/lager/lagergeraete'] ?? 0) < 3, warn: (lagerCounts['/lager/lagergeraete'] ?? 0) < 6 },
                              { label: 'Leihgeräte', value: lagerCounts['/lager/leihgeraete'] ?? 0, warn: (lagerCounts['/lager/leihgeraete'] ?? 0) < 3 },
                              { label: 'Unterwegs', value: lagerCounts['/lager/equipment-area/unterwegs'] ?? 0 },
                              { label: 'Produktion', value: lagerCounts['/lager/equipment-area/produktion'] ?? 0 },
                              { label: 'Hold', value: lagerCounts['/lager/equipment-area/hold'] ?? 0, warn: (lagerCounts['/lager/equipment-area/hold'] ?? 0) > 0 },
                            ];
                            return (
                              <div className="rounded-md border border-border bg-muted/40 p-2">
                                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                                  <span>Aktuelle Verfügbarkeit</span>
                                  <span className="text-muted-foreground">Gesamt: {total}</span>
                                </div>
                                <ul className="space-y-1">
                                  {rows.map(r => (
                                    <li key={r.label} className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">{r.label}</span>
                                      <span className={
                                        r.critical ? 'font-semibold text-destructive' :
                                        r.warn ? 'font-semibold text-yellow-500' :
                                        'font-medium text-foreground'
                                      }>
                                        {r.value}
                                        {r.critical ? ' ⚠️' : r.warn ? ' ⚡' : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {(lagerCounts['/lager/lagergeraete'] ?? 0) < 3 && (
                                  <p className="mt-2 text-[11px] text-destructive font-medium">
                                    ⚠️ Achtung: Lagerbestand kritisch niedrig!
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : rowEl}
                  {!isCollapsedView && isOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5">
                      {item.children!.map(child => {
                        const cActive = isActive(child.path);
                        const cHasChildren = child.children && child.children.length > 0;
                        const cGroupActive = cHasChildren && child.children!.some(g => isActive(g.path));
                        const cIsOpen = openGroups[child.path] ?? (cActive || cGroupActive);

                        if (cHasChildren) {
                          const isPool = child.path === '/lager/equipment-area';
                          return (
                            <div key={child.path}>
                              <button
                                type="button"
                                onClick={() => toggleGroup(child.path)}
                                className={cn(
                                  "w-full flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-3 md:py-2.5",
                                  (cActive || cGroupActive)
                                    ? (isPool
                                        ? "bg-foreground/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.25)]"
                                        : "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]")
                                    : (isPool
                                        ? "text-foreground hover:text-foreground hover:bg-foreground/5"
                                        : "text-sidebar-foreground hover:text-primary hover:bg-primary/15")
                                )}
                              >
                                <child.icon className={cn("w-5 h-5 flex-shrink-0", isPool ? "text-foreground" : ((cActive || cGroupActive) && "text-primary"))} />
                                <span className="truncate flex-1 text-left">{labelWithCount(child.path, child.label)}</span>
                                <ChevronDown className={cn("w-4 h-4 transition-transform", cIsOpen && "rotate-180")} />
                              </button>
                              {cIsOpen && (
                                <div className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5">
                                  {child.children!.map(grand => {
                                    const gActive = isActive(grand.path);
                                    const colorMap: Record<string, { active: string; inactive: string; icon: string }> = {
                                      '/lager/equipment-area/hold': {
                                        active: 'bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]',
                                        inactive: 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                                        icon: 'text-red-500',
                                      },
                                      '/lager/lagergeraete': {
                                        active: 'bg-green-500/15 text-green-500 shadow-[inset_0_0_0_1px_hsl(142_71%_45%/0.4)]',
                                        inactive: 'text-green-500 hover:text-green-500 hover:bg-green-500/10',
                                        icon: 'text-green-500',
                                      },
                                      '/lager/equipment-area/unterwegs': {
                                        active: 'bg-yellow-500/15 text-yellow-500 shadow-[inset_0_0_0_1px_hsl(48_96%_53%/0.4)]',
                                        inactive: 'text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10',
                                        icon: 'text-yellow-500',
                                      },
                                      '/lager/equipment-area/produktion': {
                                        active: 'bg-blue-500/15 text-blue-500 shadow-[inset_0_0_0_1px_hsl(217_91%_60%/0.4)]',
                                        inactive: 'text-blue-500 hover:text-blue-500 hover:bg-blue-500/10',
                                        icon: 'text-blue-500',
                                      },
                                    };
                                    const colored = colorMap[grand.path];
                                    return (
                                      <Link
                                        key={grand.path}
                                        to={grand.path}
                                        className={cn(
                                          "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-3 md:py-2.5",
                                          colored
                                            ? gActive ? colored.active : colored.inactive
                                            : gActive
                                              ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                                              : "text-sidebar-foreground hover:text-primary hover:bg-primary/15"
                                        )}
                                      >
                                        <grand.icon className={cn("w-5 h-5 flex-shrink-0", colored ? colored.icon : gActive && "text-primary")} />
                                        <span className="truncate">{labelWithCount(grand.path, grand.label)}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const lagerColorMap: Record<string, { active: string; inactive: string; icon: string }> = {
                          '/lager/leihgeraete': {
                            active: 'bg-white/15 text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.4)]',
                            inactive: 'text-white hover:text-white hover:bg-white/10',
                            icon: 'text-white',
                          },
                          '/lager/lagergeraete': {
                            active: 'bg-green-500/15 text-green-500 shadow-[inset_0_0_0_1px_hsl(142_71%_45%/0.4)]',
                            inactive: 'text-green-500 hover:text-green-500 hover:bg-green-500/10',
                            icon: 'text-green-500',
                          },
                          '/lager/equipment-area/unterwegs': {
                            active: 'bg-blue-500/15 text-blue-500 shadow-[inset_0_0_0_1px_hsl(217_91%_60%/0.4)]',
                            inactive: 'text-blue-500 hover:text-blue-500 hover:bg-blue-500/10',
                            icon: 'text-blue-500',
                          },
                          '/lager/equipment-area/produktion': {
                            active: 'bg-amber-800/20 text-amber-700 shadow-[inset_0_0_0_1px_hsl(28_45%_35%/0.5)]',
                            inactive: 'text-amber-700 hover:text-amber-600 hover:bg-amber-800/10',
                            icon: 'text-amber-700',
                          },
                          '/lager/equipment-area/warehouse': {
                            active: 'bg-yellow-500/15 text-yellow-500 shadow-[inset_0_0_0_1px_hsl(48_96%_53%/0.4)]',
                            inactive: 'text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10',
                            icon: 'text-yellow-500',
                          },
                          '/lager/equipment-area/hold': {
                            active: 'bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]',
                            inactive: 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                            icon: 'text-red-500',
                          },
                          '/order/frei-bestellung': {
                            active: 'bg-green-500/15 text-green-500 shadow-[inset_0_0_0_1px_hsl(142_71%_45%/0.4)]',
                            inactive: 'text-green-500 hover:text-green-500 hover:bg-green-500/10',
                            icon: 'text-green-500',
                          },
                          '/order/reklamation': {
                            active: 'bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]',
                            inactive: 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                            icon: 'text-red-500',
                          },
                          '/order': {
                            active: 'bg-blue-500/15 text-blue-500 shadow-[inset_0_0_0_1px_hsl(217_91%_60%/0.4)]',
                            inactive: 'text-blue-500 hover:text-blue-500 hover:bg-blue-500/10',
                            icon: 'text-blue-500',
                          },
                          '/geraetesperren': {
                            active: 'bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]',
                            inactive: 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                            icon: 'text-red-500',
                          },
                        };
                        const cColored = lagerColorMap[child.path];
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-3 md:py-2.5",
                              cColored
                                ? cActive ? cColored.active : cColored.inactive
                                : cActive
                                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                                  : "text-sidebar-foreground hover:text-primary hover:bg-primary/15"
                            )}
                          >
                            <child.icon className={cn("w-5 h-5 flex-shrink-0", cColored ? cColored.icon : (cActive && "text-primary"))} />
                            <span className="truncate">{labelWithCount(child.path, child.label)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isRed = item.path === '/geraetesperren';
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsedView ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150",
                  isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-3" : "px-3.5 py-3 md:py-2.5",
                  isRed
                    ? (active
                        ? "bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]"
                        : "text-red-500 hover:text-red-500 hover:bg-red-500/10")
                    : (active
                        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                        : "text-sidebar-foreground hover:text-primary hover:bg-primary/15")
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isRed ? "text-red-500" : (active && "text-primary"))} />
                {!isCollapsedView && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-2 flex-shrink-0">
          {(!collapsed || mobileOpen) && (
            <div className={cn("px-2 py-2 mb-1", collapsed && "md:hidden")}>
              <p className="text-[14.5px] font-medium text-foreground truncate">{profile?.full_name || 'Benutzer'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
            </div>
          )}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Menü erweitern" : "Menü einklappen"}
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start text-[14.5px] px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/bug-capa')}
              title="Bugs"
            >
              <Shield className="w-4 h-4" />
              <span className="ml-1.5">Bugs</span>
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start text-[14.5px] px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/hilfe')}
              title="Hilfe"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="ml-1.5">Hilfe</span>
            </Button>
            <Button
              variant="ghost"
              className="h-8 flex-1 justify-start text-[14.5px] px-2 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              title="Abmelden"
            >
              <LogOut className="w-4 h-4" />
              <span className="ml-1.5">Abmelden</span>
            </Button>
          </div>
        </div>
        {/* Resize-Handle (nur Desktop, wenn nicht eingeklappt) */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Sidebar-Breite anpassen"
            onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
            onDoubleClick={() => { setSidebarWidth(240); try { localStorage.setItem('sidebar_width', '240'); } catch {} }}
            title="Ziehen zum Anpassen · Doppelklick: zurücksetzen"
            className={cn(
              "hidden md:block absolute top-0 right-0 h-full w-1.5 -mr-[3px] cursor-col-resize z-50 group",
              resizing ? "bg-primary/40" : "hover:bg-primary/30"
            )}
          >
            <div className={cn(
              "absolute inset-y-0 right-0 w-px transition-colors",
              resizing ? "bg-primary" : "bg-transparent group-hover:bg-primary/60"
            )} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen-dvh">
        {/* Top Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 flex-shrink-0 pt-safe">
          <div className="flex items-center gap-1">
            {/* Mobile Burger */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Menü öffnen"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Desktop Collapse-Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Menü erweitern" : "Menü einklappen"}
              aria-label={collapsed ? "Menü erweitern" : "Menü einklappen"}
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <AuroraPrioTicker />
            <DesignVariantSwitcher inline />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-display font-bold gold-text">AlixWork</span>
              <span className="text-muted-foreground font-mono text-xs hidden sm:inline">v{APP_VERSION}</span>
          </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-touch pb-safe">
          <Outlet key={refreshKey} />
        </main>
      </div>
      <WelcomeDialog />
      <LeoWelcomeDialog />
    </div>
  );
}
