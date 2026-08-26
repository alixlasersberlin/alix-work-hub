import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, PlayCircle, RefreshCw, Settings as SettingsIcon, Eye, Inbox, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { RegionChip } from '@/components/finance/RegionChip';
import { regionCurrency } from '@/lib/finance/region';

type AccRow = {
  id: string;
  customer_id: string;
  reminder_level: number | null;
  overdue_balance: number | null;
  last_reminder_at: string | null;
  customers: { company_name: string | null; contact_name: string | null; email: string | null } | null;
};

type DraftRow = { id: string; customer_id: string; level: number; total: number; status: string; created_at: string };

const LEVEL_LABEL = ['—', 'Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung'];


export default function FinanceMahnwesen() {
  const { roles } = useAuth();
  const { region } = useAccountingRegion();
  const { tenantId } = useTenantFilter();
  const fmt = (n: number | null) => typeof n === 'number'
    ? new Intl.NumberFormat(region === 'CH' ? 'de-CH' : 'de-DE', { style: 'currency', currency: regionCurrency((region as any)) }).format(n) : '–';
  const isSuperAdmin = (roles.includes('Super Admin') || roles.includes('Admin'));
  const [accounts, setAccounts] = useState<AccRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('Entwurf');
  const [onlyWithReminder, setOnlyWithReminder] = useState(false);
  const [search, setSearch] = useState('');
  const [matchIds, setMatchIds] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);

  // Erweiterte Suche: Kundennummer, Auftragsnummer, Seriennummer, Telefon → Kunden-IDs
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setMatchIds(null); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const ids = new Set<string>();
      try {
        const [custRes, ordRes, devRes] = await Promise.all([
          supabase.from('customers').select('id')
            .or([
              `company_name.ilike.%${q}%`,
              `contact_name.ilike.%${q}%`,
              `email.ilike.%${q}%`,
              `phone.ilike.%${q}%`,
              `external_customer_id.ilike.%${q}%`,
            ].join(','))
            .limit(200),
          supabase.from('orders').select('customer_id').ilike('order_number', `%${q}%`).limit(200),
          supabase.from('lager_devices').select('customer_email').ilike('serial_number', `%${q}%`).limit(50),
        ]);
        (custRes.data || []).forEach((c: any) => c?.id && ids.add(c.id));
        (ordRes.data || []).forEach((o: any) => o?.customer_id && ids.add(o.customer_id));
        const emails = Array.from(new Set(((devRes.data || []) as any[]).map(d => d.customer_email).filter(Boolean)));
        if (emails.length) {
          const { data: byMail } = await supabase.from('customers').select('id').in('email', emails as string[]).limit(200);
          (byMail || []).forEach((c: any) => c?.id && ids.add(c.id));
        }
      } catch { /* ignore */ }
      if (!cancelled) { setMatchIds(ids); setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);


  const load = async () => {
    setLoading(true);
    let remQ: any = supabase.from('finance_reminders' as any)
      .select('id, customer_id, level, total, status, created_at')
      .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region])
      .order('created_at', { ascending: false });
    if (statusFilter !== 'alle') remQ = remQ.eq('status', statusFilter);
    if (tenantId) remQ = remQ.eq('tenant_id', tenantId);
    const [accRes, draftRes] = await Promise.all([
      supabase.from('finance_accounts' as any)
        .select('id, customer_id, reminder_level, overdue_balance, last_reminder_at, customers(company_name, contact_name, email)')
        .gt('overdue_balance', 0)
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region])
        .order('overdue_balance', { ascending: false })
        .limit(500),
      remQ,
    ]);
    setAccounts(((accRes.data ?? []) as any) as AccRow[]);
    setDrafts(((draftRes.data ?? []) as any) as DraftRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [region, statusFilter, tenantId]);


  const runEngine = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-reminder-engine', { body: { region } });
      if (error) throw error;
      toast({ title: `Mahn-Engine ausgeführt (${region})`, description: `Konten: ${data?.accounts_seen ?? 0} • Entwürfe erstellt: ${data?.drafts_created ?? 0} • übersprungen: ${data?.skipped ?? 0}` });
      await load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Unbekannt', variant: 'destructive' });
    } finally { setRunning(false); }
  };

  const draftsByCustomer = new Map(drafts.map(d => [d.customer_id, d]));
  const q = search.trim().toLowerCase();
  const visibleAccounts = accounts
    .filter(a => (onlyWithReminder ? draftsByCustomer.has(a.customer_id) : true))
    .filter(a => {
      if (q.length < 2) return true;
      const c = a.customers;
      const local = [c?.company_name, c?.contact_name, c?.email].filter(Boolean).join(' ').toLowerCase();
      return local.includes(q) || (matchIds?.has(a.customer_id) ?? false);
    });


  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={AlertTriangle}
        title={`Mahnwesen ${region}`}
        subtitle={`Buchungskreis ${region} • Überfällige Forderungen, automatische Stufenfindung & manueller Versand`}
        meta={<div className="flex items-center gap-2"><RegionChip /><InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${visibleAccounts.length}`} pulse={!loading} /></div>}
        actions={
          <>
            <div className="relative w-full sm:w-[300px]">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${searching ? 'animate-pulse text-primary' : 'text-muted-foreground'}`} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, Firma, Auftrag, Seriennr., E-Mail…"
                className="pl-9 pr-8 h-9"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Suche leeren"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle</SelectItem>
                  <SelectItem value="Entwurf">Entwurf</SelectItem>
                  <SelectItem value="Versendet">Versendet</SelectItem>
                  <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                  <SelectItem value="Storniert">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant={onlyWithReminder ? 'default' : 'outline'} size="sm" onClick={() => setOnlyWithReminder(v => !v)}>
              Nur mit Mahnung
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/finance/mahnwesen/einstellungen"><SettingsIcon className="w-4 h-4 mr-2" />Einstellungen</Link>
            </Button>
            <Button onClick={runEngine} disabled={running} size="sm" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold border-0">
              {running ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              {running ? 'Lauf läuft…' : `Mahn-Engine ${region} starten`}
            </Button>

          </>
        }

      />

      <DataCard className="overflow-hidden">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} cols={7} /></div>
        ) : visibleAccounts.length === 0 ? (
          <div className="p-8"><EmptyState compact icon={Inbox} title="Keine Einträge" description={onlyWithReminder ? `Keine Konten mit Mahnung im Status „${statusFilter}".` : 'Alle Debitoren sind im grünen Bereich.'} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">E-Mail</th>
                  <th className="text-left px-4 py-3 font-medium">Aktuelle Stufe</th>
                  <th className="text-right px-4 py-3 font-medium">Überfällig</th>
                  <th className="text-left px-4 py-3 font-medium">Letzte Mahnung</th>
                  <th className="text-left px-4 py-3 font-medium">Mahnung ({statusFilter === 'alle' ? 'alle' : statusFilter})</th>
                  <th className="text-right px-4 py-3 font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {visibleAccounts.map(a => {
                  const d = draftsByCustomer.get(a.customer_id);

                  return (
                    <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">{a.customers?.company_name || a.customers?.contact_name || a.customer_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.customers?.email ?? '–'}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{LEVEL_LABEL[a.reminder_level ?? 0] ?? `Stufe ${a.reminder_level}`}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums text-destructive">{fmt(a.overdue_balance)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.last_reminder_at ? new Date(a.last_reminder_at).toLocaleDateString('de-DE') : '–'}</td>
                      <td className="px-4 py-3">{d ? <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Stufe {d.level} • {fmt(d.total)}</Badge> : '–'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/finance/mahnwesen/${a.customer_id}`}>
                          <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" />Detail</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
