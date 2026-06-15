import { cn } from "@/lib/utils";

type Variant = "text" | "title" | "avatar" | "card" | "row" | "block";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  gold?: boolean;
  width?: string | number;
  height?: string | number;
}

export const Skeleton = ({
  variant = "block",
  gold,
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) => {
  const cls = variant === "block" ? "" : `iskel--${variant}`;
  return (
    <div
      className={cn("iskel", cls, gold && "iskel--gold", className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
};

/** Pre-composed list skeleton (rows) */
export const SkeletonList = ({ rows = 6, gold = false }: { rows?: number; gold?: boolean }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} variant="row" gold={gold} />
    ))}
  </div>
);

/** Pre-composed KPI card grid skeleton */
export const SkeletonKpiGrid = ({ count = 4, gold = false }: { count?: number; gold?: boolean }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="card" gold={gold} />
    ))}
  </div>
);

/** Pre-composed table skeleton */
export const SkeletonTable = ({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) => (
  <div className="space-y-2">
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} variant="title" gold />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} variant="text" />
        ))}
      </div>
    ))}
  </div>
);

/** Pre-composed detail/form skeleton (header + grid of fields) */
export const SkeletonForm = ({ fields = 8, cols = 2 }: { fields?: number; cols?: number }) => (
  <div className="p-4 sm:p-6 space-y-6">
    <div className="space-y-3">
      <Skeleton variant="title" gold style={{ width: '40%' }} />
      <Skeleton variant="text" style={{ width: '60%' }} />
    </div>
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" style={{ width: '30%' }} />
          <Skeleton variant="card" style={{ height: 44 }} />
        </div>
      ))}
    </div>
  </div>
);
