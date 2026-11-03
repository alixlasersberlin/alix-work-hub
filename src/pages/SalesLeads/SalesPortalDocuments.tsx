import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Button } from '@/components/ui/button';
import { loadMyLeads, loadLeadDetail, leadTitle, type LeadDetail } from '@/lib/sales/my-leads';

export default function SalesPortalDocuments({ kind }: { kind: 'offers' | 'orders' }) {
  const { user } = useAuth(); const { current } = useTenant();
  const [details, setDetails] = useState<LeadDetail[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const leads = (await loadMyLeads()).filter(l => l.assigned_user === user?.id && (!current || l.tenant_id === current.id));
      const result: LeadDetail[] = [];
      for (let start = 0; start < leads.length; start += 5) result.push(...await Promise.all(leads.slice(start, start + 5).map(l => loadLeadDetail(l.id))));
      setDetails(result); setError('');
    } catch (e) { setDetails([]); setError(e instanceof Error ? e.message : 'Vorgänge nicht zugänglich.'); }
    finally { setLoading(false); }
  }, [user?.id, current?.id]);
  useEffect(() => { void reload(); }, [reload]);
  useRealtimeRefresh(['sales_leads', 'offers', 'orders'], reload, { debounceMs: 1000 });
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) void reload(); }, 30000); return () => clearInterval(timer); }, [reload]);
  const money = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const count = details.reduce((n, d) => n + d[kind].length, 0);
  return <div className="p-4 md:p-6 space-y-6"><h1 className="text-2xl font-semibold">{kind === 'offers' ? 'Angebote' : 'Aufträge'}</h1>{error && <p role="alert" className="text-destructive">{error}</p>}{loading && <p className="text-muted-foreground">Vorgänge werden geladen …</p>}{!loading && !error && !count && <p className="text-muted-foreground">Keine verknüpften Vorgänge vorhanden.</p>}
    {details.filter(d => d[kind].length).map(d => <section key={d.lead.id} className="border-t border-border pt-4 space-y-3"><Link className="font-semibold text-primary" to={`/meine-leads/akte/${d.lead.id}`}>{leadTitle(d.lead)}</Link>{kind === 'offers' ? d.offers.map(o => <div key={o.id} className="flex items-center justify-between gap-3 flex-wrap border-b border-border py-3"><div><p>{o.offer_number}</p><p className="text-sm text-muted-foreground">{money(o.total_gross)} · {o.status} · {o.approval_status}</p></div><Button asChild variant="outline"><Link to={`/meine-leads/angebot?edit=${encodeURIComponent(o.offer_number)}&returnLead=${d.lead.id}`}>Angebot öffnen</Link></Button></div>) : d.orders.map(o => <div key={o.id} className="border-b border-border py-3"><p>{o.order_number}{o.source_system === 'zoho_eu_2' ? '-AT' : ''} · {money(o.total_amount)}</p><p className="text-sm text-muted-foreground">{o.order_status} · Zahlung: {o.payment_status || '—'} · Lieferung: {o.delivery_status || '—'}</p></div>)}</section>)}
  </div>;
}