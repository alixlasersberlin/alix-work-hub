import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Receipt, User2, Loader2, Cpu, FileSignature, LifeBuoy, FileText, ShieldCheck,
  Wrench, MessagesSquare, Files, Bell, Download, MessageSquarePlus, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PORTAL_PHASE } from '@/lib/portal/phase';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

export default function CustomerPortalDashboard() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    invoices: 0, offers: 0, contracts: 0, devices: 0, warrantyActive: 0,
    tickets: 0, unreadMsgs: 0, notifications: 0,
  });
  const [nextMaintenance, setNextMaintenance] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [lastOffer, setLastOffer] = useState<any>(null);
  const [lastNotification, setLastNotification] = useState<any>(null);
  const [customerNumber, setCustomerNumber] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cid = ctx.customerId;
      const [
        invCount, offerCount, contractCount, maintList, warrantyCount, ticketCount,
        msgUnread, notifUnread, cust, lastInv, lastOff, lastNotif,
      ] = await Promise.all([
        supabase.from('mail_attachments').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).eq('document_type', 'Rechnung'),
        supabase.from('offers').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).eq('customer_visible', true).eq('status', 'versendet'),
        supabase.from('finance_contracts').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).eq('status', 'active'),
        supabase.from('device_maintenance').select('id, next_maintenance_date, device_name')
          .eq('customer_id', cid).eq('customer_visible', true)
          .not('next_maintenance_date', 'is', null)
          .order('next_maintenance_date', { ascending: true }).limit(5),
        supabase.from('warranty_records').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).eq('customer_visible', true).eq('warranty_status', 'aktiv'),
        supabase.from('customer_portal_tickets').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).in('status', ['open', 'in_progress']),
        supabase.from('customer_portal_messages').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).eq('from_role', 'staff').is('read_at', null),
        supabase.from('customer_portal_notifications').select('id', { count: 'exact', head: true })
          .eq('customer_id', cid).is('read_at', null),
        supabase.from('customers').select('external_customer_id, contact_name').eq('id', cid).maybeSingle(),
        supabase.from('mail_attachments').select('id, file_name, sent_at, created_at')
          .eq('customer_id', cid).eq('document_type', 'Rechnung')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('offers').select('id, offer_number, offer_date, total_gross, status')
          .eq('customer_id', cid).eq('customer_visible', true)
          .order('offer_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('customer_portal_notifications').select('id, title, created_at, target_route')
          .eq('customer_id', cid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setStats({
        invoices: invCount.count ?? 0,
        offers: offerCount.count ?? 0,
        contracts: contractCount.count ?? 0,
        devices: (maintList.data ?? []).length,
        warrantyActive: warrantyCount.count ?? 0,
        tickets: ticketCount.count ?? 0,
        unreadMsgs: msgUnread.count ?? 0,
        notifications: notifUnread.count ?? 0,
      });
      const next = (maintList.data ?? []).find((m: any) => m.next_maintenance_date);
      setNextMaintenance(next?.next_maintenance_date ?? null);
      setLastInvoice(lastInv.data);
      setLastOffer(lastOff.data);
      setLastNotification(lastNotif.data);
      setCustomerNumber(cust.data?.external_customer_id ?? null);
      setContactName(cust.data?.contact_name ?? null);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Willkommen{ctx.companyName ? `, ${ctx.companyName}` : ''}.</h2>
        <p className="text-muted-foreground text-sm">Ihr sicherer Zugang zu Rechnungen, Verträgen, Geräten und Service bei Alix Lasers.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard label="Firma" value={ctx.companyName ?? '—'} />
        <InfoCard label="Ansprechpartner" value={contactName ?? '—'} />
        <InfoCard label="Kundennummer" value={customerNumber ?? '—'} mono />
      </div>

      {/* KPI-Kacheln */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard icon={<Receipt className="w-4 h-4" />} label="Rechnungen" value={stats.invoices} to="/kunde/rechnungen" />
        {PORTAL_PHASE >= 3 && <StatCard icon={<FileText className="w-4 h-4" />} label="Offene Angebote" value={stats.offers} to="/kunde/angebote" accent={stats.offers > 0} />}
        <StatCard icon={<FileSignature className="w-4 h-4" />} label="Aktive Verträge" value={stats.contracts} to="/kunde/vertraege" />
        <StatCard icon={<Cpu className="w-4 h-4" />} label="Geräte" value={stats.devices} to="/kunde/geraete" />
        {PORTAL_PHASE >= 3 && <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Aktive Garantien" value={stats.warrantyActive} to="/kunde/garantie" />}
        <StatCard icon={<LifeBuoy className="w-4 h-4" />} label="Offene Tickets" value={stats.tickets} to="/kunde/tickets" accent={stats.tickets > 0} />
        {PORTAL_PHASE >= 3 && <StatCard icon={<MessagesSquare className="w-4 h-4" />} label="Neue Nachrichten" value={stats.unreadMsgs} to="/kunde/nachrichten" accent={stats.unreadMsgs > 0} />}
        {PORTAL_PHASE >= 3 && <StatCard icon={<Bell className="w-4 h-4" />} label="Benachrichtigungen" value={stats.notifications} to="/kunde/benachrichtigungen" accent={stats.notifications > 0} />}
      </div>

      {/* Schnellzugriff */}
      <Card>
        <CardHeader><CardTitle className="text-base">Schnellzugriff</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <QuickBtn to="/kunde/rechnungen" icon={<Download className="w-4 h-4" />}>Rechnung herunterladen</QuickBtn>
          {PORTAL_PHASE >= 3 && <QuickBtn to="/kunde/angebote" icon={<Eye className="w-4 h-4" />}>Angebot ansehen</QuickBtn>}
          {PORTAL_PHASE >= 3 && <QuickBtn to="/kunde/wartungen" icon={<Wrench className="w-4 h-4" />}>Service anfragen</QuickBtn>}
          <QuickBtn to="/kunde/tickets" icon={<LifeBuoy className="w-4 h-4" />}>Ticket erstellen</QuickBtn>
          {PORTAL_PHASE >= 3 && <QuickBtn to="/kunde/nachrichten" icon={<MessageSquarePlus className="w-4 h-4" />}>Nachricht senden</QuickBtn>}
          {PORTAL_PHASE >= 3 && <QuickBtn to="/kunde/dokumente" icon={<Files className="w-4 h-4" />}>Gerätedokumente</QuickBtn>}
        </CardContent>
      </Card>

      {/* Kürzlich */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RecentCard title="Letzte Rechnung" icon={<Receipt className="w-4 h-4" />} to="/kunde/rechnungen">
          {lastInvoice ? (
            <>
              <p className="font-mono text-xs truncate">{lastInvoice.file_name}</p>
              <p className="text-xs text-muted-foreground">{new Date(lastInvoice.sent_at ?? lastInvoice.created_at).toLocaleDateString('de-DE')}</p>
            </>
          ) : <Empty />}
        </RecentCard>
        {PORTAL_PHASE >= 3 && (
          <RecentCard title="Letztes Angebot" icon={<FileText className="w-4 h-4" />} to="/kunde/angebote">
            {lastOffer ? (
              <>
                <p className="text-sm font-medium">{lastOffer.offer_number}</p>
                <p className="text-xs text-muted-foreground">{lastOffer.offer_date ? new Date(lastOffer.offer_date).toLocaleDateString('de-DE') : '—'} · {lastOffer.status}</p>
              </>
            ) : <Empty />}
          </RecentCard>
        )}
        <RecentCard title="Nächste Wartung" icon={<Wrench className="w-4 h-4" />} to="/kunde/wartungen">
          {nextMaintenance ? (
            <>
              <p className="text-sm font-medium">{new Date(nextMaintenance).toLocaleDateString('de-DE')}</p>
              <p className="text-xs text-muted-foreground">Details unter „Wartungen".</p>
            </>
          ) : <Empty />}
        </RecentCard>
      </div>

      {PORTAL_PHASE >= 3 && lastNotification && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Aktuelle Mitteilung</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{lastNotification.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(lastNotification.created_at).toLocaleString('de-DE')}</p>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/kunde/benachrichtigungen">Öffnen →</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User2 className="w-4 h-4" /> Meine Daten</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Firmen- und Kontaktdaten einsehen oder Änderung mitteilen.</p>
          <Button asChild size="sm" variant="outline"><Link to="/kunde/meine-daten">Stammdaten ansehen</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, to, accent }: { icon: React.ReactNode; label: string; value: number; to: string; accent?: boolean }) {
  return (
    <Card className={accent ? 'border-primary/40' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <div className={`mt-1 text-3xl font-semibold ${accent ? 'text-primary' : ''}`}>{value}</div>
        <Button asChild size="sm" variant="ghost" className="mt-2 -ml-2 h-auto p-2 text-xs"><Link to={to}>Öffnen →</Link></Button>
      </CardContent>
    </Card>
  );
}

function QuickBtn({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm"><Link to={to}>{icon}<span className="ml-2">{children}</span></Link></Button>
  );
}

function RecentCard({ title, icon, to, children }: { title: string; icon: React.ReactNode; to: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {children}
        <Button asChild size="sm" variant="ghost" className="-ml-2 h-auto p-2 text-xs"><Link to={to}>Alle ansehen →</Link></Button>
      </CardContent>
    </Card>
  );
}

function Empty() { return <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>; }
