import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ShieldCheck, Upload, FileText, Bell, Webhook, ClipboardList, Trash2, Plus } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const DOC_TYPES = [
  'angebot','auftrag','rechnung','lieferschein','servicebericht','arbeitsbericht',
  'wartungsprotokoll','reparaturbericht','abnahmeprotokoll','leasing','finanzierung',
  'mietvertrag','schulungsvertrag','datenschutz','nda','servicevertrag','garantie',
  'rma','retourenschein','zahlungsvereinbarung','sonstiges',
];

export default function DigitaleSignaturenAdmin() {
  return (
    <PageShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Admin · Digitale Signaturen</h1>
            <p className="text-sm text-muted-foreground">Vorlagen, Stempel, Erinnerungen, Webhooks und Audit-Log</p>
          </div>
        </div>

        <Tabs defaultValue="stamps">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="stamps"><Upload className="w-4 h-4 mr-1" /> Stempel & Signaturen</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="w-4 h-4 mr-1" /> Vorlagen</TabsTrigger>
            <TabsTrigger value="reminders"><Bell className="w-4 h-4 mr-1" /> Erinnerungen</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-1" /> Webhooks</TabsTrigger>
            <TabsTrigger value="audit"><ClipboardList className="w-4 h-4 mr-1" /> Audit-Log</TabsTrigger>
          </TabsList>

          <TabsContent value="stamps"><StampsPanel /></TabsContent>
          <TabsContent value="templates"><TemplatesPanel /></TabsContent>
          <TabsContent value="reminders"><RemindersPanel /></TabsContent>
          <TabsContent value="webhooks"><WebhooksPanel /></TabsContent>
          <TabsContent value="audit"><AuditPanel /></TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function StampsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'signature' | 'initials' | 'company_stamp' | 'name_stamp'>('signature');
  const [companyWide, setCompanyWide] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase.from('sig_stamps').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file || !name) return toast.error('Datei und Name erforderlich');
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Nicht angemeldet');
      const path = `${uid}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('sig-assets').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('sig_stamps').insert({
        owner_user_id: uid, name, kind, storage_path: path, mime_type: file.type,
        is_company_wide: companyWide, created_by: uid,
      });
      if (insErr) throw insErr;
      toast.success('Hochgeladen');
      setName(''); setFile(null); setCompanyWide(false); await load();
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const del = async (id: string, path: string) => {
    if (!confirm('Wirklich löschen?')) return;
    await supabase.storage.from('sig-assets').remove([path]);
    await supabase.from('sig_stamps').delete().eq('id', id);
    await load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Signaturen & Stempel</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-5 gap-2 items-end p-3 border rounded-lg bg-muted/30">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Typ</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="signature">Unterschrift</SelectItem>
                <SelectItem value="initials">Initialen</SelectItem>
                <SelectItem value="company_stamp">Firmenstempel</SelectItem>
                <SelectItem value="name_stamp">Namensstempel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Datei (PNG/SVG)</Label><Input type="file" accept="image/png,image/svg+xml" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="flex items-center gap-2 pb-2"><Switch checked={companyWide} onCheckedChange={setCompanyWide} /><span className="text-sm">Firmenweit</span></div>
          <Button onClick={upload} disabled={uploading}><Upload className="w-4 h-4 mr-2" />Hochladen</Button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div><div className="font-medium text-sm">{r.name}</div><div className="text-xs text-muted-foreground">{r.kind}</div></div>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id, r.storage_path)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                {r.is_company_wide && <Badge variant="outline">Firmenweit</Badge>}
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-6">Noch keine Uploads</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [docType, setDocType] = useState('angebot');

  const load = async () => {
    const { data } = await supabase.from('sig_templates').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('sig_templates').insert({
      name, document_type: docType, fields: [], default_signers: [], created_by: userData.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Vorlage erstellt');
    setOpen(false); setName(''); await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Signaturfeld-Vorlagen</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Neu</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Vorlage</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div>
                <Label>Dokumenttyp</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Anlegen</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr><th className="py-2">Name</th><th>Dokumenttyp</th><th>Felder</th><th>Aktiv</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 font-medium">{r.name}</td>
                <td>{r.document_type}</td>
                <td>{Array.isArray(r.fields) ? r.fields.length : 0}</td>
                <td>{r.is_active ? '✓' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Noch keine Vorlagen</td></tr>}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">Drag&amp;Drop-Feldplatzierung folgt in Phase 2.</p>
      </CardContent>
    </Card>
  );
}

function RemindersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from('sig_reminder_rules').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const addDefault = async () => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('sig_reminder_rules').insert({
      document_type: null, offsets_hours: [24, 72, 168], is_active: true, created_by: userData.user!.id,
    });
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Automatische Erinnerungen</CardTitle>
        <Button size="sm" onClick={addDefault}><Plus className="w-4 h-4 mr-1" />Standard-Regel</Button>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr><th className="py-2">Dokumenttyp</th><th>Intervalle (h)</th><th>Eskalation</th><th>Aktiv</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.document_type || 'alle'}</td>
                <td>{r.offsets_hours?.join(', ')}</td>
                <td>{r.escalate_to_role || '—'}</td>
                <td>{r.is_active ? '✓' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Keine Regeln</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function WebhooksPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [secret, setSecret] = useState('');

  const load = async () => {
    const { data } = await supabase.from('sig_webhooks').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('sig_webhooks').insert({
      name, url, secret: secret || crypto.randomUUID(),
      events: ['signature.created','signature.sent','signature.signed','signature.declined','signature.completed'],
      created_by: userData.user!.id,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setName(''); setUrl(''); setSecret(''); await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Webhooks</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Neu</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neuer Webhook</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
              <div><Label>Secret (optional)</Label><Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="wird generiert wenn leer" /></div>
            </div>
            <DialogFooter><Button onClick={create}>Anlegen</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr><th className="py-2">Name</th><th>URL</th><th>Events</th><th>Aktiv</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.name}</td>
                <td className="text-xs font-mono">{r.url}</td>
                <td className="text-xs">{r.events?.length}</td>
                <td>{r.is_active ? '✓' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Keine Webhooks</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AuditPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sig_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
      setRows(data || []);
    })();
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit-Log (letzte 200)</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Zeit</th><th>Event</th><th>Dokument</th><th>Signer</th><th>IP</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="font-mono">{r.event}</td>
                  <td className="font-mono">{r.document_id?.slice(0, 8)}</td>
                  <td className="font-mono">{r.signer_id?.slice(0, 8) || '—'}</td>
                  <td>{r.ip_address || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Keine Einträge</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
