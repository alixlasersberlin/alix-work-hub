import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, Inbox, Phone, CalendarClock, FileText, Package, MessageCircle, LogOut, ShieldCheck, UserCircle, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TenantSwitcher from '@/components/TenantSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { clearPendingWelcome } from '@/lib/postLogin';
import { clearSalesReturn } from '@/lib/sales/portal-navigation';
import logo from '@/assets/alix-lasers-logo-gold-new.png.asset.json';
import SalesPortalPwa from './SalesPortalPwa';

const items = [
  ['Meine Leads', '', Users], ['Neue Anfragen', '?ansicht=neu', Inbox],
  ['Offene Kontaktversuche', '?ansicht=kontakt', Phone], ['Wiedervorlagen', '?ansicht=wiedervorlagen', CalendarClock],
  ['Angebote', '/angebote', FileText], ['Aufträge', '/auftraege', Package], ['WhatsApp Sales', '?ansicht=whatsapp', MessageCircle],
] as const;

export default function SalesPortalLayout() {
  const { profile, isAdmin, signOut, roles } = useAuth();
  const superAdmin = (roles || []).includes('Super Admin');
  const location = useLocation(); const navigate = useNavigate();
  useEffect(() => { clearSalesReturn(); clearPendingWelcome(); }, []);
  useEffect(() => {
    const oldTitle = document.title; document.title = 'ALIX LASERS – Meine Leads';
    return () => { document.title = oldTitle; };
  }, []);
  return <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
    <SalesPortalPwa />
    <header className="shrink-0 border-b border-border bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
      <Link to="/meine-leads" aria-label="ALIX LASERS – Meine Leads" className="flex items-center gap-3"><img src={logo.url} alt="ALIX LASERS" className="w-32 sm:w-40 h-10 object-contain" /><span className="hidden sm:block text-xs border-l border-border pl-3 text-muted-foreground">Sales</span></Link>
      <div className="flex items-center gap-2 sm:gap-4"><TenantSwitcher />{superAdmin && <Button asChild variant="outline" size="sm"><Link to="/" title="Zu AlixWork wechseln"><LayoutDashboard className="w-4 h-4 mr-1.5" />AlixWork</Link></Button>}<span className="hidden md:flex items-center gap-2 text-sm"><UserCircle className="w-4 h-4" />{profile?.full_name || 'Mein Profil'}</span><Button variant="ghost" size="icon" aria-label="Abmelden" title="Abmelden" onClick={async () => { await signOut(); clearSalesReturn(); navigate('/meine-leads', { replace: true }); }}><LogOut className="w-4 h-4" /></Button></div>
    </header>
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <nav aria-label="Sales-Portal" className="shrink-0 lg:w-56 border-b lg:border-b-0 lg:border-r border-border bg-card flex lg:flex-col gap-1 p-2 lg:p-4 overflow-x-auto lg:overflow-y-auto">
        {items.map(([label, suffix, Icon]) => { const to = `/meine-leads${suffix}`; const active = `${location.pathname}${location.search}` === to; return <Button asChild key={label} variant={active ? 'secondary' : 'ghost'} className="justify-start shrink-0 lg:w-full gap-2 text-sm"><Link to={to} aria-current={active ? 'page' : undefined}><Icon className="w-4 h-4 shrink-0" />{label}</Link></Button>; })}
        {isAdmin && <><div className="hidden lg:block border-t border-border my-3" /><Button asChild variant="ghost" className="justify-start shrink-0 gap-2"><Link to="/meine-leads?ansicht=gesamt"><ShieldCheck className="w-4 h-4" />Gesamtübersicht</Link></Button><Button asChild variant="ghost" className="justify-start shrink-0 gap-2"><Link to="/meine-leads/whatsapp-eingang"><Inbox className="w-4 h-4" />WhatsApp-Eingang</Link></Button></>}
      </nav>
      <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain"><div className="max-w-screen-2xl mx-auto"><Outlet /></div></div>
    </div>
  </div>;
}