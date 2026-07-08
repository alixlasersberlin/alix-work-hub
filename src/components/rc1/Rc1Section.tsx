import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function Rc1Header({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Rc1Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Card className="p-5 bg-card/60 backdrop-blur-xl border-border/60">
      {title && <div className="text-sm font-medium mb-3">{title}</div>}
      {children}
    </Card>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2"><span className="text-amber-400">•</span><span>{t}</span></li>
      ))}
    </ul>
  );
}
