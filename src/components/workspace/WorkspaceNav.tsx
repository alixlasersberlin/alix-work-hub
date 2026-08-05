import { Link, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { iconFor } from '@/lib/workspace/icons';
import { cn } from '@/lib/utils';

export default function WorkspaceNav({ collapsed }: { collapsed?: boolean }) {
  const { current, navItems } = useWorkspace();
  const location = useLocation();

  if (!current) return null;

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {current.emoji} {current.name}
        </div>
      )}
      {navItems.map((item) => {
        const Icon = iconFor(item.icon);
        const active = isActive(item.path);
        return (
          <Link
            key={item.id}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg transition-all duration-150 text-[14px]',
              collapsed ? 'md:px-0 md:py-2.5 md:justify-center px-3.5 py-2.5' : 'px-3.5 py-2.5',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-primary')} />
            {!collapsed && <span className="truncate flex-1">{item.label}</span>}
          </Link>
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
