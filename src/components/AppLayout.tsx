import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  LayoutDashboard, ClipboardList, MapPin, Banknote, Users, LogOut, Shield, Menu, X, ChevronLeft, Building2, Cloud, Server, ListOrdered, Sun, Moon, Gavel, Truck, PackageCheck, BarChart3, Factory, ShoppingCart, ChevronDown, TrendingUp, Workflow, AlertTriangle, Calendar, FileText, Warehouse, Settings, Package, FilePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const APP_VERSION = '3.0';

type NavChild = { path: string; label: string; icon: typeof LayoutDashboard; roles: string[] | null };
type NavItem = NavChild & { children?: NavChild[] };

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance', 'Read Only Audit'] },
  {
    path: '/verkauf', label: 'VERKAUF', icon: TrendingUp, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'],
    children: [
      { path: '/kunden', label: 'Kunden', icon: Building2, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/auftraege', label: 'Aufträge', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/auftraege/in-klaerung', label: 'In Klärung', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/artikel', label: 'Artikel', icon: Package, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/verkauf/angebot/neu', label: 'Angebot erstellen', icon: FilePlus, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung'] },
    ],
  },
  {
    path: '/auftraege-gruppe', label: 'AUFTRÄGE', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'],
    children: [
      { path: '/prio-liste', label: 'Prio-Liste', icon: ListOrdered, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/anwaltsliste', label: 'Anwaltsliste', icon: Gavel, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/geliefert', label: 'Auftrag geliefert', icon: Truck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/teilgeliefert', label: 'Teilgeliefert', icon: PackageCheck, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
    ],
  },
  {
    path: '/einkauf', label: 'BESTELLUNGEN', icon: ShoppingCart, roles: ['Admin', 'Super Admin'],
    children: [
      { path: '/order/timeline', label: 'Timeline', icon: Calendar, roles: ['Admin', 'Super Admin'] },
      { path: '/order', label: 'Order', icon: Factory, roles: ['Admin', 'Super Admin'] },
      { path: '/order/reklamation', label: 'Reklamation', icon: AlertTriangle, roles: ['Admin', 'Super Admin'] },
    ],
  },
  { path: '/production', label: 'PRODUCTION', icon: Factory, roles: ['Admin', 'Super Admin', 'Lieferant'] },
  {
    path: '/lager', label: 'LAGER', icon: Warehouse, roles: ['Admin', 'Super Admin'],
    children: [
      { path: '/lager/lagergeraete', label: 'Lagergeräte', icon: Warehouse, roles: ['Admin', 'Super Admin'] },
      { path: '/lager/leihgeraete', label: 'Leihgeräte', icon: PackageCheck, roles: ['Admin', 'Super Admin'] },
    ],
  },
  {
    path: '/workflow', label: 'WORKFLOW', icon: Workflow, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Read Only Audit'],
    children: [
      { path: '/geraetetypen', label: 'Gerätetypen', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
      { path: '/import', label: 'Import', icon: Cloud, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Read Only Audit'] },
      { path: '/system', label: 'Monitoring', icon: Server, roles: ['Admin', 'Super Admin', 'Read Only Audit'] },
    ],
  },
  {
    path: '/tourenplanung', label: 'Tourenplanung', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'],
    children: [
      { path: '/tourenplanung', label: 'Übersicht', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'] },
      { path: '/tourenplanung/einstellungen', label: 'Einstellungen', icon: Settings, roles: ['Admin', 'Super Admin', 'Tourenplanung'] },
    ],
  },
  {
    path: '/finance', label: 'BUCHHALTUNG', icon: Banknote, roles: ['Admin', 'Super Admin', 'Finance'],
    children: [
      { path: '/finance/ratenzahler', label: 'Ratenzahler', icon: Banknote, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/rechnungen', label: 'Rechnungen', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/offene-posten', label: 'Offene Posten', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
      { path: '/finance/unpaid-zoho', label: 'Unbezahlte Rechnungen (Zoho)', icon: FileText, roles: ['Admin', 'Super Admin', 'Finance'] },
    ],
  },
  { path: '/benutzer', label: 'Benutzer', icon: Users, roles: ['Admin', 'Super Admin'] },
];

export default function AppLayout() {
  const { profile, roles, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  // Desktop: eingeklappt? (schmale Icon-Leiste)
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: Drawer offen?
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Drawer schließen, wenn die Route wechselt
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const visibleItems = navItems.filter(filterByRoles).map(item => ({
    ...item,
    children: item.children?.filter(filterByRoles),
  }));

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
      <aside className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-transform duration-200 flex-shrink-0",
        // Mobile: fixed Drawer, slide-in/out
        "fixed inset-y-0 left-0 z-50 w-[260px] pt-safe pb-safe pl-safe md:static md:translate-x-0 md:z-auto",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        // Desktop: collapsible width
        collapsed ? "md:w-[60px]" : "md:w-60"
      )}>
        {/* Brand */}
        <div className={cn(
          "flex items-center gap-2.5 border-b border-border h-14 flex-shrink-0",
          collapsed ? "md:px-2 md:justify-center px-4" : "px-4"
        )}>
          <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className={cn("font-display font-bold text-base gold-text truncate", collapsed && "md:hidden")}>
              Alix Work
            </span>
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
              return (
                <div key={item.path}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.path)}
                    title={isCollapsedView ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                      isCollapsedView ? "md:px-0 md:py-2 md:justify-center px-3 py-2.5" : "px-3 py-2.5 md:py-2",
                      childActive
                        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", childActive && "text-primary")} />
                    {!isCollapsedView && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                      </>
                    )}
                  </button>
                  {!isCollapsedView && isOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5">
                      {item.children!.map(child => {
                        const cActive = isActive(child.path);
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 px-3 py-2.5 md:py-2",
                              cActive
                                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                                : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            <child.icon className={cn("w-[18px] h-[18px] flex-shrink-0", cActive && "text-primary")} />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsedView ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                  isCollapsedView ? "md:px-0 md:py-2 md:justify-center px-3 py-2.5" : "px-3 py-2.5 md:py-2",
                  active
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", active && "text-primary")} />
                {!isCollapsedView && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-2 flex-shrink-0">
          {(!collapsed || mobileOpen) && (
            <div className={cn("px-2 py-2 mb-1", collapsed && "md:hidden")}>
              <p className="text-[13px] font-medium text-foreground truncate">{profile?.full_name || 'Benutzer'}</p>
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
              className="h-8 flex-1 justify-start text-[13px] px-2 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              title="Abmelden"
            >
              <LogOut className="w-4 h-4" />
              <span className="ml-1.5">Abmelden</span>
            </Button>
          </div>
        </div>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
