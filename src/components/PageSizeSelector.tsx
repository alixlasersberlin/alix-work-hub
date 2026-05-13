import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';

export type PageSize = 10 | 20 | 50 | 100 | 200 | 'all';

export function PageSizeSelector({
  value,
  onChange,
  className = '',
}: {
  value: PageSize;
  onChange: (v: PageSize) => void;
  className?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(v === 'all' ? 'all' : (Number(v) as 10 | 20 | 50 | 100 | 200))}>
      <SelectTrigger className={`w-32 bg-secondary border-border ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 / Seite</SelectItem>
        <SelectItem value="20">20 / Seite</SelectItem>
        <SelectItem value="50">50 / Seite</SelectItem>
        <SelectItem value="100">100 / Seite</SelectItem>
        <SelectItem value="200">200 / Seite</SelectItem>
        <SelectItem value="all">Alle</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function usePagination<T>(items: T[], initialSize: PageSize = 20) {
  const [pageSize, setPageSize] = useState<PageSize>(initialSize);
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    if (pageSize === 'all') return items;
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);
  return { pageSize, setPageSize, page: safePage, setPage, totalPages, paged, total };
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  total,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  total: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">Seite {page} von {totalPages} · {total} Ergebnisse</p>
      <div className="flex items-center gap-1">
        <button
          className="h-7 px-2 text-xs rounded border border-border bg-secondary disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >Zurück</button>
        <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
        <button
          className="h-7 px-2 text-xs rounded border border-border bg-secondary disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >Weiter</button>
      </div>
    </div>
  );
}
