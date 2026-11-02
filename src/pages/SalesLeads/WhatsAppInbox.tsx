import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, RefreshCw, ArrowRight, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { canAccessSalesLeads } from '@/lib/sales/lead-access';
import { leadTitle } from '@/lib/sales/my-leads';
import { loadWhatsAppInbox, loadWhatsAppAssignees, assignWhatsAppLead, loadWhatsAppReview, type WhatsAppReview, type WhatsAppInboxLead, type LeadAssignee } from '@/lib/sales/whatsapp-inbox';

export default function WhatsAppInbox() {
  const { roles } = useAuth();
  const allowed = canAccessSalesLeads(roles);
  const [rows, setRows] = useState<WhatsAppInboxLead[]>([]);
  const [review, setReview] = useState<WhatsAppReview[]>([]);
  const [assignees, setAssignees] = useState<Record<string, LeadAssignee[]>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!allowed) return;
    try {
      const [leads, pending] = await Promise.all([loadWhatsAppInbox(), loadWhatsAppReview()]);
      setReview(pending);
      const tenants = [...new Set(leads.map(l => l.tenant_id).filter((v): v is string => !!v))];
      const users = await Promise.all(tenants.map(async t => [t, await loadWhatsAppAssignees(t)] as const));
      setRows(leads); setAssignees(Object.fromEntries(users)); setError('');
    } catch (e) { setRows([]); setError(e instanceof Error ? e.message : 'Eingang konnte nicht geladen werden.'); }
    finally { setLoading(false); }
  }, [allowed]);
  useEffect(() => { void reload(); }, [reload]);
  useRealtimeRefresh(['sales_leads', 'sales_lead_history'], reload, { debounceMs: 1000 });
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) void reload(); }, 30000); return () => clearInterval(timer); }, [reload]);
  if (!allowed) return <p role="alert" className="p-6 text-destructive">Nur Admin und Super Admin haben Zugriff auf diesen Eingang.</p>;
  const visible = rows.filter(l => [leadTitle(l), l.phone, l.requested_products, l.whatsapp?.last_message].join(' ').toLowerCase().includes(query.toLowerCase()));
  const assign = async (l: WhatsAppInboxLead) => {
    const target = selection[l.id]; if (!target || busy) return;
    setBusy(l.id);
    try { await assignWhatsAppLead(l.id, target); toast.success('Lead zugewiesen; Mitarbeiter wurde benachrichtigt.'); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Zuweisung fehlgeschlagen'); }
    finally { setBusy(null); }
  };
  return <div className="p-4 md:p-6 space-y-6">
    <header className="flex items-center justify-between gap-4 flex-wrap"><div><div className="flex items-center gap-2 text-primary text-sm"><MessageCircle className="h-5 w-5" />Vertrieb</div><h1 className="text-2xl font-semibold mt-2">WhatsApp-Leads – Eingang</h1></div><div className="flex gap-2 items-center"><Badge variant="outline">{rows.length} nicht zugewiesen</Badge><Button variant="outline" size="icon" aria-label="Eingang aktualisieren" onClick={() => void reload()}><RefreshCw className="h-4 w-4" /></Button></div></header>
    {error && <div role="alert" className="border border-destructive p-4 text-destructive">{error}<Button variant="outline" className="ml-3" onClick={() => void reload()}>Erneut laden</Button></div>}
    <Input aria-label="WhatsApp-Leads durchsuchen" placeholder="Name, Telefonnummer, Produkt …" value={query} onChange={e => setQuery(e.target.value)} className="max-w-lg" />
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{['Eingang', 'Kundenname', 'Telefonnummer', 'Produktinteresse', 'Letzte Nachricht', 'Status', 'Priorität', 'Mitarbeiterzuweisung', ''].map(label => <th key={label} className="text-left font-medium p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{visible.map(l => <tr key={l.id} className="border-b border-border hover:bg-muted/30"><td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</td><td className="p-3"><Link className="text-primary font-medium" to={`/vertrieb/meine-leads/${l.id}`}>{leadTitle(l)}</Link></td><td className="p-3 whitespace-nowrap">{l.phone || '—'}</td><td className="p-3">{l.requested_products || '—'}</td><td className="p-3 min-w-48 max-w-80 whitespace-pre-wrap break-words">{l.whatsapp?.last_message || l.message || '—'}</td><td className="p-3"><Badge variant="outline">{l.lead_status}</Badge></td><td className="p-3">{l.workspace?.priority === 'Normal' ? 'Mittel' : l.workspace?.priority || '—'}</td><td className="p-3 min-w-60"><div className="flex items-center gap-2"><select aria-label={`Mitarbeiter für ${leadTitle(l)}`} className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-2" disabled={!!busy || !l.tenant_id} value={selection[l.id] || ''} onChange={e => setSelection(s => ({ ...s, [l.id]: e.target.value }))}><option value="">Nicht zugewiesen</option>{(assignees[l.tenant_id || ''] || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><Button size="icon" variant="outline" aria-label={`${leadTitle(l)} zuweisen`} disabled={!!busy || !selection[l.id]} onClick={() => void assign(l)}><UserCheck className="h-4 w-4" /></Button></div>{!l.tenant_id && <p className="text-xs text-destructive mt-1">Mandant ungeklärt</p>}</td><td className="p-3"><Button asChild size="icon" variant="ghost"><Link aria-label={`${leadTitle(l)} öffnen`} to={`/vertrieb/meine-leads/${l.id}`}><ArrowRight className="h-4 w-4" /></Link></Button></td></tr>)}</tbody></table></div>
    {loading ? <p className="py-12 text-center text-muted-foreground">Eingang wird geladen …</p> : !visible.length && <p className="py-12 text-center text-muted-foreground">Keine nicht zugewiesenen WhatsApp-Leads vorhanden.</p>}
    {!!review.length && <section className="border-t border-border pt-6 space-y-3"><h2 className="text-lg font-semibold">Zuordnung prüfen ({review.length})</h2>{review.map(r => <div key={r.event_id} className="border-b border-border py-3"><p className="font-medium">{r.name || 'WhatsApp-Kontakt'} · {r.phone}</p><p className="text-sm text-muted-foreground">{new Date(r.at).toLocaleString('de-DE')} · Kontaktzuordnung nicht eindeutig bestätigt</p></div>)}</section>}
  </div>;
}