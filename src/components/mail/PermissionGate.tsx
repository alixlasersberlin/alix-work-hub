import { ReactNode } from 'react';
import { useMailPermissions, type MailArea, type MailAction } from '@/hooks/useMailPermissions';
import { Lock } from 'lucide-react';

interface Props {
  area: MailArea;
  action: MailAction;
  /** 'hide' = nicht rendern, 'disable' = ausgegraut + Hinweis */
  mode?: 'hide' | 'disable' | 'message';
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ area, action, mode = 'hide', children, fallback }: Props) {
  const { can } = useMailPermissions();
  if (can(area, action)) return <>{children}</>;
  if (mode === 'hide') return fallback ? <>{fallback}</> : null;
  if (mode === 'message') {
    return (
      <div className="flex items-center gap-2 p-3 rounded border border-border bg-muted/40 text-sm text-muted-foreground">
        <Lock className="w-4 h-4" /> Keine Berechtigung
      </div>
    );
  }
  // disable: dim + block pointer
  return (
    <div className="opacity-50 pointer-events-none select-none" title="Keine Berechtigung">
      {children}
    </div>
  );
}
