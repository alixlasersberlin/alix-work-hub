import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Loader2, ArrowLeft, ExternalLink, Trash2, Search, GitMerge } from 'lucide-react';
import { SourceBadge } from '@/lib/source-system';
import CustomerDeleteDialog from '@/components/CustomerDeleteDialog';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { toast } from 'sonner';

type DupKey = 'email' | 'phone' | 'company_name';

function norm(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

export default function DoppelteKunden() {
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canMerge = hasRole('Super Admin');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyField, setKeyField] = useState<DupKey>('email');
  const [search, setSearch] = useState('');
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);

  // Merge state: per-group selections
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<string, string>>({});
  const [dupsByGroup, setDupsByGroup] = useState<Record<string, Set<string>>>({});
  const [mergePending, setMergePending] = useState<{ groupKey: string; primary: any; dups: any[] } | null>(null);
  const [merging, setMerging] = useState(false);

  async function loadAll() {
    setLoading(true);
    const CHUNK = 1000;
    const all: any[] = [];
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email, phone, source_system, external_customer_id, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + CHUNK - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < CHUNK) break;
    }
    setCustomers(all);
    setPrimaryByGroup({});
    setDupsByGroup({});
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of customers) {
      const key = norm(c[keyField]);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const entries: { key: string; rows: any[] }[] = [];
    for (const [key, rows] of map) {
      if (rows.length > 1) entries.push({ key, rows });
    }
    entries.sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(g =>
      g.key.includes(q) ||
      g.rows.some(r =>
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.contact_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    );
  }, [customers, keyField, search]);

  const totalDuplicates = groups.reduce((sum, g) => sum + g.rows.length, 0);

  function getPrimaryId(g: { key: string; rows: any[] }) {
    return primaryByGroup[g.key] ?? g.rows[0].id;
  }
  function toggleDup(groupKey: string, id: string, checked: boolean) {
    setDupsByGroup(prev => {
      const next = { ...prev };
      const set = new Set(next[groupKey] ?? []);
      if (checked) set.add(id); else set.delete(id);
      next[groupKey] = set;
      return next;
    });
  }
  function setPrimary(groupKey: string, id: string) {
    setPrimaryByGroup(prev => ({ ...prev, [groupKey]: id }));
    // ensure primary not in dup set
    setDupsByGroup(prev => {
      const set = new Set(prev[groupKey] ?? []);
      set.delete(id);
      return { ...prev, [groupKey]: set };
    });
  }

  function startMerge(g: { key: string; rows: any[] }) {
    const primaryId = getPrimaryId(g);
    const primary = g.rows.find(r => r.id === primaryId);
    const dupIds = Array.from(dupsByGroup[g.key] ?? []).filter(id => id !== primaryId);
    if (!primary || dupIds.length === 0) {
      toast.error('Bitte mindestens ein zu mergendes Duplikat auswählen.');
      return;
    }
    const dups = g.rows.filter(r => dupIds.includes(r.id));
    setMergePending({ groupKey: g.key, primary, dups });
  }

  async function confirmMerge() {
    if (!mergePending) return;
    setMerging(true);
    const { error } = await supabase.rpc('merge_customers', {
      _primary_id: mergePending.primary.id,
      _duplicate_ids: mergePending.dups.map(d => d.id),
    });
    setMerging(false);
    if (error) {
      toast.error('Zusammenführen fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success(`${mergePending.dups.length} Kunde(n) in „${mergePending.primary.company_name || mergePending.primary.contact_name || '—'}" zusammengeführt.`);
    setMergePending(null);
    loadAll();
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/kunden')} className="mb-2 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück zu Kunden
        </Button>
        <PageHeader
          icon={Users}
          title="Doppelte Kunden"
          subtitle={
            loading
              ? 'Lade Kunden …'
              : `${groups.length} Dublettengruppen · ${totalDuplicates} betroffene Kunden`
          }
          noBreadcrumbs
          meta={<InfinityStatusBadge kind="warning" label={`${groups.length}`} />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={keyField} onValueChange={(v) => setKeyField(v as DupKey)}>
          <SelectTrigger className="w-56 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Doppelt nach E-Mail</SelectItem>
            <SelectItem value="phone">Doppelt nach Telefon</SelectItem>
            <SelectItem value="company_name">Doppelt nach Firma</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="In Dubletten filtern …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      {canMerge && (
        <p className="text-xs text-muted-foreground">
          Wähle pro Gruppe den <span className="text-primary font-medium">Master-Kunden</span> (Radio) und die zu integrierenden Duplikate (Häkchen). Beim Zusammenführen werden alle Aufträge, Rechnungen, Notizen usw. auf den Master umgeschrieben und die Duplikate gelöscht.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Lade Kunden …
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Keine Dubletten gefunden.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const primaryId = getPrimaryId(g);
            const selectedDups = (dupsByGroup[g.key] ?? new Set<string>());
            const dupCount = Array.from(selectedDups).filter(id => id !== primaryId).length;
            return (
              <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2 bg-secondary/40 border-b border-border flex items-center justify-between text-sm gap-3">
                  <span className="font-mono text-foreground truncate">{g.key}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{g.rows.length} Treffer</span>
                    {canMerge && (() => {
                      const allDupIds = g.rows.map(r => r.id).filter(id => id !== primaryId);
                      const allSelected = allDupIds.length > 0 && allDupIds.every(id => selectedDups.has(id));
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDupsByGroup(prev => {
                              const next = { ...prev };
                              next[g.key] = allSelected ? new Set() : new Set(allDupIds);
                              return next;
                            });
                          }}
                        >
                          {allSelected ? 'Auswahl aufheben' : 'Alle markieren'}
                        </Button>
                      );
                    })()}
                    {canMerge && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={dupCount === 0}
                        onClick={() => startMerge(g)}
                      >
                        <GitMerge className="w-3.5 h-3.5 mr-1" />
                        Zusammenführen {dupCount > 0 ? `(${dupCount})` : ''}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {g.rows.map((c) => {
                    const isPrimary = c.id === primaryId;
                    const isDupChecked = selectedDups.has(c.id) && !isPrimary;
                    return (
                      <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30">
                        {canMerge && (
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer" title="Als Master setzen">
                              <input
                                type="radio"
                                name={`primary-${g.key}`}
                                checked={isPrimary}
                                onChange={() => setPrimary(g.key, c.id)}
                                className="accent-primary"
                              />
                              Master
                            </label>
                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer" title="Als Duplikat markieren">
                              <Checkbox
                                checked={isDupChecked}
                                disabled={isPrimary}
                                onCheckedChange={(v) => toggleDup(g.key, c.id, !!v)}
                              />
                              Dup.
                            </label>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {c.company_name || c.contact_name || '—'}
                            </p>
                            <SourceBadge source={c.source_system} />
                            {isPrimary && canMerge && (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                                Master
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.contact_name, c.email, c.phone].filter(Boolean).join(' · ')}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                            Erstellt: {new Date(c.created_at).toLocaleString('de-DE')}
                            {c.external_customer_id ? ` · Nr. ${c.external_customer_id}` : ''}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/kunden/${c.id}`}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Öffnen
                          </Link>
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => setDeleteCustomer(c)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Löschen
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteCustomer && (
        <CustomerDeleteDialog
          customer={deleteCustomer}
          open={!!deleteCustomer}
          onClose={() => setDeleteCustomer(null)}
          onDeleted={() => { setDeleteCustomer(null); loadAll(); }}
        />
      )}

      <AlertDialog open={!!mergePending} onOpenChange={(o) => !o && !merging && setMergePending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunden zusammenführen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Master-Kunde (bleibt erhalten):</div>
                  <div className="font-medium text-foreground">
                    {mergePending?.primary.company_name || mergePending?.primary.contact_name || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[mergePending?.primary.email, mergePending?.primary.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Werden gelöscht ({mergePending?.dups.length}):</div>
                  <ul className="list-disc list-inside text-foreground">
                    {mergePending?.dups.map(d => (
                      <li key={d.id} className="truncate">
                        {d.company_name || d.contact_name || '—'}
                        <span className="text-xs text-muted-foreground"> · {d.email || d.phone || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-xs text-amber-500">
                  Alle verknüpften Datensätze (Aufträge, Rechnungen, Notizen, Mails …) werden auf den Master umgeschrieben. Diese Aktion kann nicht rückgängig gemacht werden.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmMerge(); }} disabled={merging}>
              {merging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Führe zusammen …</> : 'Zusammenführen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
