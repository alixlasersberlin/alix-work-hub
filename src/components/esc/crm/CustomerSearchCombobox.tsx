import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { useCrmSearch } from '@/hooks/esc/useCrmSearch';
import type { CrmSearchHit } from '@/lib/esc/crm/types';

interface Props {
  onSelect: (hit: CrmSearchHit) => void;
  placeholder?: string;
}

export function CustomerSearchCombobox({ onSelect, placeholder }: Props) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const { hits, loading } = useCrmSearch(term);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Kunde, Firma, Telefon, Seriennummer oder Angebot suchen…'}
        />
        {loading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && term.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-80 overflow-auto">
          {hits.length === 0 && !loading && (
            <div className="p-3 text-xs text-muted-foreground">Keine Treffer</div>
          )}
          {hits.map((h) => (
            <button
              key={`${h.customerId}-${h.matchField}`}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
              onClick={() => { onSelect(h); setTerm(h.companyName); setOpen(false); }}
            >
              <div className="text-sm font-medium truncate">{h.companyName}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {h.customerNumber ? `#${h.customerNumber} · ` : ''}{h.matched}
                <span className="ml-2 uppercase tracking-wide">[{h.matchField}]</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
