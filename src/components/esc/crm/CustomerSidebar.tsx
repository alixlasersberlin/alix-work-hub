import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Wrench, FileText, Receipt, Ticket as TicketIcon, GraduationCap, Files, Clock } from 'lucide-react';
import { useCustomerContext } from '@/hooks/esc/useCustomerContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const fmt = (v: string | null | undefined) => v ? format(new Date(v), 'dd.MM.yyyy', { locale: de }) : '—';

export function CustomerSidebar({ customerId }: { customerId: string | null | undefined }) {
  const { data, loading, error } = useCustomerContext(customerId);

  if (!customerId) {
    return (
      <aside className="w-full lg:w-[380px] shrink-0 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <User className="h-5 w-5 mb-2 text-muted-foreground" />
        Kein Kunde ausgewählt. Nutze die Live-Suche im Kunden-Tab.
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="w-full lg:w-[380px] shrink-0 rounded-lg border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> CRM-Daten werden geladen…
      </aside>
    );
  }

  if (error || !data) {
    return (
      <aside className="w-full lg:w-[380px] shrink-0 rounded-lg border bg-destructive/10 p-4 text-xs text-destructive">
        Fehler beim Laden: {error || 'Kein Kunde gefunden'}
      </aside>
    );
  }

  const { customer, devices, offers, invoices, tickets, services, trainings, documents, timeline } = data;
  const openInvoices = invoices.filter((i) => !i.paid);

  return (
    <aside className="w-full lg:w-[380px] shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
      <div className="p-4 border-b bg-muted/30">
        <div className="text-sm font-semibold truncate">{customer.companyName}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {customer.customerNumber ? `#${customer.customerNumber} · ` : ''}{customer.contactPerson || ''}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {customer.group && <Badge variant="secondary" className="text-[10px]">{customer.group}</Badge>}
          {customer.country && <Badge variant="outline" className="text-[10px]">{customer.country}</Badge>}
          {customer.sourceSystem && <Badge variant="outline" className="text-[10px]">{customer.sourceSystem}</Badge>}
        </div>
      </div>

      <Tabs defaultValue="stamm" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b h-9 px-2 overflow-x-auto flex-nowrap">
          <TabsTrigger value="stamm" className="text-[11px]"><User className="h-3 w-3 mr-1" />Stamm</TabsTrigger>
          <TabsTrigger value="devices" className="text-[11px]"><Wrench className="h-3 w-3 mr-1" />Geräte</TabsTrigger>
          <TabsTrigger value="offers" className="text-[11px]"><FileText className="h-3 w-3 mr-1" />Angebote</TabsTrigger>
          <TabsTrigger value="invoices" className="text-[11px]"><Receipt className="h-3 w-3 mr-1" />Rechn.</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[11px]"><TicketIcon className="h-3 w-3 mr-1" />Tickets</TabsTrigger>
          <TabsTrigger value="service" className="text-[11px]"><Wrench className="h-3 w-3 mr-1" />Service</TabsTrigger>
          <TabsTrigger value="training" className="text-[11px]"><GraduationCap className="h-3 w-3 mr-1" />Schul.</TabsTrigger>
          <TabsTrigger value="docs" className="text-[11px]"><Files className="h-3 w-3 mr-1" />Docs</TabsTrigger>
          <TabsTrigger value="timeline" className="text-[11px]"><Clock className="h-3 w-3 mr-1" />Timeline</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="stamm" className="p-4 space-y-1 text-xs">
            <Row label="Firma" value={customer.companyName} />
            <Row label="Ansprechpartner" value={customer.contactPerson} />
            <Row label="Telefon" value={customer.phone} />
            <Row label="Mobil" value={customer.mobile} />
            <Row label="E-Mail" value={customer.email} />
            <Row label="Adresse" value={[customer.address, customer.postalCode, customer.city].filter(Boolean).join(', ')} />
            <Row label="Land" value={customer.country} />
            <Row label="Kundengruppe" value={customer.group} />
            <Row label="Vertrieb" value={customer.salesRep} />
          </TabsContent>

          <TabsContent value="devices" className="p-3 space-y-2">
            {devices.length === 0 && <Empty text="Keine Geräte hinterlegt" />}
            {devices.map((d) => (
              <div key={d.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{d.model || 'Gerät'}</div>
                  {d.status && <Badge variant="outline" className="text-[10px]">{d.status}</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">SN {d.serialNumber || '—'}</div>
                <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] text-muted-foreground">
                  <span>Install: {fmt(d.installedAt)}</span>
                  <span>Garantie: {fmt(d.warrantyUntil)}</span>
                  <span>Letzt. Service: {fmt(d.lastServiceAt)}</span>
                  <span>Nächst. Service: {fmt(d.nextServiceAt)}</span>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="offers" className="p-3 space-y-2">
            {offers.length === 0 && <Empty text="Keine Angebote" />}
            {offers.map((o) => (
              <ListLine key={o.id} title={o.number || 'Angebot'} status={o.status} right={o.total ? `${o.total} ${o.currency || ''}` : ''} at={o.createdAt} />
            ))}
          </TabsContent>

          <TabsContent value="invoices" className="p-3 space-y-2">
            {invoices.length === 0 && <Empty text="Keine Rechnungen" />}
            {openInvoices.length > 0 && (
              <div className="text-[10px] text-amber-600 uppercase tracking-wide">{openInvoices.length} offen</div>
            )}
            {invoices.map((i) => (
              <ListLine key={i.id} title={i.number || 'Rechnung'} status={i.status} right={i.total ? `${i.total} ${i.currency || ''}` : ''} at={i.dueDate} />
            ))}
          </TabsContent>

          <TabsContent value="tickets" className="p-3 space-y-2">
            {tickets.length === 0 && <Empty text="Keine Tickets" />}
            {tickets.map((t) => (
              <ListLine key={t.id} title={t.subject || t.number || 'Ticket'} status={t.status} right={t.priority || ''} at={t.createdAt} />
            ))}
          </TabsContent>

          <TabsContent value="service" className="p-3 space-y-2">
            {services.length === 0 && <Empty text="Keine Servicehistorie" />}
            {services.map((s) => (
              <ListLine key={s.id} title={s.title} status={s.status} right={s.kind} at={s.at} />
            ))}
          </TabsContent>

          <TabsContent value="training" className="p-3 space-y-2">
            {trainings.length === 0 && <Empty text="Keine Schulungen" />}
            {trainings.map((t) => (
              <ListLine key={t.id} title={t.title} status={t.status} right={t.nisv ? 'NiSV' : ''} at={t.at} />
            ))}
          </TabsContent>

          <TabsContent value="docs" className="p-3 space-y-2">
            {documents.length === 0 && <Empty text="Keine Dokumente" />}
            {documents.map((d) => (
              <ListLine key={d.id} title={d.name} status={d.kind} right="" at={d.createdAt} />
            ))}
          </TabsContent>

          <TabsContent value="timeline" className="p-3 space-y-2">
            {timeline.length === 0 && <Empty text="Keine Aktivitäten" />}
            {timeline.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-xs">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium truncate">{e.title}</span>
                    <span className="text-[10px] text-muted-foreground">{fmt(e.at)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{e.kind}{e.meta ? ` · ${e.meta}` : ''}</div>
                </div>
              </div>
            ))}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate max-w-[60%] text-right">{value || '—'}</span>
    </div>
  );
}

function ListLine({ title, status, right, at }: { title: string; status?: string | null; right?: string | null; at?: string | null }) {
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{title}</span>
        {right && <span className="text-[10px] text-muted-foreground shrink-0">{right}</span>}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>{status || ''}</span>
        <span>{fmt(at)}</span>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{text}</div>;
}
