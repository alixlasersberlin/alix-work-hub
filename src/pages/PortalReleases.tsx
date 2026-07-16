import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, FileSignature, FileText, MessageSquare, Wrench, Shield } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { toast } from 'sonner';

type Row = Record<string, any>;

function useTable(table: string, select: string, order = 'created_at') {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table as any).select(select).order(order, { ascending: false }).limit(200);
    if (error) toast.error(`${table}: ${error.message}`);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, [table]);
  return { rows, loading, reload };
}

function VisibilityToggle({ table, id, value, onChanged }: { table: string; id: string; value: boolean; onChanged?: (v: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Switch
      checked={value}
      disabled={busy}
      onCheckedChange={async (v) => {
        setBusy(true);
        const { error } = await supabase.from(table as any).update({ customer_visible: v }).eq('id', id);
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success(v ? 'Für Kunde freigegeben.' : 'Freigabe entzogen.');
        onChanged?.(v);
      }}
    />
  );
}

export default function PortalReleases() {
  const [q, setQ] = useState('');

  const offers = useTable('offers', 'id, offer_number, status, customer_visible, portal_version, total_gross, customer_id, customers(company_name)');
  const contracts = useTable('finance_contracts', 'id, contract_number, contract_type, status, signature_status, customer_visible, contract_version, customer_id, customers(company_name)');
  const docs = useTable('customer_portal_documents', 'id, title, kind, customer_visible, customer_id, created_at, customers(company_name)');
  const signatures = useTable('customer_portal_contract_signatures', 'id, contract_id, contract_version, signed_by_name, signed_by_role, ip_address, signed_at, customer_id, customers(company_name)', 'signed_at');
  const acceptances = useTable('customer_portal_offer_acceptances', 'id, offer_id, offer_version, action, accepted_by_name, decline_reason, created_at, customer_id, customers(company_name)');
  const dataRequests = useTable('customer_portal_data_requests', 'id, kind, status, note, created_at, customer_id, customers(company_name)');
  const maintenance = useTable('customer_portal_maintenance_requests', 'id, kind, status, description, preferred_date, created_at, customer_id, customers(company_name)');

  const filter = (r: Row) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return JSON.stringify(r).toLowerCase().includes(s);
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={ShieldCheck}
        title="Portal-Freigaben"
        subtitle="Angebote, Verträge und Dokumente für das Kundenportal freigeben und Signaturen / DSGVO-Anfragen überwachen."
        noBreadcrumbs
      />

      <div className="mb-4 max-w-sm">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche (Nummer, Kunde, Status)..." className="bg-secondary border-border" />
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="offers"><FileText className="w-4 h-4 mr-1" />Angebote</TabsTrigger>
          <TabsTrigger value="contracts"><FileSignature className="w-4 h-4 mr-1" />Verträge</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="w-4 h-4 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="signatures"><FileSignature className="w-4 h-4 mr-1" />Signaturen</TabsTrigger>
          <TabsTrigger value="acceptances"><MessageSquare className="w-4 h-4 mr-1" />Angebots-Aktionen</TabsTrigger>
          <TabsTrigger value="maintenance"><Wrench className="w-4 h-4 mr-1" />Wartungsanfragen</TabsTrigger>
          <TabsTrigger value="privacy"><Shield className="w-4 h-4 mr-1" />DSGVO</TabsTrigger>
        </TabsList>

        <TabsContent value="offers">
          <ListCard loading={offers.loading} rows={offers.rows.filter(filter)}
            columns={['Nr.', 'Kunde', 'Status', 'v', 'Brutto', 'Freigabe']}
            row={(r) => [
              <span className="font-mono text-xs">{r.offer_number}</span>,
              r.customers?.company_name ?? '—',
              <Badge variant="outline">{r.status ?? '—'}</Badge>,
              r.portal_version ?? 1,
              r.total_gross != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(r.total_gross) : '—',
              <VisibilityToggle table="offers" id={r.id} value={!!r.customer_visible} onChanged={offers.reload} />,
            ]} />
        </TabsContent>

        <TabsContent value="contracts">
          <ListCard loading={contracts.loading} rows={contracts.rows.filter(filter)}
            columns={['Nr.', 'Kunde', 'Typ', 'Signatur', 'v', 'Freigabe']}
            row={(r) => [
              <span className="font-mono text-xs">{r.contract_number ?? '—'}</span>,
              r.customers?.company_name ?? '—',
              r.contract_type ?? '—',
              <Badge variant={r.signature_status === 'signed' ? 'default' : 'outline'}>{r.signature_status ?? '—'}</Badge>,
              r.contract_version ?? 1,
              <VisibilityToggle table="finance_contracts" id={r.id} value={!!r.customer_visible} onChanged={contracts.reload} />,
            ]} />
        </TabsContent>

        <TabsContent value="docs">
          <ListCard loading={docs.loading} rows={docs.rows.filter(filter)}
            columns={['Titel', 'Kunde', 'Art', 'Erstellt', 'Freigabe']}
            row={(r) => [
              r.title, r.customers?.company_name ?? '—', r.kind ?? '—',
              new Date(r.created_at).toLocaleDateString('de-DE'),
              <VisibilityToggle table="customer_portal_documents" id={r.id} value={!!r.customer_visible} onChanged={docs.reload} />,
            ]} />
        </TabsContent>

        <TabsContent value="signatures">
          <ListCard loading={signatures.loading} rows={signatures.rows.filter(filter)}
            columns={['Datum', 'Kunde', 'Vertrag', 'v', 'Von', 'IP']}
            row={(r) => [
              new Date(r.signed_at).toLocaleString('de-DE'),
              r.customers?.company_name ?? '—',
              <span className="font-mono text-xs">{String(r.contract_id).slice(0, 8)}…</span>,
              r.contract_version,
              `${r.signed_by_name}${r.signed_by_role ? ' · ' + r.signed_by_role : ''}`,
              <span className="text-xs text-muted-foreground">{r.ip_address ?? '—'}</span>,
            ]} />
        </TabsContent>

        <TabsContent value="acceptances">
          <ListCard loading={acceptances.loading} rows={acceptances.rows.filter(filter)}
            columns={['Datum', 'Kunde', 'Angebot', 'v', 'Aktion', 'Details']}
            row={(r) => [
              new Date(r.created_at).toLocaleString('de-DE'),
              r.customers?.company_name ?? '—',
              <span className="font-mono text-xs">{String(r.offer_id).slice(0, 8)}…</span>,
              r.offer_version,
              <Badge variant={r.action === 'accepted' ? 'default' : 'outline'}>{r.action}</Badge>,
              r.action === 'declined' ? (r.decline_reason ?? '—') : r.accepted_by_name,
            ]} />
        </TabsContent>

        <TabsContent value="maintenance">
          <ListCard loading={maintenance.loading} rows={maintenance.rows.filter(filter)}
            columns={['Datum', 'Kunde', 'Art', 'Wunsch', 'Status', 'Beschreibung']}
            row={(r) => [
              new Date(r.created_at).toLocaleDateString('de-DE'),
              r.customers?.company_name ?? '—',
              r.kind,
              r.preferred_date ? new Date(r.preferred_date).toLocaleDateString('de-DE') : '—',
              <Badge variant="outline">{r.status}</Badge>,
              <span className="text-xs line-clamp-2 max-w-md">{r.description}</span>,
            ]} />
        </TabsContent>

        <TabsContent value="privacy">
          <ListCard loading={dataRequests.loading} rows={dataRequests.rows.filter(filter)}
            columns={['Datum', 'Kunde', 'Art', 'Status', 'Notiz']}
            row={(r) => [
              new Date(r.created_at).toLocaleString('de-DE'),
              r.customers?.company_name ?? '—',
              <Badge>{r.kind}</Badge>,
              <Badge variant="outline">{r.status}</Badge>,
              <span className="text-xs line-clamp-2 max-w-md">{r.note ?? '—'}</span>,
            ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListCard({ loading, rows, columns, row }: { loading: boolean; rows: Row[]; columns: string[]; row: (r: Row) => React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{rows.length} Einträge</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Keine Einträge.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>{columns.map((c) => <th key={c} className="text-left px-3 py-2">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                    {row(r).map((cell, i) => <td key={i} className="px-3 py-2 align-top">{cell as any}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
