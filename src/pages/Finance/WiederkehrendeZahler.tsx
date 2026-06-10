import { useEffect, useMemo, useState } from 'react';
import { Repeat, Search, Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageError } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  zoho_recurring_invoice_id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_frequency: string | null;
  repeat_every: number | null;
  start_date: string | null;
  end_date: string | null;
  next_invoice_date: string | null;
  last_sent_date: string | null;
  total: number | null;
  currency: string | null;
};

type Invoice = {
  id: string;
  zoho_invoice_id: string;
  zoho_recurring_invoice_id: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  currency: string | null;
  last_payment_date: string | null;
};

type Group = {
  customer_id: string;
  customer_name: string;
  profiles: Profile[];
  invoices: Invoice[];
  monthly: number;
  ytdBilled: number;
  openBalance: number;
  lastInvoiceDate: string | null;
  nextInvoiceDate: string | null;
  currency: string;
};

const monthsFactor = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 30 / e;
    case 'weeks': return (52 / 12) / e;
    case 'months': return 1 / e;
    case 'years': return (1 / 12) / e;
    default: return 1 / e;
  }
};

export default function WiederkehrendeZahler() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stopped'>('active');

  async function load() {
    setLoading(true);
    setError(null);
    const [p, i] = await Promise.all([
      supabase
        .from('zoho_recurring_profiles')
        .select('*')
        .eq('source_system', 'zoho_eu_1')
        .order('next_invoice_date', { ascending: true, nullsFirst: false })
        .limit(5000),
      supabase
        .from('zoho_recurring_invoices')
        .select('*')
        .eq('source_system', 'zoho_eu_1')
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .limit(5000),
    ]);
    if (p.error) { setError(p.error.message); setLoading(false); return; }
    if (i.error) { setError(i.error.message); setLoading(false); return; }
    setProfiles((p.data ?? []) as Profile[]);
    setInvoices((i.data ?? []) as Invoice[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runSync() {
    setSyncing(true);
    try {
      const [a, b] = await Promise.all([
        supabase.functions.invoke('sync-zoho-recurring-profiles', {
          body: { source_system: 'zoho_eu_1', page: 1, per_page: 100, max_pages: 30 },
        }),
        supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2024-01-01', page: 1, per_page: 200, max_pages: 30, fetch_details: false },
        }),
      ]);
      if (a.error || b.error) throw new Error(a.error?.message || b.error?.message);
      toast({ title: 'Sync gestartet', description: 'Profile & Rechnungen werden aktualisiert.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Sync fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    const keyOf = (cid: string | null, name: string | null) => cid || `name:${(name || 'Unbekannt').toLowerCase()}`;

    for (const p of profiles) {
      const k = keyOf(p.customer_id, p.company_name || p.customer_name);
      if (!map.has(k)) {
        map.set(k, {
          customer_id: p.customer_id || k,
          customer_name: p.company_name || p.customer_name || 'Unbekannt',
          profiles: [], invoices: [], monthly: 0, ytdBilled: 0, openBalance: 0,
          lastInvoiceDate: null, nextInvoiceDate: null, currency: p.currency || 'EUR',
        });
      }
      const g = map.get(k)!;
      g.profiles.push(p);
      const isActive = (p.status ?? '').toLowerCase() === 'active';
      if (isActive && p.total) g.monthly += Number(p.total) * monthsFactor(p.recurrence_frequency, p.repeat_every);
      if (p.next_invoice_date && (!g.nextInvoiceDate || p.next_invoice_date < g.nextInvoiceDate)) g.nextInvoiceDate = p.next_invoice_date;
    }

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    for (const inv of invoices) {
      const k = keyOf(inv.customer_id, inv.customer_name);
      if (!map.has(k)) {
        map.set(k, {
          customer_id: inv.customer_id || k,
          customer_name: inv.customer_name || 'Unbekannt',
          profiles: [], invoices: [], monthly: 0, ytdBilled: 0, openBalance: 0,
          lastInvoiceDate: null, nextInvoiceDate: null, currency: inv.currency || 'EUR',
        });
      }
      const g = map.get(k)!;
      g.invoices.push(inv);
      if (inv.invoice_date && inv.invoice_date >= yearStart) g.ytdBilled += Number(inv.total || 0);
      if (inv.balance) g.openBalance += Number(inv.balance);
      if (inv.invoice_date && (!g.lastInvoiceDate || inv.invoice_date > g.lastInvoiceDate)) g.lastInvoiceDate = inv.invoice_date;
    }

    return Array.from(map.values())
      .filter(g => {
        if (statusFilter === 'active') return g.profiles.some(p => (p.status ?? '').toLowerCase() === 'active');
        if (statusFilter === 'stopped') return g.profiles.length > 0 && g.profiles.every(p => (p.status ?? '').toLowerCase() !== 'active');
        return true;
      })
      .sort((a, b) => b.monthly - a.monthly || b.ytdBilled - a.ytdBilled);
  }, [profiles, invoices, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const s = search.toLowerCase();
    return groups.filter(g =>
      g.customer_name.toLowerCase().includes(s) ||
      g.profiles.some(p => (p.recurrence_name ?? '').toLowerCase().includes(s) || (p.reference_number ?? '').toLowerCase().includes(s)) ||
      g.invoices.some(i => (i.invoice_number ?? '').toLowerCase().includes(s))
    );
  }, [groups, search]);

  const totals = useMemo(() => {
    return {
      customers: filtered.length,
      monthly: filtered.reduce((s, g) => s + g.monthly, 0),
      ytd: filtered.reduce((s, g) => s + g.ytdBilled, 0),
      open: filtered.reduce((s, g) => s + g.openBalance, 0),
      activeProfiles: filtered.reduce((s, g) => s + g.profiles.filter(p => (p.status ?? '').toLowerCase() === 'active').length, 0),
    };
  }, [filtered]);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiederkehrende Zahler"
        subtitle="Periodische Rechnungen & aktive Verträge aus Zoho Deutschland — gruppiert nach Kundenkonto"
        icon={Repeat}
        actions={
          <Button onClick={runSync} disabled={syncing} size="sm" variant="outline">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Jetzt synchronisieren
          </Button>
        }
      />

      {error && <PageError message={error} onRetry={load} />}

      <div className="grid md:grid-cols-5 gap-4">
        <DataCard title="Kunden"><div className="text-2xl font-semibold">{totals.customers}</div></DataCard>
        <DataCard title="Aktive Verträge"><div className="text-2xl font-semibold">{totals.activeProfiles}</div></DataCard>
        <DataCard title="Volumen / Monat"><div className="text-2xl font-semibold">{fmt(totals.monthly)}</div></DataCard>
        <DataCard title="Abgerechnet YTD"><div className="text-2xl font-semibold">{fmt(totals.ytd)}</div></DataCard>
        <DataCard title="Offene Beträge"><div className={`text-2xl font-semibold ${totals.open > 0 ? 'text-destructive' : ''}`}>{fmt(totals.open)}</div></DataCard>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kunde, Vertragsnr. oder Rechnungsnr. suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['active', 'stopped', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'active' ? 'Aktiv' : s === 'stopped' ? 'Beendet' : 'Alle'}
            </button>
          ))}
        </div>
      </div>

      <DataCard title={`Kundenkonten (${filtered.length})`}>
        <div className="divide-y divide-border -mx-5">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-muted-foreground text-sm">Keine Treffer.</div>
          )}
          {filtered.map(g => {
            const isOpen = !!open[g.customer_id];
            const activeP = g.profiles.filter(p => (p.status ?? '').toLowerCase() === 'active').length;
            return (
              <div key={g.customer_id} className="px-5">
                <button
                  className="w-full py-3 flex items-center gap-3 hover:bg-muted/30 -mx-5 px-5 transition-colors text-left"
                  onClick={() => setOpen(s => ({ ...s, [g.customer_id]: !s[g.customer_id] }))}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{g.customer_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                      <span>{activeP} aktiv / {g.profiles.length} Verträge</span>
                      <span>{g.invoices.length} Rechnungen</span>
                      {g.nextInvoiceDate && <span>nächste: {fmtDate(g.nextInvoiceDate)}</span>}
                      {g.lastInvoiceDate && <span>letzte: {fmtDate(g.lastInvoiceDate)}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end text-sm">
                    <span className="font-semibold tabular-nums">{fmt(g.monthly, g.currency)}<span className="text-xs text-muted-foreground"> /Mon.</span></span>
                    <span className="text-xs text-muted-foreground tabular-nums">YTD {fmt(g.ytdBilled, g.currency)}</span>
                  </div>
                  {g.openBalance > 0 && (
                    <Badge variant="destructive" className="ml-2 tabular-nums">{fmt(g.openBalance, g.currency)}</Badge>
                  )}
                </button>

                {isOpen && (
                  <div className="pb-4 pl-7 space-y-4 animate-fade-in">
                    {g.profiles.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-medium mb-2">Verträge / Profile</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-2">Name / Referenz</th>
                                <th className="text-left px-3 py-2">Frequenz</th>
                                <th className="text-left px-3 py-2">Start</th>
                                <th className="text-left px-3 py-2">Ende</th>
                                <th className="text-left px-3 py-2">Letzte</th>
                                <th className="text-left px-3 py-2">Nächste</th>
                                <th className="text-right px-3 py-2">Betrag</th>
                                <th className="text-left px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.profiles.map(p => (
                                <tr key={p.id} className="border-t border-border">
                                  <td className="px-3 py-2">
                                    <div className="font-medium">{p.recurrence_name || '—'}</div>
                                    {p.reference_number && <div className="text-xs text-muted-foreground font-mono">{p.reference_number}</div>}
                                  </td>
                                  <td className="px-3 py-2">{p.repeat_every ?? 1}× {p.recurrence_frequency ?? '—'}</td>
                                  <td className="px-3 py-2">{fmtDate(p.start_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.end_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.last_sent_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.next_invoice_date)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(p.total || 0), p.currency || 'EUR')}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant={(p.status ?? '').toLowerCase() === 'active' ? 'default' : 'secondary'} className="capitalize">{p.status ?? '—'}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {g.invoices.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-medium mb-2">Rechnungen ({g.invoices.length})</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-2">Rechnungsnr.</th>
                                <th className="text-left px-3 py-2">Datum</th>
                                <th className="text-left px-3 py-2">Fällig</th>
                                <th className="text-right px-3 py-2">Betrag</th>
                                <th className="text-right px-3 py-2">Offen</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-left px-3 py-2">Letzte Zahlung</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.invoices.slice(0, 50).map(inv => (
                                <tr key={inv.id} className="border-t border-border">
                                  <td className="px-3 py-2 font-mono">{inv.invoice_number || '—'}</td>
                                  <td className="px-3 py-2">{fmtDate(inv.invoice_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(inv.due_date)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(inv.total || 0), inv.currency || 'EUR')}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${Number(inv.balance) > 0 ? 'text-destructive font-medium' : ''}`}>
                                    {fmt(Number(inv.balance || 0), inv.currency || 'EUR')}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={(inv.status ?? '').toLowerCase() === 'paid' ? 'default' : 'secondary'} className="capitalize">{inv.status ?? '—'}</Badge>
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(inv.last_payment_date)}</td>
                                </tr>
                              ))}
                              {g.invoices.length > 50 && (
                                <tr><td colSpan={7} className="px-3 py-2 text-center text-xs text-muted-foreground">… {g.invoices.length - 50} weitere</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DataCard>

      <p className="text-xs text-muted-foreground text-center">
        Quelle: Zoho Deutschland (zoho_eu_1) · Tägliche Synchronisation 23:45 Uhr · {profiles.length} Profile · {invoices.length} Rechnungen geladen
      </p>
    </div>
  );
}
