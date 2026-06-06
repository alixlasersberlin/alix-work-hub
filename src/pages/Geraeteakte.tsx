import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, FileText, Wrench, Package, Receipt, Inbox, CircleDot } from 'lucide-react';

type Ticket = any; type Repair = any; type Part = any; type Invoice = any;

function Ampel({ status }: { status: 'gruen' | 'gelb' | 'rot' }) {
  const map = {
    gruen: { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Grün – keine offenen Vorgänge' },
    gelb: { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'Gelb – offenes Ticket' },
    rot: { cls: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Rot – mehrere offene Reparaturen' },
  } as const;
  const c = map[status];
  return <Badge variant="outline" className={`gap-1 ${c.cls}`}><CircleDot className="w-3 h-3" /> {c.label}</Badge>;
}

export default function Geraeteakte() {
  const [q, setQ] = useState('');
  const [serial, setSerial] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [serialOptions, setSerialOptions] = useState<{ serial: string; label?: string; customer?: string }[]>([]);

  async function search() {
    if (!q.trim()) return;
    const like = `%${q.trim()}%`;
    const [tk, rp] = await Promise.all([
      supabase.from('tickets')
        .select('serial_number,device_name,customer_name,order_number')
        .or(`serial_number.ilike.${like},customer_name.ilike.${like},order_number.ilike.${like},device_name.ilike.${like}`)
        .not('serial_number', 'is', null).limit(50),
      supabase.from('repair_orders')
        .select('device_serial_number,device_brand,device_model,customer_name,order_number')
        .or(`device_serial_number.ilike.${like},customer_name.ilike.${like},order_number.ilike.${like},device_brand.ilike.${like},device_model.ilike.${like}`)
        .not('device_serial_number', 'is', null).limit(50),
    ]);
    const seen = new Map<string, any>();
    (tk.data || []).forEach((r: any) => seen.set(r.serial_number, { serial: r.serial_number, label: r.device_name, customer: r.customer_name }));
    (rp.data || []).forEach((r: any) => {
      if (!seen.has(r.device_serial_number)) {
        seen.set(r.device_serial_number, { serial: r.device_serial_number, label: [r.device_brand, r.device_model].filter(Boolean).join(' '), customer: r.customer_name });
      }
    });
    setSerialOptions(Array.from(seen.values()));
  }

  async function loadSerial(s: string) {
    setSerial(s); setLoading(true);
    const [tk, rp] = await Promise.all([
      supabase.from('tickets').select('*').eq('serial_number', s).order('created_at', { ascending: false }),
      supabase.from('repair_orders').select('*').eq('device_serial_number', s).order('created_at', { ascending: false }),
    ]);
    setTickets(tk.data || []);
    setRepairs(rp.data || []);
    const repairIds = (rp.data || []).map((r: any) => r.id);
    if (repairIds.length) {
      const [pa, iv] = await Promise.all([
        supabase.from('repair_spare_parts').select('*').in('repair_order_id', repairIds).order('created_at', { ascending: false }),
        supabase.from('repair_invoice_proposals').select('*').in('repair_order_id', repairIds).order('created_at', { ascending: false }),
      ]);
      setParts(pa.data || []);
      setInvoices(iv.data || []);
    } else {
      setParts([]); setInvoices([]);
    }
    setLoading(false);
  }

  const ampel: 'gruen' | 'gelb' | 'rot' = useMemo(() => {
    const openRepairs = repairs.filter((r) => !['Ausgeliefert', 'Storniert'].includes(r.repair_status)).length;
    const openTickets = tickets.filter((t) => !['geschlossen', 'closed', 'gelöst'].includes((t.status || '').toLowerCase())).length;
    if (openRepairs >= 2) return 'rot';
    if (openTickets > 0 || openRepairs > 0) return 'gelb';
    return 'gruen';
  }, [tickets, repairs]);

  const wartungen = useMemo(() => repairs.filter((r) => /wartung|inspektion|maintenance/i.test((r.device_category || '') + ' ' + (r.issue_description || ''))), [repairs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Geräteakte</h1>
        <Badge variant="outline">Service · Reparatur · Finance</Badge>
      </div>

      <Card className="p-4 space-y-3">
        <Label className="text-xs">Suche (Seriennummer, Kunde, Auftrag, Gerät)</Label>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="z. B. SN-1234 / Mustermann GmbH / OR-00012" />
          <Button onClick={search}><Search className="w-4 h-4 mr-1" /> Suchen</Button>
        </div>

        {serialOptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {serialOptions.map((o) => (
              <button key={o.serial} onClick={() => loadSerial(o.serial)} className="text-left p-3 rounded border border-border hover:border-primary transition">
                <div className="font-mono text-sm font-semibold">{o.serial}</div>
                <div className="text-xs text-muted-foreground">{o.label || '–'}</div>
                <div className="text-xs text-muted-foreground">{o.customer || '–'}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {serial && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Seriennummer</div>
              <div className="font-mono text-lg font-bold">{serial}</div>
            </div>
            <Ampel status={ampel} />
          </div>

          <Tabs defaultValue="tickets">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="tickets"><Inbox className="w-3 h-3 mr-1" /> Tickets ({tickets.length})</TabsTrigger>
              <TabsTrigger value="repairs"><Wrench className="w-3 h-3 mr-1" /> Reparaturen ({repairs.length})</TabsTrigger>
              <TabsTrigger value="parts"><Package className="w-3 h-3 mr-1" /> Ersatzteile ({parts.length})</TabsTrigger>
              <TabsTrigger value="invoices"><Receipt className="w-3 h-3 mr-1" /> Rechnungen ({invoices.length})</TabsTrigger>
              <TabsTrigger value="maintenance">Wartungen ({wartungen.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tickets">
              <ListBlock loading={loading} rows={tickets} cols={[
                { k: 'created_at', l: 'Datum', f: (v) => new Date(v).toLocaleDateString('de-DE') },
                { k: 'title', l: 'Titel' },
                { k: 'status', l: 'Status' },
                { k: 'priority', l: 'Priorität' },
                { k: 'auto_category', l: 'Kategorie' },
              ]} linkBase="/tickets/" />
            </TabsContent>
            <TabsContent value="repairs">
              <ListBlock loading={loading} rows={repairs} cols={[
                { k: 'created_at', l: 'Datum', f: (v) => new Date(v).toLocaleDateString('de-DE') },
                { k: 'repair_number', l: 'Nr.' },
                { k: 'device_brand', l: 'Marke' },
                { k: 'device_model', l: 'Modell' },
                { k: 'repair_status', l: 'Status' },
              ]} linkBase="/reparatur/auftraege/" />
            </TabsContent>
            <TabsContent value="parts">
              <ListBlock loading={loading} rows={parts} cols={[
                { k: 'created_at', l: 'Datum', f: (v) => new Date(v).toLocaleDateString('de-DE') },
                { k: 'part_name', l: 'Teil' },
                { k: 'quantity', l: 'Menge' },
                { k: 'status', l: 'Status' },
                { k: 'priority', l: 'Priorität' },
              ]} />
            </TabsContent>
            <TabsContent value="invoices">
              <ListBlock loading={loading} rows={invoices} cols={[
                { k: 'created_at', l: 'Datum', f: (v) => new Date(v).toLocaleDateString('de-DE') },
                { k: 'repair_number', l: 'Reparatur' },
                { k: 'total_amount', l: 'Summe', f: (v, r) => `${Number(v || 0).toFixed(2)} ${r.currency || 'EUR'}` },
                { k: 'status', l: 'Status' },
              ]} />
            </TabsContent>
            <TabsContent value="maintenance">
              <ListBlock loading={loading} rows={wartungen} cols={[
                { k: 'created_at', l: 'Datum', f: (v) => new Date(v).toLocaleDateString('de-DE') },
                { k: 'repair_number', l: 'Nr.' },
                { k: 'issue_description', l: 'Beschreibung' },
                { k: 'repair_status', l: 'Status' },
              ]} linkBase="/reparatur/auftraege/" />
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}

function ListBlock({ rows, cols, loading, linkBase }: { rows: any[]; cols: { k: string; l: string; f?: (v: any, r: any) => string }[]; loading: boolean; linkBase?: string }) {
  if (loading) return <div className="p-6 text-center text-muted-foreground text-sm">Lade…</div>;
  if (!rows.length) return <div className="p-6 text-center text-muted-foreground text-sm">Keine Einträge.</div>;
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            {cols.map((c) => <th key={c.k} className="py-2 pr-3">{c.l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const content = cols.map((c) => <td key={c.k} className="py-2 pr-3">{c.f ? c.f(r[c.k], r) : (r[c.k] ?? '–')}</td>);
            return (
              <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                {linkBase ? (
                  <td colSpan={cols.length} className="p-0"><Link to={linkBase + r.id} className="grid items-center py-0" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>{content}</Link></td>
                ) : content}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
