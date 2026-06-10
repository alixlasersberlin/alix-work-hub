import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS, type PageSize, pageSizeLabel } from '@/lib/finance/list-filter';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  pageSize: PageSize;
  onPageSizeChange: (v: PageSize) => void;
  total: number;
  visible: number;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Standard Finance overview toolbar:
 * - global search across Rechnungsnr, Auftragsnr, Name, Stadt, PLZ, Betrag
 * - page size selector (20/50/100/Alle)
 */
export function ListToolbar({
  search,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  total,
  visible,
  placeholder = 'Suche: Rechnungsnr., Auftragsnr., Name, Stadt, PLZ, Betrag…',
  className,
  children,
}: Props) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 mb-4 ${className ?? ''}`}>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
        {children}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(v === 'all' ? 'all' : (Number(v) as PageSize))}
          >
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((p) => (
                <SelectItem key={String(p)} value={String(p)}>{pageSizeLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {total} Treffer{search ? ` für "${search}"` : ''} • angezeigt: {visible}
      </div>
    </div>
  );
}
