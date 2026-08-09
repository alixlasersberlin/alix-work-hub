import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

export default function NavModeToggle() {
  const { workspaces, workspaceMode, setWorkspaceMode, loading } = useWorkspace();

  if (loading || workspaces.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setWorkspaceMode(!workspaceMode)}
      title={workspaceMode ? 'Zur klassischen Navigation wechseln' : 'Nur Workspace-Navigation anzeigen'}
      aria-label={workspaceMode ? 'Zur klassischen Navigation wechseln' : 'Nur Workspace-Navigation anzeigen'}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap border transition-colors',
        workspaceMode
          ? 'text-primary border-primary/50 bg-primary/10'
          : 'text-muted-foreground border-border hover:text-foreground hover:bg-accent',
      )}
    >
      <Layers className="w-4 h-4" />
      <span className="hidden lg:inline">{workspaceMode ? 'Workspace' : 'Klassisch'}</span>
    </button>


  );
}
