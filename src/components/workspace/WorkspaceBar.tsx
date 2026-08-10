import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { iconFor } from '@/lib/workspace/icons';
import { Search, Home } from 'lucide-react';

export default function WorkspaceBar() {
  const { workspaces, current, setCurrent, setWorkspaceMode, loading } = useWorkspace();

  const navigate = useNavigate();
  const location = useLocation();

  if (loading || workspaces.length === 0) return null;

  const quickCls = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors border',
      active
        ? 'bg-primary/10 text-primary border-primary/40'
        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent',
    );

  return (
    <div className="flex-shrink-0 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1 px-2 md:px-4 py-1.5 overflow-x-auto scroll-touch">

        <button
          type="button"
          onClick={() => navigate('/')}
          className={quickCls(location.pathname === '/')}
        >
          <Home className="w-4 h-4" />
          <span>Startseite</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/detailsuche')}
          className={quickCls(location.pathname === '/detailsuche')}
        >
          <Search className="w-4 h-4" />
          <span>Detailsuche</span>
        </button>

        <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />

        {workspaces.map((w) => {

          const Icon = iconFor(w.icon);
          const active = current?.id === w.id;
          const onDash = location.pathname === (w.dashboard_path || `/w/${w.code}`);
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setCurrent(w);
                setWorkspaceMode(true);
                if (!onDash) navigate(w.dashboard_path || `/w/${w.code}`);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors border',
                active
                  ? 'bg-primary/10 text-primary border-primary/40'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent',
              )}
            >
              <span aria-hidden>{w.emoji || <Icon className="w-4 h-4" />}</span>
              <span>{w.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
