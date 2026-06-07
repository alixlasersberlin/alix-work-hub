import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck, AlertTriangle, RefreshCw, Check, X, UserPlus, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

type MatchClass = 'secure' | 'suggestion' | 'manual' | 'no_match';

interface ProfileItem {
  source_id: string;
  email: string; phone: string; mobile: string;
  company: string; zip: string; city: string;
  full_name: string | null;
  target_id: string | null;
  target_company: string | null;
  target_contact: string | null;
  target_email: string | null;
  target_phone: string | null;
  confidence: number;
  match_rule: string;
  match_class: MatchClass;
  import_status?: 'importable_new_record' | null;
}

interface DeviceItem {
  source_id: string;
  serial_number: string;
  model: string;
  customer_email: string | null;
  customer_name: string | null;
  target_id: string | null;
  target_serial: string | null;
  target_model: string | null;
  target_customer: string | null;
  confidence: number;
  match_rule: string;
  match_class: MatchClass;
  import_status?: 'importable_new_record' | null;
}

type Decision = 'confirm' | 'reject' | 'new_profile' | 'new_device';

const CLASS_LABEL: Record<MatchClass, string> = {
  secure: 'sicherer Match',
  suggestion: 'wahrscheinlicher Match',
  manual: 'manueller Match nötig',
  no_match: 'kein Match',
};

function ClassBadge({ cls }: { cls: MatchClass }) {
  const cn =
    cls === 'secure' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : cls === 'suggestion' ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
    : cls === 'manual' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
    : 'bg-red-500/15 text-red-500 border-red-500/30';
  return <Badge className={`border ${cn}`}>{CLASS_LABEL[cls]}</Badge>;
}

export default function AlixSmartKonfliktaufloesung() {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  async function callEngine(action: string, body: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke('alixsmart-importer', {
      body: { action, ...body },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function runAnalysis() {
    setLoading(true);
    try {
      const res = await callEngine('analyze-wave1');
      setProfiles(res.profiles?.items || []);
      setDevices(res.devices?.items || []);
      setSummary(res.summary || null);
      toast.success('Analyse aktualisiert.');
    } catch (e: any) {
      toast.error(`Analyse fehlgeschlagen: ${e.message}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { runAnalysis(); /* eslint-disable-next-line */ }, []);

  async function decide(kind: 'profile' | 'device', item: ProfileItem | DeviceItem, decision: Decision) {
    const key = `${kind}:${item.source_id}`;
    try {
      await callEngine('resolve-wave1-conflict', {
        decision,
        source_table: kind === 'profile' ? 'profiles' : 'devices',
        source_id: item.source_id,
        target_table: kind === 'profile' ? 'customers' : 'lager_devices',
        target_id: item.target_id,
        confidence: item.confidence,
        match_rule: item.match_rule,
      });
      setDecisions(d => ({ ...d, [key]: decision }));
      toast.success(`Entscheidung gespeichert: ${decision}`);
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  }

  async function bulkApplyNewRecords(kind: 'profile' | 'device') {
    const items = kind === 'profile'
      ? profiles.filter(p => p.import_status === 'importable_new_record')
      : devices.filter(d => d.import_status === 'importable_new_record');
    if (!items.length) { toast.info('Keine Datensätze ohne Match.'); return; }
    const decision: Decision = kind === 'profile' ? 'new_profile' : 'new_device';
    let ok = 0, fail = 0;
    for (const it of items) {
      try { await decide(kind, it as any, decision); ok++; } catch { fail++; }
    }
    toast.success(`${ok} Datensätze als "neu anlegen" markiert${fail ? `, ${fail} Fehler` : ''}.`);
  }

  const counts = useMemo(() => {
    const pNew = profiles.filter(p => p.import_status === 'importable_new_record').length;
    const dNew = devices.filter(d => d.import_status === 'importable_new_record').length;
    return {
      profiles: {
        secure: profiles.filter(p => p.match_class === 'secure').length,
        suggestion: profiles.filter(p => p.match_class === 'suggestion').length,
        manual: profiles.filter(p => p.match_class === 'manual').length,
        no_match: profiles.filter(p => p.match_class === 'no_match').length,
        new_record: pNew,
      },
      devices: {
        secure: devices.filter(d => d.match_class === 'secure').length,
        suggestion: devices.filter(d => d.match_class === 'suggestion').length,
        manual: devices.filter(d => d.match_class === 'manual').length,
        no_match: devices.filter(d => d.match_class === 'no_match').length,
        new_record: dNew,
      },
    };
  }, [profiles, devices]);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Konfliktauflösung</h1>
            <p className="text-sm text-muted-foreground">
              Read-only. Entscheidungen werden in <code>alixsmart_migration_map</code> dokumentiert –
              es werden keine Geschäftsdaten verändert.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => bulkApplyNewRecords('profile')} variant="secondary" size="sm" disabled={counts.profiles.new_record === 0}>
            <UserPlus className="w-4 h-4 mr-2" />
            Alle Kunden ohne Match übernehmen ({counts.profiles.new_record})
          </Button>
          <Button onClick={() => bulkApplyNewRecords('device')} variant="secondary" size="sm" disabled={counts.devices.new_record === 0}>
            <PackagePlus className="w-4 h-4 mr-2" />
            Alle Geräte ohne Match übernehmen ({counts.devices.new_record})
          </Button>
          <Button onClick={runAnalysis} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Analyse neu laden
          </Button>
        </div>
      </div>

      <SummaryCards counts={counts} summary={summary} />

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Kunden ({profiles.length})</TabsTrigger>
          <TabsTrigger value="devices">Geräte ({devices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <ProfilesTable items={profiles} decisions={decisions} onDecide={(it, d) => decide('profile', it, d)} />
        </TabsContent>
        <TabsContent value="devices">
          <DevicesTable items={devices} decisions={decisions} onDecide={(it, d) => decide('device', it, d)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCards({ counts, summary }: { counts: any; summary: any }) {
  const block = (title: string, c: any) => (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
          <div className="text-xl font-bold text-emerald-500">{c.secure}</div><div className="text-muted-foreground">sicher</div>
        </div>
        <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2">
          <div className="text-xl font-bold text-sky-500">{c.suggestion}</div><div className="text-muted-foreground">Vorschlag</div>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <div className="text-xl font-bold text-amber-500">{c.manual}</div><div className="text-muted-foreground">manuell</div>
        </div>
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
          <div className="text-xl font-bold text-red-500">{c.no_match}</div><div className="text-muted-foreground">kein Match</div>
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 col-span-4">
          <div className="text-xl font-bold text-primary">{c.new_record}</div>
          <div className="text-muted-foreground">neu anlegen (importable_new_record)</div>
        </div>
      </CardContent>
    </Card>
  );
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {block('Kundenprofile', counts.profiles)}
      {block('Geräte', counts.devices)}
    </div>
  );
}

function ActionButtons<T extends { source_id: string; target_id: string | null }>({
  item, kind, current, onDecide,
}: {
  item: T; kind: 'profile' | 'device';
  current: string | undefined;
  onDecide: (item: T, d: Decision) => void;
}) {
  const Btn = ({ d, icon, label, variant = 'outline' as any, disabled = false }: any) => (
    <Button size="sm" variant={current === d ? 'default' : variant} disabled={disabled}
      onClick={() => onDecide(item, d)} className="h-7 px-2 text-xs">
      {icon}<span className="ml-1">{label}</span>
    </Button>
  );
  return (
    <div className="flex flex-wrap gap-1">
      <Btn d="confirm" icon={<Check className="w-3 h-3" />} label="Match bestätigen" disabled={!item.target_id} />
      <Btn d="reject" icon={<X className="w-3 h-3" />} label="Match ablehnen" disabled={!item.target_id} />
      {kind === 'profile'
        ? <Btn d="new_profile" icon={<UserPlus className="w-3 h-3" />} label="Neues Profil anlegen" />
        : <Btn d="new_device" icon={<PackagePlus className="w-3 h-3" />} label="Neues Gerät anlegen" />}
    </div>
  );
}

function ProfilesTable({ items, decisions, onDecide }:
  { items: ProfileItem[]; decisions: Record<string, string>; onDecide: (i: ProfileItem, d: Decision) => void }) {
  if (!items.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Keine Daten.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-2">Quelle</th>
              <th className="p-2">Ziel (Kunde)</th>
              <th className="p-2">Regel</th>
              <th className="p-2">Wahrscheinlichkeit</th>
              <th className="p-2">Klasse</th>
              <th className="p-2">Aktion</th>
              <th className="p-2">Entscheidung</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => {
              const key = `profile:${p.source_id}`;
              return (
                <tr key={p.source_id} className="border-t border-border align-top">
                  <td className="p-2">
                    <div className="font-medium">{p.full_name || '—'}</div>
                    <div className="text-muted-foreground">{p.email || '—'}</div>
                    <div className="text-muted-foreground">{p.company} {p.zip} {p.city}</div>
                  </td>
                  <td className="p-2">
                    {p.target_id ? (
                      <>
                        <div className="font-medium">{p.target_company || p.target_contact || '—'}</div>
                        <div className="text-muted-foreground">{p.target_email}</div>
                        <div className="text-muted-foreground font-mono">{p.target_id.slice(0, 8)}…</div>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 font-mono">{p.match_rule}</td>
                  <td className="p-2 font-bold">{p.confidence}%</td>
                  <td className="p-2"><ClassBadge cls={p.match_class} /></td>
                  <td className="p-2"><ActionButtons item={p} kind="profile" current={decisions[key]} onDecide={onDecide} /></td>
                  <td className="p-2 text-muted-foreground">{decisions[key] ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function DevicesTable({ items, decisions, onDecide }:
  { items: DeviceItem[]; decisions: Record<string, string>; onDecide: (i: DeviceItem, d: Decision) => void }) {
  if (!items.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Keine Daten.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-2">Quelle</th>
              <th className="p-2">Ziel (Lager)</th>
              <th className="p-2">Regel</th>
              <th className="p-2">Wahrscheinlichkeit</th>
              <th className="p-2">Klasse</th>
              <th className="p-2">Aktion</th>
              <th className="p-2">Entscheidung</th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => {
              const key = `device:${d.source_id}`;
              return (
                <tr key={d.source_id} className="border-t border-border align-top">
                  <td className="p-2">
                    <div className="font-mono font-medium">{d.serial_number || '—'}</div>
                    <div className="text-muted-foreground">{d.model || '—'}</div>
                    <div className="text-muted-foreground">{d.customer_name || d.customer_email || '—'}</div>
                  </td>
                  <td className="p-2">
                    {d.target_id ? (
                      <>
                        <div className="font-mono font-medium">{d.target_serial || '—'}</div>
                        <div className="text-muted-foreground">{d.target_model || '—'}</div>
                        <div className="text-muted-foreground">{d.target_customer || '—'}</div>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 font-mono">{d.match_rule}</td>
                  <td className="p-2 font-bold">{d.confidence}%</td>
                  <td className="p-2"><ClassBadge cls={d.match_class} /></td>
                  <td className="p-2"><ActionButtons item={d} kind="device" current={decisions[key]} onDecide={onDecide} /></td>
                  <td className="p-2 text-muted-foreground">{decisions[key] ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
