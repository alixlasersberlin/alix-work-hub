import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, Mail, MousePointerClick, FileText, CheckCircle2, Euro,
  Users, Flame, Sparkles, Download, RefreshCw, Trophy, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface KPI { label: string; value: string | number; icon: any; hint?: string }

function fmtEUR(n: number) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0); }

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  async function load() {
    setLoading(true);

    // Mail metrics
    const [msgs, evts, campaignsData, ordersData] = await Promise.all([
      supabase.from('mail_messages').select('id,status,opened_at,clicked_at,created_by,to_email,subject,customer_id,created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('mail_events').select('id,event_type,message_id,created_at').limit(2000),
      supabase.from('mail_campaigns').select('id,name,status,created_at').limit(100),
      supabase.from('orders').select('id,customer_id,total_amount,order_status,salesperson_name,created_at,order_date').order('created_at', { ascending: false }).limit(2000),
    ]);

    const messages = msgs.data || [];
    const events = evts.data || [];
    const orders = ordersData.data || [];

    const sent = messages.filter((m: any) => m.status === 'sent' || m.sent_at).length || messages.length;
    const opened = messages.filter((m: any) => m.opened_at).length;
    const clicked = messages.filter((m: any) => m.clicked_at).length;
    const offerSent = messages.filter((m: any) => /angebot|offer|quote/i.test(m.subject || '')).length;
    const orderTotal = orders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    const paidOrders = orders.filter((o: any) => /bezahlt|paid|geliefert/i.test(o.order_status || '')).length;

    // Customers reached by mail with subsequent order
    const customersMailed = new Set(messages.map((m: any) => m.customer_id).filter(Boolean));
    const mailDrivenRevenue = orders
      .filter((o: any) => customersMailed.has(o.customer_id))
      .reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

    setKpis([
      { label: 'Versendete E-Mails', value: sent, icon: Mail },
      { label: 'Öffnungsrate', value: sent ? `${((opened / sent) * 100).toFixed(1)}%` : '—', icon: TrendingUp },
      { label: 'Klickrate', value: sent ? `${((clicked / sent) * 100).toFixed(1)}%` : '—', icon: MousePointerClick },
      { label: 'Angebote versendet', value: offerSent, icon: FileText },
      { label: 'Bezahlte Aufträge', value: paidOrders, icon: CheckCircle2 },
      { label: 'Umsatz gesamt', value: fmtEUR(orderTotal), icon: Euro },
      { label: 'Umsatz aus E-Mail-Kontakten', value: fmtEUR(mailDrivenRevenue), icon: Sparkles, hint: 'Kunden mit E-Mail-Historie' },
      { label: 'Aktive Kampagnen', value: (campaignsData.data || []).filter((c: any) => c.status === 'active' || c.status === 'sent').length, icon: Trophy },
    ]);

    // Campaigns with revenue (best effort: by created_at window)
    const camps = (campaignsData.data || []).map((c: any) => {
      const since = new Date(c.created_at);
      const rev = orders.filter((o: any) => new Date(o.created_at) >= since).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
      return { ...c, revenue: rev, opens: 0, clicks: 0 };
    });
    setCampaigns(camps);

    // Staff performance
    const byUser: Record<string, any> = {};
    messages.forEach((m: any) => {
      const k = m.created_by || 'unbekannt';
      byUser[k] = byUser[k] || { user_id: k, sent: 0, opened: 0, replies: 0, orders: 0, revenue: 0 };
      byUser[k].sent++;
      if (m.opened_at) byUser[k].opened++;
    });
    orders.forEach((o: any) => {
      const k = o.salesperson_name || 'unbekannt';
      byUser[k] = byUser[k] || { user_id: k, sent: 0, opened: 0, replies: 0, orders: 0, revenue: 0 };
      byUser[k].orders++;
      byUser[k].revenue += Number(o.total_amount || 0);
    });
    setStaff(Object.values(byUser).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 20));

    // Customer score
    const byCust: Record<string, any> = {};
    messages.forEach((m: any) => {
      if (!m.customer_id) return;
      byCust[m.customer_id] = byCust[m.customer_id] || { customer_id: m.customer_id, opens: 0, clicks: 0, orders: 0, revenue: 0, score: 0 };
      if (m.opened_at) byCust[m.customer_id].opens++;
      if (m.clicked_at) byCust[m.customer_id].clicks++;
    });
    orders.forEach((o: any) => {
      if (!o.customer_id) return;
      byCust[o.customer_id] = byCust[o.customer_id] || { customer_id: o.customer_id, opens: 0, clicks: 0, orders: 0, revenue: 0, score: 0 };
      byCust[o.customer_id].orders++;
      byCust[o.customer_id].revenue += Number(o.total_amount || 0);
    });
    Object.values(byCust).forEach((c: any) => {
      c.score = Math.min(100, c.opens * 5 + c.clicks * 10 + c.orders * 20 + Math.min(40, Math.floor(c.revenue / 1000)));
    });
    const sortedCust = Object.values(byCust).sort((a: any, b: any) => b.score - a.score).slice(0, 25);
    setTopCustomers(sortedCust);

    // Lead alerts: hot customers without recent order
    setLeads(sortedCust.filter((c: any) => c.score >= 51 && c.orders === 0).slice(0, 10));

    // Simple heuristic recommendations
    const recs: string[] = [];
    if (opened > 0 && clicked / Math.max(opened, 1) < 0.1) recs.push('Klickrate unter 10% — CTAs prominenter platzieren.');
    if (offerSent > 0 && paidOrders / Math.max(offerSent, 1) < 0.2) recs.push('Wenige Angebote führen zu Zahlung — Nachfass-Automation empfohlen.');
    if (leads.length > 0) recs.push(`${leads.length} heiße Leads ohne Auftrag — Vertrieb informieren.`);
    if (mailDrivenRevenue > orderTotal * 0.5) recs.push('Über 50% des Umsatzes von kontaktierten Kunden — E-Mail-Kanal weiter ausbauen.');
    if (!recs.length) recs.push('Keine kritischen Auffälligkeiten erkannt.');
    setRecommendations(recs);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function exportCSV(rows: any[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function scoreColor(s: number) {
    if (s >= 76) return 'bg-purple-500/15 text-purple-500';
    if (s >= 51) return 'bg-red-500/15 text-red-500';
    if (s >= 26) return 'bg-amber-500/15 text-amber-500';
    return 'bg-blue-500/15 text-blue-500';
  }
  function scoreLabel(s: number) {
    if (s >= 76) return 'Premium';
    if (s >= 51) return 'Heiß';
    if (s >= 26) return 'Aktiv';
    return 'Kalt';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Executive Dashboard</h2></div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm"><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren</Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold">{k.value}</div>
                {k.hint && <div className="text-xs text-muted-foreground mt-1">{k.hint}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="campaigns">Kampagnen-ROI</TabsTrigger>
          <TabsTrigger value="staff">Mitarbeiter</TabsTrigger>
          <TabsTrigger value="customers">Kunden-Score</TabsTrigger>
          <TabsTrigger value="leads">Lead-Warnsystem</TabsTrigger>
          <TabsTrigger value="ai">KI-Empfehlungen</TabsTrigger>
          <TabsTrigger value="reports">Berichte</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Umsatz pro Kampagne</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => exportCSV(campaigns, 'kampagnen.csv')}><Download className="w-4 h-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Kampagne</th><th className="p-3">Status</th><th className="p-3 text-right">Umsatz (nach Start)</th>
                </tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-3">{c.name}</td>
                      <td className="p-3"><Badge variant="outline">{c.status}</Badge></td>
                      <td className="p-3 text-right font-semibold">{fmtEUR(c.revenue)}</td>
                    </tr>
                  ))}
                  {!campaigns.length && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Keine Kampagnen</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mitarbeiter-Performance</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => exportCSV(staff, 'mitarbeiter.csv')}><Download className="w-4 h-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Benutzer</th><th className="p-3 text-right">E-Mails</th><th className="p-3 text-right">Geöffnet</th>
                  <th className="p-3 text-right">Aufträge</th><th className="p-3 text-right">Umsatz</th>
                </tr></thead>
                <tbody>
                  {staff.map((s: any) => (
                    <tr key={s.user_id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{String(s.user_id).slice(0, 24)}</td>
                      <td className="p-3 text-right">{s.sent}</td>
                      <td className="p-3 text-right">{s.opened}</td>
                      <td className="p-3 text-right">{s.orders}</td>
                      <td className="p-3 text-right font-semibold">{fmtEUR(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Top Kunden-Scores</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => exportCSV(topCustomers, 'kunden-score.csv')}><Download className="w-4 h-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Kunde</th><th className="p-3 text-right">Opens</th><th className="p-3 text-right">Klicks</th>
                  <th className="p-3 text-right">Aufträge</th><th className="p-3 text-right">Umsatz</th><th className="p-3">Score</th>
                </tr></thead>
                <tbody>
                  {topCustomers.map((c: any) => (
                    <tr key={c.customer_id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{c.customer_id.slice(0, 8)}</td>
                      <td className="p-3 text-right">{c.opens}</td>
                      <td className="p-3 text-right">{c.clicks}</td>
                      <td className="p-3 text-right">{c.orders}</td>
                      <td className="p-3 text-right">{fmtEUR(c.revenue)}</td>
                      <td className="p-3"><Badge variant="outline" className={scoreColor(c.score)}>{c.score} · {scoreLabel(c.score)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" />Heiße Leads ohne Auftrag</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {leads.length === 0 && <p className="text-sm text-muted-foreground">Keine akuten Leads.</p>}
              {leads.map((l: any) => (
                <div key={l.customer_id} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div>
                    <div className="font-mono text-xs">{l.customer_id}</div>
                    <div className="text-xs text-muted-foreground">{l.opens} Opens · {l.clicks} Klicks</div>
                  </div>
                  <Badge variant="outline" className="bg-red-500/15 text-red-500">Score {l.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />KI-Empfehlungen</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-muted/20 rounded-md">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{r}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">Heuristische Auswertung lokaler Daten. Für GPT-gestützte Analyse Edge Function später ergänzen.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader><CardTitle className="text-base">Management-Berichte</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Export der aktuellen Kennzahlen als CSV. Geplanter automatischer Versand (täglich/wöchentlich/monatlich) erfordert Edge Function — kann bei Bedarf ergänzt werden.</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => exportCSV(kpis as any, 'kpis.csv')}><Download className="w-4 h-4 mr-2" />KPIs</Button>
                <Button variant="outline" onClick={() => exportCSV(campaigns, 'kampagnen.csv')}><Download className="w-4 h-4 mr-2" />Kampagnen</Button>
                <Button variant="outline" onClick={() => exportCSV(staff, 'mitarbeiter.csv')}><Download className="w-4 h-4 mr-2" />Mitarbeiter</Button>
                <Button variant="outline" onClick={() => exportCSV(topCustomers, 'kunden.csv')}><Download className="w-4 h-4 mr-2" />Kunden-Scores</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
