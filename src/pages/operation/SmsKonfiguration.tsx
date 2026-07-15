import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import {
  MessageSquare, PlugZap, Send, Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type Status = {
  account_sid_set: boolean;
  account_sid_masked: string;
  auth_token_set: boolean;
  sms_from_set: boolean;
  whatsapp_from_set: boolean;
  effective_from: string | null;
};

type Template = {
  id: string;
  template_key: string;
  label: string;
  body: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

function StatusRow({ ok, label, value }: { ok: boolean; label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
        {label}
      </div>
      <code className="text-xs text-muted-foreground">{value || (ok ? 'gesetzt' : 'nicht gesetzt')}</code>
    </div>
  );
}

export default function SmsKonfiguration() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testText, setTestText] = useState('Test-SMS von Alix Lasers SMS-Konfiguration.');
  const [sending, setSending] = useState(false);

  const [tpls, setTpls] = useState<Template[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [saving, setSaving] = useState(false);

  const [cfg, setCfg] = useState({ account_sid: '', auth_token: '', from_number: '' });
  const [cfgLoading, setCfgLoading] = useState(true);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);

  async function loadStatus() {
    setLoadingStatus(true);
    const { data, error } = await supabase.functions.invoke('sms-config-test', { body: { action: 'status' } });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Status nicht ladbar');
    } else {
      setStatus((data as any).status);
    }
    setLoadingStatus(false);
  }

  async function loadSettings() {
    setCfgLoading(true);
    const { data, error } = await supabase
      .from('sms_settings').select('account_sid, from_number').eq('id', true).maybeSingle();
    if (error) toast.error(error.message);
    else setCfg({
      account_sid: (data as any)?.account_sid ?? '',
      auth_token: '',
      from_number: (data as any)?.from_number ?? '',
    });
    setCfgLoading(false);
  }

  async function loadTemplates() {
    setTplLoading(true);
    const { data, error } = await supabase
      .from('sms_templates')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) toast.error(error.message);
    else setTpls((data ?? []) as Template[]);
    setTplLoading(false);
  }

  useEffect(() => {
    if (isAdmin) {
      void loadStatus();
      void loadSettings();
      void loadTemplates();
    }
  }, [isAdmin]);

  async function saveSettings() {
    setCfgSaving(true);
    const { error } = await supabase.from('sms_settings').update({
      account_sid: cfg.account_sid.trim() || null,
      from_number: cfg.from_number.trim() || null,
    } as any).eq('id', true);
    if (error) {
      setCfgSaving(false);
      toast.error(error.message);
      return;
    }
    // If auth token was entered, store it encrypted via edge function (Vault)
    if (cfg.auth_token.trim()) {
      const { data, error: fnErr } = await supabase.functions.invoke('sms-save-auth-token', {
        body: { auth_token: cfg.auth_token.trim() },
      });
      if (fnErr || (data as any)?.error) {
        setCfgSaving(false);
        toast.error((data as any)?.error || fnErr?.message || 'Auth-Token konnte nicht gespeichert werden');
        return;
      }
    }
    setCfgSaving(false);
    toast.success('Twilio-Verbindung gespeichert');
    setCredsOpen(false);
    setShowToken(false);
    setCfg((c) => ({ ...c, auth_token: '' }));
    void loadStatus();
  }


  async function sendTest() {
    if (!testPhone.trim()) {
      toast.error('Bitte Mobilnummer angeben');
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('sms-config-test', {
      body: { action: 'test', phone: testPhone, text: testText },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Test fehlgeschlagen');
    } else {
      toast.success(`Test-SMS gesendet (SID ${(data as any).sid})`);
    }
  }

  async function saveTemplate() {
    if (!editing) return;
    const payload = {
      template_key: editing.template_key?.trim(),
      label: editing.label?.trim(),
      body: editing.body ?? '',
      sort_order: editing.sort_order ?? 100,
      active: editing.active ?? true,
    };
    if (!payload.template_key || !payload.label || !payload.body) {
      toast.error('Schlüssel, Bezeichnung und Text sind Pflicht.');
      return;
    }
    setSaving(true);
    let res;
    if (editing.id) {
      res = await supabase.from('sms_templates').update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('sms_templates').insert(payload);
    }
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success('Vorlage gespeichert');
      setEditing(null);
      void loadTemplates();
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm('Vorlage wirklich löschen?')) return;
    const { error } = await supabase.from('sms_templates').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Gelöscht');
      void loadTemplates();
    }
  }

  async function toggleActive(t: Template) {
    const { error } = await supabase.from('sms_templates').update({ active: !t.active }).eq('id', t.id);
    if (error) toast.error(error.message);
    else void loadTemplates();
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nur Admin / Super Admin dürfen die SMS-Konfiguration einsehen.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={MessageSquare}
        title="SMS Konfiguration"
        subtitle="Twilio-Verbindung prüfen und SMS-Vorlagen verwalten."
      />

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-primary" /> Twilio-Verbindung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus || !status ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Status wird geladen …
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border p-4 bg-background/40">
                <StatusRow ok={status.account_sid_set} label="TWILIO_ACCOUNT_SID" value={status.account_sid_masked} />
                <StatusRow ok={status.auth_token_set} label="TWILIO_AUTH_TOKEN" />
                <StatusRow ok={status.sms_from_set} label="TWILIO_SMS_FROM_NUMBER" />
                <StatusRow ok={status.whatsapp_from_set} label="TWILIO_WHATSAPP_FROM_NUMBER (Fallback)" />
                <StatusRow ok={!!status.effective_from} label="Effektive Absendernummer" value={status.effective_from ?? '—'} />
              </div>
              <p className="text-xs text-muted-foreground">
                In der Datenbank hinterlegte Werte überschreiben die Supabase-Secrets. Leer lassen, um auf den Secret-Wert zurückzufallen.
              </p>
            </>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Twilio-Zugangsdaten bearbeiten</div>
              <Button variant="ghost" size="sm" onClick={() => setCredsOpen((o) => !o)}>
                {credsOpen ? 'Schließen' : 'Bearbeiten'}
              </Button>
            </div>
            {credsOpen && (cfgLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Lädt …
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account SID</Label>
                    <Input
                      value={cfg.account_sid}
                      onChange={(e) => setCfg({ ...cfg, account_sid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Absender (E.164 oder Sender-ID, z. B. ALIXLASERS)</Label>
                    <Input
                      value={cfg.from_number}
                      onChange={(e) => setCfg({ ...cfg, from_number: e.target.value })}
                      placeholder="ALIXLASERS oder +49 …"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Auth Token</Label>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToken((s) => !s)}
                      >
                        {showToken ? 'verbergen' : 'anzeigen'}
                      </button>
                    </div>
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={cfg.auth_token}
                      onChange={(e) => setCfg({ ...cfg, auth_token: e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setCredsOpen(false); setShowToken(false); }}>
                    Abbrechen
                  </Button>
                  <Button onClick={saveSettings} disabled={cfgSaving}>
                    {cfgSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Speichern
                  </Button>
                </div>
              </>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-sm font-medium">Test-SMS senden</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mobilnummer (E.164)</Label>
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+49 170 …" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nachricht</Label>
                <Input value={testText} onChange={(e) => setTestText(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={sendTest} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Test-SMS senden
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> SMS-Vorlagen
          </CardTitle>
          <Button size="sm" onClick={() => setEditing({ active: true, sort_order: 100, body: 'Hallo {{kunde}}, … {{link}}' })}>
            <Plus className="w-4 h-4 mr-1.5" /> Neue Vorlage
          </Button>
        </CardHeader>
        <CardContent>
          {tplLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : tpls.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Keine Vorlagen vorhanden.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reihenfolge</TableHead>
                    <TableHead>Schlüssel</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tpls.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{t.sort_order}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{t.template_key}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{t.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[420px] truncate">{t.body}</TableCell>
                      <TableCell><Switch checked={t.active} onCheckedChange={() => toggleActive(t)} /></TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeTemplate(t.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Platzhalter: <code>{'{{kunde}}'}</code>, <code>{'{{link}}'}</code> — werden beim Versand automatisch ersetzt.
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Schlüssel</Label>
                  <Input
                    value={editing.template_key ?? ''}
                    onChange={(e) => setEditing({ ...editing, template_key: e.target.value })}
                    placeholder="z. B. rechnung"
                    disabled={!!editing.id}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reihenfolge</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 100}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bezeichnung</Label>
                <Input
                  value={editing.label ?? ''}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">SMS-Text</Label>
                <Textarea
                  rows={5}
                  value={editing.body ?? ''}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Platzhalter <code>{'{{kunde}}'}</code> und <code>{'{{link}}'}</code> verfügbar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <Label className="text-sm">Aktiv</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Abbrechen</Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
