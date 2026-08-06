import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { iconFor } from '@/lib/workspace/icons';
import { Layers } from 'lucide-react';
import { SidebarInfoBar } from '@/components/SidebarInfoBar';

export default function WorkspaceBar() {
  const { workspaces, current, setCurrent, workspaceMode, setWorkspaceMode, loading } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || workspaces.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1 px-2 md:px-4 py-1.5 overflow-x-auto scroll-touch">



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

        <button
          type="button"
          onClick={() => setWorkspaceMode(!workspaceMode)}
          title={workspaceMode ? 'Zur klassischen Navigation wechseln' : 'Nur Workspace-Navigation anzeigen'}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] whitespace-nowrap border transition-colors',
            workspaceMode
              ? 'text-primary border-primary/40 bg-primary/5'
              : 'text-muted-foreground border-border hover:text-foreground',
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          {workspaceMode ? 'Workspace-Navigation' : 'Klassische Navigation'}
        </button>
      </div>
    </div>
  );
}
