import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useWorkspace, type WorkspaceNavEntry } from '@/contexts/WorkspaceContext';
import { iconFor } from '@/lib/workspace/icons';
import { cn } from '@/lib/utils';

const OPEN_KEY = 'alixwork.workspaceNavOpenSections';

export default function WorkspaceNav({ collapsed }: { collapsed?: boolean }) {
  const { current, navItems } = useWorkspace();
  const location = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch { return {}; }
  });

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  const groups = useMemo(() => {
    const map = new Map<string, WorkspaceNavEntry[]>();
    for (const item of navItems) {
      const key = item.section || 'Allgemein';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [navItems]);

  // Sektion mit aktiver Route automatisch öffnen
  useEffect(() => {
    const hit = groups.find(([, items]) => items.some(i => isActive(i.path)));
    if (hit && !open[hit[0]]) {
      setOpen(prev => {
        const next = { ...prev, [hit[0]]: true };
        try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, groups.length]);

  const toggle = (section: string) => {
    setOpen(prev => {
      const next = { ...prev, [section]: !prev[section] };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  if (!current) return null;

  const renderLink = (item: WorkspaceNavEntry, indent: boolean) => {
    const Icon = item.IconComp || iconFor(item.icon);
    const active = isActive(item.path);
    return (
      <Link
        key={item.id}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-lg transition-all duration-150 text-[14px]',
          collapsed ? 'md:px-0 md:py-2.5 md:justify-center px-3.5 py-2.5' : 'py-2',
          !collapsed && (indent ? 'pl-8 pr-3.5' : 'px-3.5'),
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        )}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-primary')} />
        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {current.emoji} {current.name}
        </div>
      )}

      {groups.map(([section, items]) => {
        // Eingeklappte Sidebar: nur Icons, keine Sektionen
        if (collapsed) return <div key={section}>{items.map(i => renderLink(i, false))}</div>;

        // Erste Sektion (Übersicht) immer offen darstellen
        const alwaysOpen = section === 'Übersicht' || section === 'Allgemein';
        const isOpen = alwaysOpen || !!open[section];

        return (
          <div key={section} className="pt-1">
            {!alwaysOpen && (
              <button
                type="button"
                onClick={() => toggle(section)}
                className="w-full flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-90')} />
                <span className="truncate">{section}</span>
                <span className="ml-auto text-[10px] opacity-60">{items.length}</span>
              </button>
            )}
            {isOpen && <div className="space-y-0.5">{items.map(i => renderLink(i, !alwaysOpen))}</div>}
          </div>
        );
      })}

      {navItems.length === 0 && !collapsed && (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          Für diesen Workspace sind keine Menüpunkte freigegeben.
        </div>
      )}
    </div>
  );
}
