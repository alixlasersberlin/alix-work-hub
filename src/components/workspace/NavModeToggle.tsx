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
        'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
        workspaceMode
          ? 'text-primary border-primary/40 bg-primary/5'
          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent',
      )}
    >
      <Layers className="w-5 h-5" />
    </button>

  );
}
