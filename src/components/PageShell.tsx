import { cn } from '@/lib/utils';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

interface PageHeaderProps {
  icon?: React.ReactNode | React.ElementType;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

function renderIcon(icon: React.ReactNode | React.ElementType | undefined, cls: string): React.ReactNode {
  if (!icon) return null;
  if (typeof icon === 'function') {
    const IconComp = icon as React.ElementType;
    return <IconComp className={cls} />;
  }
  // forwardRef/memo components: { $$typeof, render } — NOT React elements (those also have .props)
  if (typeof icon === 'object' && icon !== null) {
    const a = icon as any;
    const isReactElement = a.$$typeof && 'props' in a && 'type' in a;
    if (!isReactElement && (typeof a.render === 'function' || typeof a.type === 'function' || a.$$typeof)) {
      const IconComp = icon as React.ElementType;
      return <IconComp className={cls} />;
    }
  }
  return icon as React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2.5">
          {renderIcon(icon, 'w-6 h-6 text-primary')}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Daten werden geladen…</p>
      </div>
    </div>
  );
}

export function PageEmpty({ icon: Icon, message }: { icon?: React.ElementType; message: string }) {
  const IconComponent = Icon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <IconComponent className="w-6 h-6 opacity-50" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3 mb-6">
      <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-destructive font-medium hover:underline flex-shrink-0">
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

export function DataCard({ children, className, title, icon, actions }: { children: React.ReactNode; className?: string; title?: string; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card card-glow', className)}>
      {title && <DataCardHeader title={title} icon={icon} actions={actions} />}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function DataCardHeader({ icon, title, actions }: { icon?: React.ReactNode; title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display font-semibold text-foreground text-sm">{title}</h2>
      </div>
      {actions}
    </div>
  );
}
