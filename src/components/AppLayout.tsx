import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, ClipboardList, MapPin, Banknote, Users, LogOut, Shield, Menu, X, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { path: '/auftraege', label: 'Auftragsverwaltung', icon: ClipboardList, roles: ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'] },
  { path: '/tourenplanung', label: 'Tourenplanung', icon: MapPin, roles: ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'] },
  { path: '/finance', label: 'Finance', icon: Banknote, roles: ['Admin', 'Super Admin', 'Finance'] },
  { path: '/benutzer', label: 'Benutzerverwaltung', icon: Users, roles: ['Admin', 'Super Admin'] },
];

export default function AppLayout() {
  const { profile, roles, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.some(r => roles.includes(r));
  });

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-display font-bold text-lg gold-text">Alix Work</span>}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          {!collapsed && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'Benutzer'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Abmelden</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
