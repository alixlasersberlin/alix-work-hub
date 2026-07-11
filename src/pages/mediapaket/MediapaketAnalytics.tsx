// Phase 42 — Mediapaket Analytics & KPI Dashboard
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, TrendingUp, Clock, RefreshCw, Star, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Nicht begonnen', in_progress: 'In Bearbeitung',
  question_required: 'Rückfrage', customer_correction: 'Korrektur Kunde',
  submitted: 'Eingereicht', in_review: 'In Prüfung',
  approval_pending: 'Freigabe ausstehend', in_production: 'In Produktion',
  completed: 'Abgeschlossen',
};

export default function MediapaketAnalytics() {
  const { hasRole } = useAuth();
  const canView = hasRole('Super Admin') || hasRole('Admin');
  const [loading, setLoading] = useState(true);
  const [mps, setMps] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [mpRes, hRes, pRes, cRes, rRes] = await Promise.all([
        supabase.from('media_packages').select('id, status, customer_id, assigned_user_id, created_at, updated_at, submitted_at, due_date, studio_name'),
        supabase.from('media_package_history').select('media_package_id, action, created_at, new_value').in('action', ['status_changed', 'submitted', 'customer_answered', 'refresh_reminder_sent']).order('created_at', { ascending: true }).limit(5000),
        supabase.from('user_profiles').select('id, first_name, last_name, email'),
        supabase.from('customers').select('id, name'),
        supabase.from('reviews').select('id, rating_delivery, rating_driver_friendliness, customer_id, created_at, product_name').ilike('product_name', '%Mediapaket%'),
      ]);
      setMps(mpRes.data || []);
      setHistory(hRes.data || []);
      const p: Record<string, string> = {};
      (pRes.data || []).forEach((r: any) => { p[r.id] = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.id.slice(0, 6); });
      setProfiles(p);
      const c: Record<string, string> = {};
      (cRes.data || []).forEach((r: any) => { c[r.id] = r.name || r.id.slice(0, 6); });
      setCustomers(c);
      setReviews(rRes.data || []);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const now = Date.now();
    const total = mps.length;
    const completed = mps.filter(m => m.status === 'completed').length;
    const overdue = mps.filter(m => m.due_date && new Date(m.due_date).getTime() < now && m.status !== 'completed').length;

    // Durchlaufzeit: created → completed
    let ltSum = 0, ltN = 0;
    mps.forEach(m => {
      if (m.status === 'completed' && m.created_at && m.updated_at) {
        const d = (new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) / 86400000;
        if (d >= 0) { ltSum += d; ltN++; }
      }
    });

    // Auslastung pro Bearbeiter (aktiv, nicht completed)
    const byAssignee: Record<string, number> = {};
    mps.filter(m => m.status !== 'completed' && m.assigned_user_id).forEach(m => {
      byAssignee[m.assigned_user_id] = (byAssignee[m.assigned_user_id] || 0) + 1;
    });

    // Revisionen: Anzahl 'customer_answered' pro Paket
    const revByMp: Record<string, number> = {};
    history.filter(h => h.action === 'customer_answered').forEach(h => {
      revByMp[h.media_package_id] = (revByMp[h.media_package_id] || 0) + 1;
    });
    const revValues = Object.values(revByMp);
    const avgRevisions = revValues.length ? (revValues.reduce((a, b) => a + b, 0) / revValues.length) : 0;

    // Top-Kunden
    const byCustomer: Record<string, number> = {};
    mps.forEach(m => { if (m.customer_id) byCustomer[m.customer_id] = (byCustomer[m.customer_id] || 0) + 1; });
    const topCustomers = Object.entries(byCustomer).map(([id, n]) => ({ name: customers[id] || id.slice(0, 6), count: n })).sort((a, b) => b.count - a.count).slice(0, 8);

    // Refresh-Quote: wie viele Pakete >12 Monate alt & noch aktiv
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
    const refreshCandidates = mps.filter(m => m.status === 'completed' && new Date(m.updated_at).getTime() < cutoff.getTime()).length;
    const refreshDone = history.filter(h => h.action === 'refresh_reminder_sent').length;

    // NPS-Trend (Ø aus vorhandenen Ratings 1-5, hochgerechnet auf 0-10)
    const npsByMonth: Record<string, { sum: number; n: number }> = {};
    reviews.forEach((r: any) => {
      const vals = [r.rating_delivery, r.rating_driver_friendliness].filter((v: any) => typeof v === 'number');
      if (vals.length === 0) return;
      const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      const score = Math.round(avg * 2 * 10) / 10;
      const m = new Date(r.created_at).toISOString().slice(0, 7);
      npsByMonth[m] = npsByMonth[m] || { sum: 0, n: 0 };
      npsByMonth[m].sum += score; npsByMonth[m].n += 1;
    });
    const npsTrend = Object.entries(npsByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      .map(([m, v]) => ({ month: m, avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }));

    // Status-Verteilung
    const byStatus: Record<string, number> = {};
    mps.forEach(m => { byStatus[m.status] = (byStatus[m.status] || 0) + 1; });

    return { total, completed, overdue, avgLead: ltN ? Math.round(ltSum / ltN * 10) / 10 : null,
      byAssignee, avgRevisions: Math.round(avgRevisions * 10) / 10, topCustomers,
      refreshCandidates, refreshDone, npsTrend, byStatus };
  }, [mps, history, customers, reviews]);

  if (!canView) return <div className="p-8 text-center text-muted-foreground">Nur Admins & Super Admins.</div>;
  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Lade Analytics…</div>;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">Mediapaket-Analytics</h1>
        <Badge variant="outline">KPIs</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card icon={<TrendingUp className="w-4 h-4"/>} label="Pakete gesamt" value={kpis.total} />
        <Card icon={<Star className="w-4 h-4"/>} label="Abgeschlossen" value={kpis.completed} />
        <Card icon={<Clock className="w-4 h-4"/>} label="Ø Durchlauf (T)" value={kpis.avgLead ?? '—'} />
        <Card icon={<Clock className="w-4 h-4"/>} label="Überfällig" value={kpis.overdue} tone={kpis.overdue > 0 ? 'text-orange-400' : ''} />
        <Card icon={<RefreshCw className="w-4 h-4"/>} label="Ø Revisionen" value={kpis.avgRevisions} />
      </div>

      <Section title="Status-Verteilung" icon={<BarChart3 className="w-4 h-4 text-primary"/>}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(kpis.byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <div key={s} className="flex items-center justify-between text-xs border border-border/50 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{STATUS_LABEL[s] || s}</span>
              <span className="font-semibold">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Auslastung Bearbeiter (aktiv)" icon={<Users className="w-4 h-4 text-primary"/>}>
          {Object.keys(kpis.byAssignee).length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine aktiven Zuweisungen.</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(kpis.byAssignee).sort((a, b) => b[1] - a[1]).map(([uid, n]) => (
                <Bar key={uid} label={profiles[uid] || uid.slice(0, 6)} value={n} max={Math.max(...Object.values(kpis.byAssignee))} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Top-Kunden" icon={<Users className="w-4 h-4 text-primary"/>}>
          {kpis.topCustomers.length === 0 ? <p className="text-xs text-muted-foreground">Keine Daten.</p> : (
            <div className="space-y-1">
              {kpis.topCustomers.map(c => <Bar key={c.name} label={c.name} value={c.count} max={kpis.topCustomers[0].count} />)}
            </div>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Refresh-Zyklen" icon={<RefreshCw className="w-4 h-4 text-primary"/>}>
          <div className="flex gap-4 text-sm">
            <div><div className="text-2xl font-semibold">{kpis.refreshCandidates}</div><div className="text-xs text-muted-foreground">Kandidaten (&gt;12 Mon.)</div></div>
            <div><div className="text-2xl font-semibold">{kpis.refreshDone}</div><div className="text-xs text-muted-foreground">Reminder versendet</div></div>
            <div><div className="text-2xl font-semibold">{kpis.refreshCandidates ? Math.round(kpis.refreshDone / Math.max(kpis.refreshCandidates, 1) * 100) : 0}%</div><div className="text-xs text-muted-foreground">Quote</div></div>
          </div>
        </Section>

        <Section title="NPS-Trend (letzte 6 Monate)" icon={<Star className="w-4 h-4 text-primary"/>}>
          {kpis.npsTrend.length === 0 ? <p className="text-xs text-muted-foreground">Noch keine Bewertungen.</p> : (
            <div className="space-y-1">
              {kpis.npsTrend.map(t => <Bar key={t.month} label={`${t.month} (n=${t.n})`} value={t.avg} max={10} suffix="" />)}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Card({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: any; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone || 'text-foreground'}`}>{value}</div>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <div className="flex items-center gap-2 mb-3">{icon}<h2 className="text-sm font-semibold">{title}</h2></div>
      {children}
    </div>
  );
}
function Bar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="text-xs">
      <div className="flex justify-between mb-0.5"><span className="truncate text-muted-foreground">{label}</span><span className="font-medium">{value}{suffix}</span></div>
      <div className="h-1.5 bg-background/50 rounded-full overflow-hidden"><div className="h-full gold-gradient" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
