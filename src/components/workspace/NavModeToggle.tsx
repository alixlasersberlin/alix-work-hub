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
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] whitespace-nowrap border transition-colors',
        workspaceMode
          ? 'text-primary border-primary/40 bg-primary/5'
          : 'text-muted-foreground border-border hover:text-foreground',
      )}
    >
      <Layers className="w-3.5 h-3.5" />
      <span className="hidden md:inline">
        {workspaceMode ? 'Workspace-Navigation' : 'Klassische Navigation'}
      </span>
    </button>
  );
}
