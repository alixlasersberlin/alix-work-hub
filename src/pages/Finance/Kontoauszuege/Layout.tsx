import { NavLink, Outlet } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { AccountingRegionSwitcher } from '@/components/AccountingRegionSwitcher';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/finance/kontoauszuege/import', label: 'Kontoauszüge importieren' },
  { to: '/finance/kontoauszuege/buchungen', label: 'Importierte Buchungen' },
  { to: '/finance/kontoauszuege/offen', label: 'Offene Zuordnungen' },
  { to: '/finance/kontoauszuege/verbucht', label: 'Bereits verbuchte Zahlungen' },
  { to: '/finance/kontoauszuege/ruecklastschriften', label: 'Rücklastschriften' },
  { to: '/finance/kontoauszuege/quote', label: 'Rücklastschriftquote' },
  { to: '/finance/kontoauszuege/historie', label: 'Importhistorie' },
  { to: '/finance/kontoauszuege/konten', label: 'Bankkonten' },
  { to: '/finance/kontoauszuege/regeln', label: 'Importregeln' },
  { to: '/finance/kontoauszuege/datev', label: 'DATEV-Export' },
  { to: '/finance/kontoauszuege/bank-api', label: 'Bank-API / EBICS' },
];

export default function KontoauszuegeLayout() {
  const { region } = useAccountingRegion();
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Bank &amp; Kontoauszüge</h1>
          <span className="text-xs text-muted-foreground">Buchhaltung {region}</span>
        </div>
        <AccountingRegionSwitcher />
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}>{t.label}</NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
