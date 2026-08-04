import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2, ArrowUpDown, Loader2, Inbox, Pencil, Trash2, UserPlus, Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import CustomerEditDialog from '@/components/CustomerEditDialog';
import CustomerDeleteDialog from '@/components/CustomerDeleteDialog';
import CustomerImportDialog from '@/components/CustomerImportDialog';
import { VipBadge } from '@/components/VipBadge';
import { SourceBadge, sourceLabel, sourceFlag } from '@/lib/source-system';
import { useAtOnly } from '@/hooks/useAtOnly';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { qk, STALE } from '@/lib/query-keys';

type SortField = 'company_name' | 'contact_name' | 'created_at';
type SortDir = 'asc' | 'desc';

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAGE_SIZES = [20, 50, 100, 250] as const;

type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source_system: string | null;
  external_customer_id: string | null;
  is_vip: boolean;
  created_at: string;
  total_count: number;
};

/**
 * Serverseitige Seitenabfrage (Phase 3/4).
 * Statt aller Kunden inkl. `raw_data` (~27 MB) kommen nur die sichtbaren
 * Zeilen mit den benötigten Spalten und die Gesamtzahl in einem Rutsch zurück.
 */
async function fetchCustomerPage(params: {
  q: string; source: string; letter: string | null;
  sortField: SortField; sortDir: SortDir; limit: number; offset: number;
}) {
  const { data, error } = await supabase.rpc('customers_page' as any, {
    _q: params.q || null,
    _source: params.source === 'all' ? null : params.source,
    _letter: params.letter,
    _sort: params.sortField,
    _dir: params.sortDir,
    _limit: params.limit,
    _offset: params.offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as CustomerRow[];
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0 };
}

export default function Customers() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const atOnly = useAtOnly();
  const queryClient = useQueryClient();
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [loadingRow, setLoadingRow] = useState<string | null>(null);

  // Suche entprellen — sonst eine Serverabfrage pro Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const effectiveSource = atOnly ? 'zoho_eu_2' : sourceFilter;

  const { data, isPending: loading, error: queryError } = useQuery({
    queryKey: qk.customers.page({
      q: search, source: effectiveSource, letter: letterFilter,
      sortField, sortDir, page, pageSize,
    }),
    queryFn: () => fetchCustomerPage({
      q: search, source: effectiveSource, letter: letterFilter,
      sortField, sortDir, limit: pageSize, offset: page * pageSize,
    }),
    staleTime: STALE.medium,
    placeholderData: keepPreviousData,
  });

  // Buchstabenleiste kommt aus einer aggregierten Serverabfrage (eine Zeile je Buchstabe).
  const { data: letters } = useQuery({
    queryKey: qk.customers.letters(effectiveSource),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('customers_letters' as any, {
        _source: effectiveSource === 'all' ? null : effectiveSource,
      });
      if (error) throw error;
      return new Set(((data ?? []) as { letter: string }[]).map(r => r.letter));
    },
    staleTime: STALE.long,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['customers', 'sources'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('source_system').limit(5000);
      return [...new Set((data ?? []).map(r => r.source_system).filter(Boolean))] as string[];
    },
    staleTime: STALE.long,
    enabled: !atOnly,
  });

  const error = queryError ? (queryError as Error).message : null;
  const invalidateCustomers = () => queryClient.invalidateQueries({ queryKey: qk.customers.all });

  useEffect(() => { setPage(0); }, [search, sourceFilter, letterFilter, pageSize]);

  const rows = data?.rows ?? [];
  const totalFiltered = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const availableLetters = letters ?? new Set<string>();

  /** Dialoge brauchen den vollständigen Datensatz — der wird erst bei Bedarf geladen. */
  async function openFull(row: CustomerRow, mode: 'edit' | 'delete') {
    setLoadingRow(row.id);
    const { data } = await supabase.from('customers').select('*').eq('id', row.id).maybeSingle();
    setLoadingRow(null);
    const full = data ?? row;
    if (mode === 'edit') setEditCustomer(full); else setDeleteCustomer(full);
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
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
      <PageHeader
        icon={Building2}
        title="Kunden"
        subtitle={`${totalFiltered} Kunden`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label={`${totalFiltered}`} />}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import
            </Button>
            <Button variant="outline" onClick={() => navigate('/kunden/doppelte')}>
              <Users className="w-4 h-4 mr-2" /> Doppelte suchen
            </Button>
            <Button onClick={() => setEditCustomer({})} className="gold-gradient text-primary-foreground">
              <UserPlus className="w-4 h-4 mr-2" /> Neuer Kunde
            </Button>
          </>
        }
      />
      <CustomerImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={invalidateCustomers} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Firma, Kontakt, E-Mail, Nr..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        {!atOnly && (
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
        )}
        <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
          <SelectTrigger className="w-36 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map(s => (
              <SelectItem key={s} value={String(s)}>{`${s} pro Seite`}</SelectItem>
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
              ) : rows.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Kunden gefunden.</p>
                </td></tr>
              ) : (
                rows.map(c => (
                  <tr
                    key={c.id}
                    className={`hover:bg-secondary/30 transition-colors cursor-pointer ${c.is_vip ? 'bg-gradient-to-r from-amber-500/[0.08] to-transparent' : ''}`}
                    onClick={() => navigate(`/kunden/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        {c.is_vip && <VipBadge size="sm" iconOnly />}
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
                            disabled={loadingRow === c.id}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={e => { e.stopPropagation(); openFull(c, 'edit'); }}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Ändern
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loadingRow === c.id}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={e => { e.stopPropagation(); openFull(c, 'delete'); }}
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
          onSaved={() => { setEditCustomer(null); invalidateCustomers(); }}
        />
      )}
      {deleteCustomer && (
        <CustomerDeleteDialog
          customer={deleteCustomer}
          open={!!deleteCustomer}
          onClose={() => setDeleteCustomer(null)}
          onDeleted={() => { setDeleteCustomer(null); invalidateCustomers(); }}
        />
      )}
    </div>
  );
}
