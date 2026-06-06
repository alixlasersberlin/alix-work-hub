import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, ShoppingCart, Truck, Wrench, Hammer, Package,
  AlertTriangle, ShieldCheck, RefreshCw, Undo2, Heart, Activity, Award, FileText,
} from 'lucide-react';

type DLRow = {
  id: string;
  serial_number: string;
  device_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  event_type: string;
  event_date: string;
  event_source: string;
  reference_id: string | null;
  description: string | null;
  meta: any;
};

const EVENT_ORDER = ['Verkauf', 'Lieferung', 'Wartung', 'Reparatur', 'Ersatzteil', 'Reklamation', 'Garantie', 'Leasing', 'Austausch', 'Rücknahme'];

const EVENT_META: Record<string, { icon: any; cls: string }> = {
  Verkauf:     { icon: ShoppingCart, cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  Lieferung:   { icon: Truck,        cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
  Wartung:     { icon: Wrench,       cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  Reparatur:   { icon: Hammer,       cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  Ersatzteil:  { icon: Package,      cls: 'bg-violet-500/15 text-violet-300 border-violet-500/40' },
  Reklamation: { icon: AlertTriangle, cls: 'bg-red-500/15 text-red-300 border-red-500/40' },
  Garantie:    { icon: ShieldCheck,  cls: 'bg-teal-500/15 text-teal-300 border-teal-500/40' },
  Leasing:     { icon: FileText,     cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' },
  Austausch:   { icon: RefreshCw,    cls: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  'Rücknahme': { icon: Undo2,        cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
};

function eventLink(ev: DLRow): string | null {
  if (ev.event_source === 'orders') return `/orders/${ev.reference_id}`;
  if (ev.event_source === 'repair_orders') return `/reparatur/auftraege/${ev.reference_id}`;
  if (ev.event_source === 'tickets') return `/tickets/${ev.reference_id}`;
  if (ev.event_source === 'repair_spare_parts' && ev.meta?.repair_order_id) return `/reparatur/auftraege/${ev.meta.repair_order_id}`;
  return null;
}

export default function GeraeteLebenslauf() {
  const [q, setQ] = useState('');
  const [serial, setSerial] = useState<string | null>(null);
  const [serialOptions, setSerialOptions] = useState<{ serial: string; label?: string; customer?: string }[]>([]);
  const [events, setEvents] = useState<DLRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [topDevices, setTopDevices] = useState<{ serial: string; count: number; device?: string }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; count: number }[]>([]);
  const [warrantyCases, setWarrantyCases] = useState<{ serial: string; device?: string; date: string }[]>([]);
  const [leasingDevices, setLeasingDevices] = useState<{ serial: string; device?: string; customer?: string }[]>([]);
  const [redDevices, setRedDevices] = useState<{ serial: string; device?: string; customer?: string; score: number }[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [warranty, setWarranty] = useState<any | null>(null);
  const [maintenance, setMaintenance] = useState<any[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    const { data } = await supabase
      .from('device_lifecycle')
      .select('serial_number, device_name, customer_name, event_type, event_date, reference_id')
      .in('event_type', ['Reparatur', 'Reklamation', 'Ersatzteil', 'Garantie', 'Leasing']);
    const dev = new Map<string, { count: number; device?: string }>();
    const cust = new Map<string, number>();
    const warr: { serial: string; device?: string; date: string }[] = [];
    const leas = new Map<string, { serial: string; device?: string; customer?: string }>();
    (data || []).forEach((r: any) => {
      if (['Reparatur', 'Reklamation', 'Ersatzteil'].includes(r.event_type)) {
        const d = dev.get(r.serial_number) || { count: 0, device: r.device_name || undefined };
        d.count += 1; dev.set(r.serial_number, d);
        if (r.customer_name) cust.set(r.customer_name, (cust.get(r.customer_name) || 0) + 1);
      }
      if (r.event_type === 'Garantie') warr.push({ serial: r.serial_number, device: r.device_name, date: r.event_date });
      if (r.event_type === 'Leasing' && !leas.has(r.serial_number)) leas.set(r.serial_number, { serial: r.serial_number, device: r.device_name, customer: r.customer_name });
    });
    setTopDevices(Array.from(dev.entries()).map(([s, v]) => ({ serial: s, count: v.count, device: v.device })).sort((a, b) => b.count - a.count).slice(0, 8));
    setTopCustomers(Array.from(cust.entries()).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count).slice(0, 8));
    setWarrantyCases(warr.slice(0, 8));
    setLeasingDevices(Array.from(leas.values()).slice(0, 8));

    const { data: health } = await (supabase as any)
      .from('device_health_scores')
      .select('serial_number, device_name, customer_name, health_score, health_status')
      .eq('health_status', 'rot')
      .order('health_score', { ascending: false })
      .limit(8);
    setRedDevices((health || []).map((h: any) => ({ serial: h.serial_number, device: h.device_name, customer: h.customer_name, score: Number(h.health_score) || 0 })));
  }

  async function search() {
    if (!q.trim()) return;
    const like = `%${q.trim()}%`;
    const { data } = await supabase
      .from('device_lifecycle')
      .select('serial_number, device_name, customer_name')
      .or(`serial_number.ilike.${like},customer_name.ilike.${like},device_name.ilike.${like},description.ilike.${like}`)
      .limit(100);
    const seen = new Map<string, any>();
    (data || []).forEach((r: any) => {
      if (!seen.has(r.serial_number)) seen.set(r.serial_number, { serial: r.serial_number, label: r.device_name, customer: r.customer_name });
    });
    setSerialOptions(Array.from(seen.values()));
  }

  async function loadSerial(s: string) {
    setSerial(s); setLoading(true);
    const { data } = await supabase
      .from('device_lifecycle')
      .select('*')
      .eq('serial_number', s)
      .order('event_date', { ascending: true });
    setEvents((data || []) as DLRow[]);

    const { data: ai } = await (supabase as any)
      .from('ai_service_analyses')
      .select('id, probable_cause, recommended_repair, recommended_parts, recommended_steps, confidence_score, created_at')
      .eq('serial_number', s)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAiAnalysis(ai || null);

    const [{ data: w }, { data: m }] = await Promise.all([
      (supabase as any).from('warranty_records').select('*').eq('serial_number', s).maybeSingle(),
      (supabase as any).from('device_maintenance').select('*').eq('serial_number', s).order('next_maintenance_date', { ascending: true }),
    ]);
    setWarranty(w || null);
    setMaintenance((m as any[]) || []);

    setLoading(false);
  }

  const header = useMemo(() => {
    if (!events.length) return null;
    const last = events[events.length - 1];
    const verkauf = events.find((e) => e.event_type === 'Verkauf');
    const liefer = events.find((e) => e.event_type === 'Lieferung');
    const garantie = events.find((e) => e.event_type === 'Garantie');
    const leasing = events.find((e) => e.event_type === 'Leasing');
    return {
      device: last.device_name || '–',
      customer: last.customer_name || '–',
      liefer_date: liefer?.event_date ? new Date(liefer.event_date).toLocaleDateString('de-DE') : '–',
      verkauf_date: verkauf?.event_date ? new Date(verkauf.event_date).toLocaleDateString('de-DE') : '–',
      garantie: garantie ? 'aktiv' : 'keine Daten',
      leasing: leasing ? 'aktiv' : 'kein Leasing',
    };
  }, [events]);

  const health = useMemo(() => {
    const reps = events.filter((e) => e.event_type === 'Reparatur').length;
    const rekl = events.filter((e) => e.event_type === 'Reklamation').length;
    const teile = events.filter((e) => e.event_type === 'Ersatzteil').length;
    let level: 'gruen' | 'gelb' | 'rot' = 'gruen';
    if (reps + rekl >= 4 || teile >= 6) level = 'rot';
    else if (reps + rekl >= 2 || teile >= 3) level = 'gelb';
    return { reps, rekl, teile, level };
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Activity className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Geräte-Lebenslauf</h1>
        <Badge variant="outline">Automatisch aus allen Modulen</Badge>
      </div>

      <Card className="p-4 space-y-3">
        <Label className="text-xs">Suche (Seriennummer, Kunde, Auftrag, Gerät)</Label>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="z. B. SN-1234 / Mustermann GmbH" />
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
        <Card className="p-4 space-y-5">
          {header && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Info label="Gerät" value={header.device} />
              <Info label="Seriennummer" value={serial} mono />
              <Info label="Kunde" value={header.customer} />
              <Info label="Lieferdatum" value={header.liefer_date} />
              <Info label="Garantie" value={header.garantie} />
              <Info label="Leasing" value={header.leasing} />
            </div>
          )}

          <HealthBar health={health} />

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Zeitachse</h3>
            {loading ? (
              <div className="text-sm text-muted-foreground">Lade…</div>
            ) : events.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine Ereignisse vorhanden.</div>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-3">
                {events.map((ev) => {
                  const meta = EVENT_META[ev.event_type] || { icon: FileText, cls: 'bg-muted text-foreground border-border' };
                  const Icon = meta.icon;
                  const link = eventLink(ev);
                  const content = (
                    <div className={`p-3 rounded border ${meta.cls} hover:opacity-90 transition`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className="w-4 h-4" />
                        <span className="font-semibold">{ev.event_type}</span>
                        <span className="text-xs opacity-80">{new Date(ev.event_date).toLocaleString('de-DE')}</span>
                      </div>
                      {ev.description && <div className="text-xs mt-1 opacity-90">{ev.description}</div>}
                    </div>
                  );
                  return (
                    <li key={ev.id} className="ml-5 relative">
                      <span className="absolute -left-7 top-3 w-3 h-3 rounded-full bg-primary border border-background" />
                      {link ? <Link to={link}>{content}</Link> : content}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {aiAnalysis && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">AI Service Analyse</h3>
                {typeof aiAnalysis.confidence_score === 'number' && (
                  <Badge variant="outline">Konfidenz: {Math.round(aiAnalysis.confidence_score * 100)}%</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(aiAnalysis.created_at).toLocaleString('de-DE')}
                </span>
              </div>
              {aiAnalysis.probable_cause && (
                <div className="text-sm"><span className="text-muted-foreground">Häufigste Ursache:</span> {aiAnalysis.probable_cause}</div>
              )}
              {aiAnalysis.recommended_repair && (
                <div className="text-sm"><span className="text-muted-foreground">Empfohlene Wartung/Reparatur:</span> {aiAnalysis.recommended_repair}</div>
              )}
              {Array.isArray(aiAnalysis.recommended_parts) && aiAnalysis.recommended_parts.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Empfohlene Ersatzteile:</span>{' '}
                  {aiAnalysis.recommended_parts.map((p: any) => p?.name || p).filter(Boolean).join(', ')}
                </div>
              )}
              {Array.isArray(aiAnalysis.recommended_steps) && aiAnalysis.recommended_steps.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Nächste empfohlene Prüfung:</span>{' '}
                  {(aiAnalysis.recommended_steps[0]?.text || aiAnalysis.recommended_steps[0]) as string}
                </div>
              )}
            </div>
          )}
        </Card>
      )}



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-red-400" /> Top Geräte nach Fehlerquote</h3>
          {topDevices.length === 0 ? <div className="text-sm text-muted-foreground">Keine Daten.</div> : (
            <ul className="space-y-1 text-sm">
              {topDevices.map((d) => (
                <li key={d.serial} className="flex items-center justify-between gap-2">
                  <button className="font-mono text-left hover:text-primary" onClick={() => loadSerial(d.serial)}>{d.serial}</button>
                  <span className="text-xs text-muted-foreground truncate flex-1 mx-2">{d.device || ''}</span>
                  <Badge variant="outline">{d.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Top Kunden nach Serviceaufkommen</h3>
          {topCustomers.length === 0 ? <div className="text-sm text-muted-foreground">Keine Daten.</div> : (
            <ul className="space-y-1 text-sm">
              {topCustomers.map((c) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span className="truncate">{c.name}</span>
                  <Badge variant="outline">{c.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-400" /> Garantiefälle</h3>
          {warrantyCases.length === 0 ? <div className="text-sm text-muted-foreground">Keine Garantiefälle.</div> : (
            <ul className="space-y-1 text-sm">
              {warrantyCases.map((w) => (
                <li key={w.serial + w.date} className="flex items-center justify-between gap-2">
                  <button className="font-mono text-left hover:text-primary" onClick={() => loadSerial(w.serial)}>{w.serial}</button>
                  <span className="text-xs text-muted-foreground truncate flex-1 mx-2">{w.device || ''}</span>
                  <Badge variant="outline">{new Date(w.date).toLocaleDateString('de-DE')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Leasinggeräte</h3>
          {leasingDevices.length === 0 ? <div className="text-sm text-muted-foreground">Keine Leasinggeräte.</div> : (
            <ul className="space-y-1 text-sm">
              {leasingDevices.map((l) => (
                <li key={l.serial} className="flex items-center justify-between gap-2">
                  <button className="font-mono text-left hover:text-primary" onClick={() => loadSerial(l.serial)}>{l.serial}</button>
                  <span className="text-xs text-muted-foreground truncate flex-1 mx-2">{l.device || l.customer || ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 md:col-span-2">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Geräte im roten Status</h3>
          {redDevices.length === 0 ? <div className="text-sm text-muted-foreground">Keine kritischen Geräte.</div> : (
            <ul className="space-y-1 text-sm">
              {redDevices.map((d) => (
                <li key={d.serial} className="flex items-center justify-between gap-2">
                  <button className="font-mono text-left hover:text-primary" onClick={() => loadSerial(d.serial)}>{d.serial}</button>
                  <span className="text-xs text-muted-foreground truncate flex-1 mx-2">{d.device || ''} – {d.customer || ''}</span>
                  <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">Score {d.score}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function HealthBar({ health }: { health: { reps: number; rekl: number; teile: number; level: 'gruen' | 'gelb' | 'rot' } }) {
  const map = {
    gruen: { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Gerätegesundheit: Grün' },
    gelb:  { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'Gerätegesundheit: Gelb' },
    rot:   { cls: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Gerätegesundheit: Rot' },
  } as const;
  const m = map[health.level];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline" className={`gap-1 ${m.cls}`}><Heart className="w-3 h-3" /> {m.label}</Badge>
      <Badge variant="outline">Reparaturen: {health.reps}</Badge>
      <Badge variant="outline">Reklamationen: {health.rekl}</Badge>
      <Badge variant="outline">Ersatzteile: {health.teile}</Badge>
    </div>
  );
}
