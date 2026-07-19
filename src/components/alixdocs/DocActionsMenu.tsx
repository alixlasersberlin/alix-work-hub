import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Workflow, PenTool, Share2, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Doc = { id: string; title: string; mime_type: string; customer_id?: string | null };

export default function DocActionsMenu({ doc, onChanged }: { doc: Doc; onChanged?: () => void }) {
  const [dlg, setDlg] = useState<null | 'approval' | 'sign' | 'share'>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" title="Weitere Aktionen"><MoreHorizontal className="w-4 h-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Etappe D</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setDlg('approval')}><Workflow className="w-3 h-3 mr-2" /> Freigabekette starten</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg('sign')} disabled={doc.mime_type !== 'application/pdf'}>
            <PenTool className="w-3 h-3 mr-2" /> Zur E-Signatur senden
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDlg('share')}><Share2 className="w-3 h-3 mr-2" /> Kundenportal-Freigabe</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dlg === 'approval' && <ApprovalDialog doc={doc} onClose={() => { setDlg(null); onChanged?.(); }} />}
      {dlg === 'sign' && <SignDialog doc={doc} onClose={() => { setDlg(null); onChanged?.(); }} />}
      {dlg === 'share' && <ShareDialog doc={doc} onClose={() => { setDlg(null); onChanged?.(); }} />}
    </>
  );
}

function ApprovalDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [chains, setChains] = useState<{ id: string; name: string }[]>([]);
  const [chainId, setChainId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from('alixdocs_approval_chains').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setChains(data ?? []));
  }, []);
  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('alixdocs-approval-start', {
      body: { document_id: doc.id, chain_id: chainId || undefined },
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Freigabekette gestartet');
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Freigabekette starten</DialogTitle>
          <DialogDescription>„{doc.title}" wird zur Freigabe an die konfigurierten Approver gesendet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Kette (optional – sonst Standard der Kategorie)</Label>
          <select className="w-full border rounded p-2 bg-background text-sm" value={chainId} onChange={e => setChainId(e.target.value)}>
            <option value="">Standard aus Kategorie</option>
            {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={start} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Starten'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!email) { toast.error('E-Mail Pflicht'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('alixdocs-sign-request', {
      body: { document_id: doc.id, signer_email: email, signer_name: name, message: msg },
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Signaturanfrage erstellt');
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenTool className="w-4 h-4" /> An ALIX SIGN PRO senden</DialogTitle>
          <DialogDescription>„{doc.title}" wird als Signaturanfrage angelegt. Das signierte PDF fließt automatisch als neue Version zurück.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Empfänger-E-Mail *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Name (optional)</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Nachricht</Label><Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={send} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Anfrage senden'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [shares, setShares] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState(doc.customer_id ?? '');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('alixdocs_portal_shares').select('*').eq('document_id', doc.id).order('shared_at', { ascending: false });
    setShares(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!customerId) { toast.error('Kunde erforderlich'); return; }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('alixdocs_portal_shares').insert({
      document_id: doc.id, customer_id: customerId, shared_by: userData.user!.id,
      expires_at: expires || null, note: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Portal-Freigabe erteilt');
    setNote(''); setExpires('');
    load();
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.from('alixdocs_portal_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Freigabe widerrufen');
    load();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4" /> Kundenportal-Freigabe</DialogTitle>
          <DialogDescription>„{doc.title}" für Kunden im Portal read-only sichtbar machen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kunden-ID</Label>
            <Input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="UUID" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Läuft ab</Label><Input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} /></div>
            <div><Label>Notiz</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
          </div>
          <Button onClick={add} disabled={busy} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Freigabe erteilen'}
          </Button>

          <div className="border rounded divide-y max-h-52 overflow-auto">
            {shares.length === 0 && <p className="p-3 text-xs text-muted-foreground italic">Noch keine Freigaben.</p>}
            {shares.map(s => (
              <div key={s.id} className="p-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono truncate max-w-[220px]">{s.customer_id}</div>
                  <div className="text-muted-foreground">
                    {s.revoked_at ? `widerrufen ${new Date(s.revoked_at).toLocaleString('de-DE')}` : `aktiv · ${s.download_count} Downloads`}
                  </div>
                </div>
                {!s.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}><Trash2 className="w-3 h-3" /></Button>}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <a href="/portal/dokumente" target="_blank" className="text-xs text-primary inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Portal-Ansicht</a>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
