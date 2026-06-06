import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Wrench, Inbox, Calendar, Clock, Users, Cpu, AlertTriangle,
  CheckCircle2, Package, Receipt, Target, FileDown, Sheet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CLOSED_STATUSES = ['geschlossen', 'closed', 'gelöst'];
const SLA_HOURS = 48;
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#a855f7', '#ef4444', '#22d3ee', '#84cc16'];

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function startOfMonth(d = new Date()) { const x = startOfDay(d); x.setDate(1); return x; }

export default function ServiceCockpit() {
  const { hasRole } = useAuth() as any;
  const allowed = hasRole?.('Super Admin') || hasRole?.('Admin') || hasRole?.('Serviceleitung');

  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [filterTech, setFilterTech] = useState<string>('all');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('');

  const [tickets, setTickets] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [spareReq, setSpareReq] = useState<any[]>([]);
  const [invoiceProps, setInvoiceProps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoading(true);
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(new Date(to).getTime() + 86400000 - 1).toISOString();
      const [tk, rp, sp, ip, up] = await Promise.all([
        supabase.from('tickets').select('id,title,status,priority,device_name,customer_name,assigned_to,created_at,updated_at,repair_order_id').gte('created_at', fromIso).lte('created_at', toIso).limit(5000),
        supabase.from('repair_orders').select('id,repair_status,device_brand,device_model,device_category,customer_name,created_at,ticket_id').gte('created_at', fromIso).lte('created_at', toIso).limit(5000),
        supabase.from('repair_spare_parts').select('id,repair_order_id,status,created_at').gte('created_at', fromIso).lte('created_at', toIso).limit(5000),
        supabase.from('repair_invoice_proposals').select('id,status,total_amount,currency,created_at').limit(5000),
        supabase.from('user_profiles').select('id,full_name,email').limit(500),
      ]);
      setTickets(tk.data || []);
      setRepairs(rp.data || []);
      setSpareReq(sp.data || []);
      setInvoiceProps(ip.data || []);
      setUsers(up.data || []);
      setLoading(false);
    })();
  }, [from, to, allowed]);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.full_name || u.email || '–'])), [users]);

  const filteredTickets = useMemo(() => tickets.filter((t) => {
    if (filterTech !== 'all' && t.assigned_to !== filterTech) return false;
    if (filterDevice !== 'all' && (t.device_name || '–') !== filterDevice) return false;
    if (filterCustomer && !(t.customer_name || '').toLowerCase().includes(filterCustomer.toLowerCase())) return false;
    return true;
  }), [tickets, filterTech, filterDevice, filterCustomer]);

  // KPIs
  const now = new Date();
  const today0 = startOfDay(now).getTime();
  const week0 = startOfWeek(now).getTime();
  const month0 = startOfMonth(now).getTime();
  const isClosed = (s: string) => CLOSED_STATUSES.includes(s);

  const openTickets = filteredTickets.filter((t) => !isClosed(t.status)).length;
  const newToday = filteredTickets.filter((t) => new Date(t.created_at).getTime() >= today0).length;
  const newWeek = filteredTickets.filter((t) => new Date(t.created_at).getTime() >= week0).length;
  const newMonth = filteredTickets.filter((t) => new Date(t.created_at).getTime() >= month0).length;

  const closedTickets = filteredTickets.filter((t) => isClosed(t.status));
  const avgHours = closedTickets.length
    ? closedTickets.reduce((acc, t) => acc + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0) / closedTickets.length / 3600000
    : 0;

  const slaPct = closedTickets.length
    ? (closedTickets.filter((t) => (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 3600000 <= SLA_HOURS).length / closedTickets.length) * 100
    : 0;

  const repairQuote = filteredTickets.length
    ? (filteredTickets.filter((t) => !!t.repair_order_id).length / filteredTickets.length) * 100
    : 0;

  const repairIdsInRange = new Set(repairs.map((r) => r.id));
  const repairsWithParts = new Set(spareReq.map((s) => s.repair_order_id).filter((id) => repairIdsInRange.has(id)));
  const sparePartQuote = repairs.length ? (repairsWithParts.size / repairs.length) * 100 : 0;

  const openInvoiceCount = invoiceProps.filter((i) => i.status === 'offen').length;
  const openInvoiceSum = invoiceProps.filter((i) => i.status === 'offen').reduce((a, b) => a + Number(b.total_amount || 0), 0);

  // Aggregations
  const techData = useMemo(() => {
    const m = new Map<string, number>();
    filteredTickets.forEach((t) => {
      const k = t.assigned_to || 'unassigned';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m, ([id, count]) => ({ name: id === 'unassigned' ? 'Nicht zugewiesen' : (userMap[id] || id.slice(0, 8)), count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredTickets, userMap]);

  const deviceData = useMemo(() => {
    const m = new Map<string, number>();
    filteredTickets.forEach((t) => { const k = t.device_name || '–'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredTickets]);

  const errorData = useMemo(() => {
    const m = new Map<string, number>();
    filteredTickets.forEach((t) => { const k = (t.title || '–').slice(0, 60); m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredTickets]);

  // Erweiterungen: Top Kunden, Garantiequote, Ø Reparaturdauer
  const customerData = useMemo(() => {
    const m = new Map<string, number>();
    filteredTickets.forEach((t) => { const k = t.customer_name || '–'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredTickets]);

  const warrantyPct = useMemo(() => {
    if (!filteredTickets.length) return 0;
    const w = filteredTickets.filter((t: any) => (t.auto_category || '').toLowerCase() === 'garantie').length;
    return (w / filteredTickets.length) * 100;
  }, [filteredTickets]);

  const avgRepairDays = useMemo(() => {
    const done = repairs.filter((r: any) => r.repair_status === 'Ausgeliefert' || r.repair_status === 'Reparatur abgeschlossen');
    if (!done.length) return 0;
    const sum = done.reduce((acc: number, r: any) => acc + (new Date(r.updated_at || r.created_at).getTime() - new Date(r.created_at).getTime()), 0);
    return sum / done.length / 86400000;
  }, [repairs]);

  // Filter options
  const techOptions = useMemo(() => {
    const ids = Array.from(new Set(tickets.map((t) => t.assigned_to).filter(Boolean)));
    return ids.map((id) => ({ id, name: userMap[id] || (id as string).slice(0, 8) }));
  }, [tickets, userMap]);
  const deviceOptions = useMemo(() => Array.from(new Set(tickets.map((t) => t.device_name).filter(Boolean))) as string[], [tickets]);

  // Exports
  const buildExportRows = () => ({
    kpis: [
      ['Kennzahl', 'Wert'],
      ['Offene Tickets', openTickets],
      ['Neu heute', newToday],
      ['Neu diese Woche', newWeek],
      ['Neu diesen Monat', newMonth],
      ['Ø Bearbeitungszeit (h)', avgHours.toFixed(1)],
      ['SLA Einhaltung (%)', slaPct.toFixed(1)],
      ['Reparaturquote (%)', repairQuote.toFixed(1)],
      ['Ersatzteilquote (%)', sparePartQuote.toFixed(1)],
      ['Offene Rechnungsvorschläge', openInvoiceCount],
      ['Offene Rechnungssumme (EUR)', openInvoiceSum.toFixed(2)],
      ['Garantiequote (%)', warrantyPct.toFixed(1)],
      ['Ø Reparaturdauer (Tage)', avgRepairDays.toFixed(1)],
    ],
    techniker: [['Techniker', 'Tickets'], ...techData.map((d) => [d.name, d.count])],
    geraete: [['Gerät', 'Tickets'], ...deviceData.map((d) => [d.name, d.count])],
    fehler: [['Fehler / Titel', 'Anzahl'], ...errorData.map((d) => [d.name, d.count])],
    kunden: [['Kunde', 'Tickets'], ...customerData.map((d) => [d.name, d.count])],
  });

  const exportExcel = () => {
    const { kpis, techniker, geraete, fehler } = buildExportRows();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpis), 'KPIs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(techniker), 'Techniker');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(geraete), 'Geräte');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fehler), 'Fehler');
    XLSX.writeFile(wb, `service-cockpit_${from}_${to}.xlsx`);
  };

  const exportPdf = () => {
    const { kpis, techniker, geraete, fehler } = buildExportRows();
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Service Cockpit', 14, 16);
    doc.setFontSize(10); doc.text(`Zeitraum: ${from} – ${to}`, 14, 23);
    autoTable(doc, { head: [kpis[0] as any], body: kpis.slice(1) as any, startY: 28, theme: 'striped' });
    autoTable(doc, { head: [techniker[0] as any], body: techniker.slice(1) as any, startY: (doc as any).lastAutoTable.finalY + 6, theme: 'striped', headStyles: { fillColor: [16, 185, 129] } });
    autoTable(doc, { head: [geraete[0] as any], body: geraete.slice(1) as any, startY: (doc as any).lastAutoTable.finalY + 6, theme: 'striped', headStyles: { fillColor: [59, 130, 246] } });
    autoTable(doc, { head: [fehler[0] as any], body: fehler.slice(1) as any, startY: (doc as any).lastAutoTable.finalY + 6, theme: 'striped', headStyles: { fillColor: [239, 68, 68] } });
    doc.save(`service-cockpit_${from}_${to}.pdf`);
  };

  if (!allowed) {
    return <Card className="p-8 text-center text-muted-foreground">Kein Zugriff. Service Cockpit ist nur für Super Admin, Admin und Serviceleitung.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-3">
        <Wrench className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold">Service Cockpit</h1>
        <Badge variant="outline" className="ml-2">Reparatur · Tickets · Finance</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><Sheet className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Von</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Bis</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Techniker</Label>
            <Select value={filterTech} onValueChange={setFilterTech}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {techOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Gerät</Label>
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {deviceOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Kunde</Label>
            <Input placeholder="Kunde suchen…" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Lade…</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Kpi icon={Inbox} color="text-amber-400" label="Offen" value={openTickets} />
            <Kpi icon={Calendar} color="text-emerald-400" label="Neu heute" value={newToday} />
            <Kpi icon={Calendar} color="text-emerald-300" label="Diese Woche" value={newWeek} />
            <Kpi icon={Calendar} color="text-emerald-200" label="Diesen Monat" value={newMonth} />
            <Kpi icon={Clock} color="text-blue-400" label="Ø Bearbeitung" value={`${avgHours.toFixed(1)} h`} />
            <Kpi icon={Target} color="text-cyan-400" label={`SLA ≤${SLA_HOURS}h`} value={`${slaPct.toFixed(0)} %`} />
            <Kpi icon={CheckCircle2} color="text-emerald-400" label="Reparaturquote" value={`${repairQuote.toFixed(0)} %`} />
            <Kpi icon={Package} color="text-purple-400" label="Ersatzteilquote" value={`${sparePartQuote.toFixed(0)} %`} />
            <Kpi icon={Receipt} color="text-pink-400" label="Rechnungen offen" value={openInvoiceCount} sub={`${openInvoiceSum.toFixed(0)} €`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Tickets nach Techniker" icon={Users}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={techData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="name" stroke="#888" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tickets nach Gerät" icon={Cpu}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deviceData} dataKey="count" nameKey="name" outerRadius={100} label>
                    {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Häufigste Fehler" icon={AlertTriangle} full>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={errorData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} width={220} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Bar dataKey="count" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }: any) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`w-4 h-4 ${color}`} /> {label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function ChartCard({ title, icon: Icon, children, full }: any) {
  return (
    <Card className={`p-4 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><Icon className="w-4 h-4 text-primary" /> {title}</div>
      {children}
    </Card>
  );
}
