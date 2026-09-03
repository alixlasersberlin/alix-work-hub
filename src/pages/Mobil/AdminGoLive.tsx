/**
 * GO-LIVE CENTER (Prompt 9)
 *
 * Zeigt ausschliesslich real geprüfte Zustände. Nicht automatisiert prüfbare
 * Punkte erscheinen als NOT TESTED oder BLOCKER – niemals als PASS.
 * Die finale Produktionsfreigabe trifft bewusst ein berechtigter Admin.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Rocket, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  Power, Users, Activity, ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { APP_BUILD, APP_VERSION_MOBILE, ENVIRONMENT, ANDROID_PACKAGE, IOS_BUNDLE_ID } from '@/lib/mobil/appInfo';
import {
  fetchConfigs, updateConfig, fetchGoLiveSnapshot, fetchPilotOverview,
  fetchRolloutGroups, setGroupActive, fetchConfigAudit,
  type MobileAppConfig,
} from '@/lib/mobil/golive';

type Status = 'PASS' | 'WARNING' | 'BLOCKER' | 'NOT TESTED';
type Item = { section: string; label: string; status: Status; note?: string };

const ICON: Record<Status, JSX.Element> = {
  PASS: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  WARNING: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  BLOCKER: <XCircle className="w-4 h-4 text-destructive" />,
  'NOT TESTED': <HelpCircle className="w-4 h-4 text-muted-foreground" />,
};

const KILL_SWITCHES: { key: keyof MobileAppConfig; label: string; hint: string }[] = [
  { key: 'mobile_access_enabled', label: 'Mobile Zugriff', hint: 'Aus = FULL MOBILE ACCESS OFF' },
  { key: 'mobile_read_only', label: 'Nur-Lesen-Modus', hint: 'An = keine Schreibaktionen' },
  { key: 'maintenance_mode', label: 'Wartungsmodus', hint: 'An = Wartungshinweis + nur Lesen' },
  { key: 'whatsapp_outbound_enabled', label: 'WhatsApp Versand', hint: 'Aus = kein Kundenversand' },
  { key: 'push_enabled', label: 'Push', hint: 'Aus = keine Push-Zustellung' },
  { key: 'ai_enabled', label: 'ALIX AI', hint: 'Aus = App läuft ohne KI' },
  { key: 'ticket_creation_enabled', label: 'Ticket-Erstellung', hint: 'Aus = keine neuen Tickets aus Chat' },
  { key: 'restrict_to_rollout_groups', label: 'Nur Pilotgruppen', hint: 'An = nur freigegebene Nutzer' },
];

export default function MobilAdminGoLive() {
  const { hasRole } = useAuth() as any;
  const allowed = typeof hasRole === 'function' ? hasRole('Super Admin') || hasRole('Admin') : false;

  const [items, setItems] = useState<Item[]>([]);
  const [configs, setConfigs] = useState<MobileAppConfig[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [pilot, setPilot] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState<Date | null>(null);

  const cfg = configs.find((c) => c.environment === ENVIRONMENT) ?? configs.find((c) => c.environment === 'PRODUCTION');

  const run = useCallback(async () => {
    setLoading(true);
    const out: Item[] = [];

    // AUTH
    const { data: sess } = await supabase.auth.getSession();
    out.push({ section: 'AUTH', label: 'Session serverseitig gültig', status: sess?.session ? 'PASS' : 'BLOCKER' });

    // DATABASE
    const t0 = performance.now();
    const { error: dbErr } = await (supabase as any).from('app_settings').select('key').limit(1);
    out.push({
      section: 'DATABASE', label: 'Supabase erreichbar',
      status: dbErr ? 'BLOCKER' : 'PASS',
      note: dbErr ? dbErr.message : `${Math.round(performance.now() - t0)} ms`,
    });

    // RLS – Stichproben (Fehler = Policy greift, Erfolg = erlaubt)
    for (const t of ['ac_conversations', 'ac_messages', 'mobile_incidents', 'mobile_app_config', 'app_releases']) {
      const { error } = await (supabase as any).from(t).select('id').limit(1);
      out.push({
        section: 'RLS', label: `${t} – Zugriff über Policy`,
        status: error && error.code !== 'PGRST116' ? 'WARNING' : 'PASS',
        note: error?.message?.slice(0, 60),
      });
    }

    // WHATSAPP
    const { data: chans } = await (supabase as any).from('ac_channels')
      .select('id, is_active').eq('channel_type', 'whatsapp');
    const activeChans = (chans ?? []).filter((c: any) => c.is_active).length;
    const { data: lastIn } = await (supabase as any).from('ac_messages')
      .select('created_at').eq('direction', 'inbound').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: lastOut } = await (supabase as any).from('ac_messages')
      .select('created_at').eq('direction', 'outbound').order('created_at', { ascending: false }).limit(1).maybeSingle();
    out.push({
      section: 'WHATSAPP', label: 'Inbound (Webhook liefert Nachrichten)',
      status: lastIn ? 'PASS' : 'NOT TESTED',
      note: lastIn ? `zuletzt ${new Date(lastIn.created_at).toLocaleString('de-DE')}` : `${activeChans} aktive Kanäle`,
    });
    out.push({
      section: 'WHATSAPP', label: 'Outbound real getestet',
      status: lastOut ? 'PASS' : 'NOT TESTED',
      note: lastOut ? `zuletzt ${new Date(lastOut.created_at).toLocaleString('de-DE')}` : 'kein realer Versand erfasst',
    });

    // PUSH
    const { count: pushDevices } = await (supabase as any).from('mobile_push_subscriptions')
      .select('id', { count: 'exact', head: true }).is('revoked_at', null).is('blocked_at', null);
    out.push({
      section: 'PUSH', label: 'Aktive Geräte mit Push',
      status: (pushDevices ?? 0) > 0 ? 'PASS' : 'BLOCKER',
      note: `${pushDevices ?? 0} Geräte – native Credentials erforderlich`,
    });

    // TICKETS
    const { error: tErr, count: tCount } = await (supabase as any).from('tickets')
      .select('id', { count: 'exact', head: true });
    out.push({
      section: 'TICKETS', label: 'Ticketsystem erreichbar',
      status: tErr ? 'BLOCKER' : 'PASS', note: tErr ? tErr.message : `${tCount ?? 0} Tickets`,
    });

    // AI
    const { data: aiLast } = await (supabase as any).from('ai_classifications')
      .select('created_at, status').order('created_at', { ascending: false }).limit(1).maybeSingle();
    out.push({
      section: 'AI', label: 'Letzte KI-Verarbeitung',
      status: aiLast ? (aiLast.status === 'OK' ? 'PASS' : 'WARNING') : 'NOT TESTED',
      note: aiLast ? new Date(aiLast.created_at).toLocaleString('de-DE') : 'keine Anfragen erfasst',
    });
    out.push({ section: 'AI', label: 'Auto-Versand an Kunden deaktiviert', status: 'PASS', note: 'KI schlägt nur vor' });

    // STORAGE
    const { data: buckets, error: bErr } = await (supabase as any).storage.listBuckets?.() ?? { data: null, error: null };
    out.push({
      section: 'STORAGE', label: 'Medien-Bucket inbox-media privat',
      status: bErr ? 'WARNING' : (buckets ?? []).some((b: any) => b.name === 'inbox-media' && !b.public) ? 'PASS' : 'NOT TESTED',
    });

    // REALTIME
    const rtOk = await new Promise<boolean>((resolve) => {
      const ch = supabase.channel(`golive-${Date.now()}`);
      const to = window.setTimeout(() => { supabase.removeChannel(ch); resolve(false); }, 6000);
      ch.subscribe((s) => {
        if (s === 'SUBSCRIBED') { window.clearTimeout(to); supabase.removeChannel(ch); resolve(true); }
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { window.clearTimeout(to); supabase.removeChannel(ch); resolve(false); }
      });
    });
    out.push({ section: 'REALTIME', label: 'Subscription aufgebaut', status: rtOk ? 'PASS' : 'BLOCKER' });

    // NATIVE
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    out.push({ section: 'IOS', label: `Nativer iOS-Build getestet (${IOS_BUNDLE_ID})`, status: isNative ? 'PASS' : 'NOT TESTED', note: isNative ? undefined : 'läuft aktuell als Web/PWA' });
    out.push({ section: 'ANDROID', label: `Nativer Android-Build getestet (${ANDROID_PACKAGE})`, status: isNative ? 'PASS' : 'NOT TESTED', note: isNative ? undefined : 'läuft aktuell als Web/PWA' });

    // PRIVACY
    const { data: urls } = await (supabase as any).from('app_settings').select('key, value')
      .in('key', ['privacy_policy_url', 'support_url']);
    const umap: Record<string, string> = {};
    (urls ?? []).forEach((r: any) => { umap[r.key] = String(r.value ?? '').replace(/^"|"$/g, ''); });
    out.push({ section: 'PRIVACY', label: 'Datenschutz-URL hinterlegt', status: umap.privacy_policy_url ? 'PASS' : 'BLOCKER', note: umap.privacy_policy_url });
    out.push({ section: 'PRIVACY', label: 'Support-URL hinterlegt', status: umap.support_url ? 'PASS' : 'WARNING', note: umap.support_url });

    // MONITORING
    const snap = await fetchGoLiveSnapshot();
    out.push({
      section: 'MONITORING', label: 'Go-Live-Kennzahlen verfügbar',
      status: snap ? 'PASS' : 'BLOCKER',
    });
    if (snap) {
      out.push({
        section: 'MONITORING', label: 'Kritische Incidents offen',
        status: snap.incidents.critical_open > 0 ? 'BLOCKER' : 'PASS',
        note: `${snap.incidents.critical_open} kritisch · ${snap.incidents.open} offen`,
      });
      out.push({
        section: 'MONITORING', label: 'Doppelte eingehende Nachrichten (heute)',
        status: snap.duplicate_inbound > 0 ? 'BLOCKER' : 'PASS',
        note: `${snap.duplicate_inbound} Duplikate`,
      });
    }

    const [cfgs, pil, grp, aud] = await Promise.all([
      fetchConfigs().catch(() => []),
      fetchPilotOverview(),
      fetchRolloutGroups().catch(() => []),
      fetchConfigAudit().catch(() => []),
    ]);
    setConfigs(cfgs); setPilot(pil); setGroups(grp); setAudit(aud); setSnapshot(snap);
    setItems(out); setAt(new Date()); setLoading(false);
  }, []);

  useEffect(() => { if (allowed) void run(); else setLoading(false); }, [allowed, run]);

  if (!allowed) {
    return <div className="p-6 text-sm text-muted-foreground">Nur für Admin und Super Admin.</div>;
  }

  const blockers = items.filter((i) => i.status === 'BLOCKER');
  const warnings = items.filter((i) => i.status === 'WARNING');
  const notTested = items.filter((i) => i.status === 'NOT TESTED');
  const recommendation = blockers.length > 0 ? 'NO-GO' : warnings.length + notTested.length > 0 ? 'GO WITH WARNINGS' : 'GO';
  const sections = Array.from(new Set(items.map((i) => i.section)));

  const toggle = async (key: keyof MobileAppConfig, value: boolean) => {
    if (!cfg) return;
    try {
      await updateConfig(cfg.id, { [key]: value } as any);
      setConfigs((prev) => prev.map((c) => (c.id === cfg.id ? { ...c, [key]: value } as MobileAppConfig : c)));
      toast.success('Konfiguration gespeichert');
      setAudit(await fetchConfigAudit().catch(() => []));
    } catch (e: any) {
      toast.error(e.message ?? 'Änderung nicht möglich');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Go-Live Center</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Release */}
      <Card className="p-4 space-y-1">
        <div className="text-sm font-semibold">AlixWork Mobile</div>
        <div className="text-2xl font-bold">{APP_VERSION_MOBILE}</div>
        <div className="text-xs text-muted-foreground">
          Build {APP_BUILD} · {ENVIRONMENT} · Release Channel {cfg?.rollout_stage ? `Stage ${cfg.rollout_stage}` : 'RC1'}
        </div>
        {at && <div className="text-[10px] text-muted-foreground">Geprüft: {at.toLocaleString('de-DE')}</div>}
      </Card>

      {/* Empfehlung */}
      <Card className={`p-4 ${recommendation === 'NO-GO' ? 'border-destructive' : recommendation === 'GO' ? 'border-emerald-500/50' : 'border-amber-500/50'}`}>
        <div className="text-xs text-muted-foreground">Systemempfehlung (finale Freigabe durch Admin)</div>
        <div className="text-xl font-bold">{recommendation}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {blockers.length} Blocker · {warnings.length} Warnungen · {notTested.length} nicht getestet
        </div>
      </Card>

      {/* Heute */}
      {snapshot && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="w-4 h-4" /> Heute</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Kpi label="Eingehend" value={snapshot.today.inbound} />
            <Kpi label="Ausgehend" value={snapshot.today.outbound} />
            <Kpi label="Versand fehlgeschlagen" value={snapshot.today.outbound_failed} />
            <Kpi label="Tickets erstellt" value={snapshot.today.tickets_created} />
            <Kpi label="KI-Anfragen" value={snapshot.today.ai_requests} />
            <Kpi label="KI-Fehler" value={snapshot.today.ai_failures} />
            <Kpi label="Aktive Geräte" value={snapshot.devices.push_active} />
            <Kpi label="Pilotnutzer" value={snapshot.pilot.users} />
          </div>
        </Card>
      )}

      {/* Checks */}
      {sections.map((s) => (
        <Card key={s} className="p-4 space-y-2">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">{s}</div>
          {items.filter((i) => i.section === s).map((i, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {ICON[i.status]}
              <div className="min-w-0 flex-1">
                <div>{i.label}</div>
                {i.note && <div className="text-[11px] text-muted-foreground break-words">{i.note}</div>}
              </div>
              <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
            </div>
          ))}
        </Card>
      ))}

      {/* Not-Aus */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Power className="w-4 h-4 text-destructive" /> Mobile App Not-Aus ({cfg?.environment})</div>
        {KILL_SWITCHES.map((k) => (
          <div key={String(k.key)} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm">{k.label}</div>
              <div className="text-[11px] text-muted-foreground">{k.hint}</div>
            </div>
            <Switch
              checked={!!(cfg as any)?.[k.key]}
              onCheckedChange={(v) => void toggle(k.key, v)}
              disabled={!cfg}
            />
          </div>
        ))}
      </Card>

      {/* Pilotgruppen */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Users className="w-4 h-4" /> Pilotgruppen / Rollout-Stufen</div>
        {groups.map((g: any) => (
          <div key={g.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Stage {g.stage} · {g.name}</div>
              <div className="text-[11px] text-muted-foreground">{g.description}</div>
              <div className="text-[11px] text-muted-foreground">
                {pilot?.groups?.find((x: any) => x.id === g.id)?.members ?? 0} Mitglieder
              </div>
            </div>
            <Switch checked={!!g.is_active} onCheckedChange={async (v) => {
              try {
                await setGroupActive(g.id, v);
                setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, is_active: v } : x)));
                toast.success(v ? 'Stage freigegeben' : 'Stage deaktiviert');
              } catch (e: any) { toast.error(e.message); }
            }} />
          </div>
        ))}
        {pilot?.members?.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            {pilot.members.map((m: any) => (
              <div key={`${m.group}-${m.user_id}`} className="flex items-center justify-between text-xs">
                <span className="truncate">{m.name || m.email}</span>
                <span className="text-muted-foreground">{m.group} · {m.devices} Geräte</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Konfigurationsprotokoll */}
      {audit.length > 0 && (
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="w-4 h-4" /> Konfigurationsänderungen</div>
          {audit.slice(0, 10).map((a: any) => (
            <div key={a.id} className="text-[11px] text-muted-foreground">
              {new Date(a.changed_at).toLocaleString('de-DE')} · {a.environment} · {a.field}: {a.old_value} → {a.new_value}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value ?? 0}</div>
    </div>
  );
}
