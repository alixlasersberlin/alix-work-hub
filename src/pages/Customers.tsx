import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2, ArrowUpDown, Loader2, Inbox, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import CustomerEditDialog from '@/components/CustomerEditDialog';
import CustomerDeleteDialog from '@/components/CustomerDeleteDialog';
import { VipBadge } from '@/components/VipBadge';
import { isCustomerVip, vipFirst } from '@/lib/vip';
import { SourceBadge, sourceLabel, sourceFlag } from '@/lib/source-system';
import { useAtOnly } from '@/hooks/useAtOnly';

type SortField = 'company_name' | 'contact_name' | 'created_at';
type SortDir = 'asc' | 'desc';

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAGE_SIZES = [20, 50, 100, 0] as const; // 0 = alle

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const atOnly = useAtOnly();
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    const CHUNK = 1000;
    let from = 0;
    const all: any[] = [];
    for (;;) {
      let qb = supabase
        .from('customers')
        .select('*')
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(from, from + CHUNK - 1);
      if (atOnly) qb = qb.eq('source_system', 'zoho_eu_2');
      const { data, error: err } = await qb;
      if (err) { setError(err.message); break; }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < CHUNK) break;
      from += CHUNK;
    }
    setCustomers(all);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [sortField, sortDir, atOnly]);

  const sources = [...new Set(customers.map(c => c.source_system).filter(Boolean))];

  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        c.company_name?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q);
      const matchSource = sourceFilter === 'all' || c.source_system === sourceFilter;

      let matchLetter = true;
      if (letterFilter) {
        const name = (c.company_name || c.contact_name || '').trim();
        if (letterFilter === '#') {
          matchLetter = !name || !/^[a-zA-Z]/.test(name);
        } else {
          matchLetter = name.toUpperCase().startsWith(letterFilter);
        }
      }

      return matchSearch && matchSource && matchLetter;
    });
  }, [customers, search, sourceFilter, letterFilter]);

  // Available letters for highlighting
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => {
      const name = (c.company_name || c.contact_name || '').trim();
      if (!name || !/^[a-zA-Z]/.test(name)) {
        set.add('#');
      } else {
        set.add(name[0].toUpperCase());
      }
    });
    return set;
  }, [customers]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, sourceFilter, letterFilter, pageSize]);

  const totalFiltered = filtered.length;
  const sortedFiltered = vipFirst(filtered, isCustomerVip);
  const paginated = pageSize === 0 ? sortedFiltered : sortedFiltered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalFiltered / pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </span>
    </th>
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          Kunden
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{totalFiltered} Kunden</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Firma, Kontakt, E-Mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48 bg-secondary border-border">
            <SelectValue placeholder="Quelle filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            {sources.map(s => (
              <SelectItem key={s} value={s}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>{sourceFlag(s)}</span>
                  {sourceLabel(s)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
          <SelectTrigger className="w-36 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map(s => (
              <SelectItem key={s} value={String(s)}>{s === 0 ? 'Alle' : `${s} pro Seite`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alphabet bar */}
      <div className="flex flex-wrap gap-1 mb-4">
        <Button
          variant={letterFilter === null ? 'default' : 'ghost'}
          size="sm"
          className={cn("h-7 w-7 p-0 text-xs font-medium", letterFilter === null && "gold-gradient text-primary-foreground")}
          onClick={() => setLetterFilter(null)}
        >
          Alle
        </Button>
        {ALPHABET.map(letter => {
          const hasEntries = availableLetters.has(letter);
          return (
            <Button
              key={letter}
              variant={letterFilter === letter ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "h-7 w-7 p-0 text-xs font-medium",
                letterFilter === letter && "gold-gradient text-primary-foreground",
                !hasEntries && "text-muted-foreground/30 cursor-default"
              )}
              onClick={() => hasEntries && setLetterFilter(letter === letterFilter ? null : letter)}
              disabled={!hasEntries}
            >
              {letter}
            </Button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <SortHeader field="company_name" label="Firma" />
                <SortHeader field="contact_name" label="Kontakt" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-Mail</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Quelle</th>
                <SortHeader field="created_at" label="Erstellt" />
                {isAdmin && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Kunden gefunden.</p>
                </td></tr>
              ) : (
                paginated.map(c => (
                  <tr
                    key={c.id}
                    className={`hover:bg-secondary/30 transition-colors cursor-pointer ${isCustomerVip(c) ? 'bg-gradient-to-r from-amber-500/[0.08] to-transparent' : ''}`}
                    onClick={() => navigate(`/kunden/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        {isCustomerVip(c) && <VipBadge size="sm" iconOnly />}
                        {c.company_name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                    <td className="px-4 py-3"><SourceBadge source={c.source_system} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString('de-DE')}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={e => { e.stopPropagation(); setEditCustomer(c); }}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Ändern
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteCustomer(c); }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Löschen
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalFiltered)} von {totalFiltered}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">
                Zurück
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">
                Weiter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {editCustomer && (
        <CustomerEditDialog
          customer={editCustomer}
          open={!!editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={() => { setEditCustomer(null); loadAll(); }}
        />
      )}
      {deleteCustomer && (
        <CustomerDeleteDialog
          customer={deleteCustomer}
          open={!!deleteCustomer}
          onClose={() => setDeleteCustomer(null)}
          onDeleted={() => { setDeleteCustomer(null); loadAll(); }}
        />
      )}
    </div>
  );
}
