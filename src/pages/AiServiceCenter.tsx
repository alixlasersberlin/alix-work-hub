import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, Wrench, Package, TrendingUp, ListChecks } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function AiServiceCenter() {
  const { roles } = useAuth();
  const isAdmin = roles?.some((r) => r === 'Super Admin' || r === 'Admin');
  const isTechnik = roles?.includes('Technik');
  const canEditKb = isAdmin || isTechnik;

  const [stats, setStats] = useState<{ topErrors: any[]; topParts: any[]; criticalTickets: any[]; latestAnalyses: any[]; kbCount: number }>({
    topErrors: [], topParts: [], criticalTickets: [], latestAnalyses: [], kbCount: 0,
  });
  const [kb, setKb] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [analyses, kbRows, tickets] = await Promise.all([
        supabase.from('service_ai_analyses' as any).select('id, ursache, ersatzteile, device_type, device_model, ticket_id, repair_order_id, created_at, confidence').order('created_at', { ascending: false }).limit(200),
        supabase.from('service_knowledge_base' as any).select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('tickets').select('id, title, status, priority, customer_name, created_at, auto_priority').or('priority.eq.Hoch,auto_priority.eq.Hoch').neq('status', 'closed').order('created_at', { ascending: false }).limit(20),
      ]);

      const counts = new Map<string, number>();
      const parts = new Map<string, number>();
      (analyses.data ?? []).forEach((a: any) => {
        const k = (a.ursache ?? '').slice(0, 80);
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
        (a.ersatzteile ?? []).forEach((p: any) => {
          if (p?.name) parts.set(p.name, (parts.get(p.name) ?? 0) + 1);
        });
      });
      const topErrors = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k, count: v }));
      const topParts = [...parts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k, count: v }));

      setStats({
        topErrors,
        topParts,
        criticalTickets: tickets.data ?? [],
        latestAnalyses: (analyses.data ?? []).slice(0, 12),
        kbCount: (kbRows.data ?? []).length,
      });
      setKb(kbRows.data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-7 h-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-display font-bold">AI Service Center</h1>
          <p className="text-sm text-muted-foreground">Cockpit für Fehleranalysen, Ersatzteile, Anleitungen und Wissensdatenbank.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Kritische offene Tickets" value={stats.criticalTickets.length} tone="red" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="AI Analysen (gesamt)" value={stats.latestAnalyses.length >= 12 ? '12+' : stats.latestAnalyses.length} tone="amber" />
        <KpiCard icon={<Wrench className="w-5 h-5" />} label="Top-Ersatzteil" value={stats.topParts[0]?.name ?? '—'} tone="amber" />
        <KpiCard icon={<ListChecks className="w-5 h-5" />} label="Wissenseinträge" value={stats.kbCount} tone="green" />
      </div>

      <Tabs defaultValue="cockpit">
        <TabsList>
          <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
          <TabsTrigger value="analyses">Letzte Analysen</TabsTrigger>
          <TabsTrigger value="kb">Wissensdatenbank</TabsTrigger>
        </TabsList>

        <TabsContent value="cockpit" className="grid md:grid-cols-2 gap-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Häufigste Ursachen</h3>
            <ul className="space-y-2 text-sm">
              {stats.topErrors.length === 0 && <li className="text-muted-foreground">Noch keine Daten.</li>}
              {stats.topErrors.map((e, i) => (
                <li key={i} className="flex justify-between border-b border-border/50 pb-1">
                  <span className="truncate pr-2">{e.name}</span>
                  <Badge variant="outline">{e.count}×</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Top Ersatzteile</h3>
            <ul className="space-y-2 text-sm">
              {stats.topParts.length === 0 && <li className="text-muted-foreground">Noch keine Daten.</li>}
              {stats.topParts.map((p, i) => (
                <li key={i} className="flex justify-between border-b border-border/50 pb-1">
                  <span className="truncate pr-2">{p.name}</span>
                  <Badge variant="outline">{p.count}×</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4 md:col-span-2">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Kritische offene Tickets</h3>
            <div className="space-y-2 text-sm">
              {stats.criticalTickets.length === 0 && <div className="text-muted-foreground">Keine kritischen Tickets offen.</div>}
              {stats.criticalTickets.map((t: any) => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center justify-between border-b border-border/50 pb-1 hover:bg-muted/30 rounded px-1">
                  <div className="truncate">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{t.customer_name}</span>
                  </div>
                  <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">{t.priority || t.auto_priority}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analyses" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Letzte AI-Analysen</h3>
            <div className="space-y-2 text-sm">
              {loading && <div className="text-muted-foreground">Lade…</div>}
              {!loading && stats.latestAnalyses.length === 0 && <div className="text-muted-foreground">Noch keine Analysen.</div>}
              {stats.latestAnalyses.map((a: any) => {
                const link = a.ticket_id ? `/tickets/${a.ticket_id}` : a.repair_order_id ? `/reparatur/auftraege/${a.repair_order_id}` : '#';
                return (
                  <Link key={a.id} to={link} className="flex items-center justify-between border-b border-border/50 pb-1 hover:bg-muted/30 rounded px-1">
                    <div className="truncate pr-2">
                      <span className="font-medium">{a.device_type ?? a.device_model ?? '—'}</span>
                      <span className="text-xs text-muted-foreground ml-2">{(a.ursache ?? '').slice(0, 80)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/40">{a.confidence ?? 0}%</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="kb" className="mt-4 space-y-4">
          {canEditKb && <KbEditor onSaved={(row) => setKb([row, ...kb])} />}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Wissenseinträge</h3>
            <div className="space-y-2 text-sm">
              {kb.length === 0 && <div className="text-muted-foreground">Noch keine Einträge.</div>}
              {kb.map((k: any) => (
                <div key={k.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {k.geraetetyp && <Badge variant="outline">{k.geraetetyp}</Badge>}
                    {k.fehlercode && <Badge variant="outline">{k.fehlercode}</Badge>}
                  </div>
                  <div className="font-medium">{k.symptom}</div>
                  {k.ursache && <div className="text-xs text-muted-foreground">Ursache: {k.ursache}</div>}
                  {k.loesung && <div className="text-xs">Lösung: {k.loesung}</div>}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: any; tone: 'red' | 'amber' | 'green' }) {
  const toneCls = tone === 'red' ? 'text-red-400' : tone === 'green' ? 'text-emerald-400' : 'text-amber-400';
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 ${toneCls}`}>{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <div className="text-2xl font-bold mt-2 truncate">{value}</div>
    </Card>
  );
}

function KbEditor({ onSaved }: { onSaved: (row: any) => void }) {
  const [form, setForm] = useState({ geraetetyp: '', fehlercode: '', symptom: '', ursache: '', loesung: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.symptom.trim()) { toast.error('Symptom ist erforderlich'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('service_knowledge_base' as any).insert(form).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Eintrag gespeichert');
    setForm({ geraetetyp: '', fehlercode: '', symptom: '', ursache: '', loesung: '' });
    onSaved(data);
  }
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Neuer Wissenseintrag</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Gerätetyp" value={form.geraetetyp} onChange={(e) => setForm({ ...form, geraetetyp: e.target.value })} />
        <Input placeholder="Fehlercode" value={form.fehlercode} onChange={(e) => setForm({ ...form, fehlercode: e.target.value })} />
      </div>
      <Input placeholder="Symptom *" value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} />
      <Textarea placeholder="Ursache" rows={2} value={form.ursache} onChange={(e) => setForm({ ...form, ursache: e.target.value })} />
      <Textarea placeholder="Lösung" rows={2} value={form.loesung} onChange={(e) => setForm({ ...form, loesung: e.target.value })} />
      <Button onClick={save} disabled={saving} className="gap-2"><Sparkles className="w-4 h-4" />Speichern</Button>
    </Card>
  );
}
