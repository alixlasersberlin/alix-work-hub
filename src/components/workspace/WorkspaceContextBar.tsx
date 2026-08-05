import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Clock, Home, Star } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRecentPages } from '@/hooks/useRecentPages';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';

function prettify(seg: string) {
  const s = decodeURIComponent(seg).replace(/[-_]/g, ' ');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg)) return 'Detail';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkspaceContextBar() {
  const { pathname } = useLocation();
  const { current: tenant } = useTenant();
  const { current: workspace, navItems } = useWorkspace();
  const { recents, track } = useRecentPages();
  const { favorites } = useFavorites();

  const segments = useMemo(() => pathname.split('/').filter(Boolean), [pathname]);

  const label = useMemo(() => {
    const hit = navItems.find(n => n.path === pathname);
    if (hit) return hit.label;
    return segments.length ? prettify(segments[segments.length - 1]) : 'Start';
  }, [navItems, pathname, segments]);

  useEffect(() => {
    track(pathname, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, label]);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: i === segments.length - 1 ? label : prettify(seg),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  const otherRecents = recents.filter(r => r.path !== pathname).slice(0, 4);

  return (
    <div className="flex-shrink-0 border-b border-border bg-background/60">
      <div className="flex items-center gap-2 px-2 md:px-4 py-1 overflow-x-auto scroll-touch text-[12px]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
          <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center">
            <Home className="w-3.5 h-3.5" />
          </Link>
          {tenant && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-muted-foreground whitespace-nowrap">{tenant.name}</span>
            </>
          )}
          {workspace && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              <Link
                to={workspace.dashboard_path || `/w/${workspace.code}`}
                className="text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                {workspace.name}
              </Link>
            </>
          )}
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              {i === crumbs.length - 1 ? (
                <span className="font-medium text-foreground truncate max-w-[220px]">{c.label}</span>
              ) : (
                <Link to={c.path} className="text-muted-foreground hover:text-foreground whitespace-nowrap">
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {(otherRecents.length > 0 || favorites.length > 0) && (
          <div className="ml-auto flex items-center gap-1">
            {favorites.slice(0, 3).map(f => (
              <Link
                key={f.path}
                to={f.path}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent whitespace-nowrap"
              >
                <Star className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{f.label}</span>
              </Link>
            ))}
            {otherRecents.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 text-muted-foreground/70">
                <Clock className="w-3 h-3" />
              </span>
            )}
            {otherRecents.map(r => (
              <Link
                key={r.path}
                to={r.path}
                className={cn(
                  'hidden md:inline-block rounded px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent whitespace-nowrap max-w-[140px] truncate',
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
