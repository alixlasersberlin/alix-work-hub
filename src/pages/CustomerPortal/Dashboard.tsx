import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, User2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    (async () => {
      const [{ count }, { data: recentData }, { data: cust }] = await Promise.all([
        supabase
          .from('mail_attachments')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId)
          .eq('document_type', 'Rechnung'),
        supabase
          .from('mail_attachments')
          .select('id, file_name, sent_at, created_at, status')
          .eq('customer_id', ctx.customerId)
          .eq('document_type', 'Rechnung')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('customers')
          .select('external_customer_id, contact_name')
          .eq('id', ctx.customerId)
          .maybeSingle(),
      ]);
      setTotalInvoices(count ?? 0);
      setRecent((recentData ?? []) as InvoiceRow[]);
      setCustomerNumber(cust?.external_customer_id ?? null);
      setContactName(cust?.contact_name ?? null);
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Receipt className="w-4 h-4" /> Rechnungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">gesamt hinterlegte Rechnungen</p>
            <Button asChild size="sm" className="w-full"><Link to="/kunde/rechnungen">Alle Rechnungen öffnen</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><User2 className="w-4 h-4" /> Meine Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Firmen- und Kontaktdaten einsehen oder Änderung mitteilen.</p>
            <Button asChild size="sm" variant="outline" className="w-full"><Link to="/kunde/meine-daten">Stammdaten ansehen</Link></Button>
          </CardContent>
        </Card>
      </div>

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
