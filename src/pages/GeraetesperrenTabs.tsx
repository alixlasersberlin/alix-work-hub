import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { path: '/geraetesperren', label: 'Übersicht' },
  { path: '/geraetesperren/bearbeitung', label: 'Bearbeitung' },
];

export function GeraetesperrenTabs() {
  const { pathname } = useLocation();
  return (
    <div className="flex items-center gap-2">
      {TABS.map((t) => {
        const active = pathname === t.path;
        return (
          <Link
            key={t.path}
            to={t.path}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors border',
              active
                ? 'bg-red-600 text-white border-red-600'
                : 'border-red-500/30 text-red-500 hover:bg-red-500/10',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
