import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondary?: { label: string; onClick: () => void };
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Phase I-16: Premium empty state. Glass card with gold halo icon.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondary,
  children,
  className,
  compact,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "relative mx-auto text-center rounded-2xl border border-amber-500/15",
        "bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent",
        "backdrop-blur-sm",
        compact ? "p-6 max-w-md" : "p-10 max-w-xl",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto mb-4 grid place-items-center rounded-2xl",
          "bg-gradient-to-br from-amber-400/20 to-amber-600/10",
          "border border-amber-500/25",
          "shadow-[0_0_40px_rgba(245,158,11,0.15)]",
          compact ? "h-12 w-12" : "h-16 w-16"
        )}
      >
        <Icon className={cn("text-amber-300", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>

      <h3 className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      )}

      {children && <div className="mt-4">{children}</div>}

      {(action || secondary) && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {action && (
            <Button
              onClick={action.onClick}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold border-0 shadow-lg shadow-amber-500/20"
            >
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondary && (
            <Button variant="ghost" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
