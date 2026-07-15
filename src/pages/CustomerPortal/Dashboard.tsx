import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, User2, Loader2, Cpu, FileSignature, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PORTAL_PHASE } from '@/lib/portal/phase';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

type InvoiceRow = {
  id: string;
  file_name: string;
  sent_at: string | null;
  created_at: string;
  status: string;
};

export default function CustomerPortalDashboard() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [recent, setRecent] = useState<InvoiceRow[]>([]);
  const [customerNumber, setCustomerNumber] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);
  const [devCount, setDevCount] = useState(0);
  const [contractCount, setContractCount] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ count }, { data: recentData }, { data: cust }, mCnt, cCnt, tCnt] = await Promise.all([
        supabase.from('mail_attachments').select('id', { count: 'exact', head: true }).eq('customer_id', ctx.customerId).eq('document_type', 'Rechnung'),
        supabase.from('mail_attachments').select('id, file_name, sent_at, created_at, status').eq('customer_id', ctx.customerId).eq('document_type', 'Rechnung').order('created_at', { ascending: false }).limit(3),
        supabase.from('customers').select('external_customer_id, contact_name').eq('id', ctx.customerId).maybeSingle(),
        PORTAL_PHASE >= 2 ? supabase.from('device_maintenance').select('id', { count: 'exact', head: true }).eq('customer_id', ctx.customerId) : Promise.resolve({ count: 0 } as any),
        PORTAL_PHASE >= 2 ? supabase.from('finance_contracts').select('id', { count: 'exact', head: true }).eq('status', 'active') : Promise.resolve({ count: 0 } as any),
        PORTAL_PHASE >= 2 ? supabase.from('customer_portal_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']) : Promise.resolve({ count: 0 } as any),
      ]);
      setTotalInvoices(count ?? 0);
      setRecent((recentData ?? []) as InvoiceRow[]);
      setCustomerNumber(cust?.external_customer_id ?? null);
      setContactName(cust?.contact_name ?? null);
      setDevCount((mCnt as any).count ?? 0);
      setContractCount((cCnt as any).count ?? 0);
      setOpenTickets((tCnt as any).count ?? 0);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Willkommen{ctx.companyName ? `, ${ctx.companyName}` : ''}.</h2>
        <p className="text-muted-foreground text-sm">Ihre Rechnungen und Stammdaten bei Alix Lasers.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Firma" value={ctx.companyName ?? '—'} />
        <InfoCard label="Ansprechpartner" value={contactName ?? '—'} />
        <InfoCard label="Kundennummer" value={customerNumber ?? '—'} mono />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Receipt className="w-4 h-4" />} label="Rechnungen" value={totalInvoices} to="/kunde/rechnungen" />
        {PORTAL_PHASE >= 2 && <StatCard icon={<Cpu className="w-4 h-4" />} label="Geräte" value={devCount} to="/kunde/geraete" />}
        {PORTAL_PHASE >= 2 && <StatCard icon={<FileSignature className="w-4 h-4" />} label="Verträge" value={contractCount} to="/kunde/vertraege" />}
        {PORTAL_PHASE >= 2 && <StatCard icon={<LifeBuoy className="w-4 h-4" />} label="Offene Tickets" value={openTickets} to="/kunde/tickets" />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User2 className="w-4 h-4" /> Meine Daten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Firmen- und Kontaktdaten einsehen oder Änderung mitteilen.</p>
          <Button asChild size="sm" variant="outline"><Link to="/kunde/meine-daten">Stammdaten ansehen</Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Letzte Rechnungen</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aktuell keine Rechnungen hinterlegt.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.sent_at ?? r.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/kunde/rechnungen">Öffnen</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
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

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <div className="mt-1 text-3xl font-semibold">{value}</div>
        <Button asChild size="sm" variant="ghost" className="mt-2 -ml-2 h-auto p-2 text-xs"><Link to={to}>Öffnen →</Link></Button>
      </CardContent>
    </Card>
  );
}
