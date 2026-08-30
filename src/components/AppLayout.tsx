import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAtOnly } from '@/hooks/useAtOnly';

import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, LayoutGrid, ClipboardList, MapPin, Banknote, Users, LogOut, Shield, ShieldCheck, Menu, X, ChevronLeft, Building2, Cloud, Server, ListOrdered, Sun, Moon, Gavel, Truck, PackageCheck, BarChart3, Factory, ShoppingCart, ChevronDown, TrendingUp, Workflow, AlertTriangle, Calendar, CalendarDays, FileText, FileSignature, Warehouse, Settings, Package, FilePlus, BookOpen, Receipt, Undo2, CreditCard, CheckCircle2, FolderTree, ScrollText, Inbox, Mail, Landmark, SearchCheck, Pause, Clock, HelpCircle, Star, Lock, Globe, Wrench, Ticket, User, Flame,
  PenSquare, Send, FileEdit, MessageSquare, MessageCircle, Sparkles, FileCheck2, Files, Phone, PhoneCall, CheckSquare, CalendarClock, Megaphone, Activity, MailX, MailCheck, HeartPulse, TestTube2, Rocket, Database, Upload, FileUp, FileDown, BadgeCheck, GraduationCap, Brain, AlertOctagon, LineChart, ListChecks, Cog, Boxes, Repeat, Wallet, Hash, ClipboardCheck, Gift, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SecurityStatusLamp } from '@/components/SecurityStatusLamp';
import { isPhone } from '@/lib/mobil/utils';
import WelcomeDialog from '@/components/WelcomeDialog';
import LeoWelcomeDialog from '@/components/LeoWelcomeDialog';
import NataliaWelcomeOverlay from '@/components/NataliaWelcomeOverlay';
import NewsAnnouncementDialog from '@/components/NewsAnnouncementDialog';
import SalesLeadAssignmentOverlay from '@/components/SalesLeadAssignmentOverlay';
import { SidebarInfoBar } from '@/components/SidebarInfoBar';
import TenantSwitcher from '@/components/TenantSwitcher';
import GlobalSearch from '@/components/GlobalSearch';
import WorkspaceBar from '@/components/workspace/WorkspaceBar';
import WorkspaceContextBar from '@/components/workspace/WorkspaceContextBar';
import WorkspaceNav from '@/components/workspace/WorkspaceNav';
import MenuScaleControl from '@/components/MenuScaleControl';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { PanelLeftClose, PanelLeftOpen, PackageSearch, Cpu, ListTree, Layers, GitBranch } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AccountingRegionSwitcher } from '@/components/AccountingRegionSwitcher';
import { RegionChip } from '@/components/finance/RegionChip';

import { TicketNotificationBell } from '@/components/tickets/TicketNotificationBell';
import NavModeToggle from '@/components/workspace/NavModeToggle';

import AuroraPrioTicker from '@/components/AuroraPrioTicker';
import AuroraTopNav from '@/components/AuroraTopNav';
import CommandPalette from '@/components/CommandPalette';
import CallScreenPop from '@/components/telephony/CallScreenPop';
import { useDesignVariant } from '@/hooks/useDesignVariant';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useFavorites, type FavoriteEntry } from '@/hooks/useFavorites';
import { NotificationCenter } from '@/components/infinity/NotificationCenter';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { Briefcase, Bell, BellRing, Package as PackageIcon, Eye, Home, UserCheck, Radio, ShieldAlert, Trophy, Plus, Image as ImageIcon, Target, Globe2, Zap, Quote } from 'lucide-react';
import alixLogo from '@/assets/alix-logo-gold.png';
import appVersion from '@/version.json';



// Wird bei jedem Production-Build (Publish) automatisch um 0.01 erhöht
// (siehe vite.config.ts -> autoBumpVersion Plugin).
declare const __APP_VERSION__: string;
const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : appVersion.version;

import { navItems, type NavChild, type NavItem } from '@/lib/nav/navItems';
export { navItems };
export type { NavChild, NavItem };

function filterKontaktByRoles(items: NavChild[] | undefined, roles: string[]): NavChild[] {
  if (!items) return [];
  const allowed = (r: string[] | null) => !r || r.some(x => roles.includes(x));
  return items
    .filter(it => allowed(it.roles))
    .map(it => ({ ...it, children: it.children ? filterKontaktByRoles(it.children, roles) : undefined }))
    .filter(it => !it.children || it.children.length > 0 || !!it.path);
}

function HeaderNavMenu({ roles, itemLabel, triggerLabel, triggerClassName, align = 'end' }: { roles: string[]; itemLabel: string; triggerLabel: string; triggerClassName?: string; align?: 'start' | 'end' }) {
  const item = navItems.find(i => i.label === itemLabel);
  if (!item) return null;
  if (item.roles && !item.roles.some(r => roles.includes(r))) return null;
  const children = filterKontaktByRoles(item.children, roles);
  if (children.length === 0 && !item.path) return null;

  const renderItems = (items: NavChild[]): React.ReactNode =>
    items.map((it, idx) => {
      const Icon = it.icon;
      if (it.children && it.children.length > 0) {
        return (
          <DropdownMenuSub key={`${it.path}-${idx}`}>
            <DropdownMenuSubTrigger className="gap-2">
              <Icon className="w-4 h-4" />
              <span>{it.label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="max-h-[70vh] overflow-y-auto">
                {renderItems(it.children)}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }
      return (
        <DropdownMenuItem key={`${it.path}-${idx}`} asChild>
          <Link to={it.path} className="flex items-center gap-2 cursor-pointer">
            <Icon className="w-4 h-4" />
            <span>{it.label}</span>
          </Link>
        </DropdownMenuItem>
      );
    });

  const RootIcon = item.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName ?? "hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"}
          aria-label={`${triggerLabel}-Menü`}
        >
          <RootIcon className="w-4 h-4" />
          <span className="font-medium">{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64 max-h-[75vh] overflow-y-auto">
        <DropdownMenuLabel>{triggerLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderItems(children)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function KontaktMenu({ roles }: { roles: string[] }) {
  return <HeaderNavMenu roles={roles} itemLabel="KONTAKT" triggerLabel="Alix iCom" />;
}

function ConnectMenu({ roles }: { roles: string[] }) {
  return <HeaderNavMenu roles={roles} itemLabel="ALIX CONNECT" triggerLabel="Connect" />;
}

function AiDiensteMenu({ roles }: { roles: string[] }) {
  return <HeaderNavMenu roles={roles} itemLabel="ALIX AI DIENSTE" triggerLabel="Alix AI" />;
}

function GeraetesperrenMenu(_props: { roles: string[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          aria-label="Sperren-Menü"
        >
          <Lock className="w-4 h-4" />
          <span>Sperren</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-destructive font-bold">Sperren</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/geraetesperren" className="flex items-center gap-2 cursor-pointer">
            <Lock className="w-4 h-4" /> <span>Übersicht</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/geraetesperren/bearbeitung" className="flex items-center gap-2 cursor-pointer">
            <Lock className="w-4 h-4" /> <span>Bearbeitung</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}




export default function AppLayout() {
  const { profile, roles, signOut, impersonatedUserId, impersonatedName, stopImpersonation } = useAuth();
  const { variant } = useDesignVariant();
  const isAurora = variant === 'aurora';
  const location = useLocation();
  const navigate = useNavigate();
  const isOrdersRoute = location.pathname.startsWith('/auftraege');
  // Desktop: eingeklappt? (schmale Icon-Leiste) – pro Benutzer gespeichert
  const {
    menuScale,
    sidebarCollapsed,
    sidebarAutoCollapse,
    setSidebarCollapsed,
    setSidebarAutoCollapse,
  } = useUiPrefs();
  const [hoverExpand, setHoverExpand] = useState(false);
  const collapsed = sidebarAutoCollapse ? !hoverExpand : sidebarCollapsed;
  const setCollapsed = (v: boolean) => {
    if (sidebarAutoCollapse) setSidebarAutoCollapse(false);
    setSidebarCollapsed(v);
  };
  // Mobile: Drawer offen?
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ '__favorites': true });
  const [lagerCounts, setLagerCounts] = useState<Record<string, number>>({});
  const atOnly = useAtOnly();

  const { favorites, isFavorite, toggle: toggleFavorite } = useFavorites();
  useNotificationFeed();
  // Desktop: flexible Sidebar-Breite (px), per Drag anpassbar, in localStorage gespeichert
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 480;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const v = Number(localStorage.getItem('sidebar_width'));
    return v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : 240;
  });
  const [resizing, setResizing] = useState(false);
  

  // Per-User Menü-Freigaben (überschreibt Rollenlogik, wenn gesetzt)
  const [menuGrants, setMenuGrants] = useState<Set<string> | null>(null);
  useEffect(() => {
    const uid = impersonatedUserId ?? profile?.id;
    if (!uid) { setMenuGrants(null); return; }
    (async () => {
      const { data } = await supabase.from('user_menu_grants' as any).select('path').eq('user_id', uid);
      if (!data || data.length === 0) { setMenuGrants(null); return; }
      setMenuGrants(new Set((data as any[]).map(r => r.path)));
    })();
  }, [profile?.id, impersonatedUserId]);

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
  }, [location.pathname, isOrdersRoute]);

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
      // Zähler werden serverseitig aggregiert (statt alle Geräte zu laden)
      const { data, error } = await supabase.rpc('sidebar_lager_counts' as any);
      if (cancelled || error || !data) return;
      lastLoadedAt = Date.now();
      const c = data as Record<string, number>;
      const n = (k: string) => Number(c?.[k] ?? 0);
      const leih = n('leih'), lager = n('lager'), transfer = n('transfer');
      const produktion = n('produktion'), hold = n('hold');
      const warehouse = n('warehouse'), ausgeliefert = n('ausgeliefert');
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


    // Initiales Laden verschieben, damit der erste Render der Auftragsliste nicht blockiert wird.
    const ric: any = (window as any).requestIdleCallback ?? ((cb: any) => window.setTimeout(cb, 200));
    const cic: any = (window as any).cancelIdleCallback ?? ((id: any) => window.clearTimeout(id));
    const initialId = isOrdersRoute
      ? window.setTimeout(() => { if (!cancelled) load(); }, 5000)
      : ric(() => { if (!cancelled) load(); });

    // Periodischer Refresh
    const intervalId = window.setInterval(load, REFRESH_MS);

    let debounceId: number | undefined;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(load, 400);
    };

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
    // (Realtime-Subscription auf `lager_devices` wurde entfernt — bei vielen
    //  parallelen Änderungen erzeugte sie zu viele Reloads und bremste die UI.)
    const onCustomRefresh = () => scheduleReload();
    window.addEventListener('lager-data-refresh', onCustomRefresh);

    return () => {
      cancelled = true;
      if (isOrdersRoute) window.clearTimeout(initialId);
      else cic(initialId);
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('lager-data-refresh', onCustomRefresh);
    };
  }, [isOrdersRoute]);

  // Bei jedem Routenwechsel: Menüzählungen neu anfordern
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('lager-data-refresh'));
      window.dispatchEvent(new Event('route-plans-refresh'));
    }, isOrdersRoute ? 5000 : 1500);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  // Menü-Zähler Verkauf/Touren – 1 RPC statt 3 Einzelabfragen
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await (supabase as any).rpc('sidebar_sales_counts');
      if (cancelled || error || !data) return;
      const c = data as any;
      setLagerCounts((prev) => ({
        ...prev,
        '/tourenplanung': Number(c.routes_open ?? 0),
        '/verkauf/anfragen': Number(c.leads_open ?? 0),
        '/verkauf/angebote': Number(c.offers_open ?? 0),
      }));
    };
    const id = window.setTimeout(load, isOrdersRoute ? 5000 : 1500);
    const intervalId = window.setInterval(load, 15 * 60 * 1000);
    let debounceId: number | undefined;
    let lastRun = 0;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        if (Date.now() - lastRun < 60 * 1000) return;
        lastRun = Date.now();
        void load();
      }, 3000);
    };
    const channel = supabase
      .channel('sidebar_sales_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_plans' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, scheduleReload)
      .subscribe();
    const onCustomRefresh = () => scheduleReload();
    window.addEventListener('route-plans-refresh', onCustomRefresh);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      window.removeEventListener('route-plans-refresh', onCustomRefresh);
      supabase.removeChannel(channel);
    };
  }, [isOrdersRoute]);



  // Anzahl der Bestellungen (production_orders + Bestellung möglich) – gedrosselt: 1 RPC statt 9 Queries
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Kein Polling, wenn der Tab im Hintergrund ist
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.rpc('sidebar_production_counts', { p_at_only: atOnly });
      if (cancelled || error || !data) return;
      const c = data as any;
      const all = Number(c.all ?? 0);
      const rekla = Number(c.rekla ?? 0);
      const factory = Number(c.factory ?? 0);
      const frei = Number(c.frei ?? 0);
      const approved = Number(c.approved ?? 0);
      const pending = Number(c.pending ?? 0);
      const fertig = Number(c.fertig ?? 0);
      setLagerCounts((prev) => ({
        ...prev,
        '/einkauf': frei,
        '/order/timeline': all,
        '/order/reklamation': rekla,
        '/order': factory,
        '/order/frei-bestellung': frei,
        '/order/freigabe': pending,
        '/production/order-in': approved,
        '/production/fertig': fertig,
        '/production': approved + factory + fertig,
        '__production_liste': factory,
      }));
    };
    // Initiales Laden verschieben (nicht beim ersten Render der Auftragsliste).
    const ric: any = (window as any).requestIdleCallback ?? ((cb: any) => window.setTimeout(cb, 300));
    const cic: any = (window as any).cancelIdleCallback ?? ((id: any) => window.clearTimeout(id));
    const initialId = isOrdersRoute
      ? window.setTimeout(() => { if (!cancelled) load(); }, 5000)
      : ric(() => { if (!cancelled) load(); });
    const intervalId = window.setInterval(load, 60 * 1000);
    let debounceId: number | undefined;
    const scheduleReload = () => {
      if (debounceId) window.clearTimeout(debounceId);
      // Echtzeit: nur kurzes Debounce, um Bursts zu bündeln
      debounceId = window.setTimeout(() => { void load(); }, 500);
    };

    const onRefresh = () => scheduleReload();
    window.addEventListener('einkauf-counts-refresh', onRefresh);

    // Realtime: Menü-Zähler live aktualisieren bei Änderungen an production_orders,
    // orders (source_system für AT-Filter) und lager_devices.
    const chProd = supabase
      .channel('menu_counts_production_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, scheduleReload)
      .subscribe();
    const chOrders = supabase
      .channel('menu_counts_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleReload)
      .subscribe();
    const chLager = supabase
      .channel('menu_counts_lager_devices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lager_devices' }, scheduleReload)
      .subscribe();
    const chNotes = supabase
      .channel('menu_counts_order_notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_notes' }, scheduleReload)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleReload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (isOrdersRoute) window.clearTimeout(initialId);
      else cic(initialId);
      window.clearInterval(intervalId);
      if (debounceId) window.clearTimeout(debounceId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('einkauf-counts-refresh', onRefresh);
      supabase.removeChannel(chProd);
      supabase.removeChannel(chOrders);
      supabase.removeChannel(chLager);
      supabase.removeChannel(chNotes);
    };


  }, [atOnly, isOrdersRoute]);

  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event('einkauf-counts-refresh')), isOrdersRoute ? 5000 : 1500);
    return () => window.clearTimeout(id);
  }, [location.pathname, isOrdersRoute]);

  const labelWithCount = (path: string, label: string) => {
    if (path === '/verkauf') {
      const anfragen = lagerCounts['/verkauf/anfragen'];
      if (anfragen === undefined) return label;
      return (
        <>
          {label}{' '}
          <span className={(anfragen ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'} title="Offene Anfragen">
            ({anfragen ?? 0})
          </span>
        </>
      );

    }
    if (path === '/verkauf/angebote') return label;
    if (path === '/verkauf/anfragen') {
      const c = lagerCounts['/verkauf/anfragen'] ?? 0;
      return (
        <>
          {label}{' '}
          <span className={c > 0 ? 'text-amber-500' : 'text-muted-foreground'} title="Offene Anfragen">
            ({c})
          </span>
        </>
      );
    }
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
      path === '/verkauf/anfragen' || path === '/verkauf/angebote'
        ? (c > 0 ? 'text-amber-500' : 'text-muted-foreground')
        : path === '/order/freigabe'
          ? (c > 0 ? 'text-yellow-500' : 'text-muted-foreground')
          : c === 0
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

  const filterByRoles = (item: { path: string; roles: string[] | null }) => {
    if (!item.roles) return true;
    return item.roles.some(r => roles.includes(r));
  };

  const atHiddenPaths = new Set<string>([
    '/lager/equipment-area/unterwegs',
    '/lager/equipment-area/produktion',
    '/lager/equipment-area/warehouse',
    '/lager/equipment-area/hold',
  ]);

  const filterByGrant = (item: { path: string; children?: any[] }) => {
    if (!menuGrants) return true;
    // Container/Gruppen (# oder mit children) immer durchlassen — werden später via children ausgefiltert
    if (item.path.startsWith('#') || (item.children && item.children.length > 0)) return true;
    return menuGrants.has(item.path);
  };

  const { workspaceMode: wsMode } = useWorkspace();

  const visibleItems = navItems
    .filter(i => i.label !== 'KONTAKT' && i.label !== 'ALIX AI DIENSTE' && i.label !== 'ALIX CONNECT')
    .filter(filterByRoles)

    .map(item => ({
      ...item,
      children: item.children
        ?.filter(filterByRoles)
        .filter(c => !atOnly || !atHiddenPaths.has(c.path))
        .map(c => ({
          ...c,
          children: c.children?.filter(filterByRoles).filter(filterByGrant),
        }))
        .filter(filterByGrant)
        .filter(c => !c.children || c.children.length > 0),
    }))
    // Hide groups whose children are all hidden by role
    .filter(item => !item.children || item.children.length > 0);


  // Sammle alle erlaubten Leaf-Pfade (für "Mein Arbeitsplatz")
  const allowedLeafMap = useMemo(() => {
    const map = new Map<string, { label: string; icon: typeof LayoutDashboard }>();
    const walk = (items: NavChild[]) => {
      for (const it of items) {
        if (it.children && it.children.length > 0) walk(it.children);
        else map.set(it.path, { label: it.label, icon: it.icon });
      }
    };
    walk(visibleItems as any);
    // Auch Top-Level Leafs (ohne children) sind bereits in walk enthalten.
    return map;
  }, [visibleItems]);

  // Menü offen halten: alle Gruppen, die den aktiven Pfad enthalten, bleiben aufgeklappt
  useEffect(() => {
    const path = location.pathname;
    const matches = (p: string) => p !== '/' && !p.startsWith('#') && path.startsWith(p);
    const toOpen: string[] = [];
    const walk = (items: any[]) => {
      for (const it of items) {
        if (it.children && it.children.length > 0) {
          const anyActive = it.children.some((c: any) =>
            matches(c.path) || (c.children ?? []).some((g: any) => matches(g.path)),
          );
          if (anyActive) toOpen.push(it.path);
          walk(it.children);
        }
      }
    };
    walk(visibleItems as any[]);
    if (toOpen.length === 0) return;
    setOpenGroups(s => {
      const next = { ...s };
      let changed = false;
      for (const p of toOpen) {
        if (next[p] !== true) { next[p] = true; changed = true; }
      }
      return changed ? next : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);


  const visibleFavorites = useMemo(
    () => favorites.filter(f => allowedLeafMap.has(f.path)),
    [favorites, allowedLeafMap],
  );

  const FavStar = ({ path, label }: { path: string; label: string }) => {
    const fav = isFavorite(path);
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite({ path, label }); }}
        title={fav ? 'Aus „Mein Arbeitsplatz" entfernen' : 'Zu „Mein Arbeitsplatz" hinzufügen'}
        aria-label={fav ? 'Favorit entfernen' : 'Als Favorit markieren'}
        className={cn(
          "shrink-0 p-1 rounded hover:bg-primary/20 transition-opacity",
          fav ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-70 text-muted-foreground hover:text-primary"
        )}
      >
        <Star className={cn("w-3.5 h-3.5", fav && "fill-primary")} />
      </button>
    );
  };

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
    <div className="h-screen-dvh flex flex-col bg-background overflow-hidden">
      {impersonatedUserId && (
        <div className="flex-shrink-0 bg-amber-500 text-black text-sm px-4 py-2 flex items-center gap-3 justify-center border-b border-amber-600">
          <Eye className="w-4 h-4" />
          <span><strong>Simulation aktiv</strong> — Ansicht als: {impersonatedName ?? impersonatedUserId}</span>
          <button
            type="button"
            onClick={stopImpersonation}
            className="ml-2 px-2 py-0.5 rounded bg-black/80 text-white text-xs hover:bg-black"
          >
            Simulation beenden
          </button>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
      {/* Globale Cmd+K Suche (per Tastatur erreichbar) */}
      <CommandPalette />
      <CallScreenPop />
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
        onMouseEnter={sidebarAutoCollapse ? () => setHoverExpand(true) : undefined}
        onMouseLeave={sidebarAutoCollapse ? () => setHoverExpand(false) : undefined}
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
          {/* Notifications + Close-Button (Mobile) */}
          <div className="ml-auto flex items-center gap-1">
            {(!collapsed || mobileOpen) && <NotificationCenter />}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Menü schließen"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>






        {/* Navigation */}
        <nav
          style={menuScale !== 1 ? ({ zoom: menuScale } as any) : undefined}
          className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto scroll-touch"
        >
          {wsMode && <WorkspaceNav collapsed={collapsed && !mobileOpen} />}
          <div className={cn("space-y-0.5", wsMode && "hidden")}>
          {/* ALIX Copilot – öffnet das Copilot-Panel */}
          {(() => {
            const isCollapsedView = collapsed && !mobileOpen;
            return (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('alix-copilot:open'))}
                title={isCollapsedView ? 'ALIX Copilot' : undefined}
                className={cn(
                  "mb-2 w-full flex items-center gap-2.5 rounded-lg border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-transparent text-amber-200 hover:border-amber-400/60 hover:from-amber-500/20 transition-all duration-150",
                  isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-2.5" : "px-3 py-2.5"
                )}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-300" />
                {!isCollapsedView && (
                  <>
                    <span className="text-[13px] font-medium truncate flex-1 text-left sig-mark">ALIX Copilot</span>
                    <kbd className="text-[10px] text-amber-200/70 border border-amber-400/30 rounded px-1.5 py-0.5">⌘J</kbd>
                  </>
                )}
              </button>
            );
          })()}
          {/* Mein Arbeitsplatz – persönliche Favoriten */}
          {(() => {
            const isCollapsedView = collapsed && !mobileOpen;
            const favOpen = openGroups['__favorites'] ?? true;
            return (
              <div className="mb-2">
                <div
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 bg-primary/5 text-primary",
                    isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-3" : "px-3.5 py-3 md:py-2.5"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup('__favorites')}
                    title={isCollapsedView ? 'Mein Arbeitsplatz' : undefined}
                    className="flex items-center gap-2.5 flex-1 min-w-0"
                  >
                    <Briefcase className="w-5 h-5 flex-shrink-0 text-primary" />
                    {!isCollapsedView && (
                      <span className="truncate flex-1 text-left">
                        MEIN ARBEITSPLATZ <span className="text-muted-foreground">({visibleFavorites.length})</span>
                      </span>
                    )}
                  </button>
                  {!isCollapsedView && (
                    <ChevronDown className={cn("w-4 h-4 transition-transform", favOpen && "rotate-180")} />
                  )}
                </div>
                {!isCollapsedView && favOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-primary/30 space-y-0.5">
                    {visibleFavorites.length === 0 ? (
                      <p className="px-3.5 py-2 text-[12px] text-muted-foreground italic">
                        Markiere Menüpunkte mit dem Stern, um sie hier abzulegen.
                      </p>
                    ) : visibleFavorites.map(f => {
                      const meta = allowedLeafMap.get(f.path)!;
                      const Icon = meta.icon;
                      const fActive = isActive(f.path);
                      return (
                        <div key={f.path} className="group flex items-center gap-1">
                          <Link
                            to={f.path}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-2.5 flex-1 min-w-0",
                              fActive
                                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                                : "text-sidebar-foreground hover:text-primary hover:bg-primary/15"
                            )}
                          >
                            <Icon className={cn("w-5 h-5 flex-shrink-0", fActive && "text-primary")} />
                            <span className="truncate">{labelWithCount(f.path, meta.label)}</span>
                          </Link>
                          <FavStar path={f.path} label={meta.label} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {visibleItems.map(item => {
            const active = isActive(item.path);
            const hasChildren = item.children && item.children.length > 0;
            const childActive = hasChildren && item.children!.some(c => isActive(c.path));
            const isOpen = openGroups[item.path] ?? childActive;
            const isCollapsedView = collapsed && !mobileOpen;

            if (hasChildren) {
              const isNavigableParent = item.path === '/lager' || item.path === '/verkauf/artikel-uebersicht' || item.path === '/verkauf' || item.path === '/geraetesperren';
              const isRedGroup = item.path === '/geraetesperren';
              const rowEl = (
                <div
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150",
                    isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-3" : "px-3.5 py-3 md:py-2.5",
                    isRedGroup
                      ? (childActive || active
                          ? "font-bold bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]"
                          : "font-bold text-red-500 hover:text-red-500 hover:bg-red-500/10")
                      : childActive
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
                <div key={`${item.path}-${item.label}`}>
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
                                      <div key={grand.path} className="group flex items-center gap-1">
                                        <Link
                                          to={grand.path}
                                          className={cn(
                                            "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-3 md:py-2.5 flex-1 min-w-0",
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
                                        <FavStar path={grand.path} label={grand.label} />
                                      </div>
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
                          '/geraetesperren/bearbeitung': {
                            active: 'bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]',
                            inactive: 'text-red-500 hover:text-red-500 hover:bg-red-500/10',
                            icon: 'text-red-500',
                          },
                        };
                        const cColored = lagerColorMap[child.path];
                        return (
                          <div key={child.path} className="group flex items-center gap-1">
                            <Link
                              to={child.path}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 px-3.5 py-3 md:py-2.5 flex-1 min-w-0",
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
                            <FavStar path={child.path} label={child.label} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isRed = item.path === '/geraetesperren';
            return (
              <div key={`${item.path}-${item.label}`} className="group flex items-center gap-1">
                <Link
                  to={item.path}
                  title={isCollapsedView ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg text-[14.5px] font-medium transition-all duration-150 flex-1 min-w-0",
                    isCollapsedView ? "md:px-0 md:py-2.5 md:justify-center px-3.5 py-3" : "px-3.5 py-3 md:py-2.5",
                    isRed
                      ? (active
                          ? "font-bold bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.4)]"
                          : "font-bold text-red-500 hover:text-red-500 hover:bg-red-500/10")
                      : (active
                          ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                          : "text-sidebar-foreground hover:text-primary hover:bg-primary/15")
                  )}
                >
                  <item.icon className={cn("w-5 h-5 flex-shrink-0", isRed ? "text-red-500" : (active && "text-primary"))} />
                  {!isCollapsedView && <span className="truncate">{item.label}</span>}
                </Link>
                {!isCollapsedView && <FavStar path={item.path} label={item.label} />}
              </div>
            );
          })}
          </div>
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-2 flex-shrink-0">
          {(!collapsed || mobileOpen) && (
            <div className={cn("px-2 py-2 mb-1 flex items-center justify-between gap-2 flex-wrap", collapsed && "md:hidden")}>
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium text-foreground truncate">{profile?.full_name || 'Benutzer'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
              </div>
              <SidebarInfoBar inline />
            </div>


          )}

          <div className="flex flex-wrap gap-1 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex flex-shrink-0"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Menü erweitern" : "Menü einklappen"}
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 hidden md:inline-flex flex-shrink-0",
                sidebarAutoCollapse ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                const next = !sidebarAutoCollapse;
                setSidebarAutoCollapse(next);
                setHoverExpand(false);
                if (!next) setSidebarCollapsed(false);
              }}
              title={sidebarAutoCollapse
                ? "Auto-Einklappen aus (Menü bleibt offen)"
                : "Auto-Einklappen an (öffnet bei Mauskontakt)"}
              aria-label="Automatisches Ein- und Ausklappen umschalten"
              aria-pressed={sidebarAutoCollapse}
            >
              {sidebarAutoCollapse ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => navigate('/bug-capa')}
              title="Bugs"
              aria-label="Bugs"
            >
              <Shield className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => navigate('/sicherheit')}
              title="Sicherheit"
              aria-label="Sicherheit"
            >
              <ShieldCheck className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => navigate('/hilfe')}
              title="Hilfe"
              aria-label="Hilfe"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
            <MenuScaleControl compact={collapsed} />
            <div className="flex items-center gap-1 text-[11px] flex-shrink-0 px-1">
              {!collapsed && <span className="font-display font-bold gold-text">AlixWork</span>}
              <span className="text-muted-foreground font-mono">v{APP_VERSION}</span>
            </div>




            <Button
              variant="ghost"
              className="h-8 ml-auto justify-start text-[13px] px-2 text-muted-foreground hover:text-destructive flex-shrink-0"
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

          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <AuroraPrioTicker />
            {location.pathname.startsWith('/finance') && <RegionChip className="hidden lg:inline-flex" />}
            {(location.pathname.startsWith('/finance') ||
              location.pathname.startsWith('/buchhaltung') ||
              location.pathname.startsWith('/w/buchhaltung')) && (
              <AccountingRegionSwitcher className="hidden md:flex" />
            )}

            



            <Link
              to="/tickets"
              title="Ticketliste"
              aria-label="Ticketliste"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Ticket className="w-5 h-5" />
            </Link>
            <Link
              to="/mailcenter/telefonnotizen"
              title="Telefonnotizen"
              aria-label="Telefonnotizen"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Phone className="w-5 h-5" />
            </Link>
            <Link
              to="/mailcenter/intern"
              title="Interne Nachrichten"
              aria-label="Interne Nachrichten"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>
            <Link
              to="/mailcenter/dokumente"
              title="Dokumente"
              aria-label="Dokumente"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Files className="w-5 h-5" />
            </Link>
            <TicketNotificationBell />
            <NavModeToggle />


            <GlobalSearch />

            <KontaktMenu roles={roles} />
            <ConnectMenu roles={roles} />
            <AiDiensteMenu roles={roles} />

            <TenantSwitcher />
            <SecurityStatusLamp />





          </div>

        </header>
        <WorkspaceBar />
        <WorkspaceContextBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-touch pb-safe">
          <Outlet key={refreshKey} />
        </main>
      </div>
      {!isPhone() && (
        <>
          <WelcomeDialog />
          <NewsAnnouncementDialog />
          <SalesLeadAssignmentOverlay />
        </>
      )}
      {/* Begrüßungs-Overlays für Natalia & Lars deaktiviert */}


      </div>
    </div>
  );
}
