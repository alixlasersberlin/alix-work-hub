import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAfterSalesCases, useForceCloseCase, type AsCaseListItem, type AsTrafficLight } from '@/hooks/useAfterSales';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  HeartPulse, PhoneCall, AlertTriangle, CheckCircle2, Star, Smartphone, GraduationCap, Image as ImageIcon, ShieldCheck,
} from 'lucide-react';

function fmtDate(s: string | null) { return s ? new Date(s).toLocaleDateString('de-DE') : '—'; }
function fmtMoney(v: number | null, c: string | null) {
  if (v == null) return '—';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v)); }
  catch { return `${v} ${c ?? ''}`; }
}
function LightDot({ l }: { l: AsTrafficLight }) {
  const color = l === 'green' ? 'bg-emerald-500' : l === 'yellow' ? 'bg-amber-400' : 'bg-rose-500';
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} />;
}

export default function AfterSalesDashboard() {
  const { data = [], isLoading } = useAfterSalesCases({ completed: false });
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const forceClose = useForceCloseCase();
  const [closingCaseId, setClosingCaseId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const confirmCloseCase = async (caseId: string) => {
    setClosingCaseId(caseId);
    try {
      await forceClose.mutateAsync({ caseId, reason: 'Direkt-Schließung aus Dashboard' });
    } finally {
      setClosingCaseId(null);
    }
  };

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = data.filter(c => c.next_callback_at && new Date(c.next_callback_at) < today).length;
    const dueToday = data.filter(c => c.next_callback_at && new Date(c.next_callback_at).toDateString() === today.toDateString()).length;
    const red = data.filter(c => c.traffic_light === 'red').length;
    const avgProgress = data.length ? Math.round(data.reduce((a, c) => a + (c.progress_pct ?? 0), 0) / data.length) : 0;
    return { open: data.length, overdue, dueToday, red, avgProgress };
  }, [data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter(c =>
      [c.order_number, c.customer_company, c.customer_contact, c.customer_email, c.device_serial, c.device_model, c.customer_number]
        .some(v => (v ?? '').toLowerCase().includes(s)),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">After Sales</h1>
          <p className="text-sm text-muted-foreground">Kein Kunde geht nach dem Verkauf verloren.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/crm/after-sales/erledigt">Abgeschlossene Fälle</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<HeartPulse className="w-4 h-4" />} label="Offene Fälle" value={kpis.open} />
        <Kpi icon={<PhoneCall className="w-4 h-4" />} label="Heute fällig" value={kpis.dueToday} />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Überfällig" value={kpis.overdue} accent="rose" />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Rote Ampel" value={kpis.red} accent="rose" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Ø Fortschritt" value={`${kpis.avgProgress}%`} accent="emerald" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Offene After-Sales-Fälle</CardTitle>
          <Input className="max-w-xs" placeholder="Suchen…" value={q} onChange={e => setQ(e.target.value)} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Fälle gefunden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">Ampel</th>
                  <th className="text-left py-2 pr-3">Auftrag</th>
                  <th className="text-left py-2 pr-3">Kunde</th>
                  <th className="text-left py-2 pr-3">Gerät</th>
                  <th className="text-left py-2 pr-3">Bestelldatum</th>
                  <th className="text-left py-2 pr-3">Lieferung</th>
                  <th className="text-right py-2 pr-3">Wert</th>
                  <th className="text-left py-2 pr-3">Verkäufer</th>
                  <th className="text-left py-2 pr-3">Letzter Kontakt</th>
                  <th className="text-left py-2 pr-3">Nächster Rückruf</th>
                  <th className="text-left py-2 pr-3">Fortschritt</th>
                  {isSuperAdmin && <th className="text-right py-2 pr-3">Aktion</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-3"><LightDot l={c.traffic_light} /></td>
                    <td className="py-2 pr-3">
                      <Link to={`/crm/after-sales/${c.id}`} className="text-primary hover:underline font-medium">
                        {c.order_number ?? '—'}
                      </Link>
                      <div className="text-xs text-muted-foreground">{c.internal_number ?? ''}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium flex items-center gap-1">
                        {c.is_vip && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        {c.customer_company ?? c.customer_contact ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.customer_number ?? ''}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div>{c.device_model ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{c.device_serial ?? ''}</div>
                    </td>
                    <td className="py-2 pr-3">{fmtDate(c.order_date)}</td>
                    <td className="py-2 pr-3">{fmtDate(c.expected_shipment_date)}</td>
                    <td className="py-2 pr-3 text-right">{fmtMoney(c.total_amount, c.currency)}</td>
                    <td className="py-2 pr-3">{c.sales_user_name ?? '—'}</td>
                    <td className="py-2 pr-3">{fmtDate(c.last_contact_at)}</td>
                    <td className="py-2 pr-3">
                      {c.next_callback_at ? (
                        <Badge variant={new Date(c.next_callback_at) < new Date() ? 'destructive' : 'secondary'}>
                          {new Date(c.next_callback_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 w-32">
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${c.progress_pct ?? 0}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.progress_pct ?? 0}%</div>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2 pr-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1" disabled={forceClose.isPending && closingCaseId === c.id}>
                              <ShieldCheck className="w-3.5 h-3.5" /> Schließen
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Fall ohne Bearbeitung abschließen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Auftrag <strong>{c.order_number ?? '—'}</strong> ({c.customer_company ?? c.customer_contact ?? '—'}) wird als <strong>100 % erledigt</strong> markiert.
                                Alle Checklisten-Punkte, offenen Rückrufe und das Mediapaket werden automatisch geschlossen. Die Aktion wird in der Timeline protokolliert.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={forceClose.isPending && closingCaseId === c.id}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void confirmCloseCase(c.id);
                                }}
                              >
                                {forceClose.isPending && closingCaseId === c.id ? 'Schließt…' : 'Jetzt schließen'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-3 text-xs text-muted-foreground">
        <Hint icon={<Smartphone className="w-4 h-4" />} text="App fehlt → automatische Erinnerung nach 3 Tagen" />
        <Hint icon={<GraduationCap className="w-4 h-4" />} text="Schulung fehlt → Kalendertermin vorschlagen" />
        <Hint icon={<ImageIcon className="w-4 h-4" />} text="Mediapaket offen → Marketing wird benachrichtigt" />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: 'rose' | 'emerald' }) {
  const tone = accent === 'rose' ? 'text-rose-500' : accent === 'emerald' ? 'text-emerald-500' : 'text-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={tone}>{icon}</span>
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Hint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 p-3 rounded border bg-card">{icon}<span>{text}</span></div>;
}
