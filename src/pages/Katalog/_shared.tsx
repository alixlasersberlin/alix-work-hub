import { Outlet, NavLink } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/katalog', label: 'Übersicht', end: true },
  { to: '/katalog/artikel', label: 'Artikel' },
  { to: '/katalog/kategorien', label: 'Kategorien' },
  { to: '/katalog/laender', label: 'Länder & Währungen' },
  { to: '/katalog/niederlassungen', label: 'Niederlassungen' },
  { to: '/katalog/preisregeln', label: 'Preisregeln' },
  { to: '/katalog/import', label: 'Import' },
  { to: '/katalog/export', label: 'Export' },
  { to: '/katalog/versand', label: 'Freigabelinks' },
  { to: '/katalog/protokolle', label: 'Änderungsprotokoll' },
];

export function KatalogLayout() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Katalogverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Zentrales Master-Katalogmodul für alle verkaufsfähigen Artikel, Länderpreise und Sprachen.
          </p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                'px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary bg-muted/40'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

export default KatalogLayout;
