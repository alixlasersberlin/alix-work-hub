import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Power, Copy, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function FinanceStakeholders() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Geschäftsführung');
  const isSuper = roles.includes('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', email: '', role: 'viewer', allowed_reports: [], expires_at: '',
  });

  const load = async () => {
    setLoading(true);
    const [{ data: r1 }, { data: r2 }] = await Promise.all([
      supabase.from('finance_stakeholders' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('finance_reports' as any).select('id,name').order('name'),
    ]);
    setRows((r1 ?? []) as any[]);
    setReports((r2 ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload: any = {
        ...form,
        expires_at: form.expires_at || null,
      };
      const { error } = await supabase.from('finance_stakeholders' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Stakeholder angelegt' });
      setShow(false);
      setForm({ name: '', email: '', role: 'viewer', allowed_reports: [], expires_at: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/stakeholder/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link kopiert', description: url });
  };

  const toggleEnabled = async (r: any) => {
    await supabase.from('finance_stakeholders' as any).update({ enabled: !r.enabled }).eq('id', r.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Stakeholder löschen?')) return;
    await supabase.from('finance_stakeholders' as any).delete().eq('id', id);
    load();
  };

  const toggleReport = (id: string) => {
    setForm((f: any) => ({ ...f, allowed_reports: f.allowed_reports.includes(id) ? f.allowed_reports.filter((x: string) => x !== id) : [...f.allowed_reports, id] }));
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Stakeholder-Portale" subtitle="Externe Empfänger mit Token-Zugriff auf ausgewählte Berichte" icon={Users}
        actions={canEdit && <Button onClick={() => setShow(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Stakeholder</Button>} />

      <DataCard title={`Stakeholder (${rows.length})`}>
        {rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">Keine Stakeholder konfiguriert.</div> : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? 'aktiv' : 'gesperrt'}</Badge>
                    <Badge variant="outline">{r.role}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{r.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Berichte: {(r.allowed_reports || []).length} · Zugriffe: {r.access_count}
                    {r.expires_at && ` · läuft ab: ${new Date(r.expires_at).toLocaleDateString('de-DE')}`}
                    {r.last_access_at && ` · zuletzt: ${new Date(r.last_access_at).toLocaleString('de-DE')}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.access_token)}><Copy className="h-4 w-4 mr-1" />Link</Button>
                  {canEdit && <Button size="sm" variant="outline" onClick={() => toggleEnabled(r)}><Power className="h-4 w-4" /></Button>}
                  {isSuper && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Stakeholder</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">E-Mail</label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Rolle</label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (nur ansehen)</SelectItem>
                  <SelectItem value="auditor">Auditor (mit Download)</SelectItem>
                  <SelectItem value="board">Beirat / Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ablauf-Datum (optional)</label>
              <Input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Erlaubte Berichte</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {reports.length === 0 ? <span className="text-sm text-muted-foreground">Keine Berichte vorhanden</span> :
                  reports.map(r => (
                    <Badge key={r.id} variant={form.allowed_reports.includes(r.id) ? 'default' : 'outline'}
                      className="cursor-pointer" onClick={() => toggleReport(r.id)}>{r.name}</Badge>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!form.name || !form.email}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
