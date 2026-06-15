import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2, ArrowLeft, ExternalLink, Trash2, Search } from 'lucide-react';
import { SourceBadge } from '@/lib/source-system';
import CustomerDeleteDialog from '@/components/CustomerDeleteDialog';
import { useAuth } from '@/hooks/useAuth';

type DupKey = 'email' | 'phone' | 'company_name';

function norm(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

export default function DoppelteKunden() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyField, setKeyField] = useState<DupKey>('email');
  const [search, setSearch] = useState('');
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);

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

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/kunden')} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück zu Kunden
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Doppelte Kunden
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Lade Kunden …'
              : `${groups.length} Dublettengruppen · ${totalDuplicates} betroffene Kunden`}
          </p>
        </div>
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
          {groups.map((g) => (
            <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-secondary/40 border-b border-border flex items-center justify-between text-sm">
                <span className="font-mono text-foreground">{g.key}</span>
                <span className="text-xs text-muted-foreground">{g.rows.length} Treffer</span>
              </div>
              <div className="divide-y divide-border">
                {g.rows.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {c.company_name || c.contact_name || '—'}
                        </p>
                        <SourceBadge source={c.source_system} />
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
                ))}
              </div>
            </div>
          ))}
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
    </div>
  );
}
