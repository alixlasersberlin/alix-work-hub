import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Repeat, Send, Eye, Trash2, Printer, Download, RefreshCw, Loader2, Save, Mail, History, Settings as SettingsIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { RZ_T } from '@/lib/finance/rz-i18n';

const fmt = (n: number | null, c = 'EUR') =>
  n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(n));
const fmtDate = (d?: string | null) => (d ? new Date(String(d).slice(0, 10)).toLocaleDateString('de-DE') : '—');
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('de-DE') : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);

type Reminder = {
  id: string; customer_id: string | null; customer_number: string | null; customer_name: string | null;
  contract_number: string | null; invoice_number: string | null; payment_method: string; frequency: string | null;
  due_date: string; send_date: string; last_payment_date: string | null; amount: number | null; currency: string;
  email: string | null; status: string; send_mode: string | null; sent_at: string | null; error: string | null;
};
type LogRow = {
  id: string; customer_name: string | null; invoice_number: string | null; email: string | null; sent_at: string;
  channel: string; mode: string; success: boolean; error: string | null; user_email: string | null;
  amount: number | null; currency: string | null; payment_method: string | null;
};
type Settings = {
  auto_enabled: boolean; lead_days: number; extra_lead_days: number[]; bcc: string[];
  subject: string; language: string; shop_url: string;
};

const PayBadge = ({ m }: { m: string }) =>
  m === 'sepa'
    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">SEPA</Badge>
    : <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Selbstzahler</Badge>;

const StatusBadge = ({ s }: { s: string }) => {
  const map: Record<string, string> = {
    pending: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    sent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    removed: 'bg-muted text-muted-foreground',
  };
  const lbl: Record<string, string> = { pending: 'Offen', sent: 'Versendet', failed: 'Fehler', removed: 'Entfernt' };
  return <Badge className={map[s] ?? ''}>{lbl[s] ?? s}</Badge>;
};

export default function WiederkehrendeZahlerErinnerungen() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'uebersicht';
  const { isSuperAdmin, canWrite } = useFinancePermissions();
  const T = RZ_T.de;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, l, s] = await Promise.all([
      supabase.from('rz_reminders' as any).select('*').order('due_date', { ascending: true }).limit(2000),
      supabase.from('rz_reminder_log' as any).select('*').order('sent_at', { ascending: false }).limit(500),
      supabase.from('rz_reminder_settings' as any).select('*').eq('id', true).maybeSingle(),
    ]);
    if (r.error) toast({ title: 'Fehler', description: r.error.message, variant: 'destructive' });
    setReminders(((r.data ?? []) as any[]) as Reminder[]);
    setLogs(((l.data ?? []) as any[]) as LogRow[]);
    if (s.data) setSettings(s.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = todayIso();
  const dueToday = reminders.filter(r => r.due_date === today);
  const batch = reminders.filter(r => r.status === 'pending' && r.send_date <= today);
  const sentToday = reminders.filter(r => r.status === 'sent' && (r.sent_at ?? '').slice(0, 10) === today);
  const openCount = reminders.filter(r => r.status === 'pending').length;
  const sepaCount = reminders.filter(r => r.payment_method === 'sepa').length;
  const selfCount = reminders.filter(r => r.payment_method !== 'sepa').length;

  const filter = (list: Reminder[]) => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(r =>
      `${r.customer_name ?? ''} ${r.customer_number ?? ''} ${r.invoice_number ?? ''} ${r.contract_number ?? ''} ${r.email ?? ''}`
        .toLowerCase().includes(s));
  };

  const upcoming = useMemo(
    () => filter(reminders.filter(r => r.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date))),
    [reminders, q, today],
  );
  const batchList = useMemo(() => filter(batch), [reminders, q, today]);

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Reminder[]) =>
    setSel(p => (list.every(r => p.has(r.id)) ? new Set() : new Set(list.map(r => r.id))));

  const runBuild = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('rz-reminder-build', { body: {} });
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Fälligkeiten geprüft', description: `${(data as any)?.created ?? 0} neue Erinnerungen erzeugt.` });
    load();
  };

  const send = async (ids: string[], preview = false) => {
    if (!ids.length) return toast({ title: 'Keine Auswahl', description: 'Bitte mindestens einen Eintrag wählen.' });
    if (!canWrite) return toast({ title: 'Keine Berechtigung', variant: 'destructive' });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('rz-reminder-send', {
      body: { reminder_ids: ids, preview, mode: 'manual' },
    });
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    if (preview) {
      setPreviewHtml((data as any)?.results?.[0]?.html ?? '<p>Keine Vorschau verfügbar.</p>');
      return;
    }
    toast({ title: 'Versand abgeschlossen', description: `${(data as any)?.sent ?? 0} versendet, ${(data as any)?.failed ?? 0} fehlerhaft.` });
    setSel(new Set());
    load();
  };

  const removeFromBatch = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from('rz_reminders' as any).update({ status: 'removed' } as any).in('id', ids);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setSel(new Set());
    load();
  };

  const exportCsv = (list: Reminder[]) => {
    const head = ['Kunde', 'Kundennummer', 'Vertrag', 'Rechnung', 'Zahlungsart', 'Fälligkeit', 'Betrag', 'E-Mail', 'Status'];
    const rows = list.map(r => [
      r.customer_name, r.customer_number, r.contract_number, r.invoice_number,
      r.payment_method === 'sepa' ? 'SEPA' : 'Selbstzahler', r.due_date, r.amount ?? '', r.email, r.status,
    ]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `sammelversand-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase.from('rz_reminder_settings' as any).update(settings as any).eq('id', true);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Gespeichert', description: 'Einstellungen aktualisiert.' });
  };

  const clearHistory = async () => {
    if (!isSuperAdmin) return;
    if (!confirm('Gesamte Versandhistorie löschen?')) return;
    const { error } = await supabase.from('rz_reminder_log' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    load();
  };

  const Table = ({ list, selectable }: { list: Reminder[]; selectable?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            {selectable && (
              <th className="p-2 w-8">
                <Checkbox checked={list.length > 0 && list.every(r => sel.has(r.id))} onCheckedChange={() => toggleAll(list)} />
              </th>
            )}
            <th className="p-2 text-left">Kunde</th>
            <th className="p-2 text-left">Kunden-Nr.</th>
            <th className="p-2 text-left">Vertrag</th>
            <th className="p-2 text-left">Rechnung</th>
            <th className="p-2 text-left">Zahlungsart</th>
            <th className="p-2 text-left">Rhythmus</th>
            <th className="p-2 text-left">Fälligkeit</th>
            <th className="p-2 text-right">Betrag</th>
            <th className="p-2 text-left">E-Mail</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id} className={i % 2 ? 'bg-muted/20' : ''}>
              {selectable && <td className="p-2"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>}
              <td className="p-2 font-medium">{r.customer_name ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{r.customer_number ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{r.contract_number ?? '—'}</td>
              <td className="p-2">{r.invoice_number ?? '—'}</td>
              <td className="p-2"><PayBadge m={r.payment_method} /></td>
              <td className="p-2 text-muted-foreground">{r.frequency ?? '—'}</td>
              <td className="p-2">{fmtDate(r.due_date)}</td>
              <td className="p-2 text-right">{fmt(r.amount, r.currency)}</td>
              <td className="p-2 text-muted-foreground">{r.email ?? <span className="text-red-400">fehlt</span>}</td>
              <td className="p-2"><StatusBadge s={r.status} /></td>
              <td className="p-2 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => send([r.id], true)}><Eye className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" disabled={!canWrite || busy} onClick={() => send([r.id])}>
                  <Send className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Keine Einträge.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        icon={Repeat}
        title="Wiederkehrende Zahler – Zahlungserinnerungen"
        subtitle={`Automatische Erinnerung ${settings?.lead_days ?? 3} Kalendertage vor Fälligkeit · SEPA & Selbstzahler`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren
            </Button>
            <Button size="sm" onClick={runBuild} disabled={busy || !canWrite}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Fälligkeiten prüfen
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiTile label="Heute fällig" value={String(dueToday.length)} />
        <KpiTile label="Erinnerungen heute" value={String(batch.length + sentToday.length)} />
        <KpiTile label="Bereits versendet" value={String(sentToday.length)} />
        <KpiTile label="Offene Erinnerungen" value={String(openCount)} />
        <KpiTile label="SEPA" value={String(sepaCount)} />
        <KpiTile label="Selbstzahler" value={String(selfCount)} />
      </div>

      <Input placeholder="Suche Kunde, Kundennummer, Rechnung, E-Mail …" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      <Tabs value={tab} onValueChange={v => setParams({ tab: v })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="faelligkeiten">Fälligkeiten</TabsTrigger>
          <TabsTrigger value="sammelversand">Sammelversand</TabsTrigger>
          <TabsTrigger value="einzelversand">Einzelversand</TabsTrigger>
          <TabsTrigger value="historie">Versandhistorie</TabsTrigger>
          <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          <DataCard title="Alle wiederkehrenden Zahler mit Erinnerung">
            <p className="text-sm text-muted-foreground mb-3">
              Stammdaten der Verträge findest du weiterhin unter{' '}
              <Link className="underline" to="/finance/wiederkehrende-zahler">Wiederkehrende Zahler</Link>.
            </p>
            <Table list={filter(reminders)} />
          </DataCard>
        </TabsContent>

        <TabsContent value="faelligkeiten" className="mt-4">
          <DataCard title="Kommende Fälligkeiten">
            <Table list={upcoming} />
          </DataCard>
        </TabsContent>

        <TabsContent value="sammelversand" className="mt-4">
          <DataCard title={`Heute zu versenden (${batchList.length})`}>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button size="sm" disabled={!canWrite || busy || sel.size === 0} onClick={() => send([...sel])}>
                <Send className="h-4 w-4 mr-2" />Sammelversand starten
              </Button>
              <Button size="sm" variant="outline" disabled={sel.size === 0} onClick={() => send([[...sel][0]], true)}>
                <Eye className="h-4 w-4 mr-2" />Vorschau
              </Button>
              <Button size="sm" variant="outline" disabled={!canWrite || sel.size === 0} onClick={() => removeFromBatch([...sel])}>
                <Trash2 className="h-4 w-4 mr-2" />Entfernen
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />Drucken
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(batchList)}>
                <Download className="h-4 w-4 mr-2" />Exportieren
              </Button>
            </div>
            <Table list={batchList} selectable />
          </DataCard>
        </TabsContent>

        <TabsContent value="einzelversand" className="mt-4">
          <DataCard title="Erinnerung jetzt senden">
            <p className="text-sm text-muted-foreground mb-3">
              Über <Mail className="inline h-4 w-4" /> kann jede Erinnerung jederzeit einzeln versendet werden – unabhängig vom Sammelversand.
            </p>
            <Table list={filter(reminders.filter(r => r.status !== 'removed'))} />
          </DataCard>
        </TabsContent>

        <TabsContent value="historie" className="mt-4">
          <DataCard
            title="Versandhistorie"
            actions={isSuperAdmin
              ? <Button size="sm" variant="outline" onClick={clearHistory}><Trash2 className="h-4 w-4 mr-2" />Historie löschen</Button>
              : undefined}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2 text-left">Kunde</th>
                    <th className="p-2 text-left">Rechnung</th>
                    <th className="p-2 text-left">Versanddatum / Uhrzeit</th>
                    <th className="p-2 text-left">Versandart</th>
                    <th className="p-2 text-left">Auslösung</th>
                    <th className="p-2 text-left">Benutzer</th>
                    <th className="p-2 text-left">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} className={i % 2 ? 'bg-muted/20' : ''}>
                      <td className="p-2 font-medium">{l.customer_name ?? '—'}</td>
                      <td className="p-2">{l.invoice_number ?? '—'}</td>
                      <td className="p-2">{fmtDateTime(l.sent_at)}</td>
                      <td className="p-2 uppercase text-muted-foreground">{l.channel}</td>
                      <td className="p-2">{l.mode === 'auto' ? 'Automatisch' : 'Manuell'}</td>
                      <td className="p-2 text-muted-foreground">{l.user_email ?? 'System'}</td>
                      <td className="p-2">
                        {l.success
                          ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Erfolgreich</Badge>
                          : <Badge className="bg-red-500/15 text-red-400 border-red-500/30">{l.error ?? 'Fehler'}</Badge>}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Noch keine Versände.</td></tr>}
                </tbody>
              </table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="einstellungen" className="mt-4">
          <DataCard title="Einstellungen">
            {!settings ? <p className="text-muted-foreground">Lade …</p> : (
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center justify-between">
                  <Label>Automatischer Hintergrundjob aktiv</Label>
                  <Switch
                    checked={settings.auto_enabled}
                    disabled={!canWrite}
                    onCheckedChange={v => setSettings({ ...settings, auto_enabled: v })}
                  />
                </div>
                <div>
                  <Label>Vorlaufzeit (Kalendertage vor Fälligkeit)</Label>
                  <Input type="number" min={0} value={settings.lead_days} disabled={!canWrite}
                    onChange={e => setSettings({ ...settings, lead_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Zusätzliche Vorlauftage (kommagetrennt)</Label>
                  <Input value={(settings.extra_lead_days ?? []).join(', ')} disabled={!canWrite}
                    onChange={e => setSettings({
                      ...settings,
                      extra_lead_days: e.target.value.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)),
                    })} />
                </div>
                <div>
                  <Label>BCC-Empfänger (kommagetrennt)</Label>
                  <Input value={(settings.bcc ?? []).join(', ')} disabled={!canWrite}
                    onChange={e => setSettings({ ...settings, bcc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <Label>Betreff</Label>
                  <Input value={settings.subject} disabled={!canWrite}
                    onChange={e => setSettings({ ...settings, subject: e.target.value })} />
                </div>
                <div>
                  <Label>Shop-Link</Label>
                  <Input value={settings.shop_url} disabled={!canWrite}
                    onChange={e => setSettings({ ...settings, shop_url: e.target.value })} />
                </div>
                <div>
                  <Label>Sprache (Standard: Deutsch)</Label>
                  <Input value={settings.language} disabled={!canWrite}
                    onChange={e => setSettings({ ...settings, language: e.target.value })} />
                </div>
                <Button onClick={saveSettings} disabled={!canWrite}><Save className="h-4 w-4 mr-2" />Speichern</Button>
              </div>
            )}
          </DataCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewHtml} onOpenChange={o => !o && setPreviewHtml(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{T.subject} – Vorschau</DialogTitle></DialogHeader>
          <iframe title="preview" className="w-full h-[60vh] bg-white rounded" srcDoc={previewHtml ?? ''} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
