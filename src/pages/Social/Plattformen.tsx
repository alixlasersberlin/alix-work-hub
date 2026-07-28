import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Eye, Trash2, Plus, Link2 } from 'lucide-react';
import { CustomerLinkDialog } from '@/components/social/CustomerLinkDialog';

type Client = { id: string; company_name: string; contact_person: string | null; onboarding_status: string; customer_id: string | null };
type LinkedCustomer = { id: string; company_name: string | null; source_system: string | null };
type Account = { id: string; client_id: string; platform: string; username: string | null; connected: boolean; status: string };

export default function SocialPlattformen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account[]>>({});
  const [linkedCustomers, setLinkedCustomers] = useState<Record<string, LinkedCustomer>>({});
  const [openCred, setOpenCred] = useState<Account | null>(null);
  const [linkClient, setLinkClient] = useState<Client | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = async () => {
    const { data: cs } = await supabase.from('social_clients').select('id,company_name,contact_person,onboarding_status,customer_id').is('deleted_at', null).order('created_at', { ascending: false });
    setClients((cs ?? []) as Client[]);
    if (cs?.length) {
      const { data: acs } = await supabase.from('social_accounts').select('*').in('client_id', cs.map(c => c.id)).is('deleted_at', null);
      const grouped: Record<string, Account[]> = {};
      (acs ?? []).forEach(a => { (grouped[a.client_id] ||= []).push(a as Account); });
      setAccounts(grouped);
      const custIds = Array.from(new Set((cs as Client[]).map(c => c.customer_id).filter(Boolean) as string[]));
      if (custIds.length) {
        const { data: custs } = await supabase.from('customers').select('id,company_name,source_system').in('id', custIds);
        const map: Record<string, LinkedCustomer> = {};
        (custs ?? []).forEach((c: any) => { map[c.id] = c; });
        setLinkedCustomers(map);
      } else {
        setLinkedCustomers({});
      }
    }
  };
  useEffect(() => { load(); }, []);

  async function storeCred() {
    if (!openCred || !password) return;
    const { error } = await supabase.functions.invoke('social-credentials', {
      body: { action: 'store', account_id: openCred.id, password },
    });
    if (error) return toast.error(error.message);
    if (username && username !== openCred.username) {
      await supabase.from('social_accounts').update({ username }).eq('id', openCred.id);
    }
    toast.success('Zugangsdaten verschlüsselt gespeichert');
    setPassword(''); setUsername(''); setOpenCred(null); load();
  }

  async function reveal(a: Account) {
    const { data, error } = await supabase.functions.invoke('social-credentials', {
      body: { action: 'reveal', account_id: a.id },
    });
    if (error) return toast.error(error.message);
    setRevealed((data as any).password);
    setTimeout(() => setRevealed(null), 15000);
  }

  async function removeCred(a: Account) {
    if (!confirm('Zugangsdaten für ' + a.platform + ' löschen?')) return;
    const { error } = await supabase.functions.invoke('social-credentials', { body: { action: 'delete', account_id: a.id } });
    if (error) return toast.error(error.message);
    toast.success('Gelöscht'); load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Plattformen & Zugangsdaten</h1>
        <Button asChild><Link to="/social/onboarding"><Plus className="mr-2 h-4 w-4" />Neuer Kunde</Link></Button>
      </div>

      {clients.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Noch keine Kunden — bitte Onboarding starten.</CardContent></Card>
      )}

      {clients.map(c => (
        <Card key={c.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{c.company_name}</CardTitle>
              <div className="text-sm text-muted-foreground">{c.contact_person}</div>
              <div className="mt-1 text-xs">
                {c.customer_id && linkedCustomers[c.customer_id] ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Link2 className="h-3 w-3" />
                    Alix-Kunde: {linkedCustomers[c.customer_id].company_name}
                    {linkedCustomers[c.customer_id].source_system && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">{linkedCustomers[c.customer_id].source_system}</Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nicht mit Alix-Kunde verknüpft</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setLinkClient(c)}>
                <Link2 className="mr-2 h-4 w-4" />{c.customer_id ? 'Ändern' : 'Verknüpfen'}
              </Button>
              <Badge variant={c.onboarding_status === 'completed' ? 'default' : 'secondary'}>{c.onboarding_status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {(accounts[c.id] ?? []).map(a => (
                <div key={a.id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.platform}</div>
                    <div className="text-xs text-muted-foreground">{a.username ?? 'kein Benutzer'} • {a.connected ? 'verbunden' : 'nicht verbunden'}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setOpenCred(a); setUsername(a.username ?? ''); }}><KeyRound className="h-4 w-4" /></Button>
                    {a.connected && <Button size="sm" variant="outline" onClick={() => reveal(a)}><Eye className="h-4 w-4" /></Button>}
                    {a.connected && <Button size="sm" variant="outline" onClick={() => removeCred(a)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
              {(accounts[c.id] ?? []).length === 0 && <div className="text-sm text-muted-foreground">Keine Plattformen konfiguriert.</div>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!openCred} onOpenChange={o => !o && setOpenCred(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zugangsdaten — {openCred?.platform}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Benutzername / E-Mail</Label><Input value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div><Label>Passwort</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="wird AES-256-GCM verschlüsselt" /></div>
            <Button className="w-full" onClick={storeCred}>Verschlüsselt speichern</Button>
            <p className="text-xs text-muted-foreground">OAuth wird sofern verfügbar bevorzugt. Passwörter werden serverseitig verschlüsselt (AES-256-GCM) und niemals im Klartext gespeichert.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealed} onOpenChange={o => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passwort (15 Sek. sichtbar)</DialogTitle></DialogHeader>
          <div className="p-4 bg-muted rounded font-mono break-all">{revealed}</div>
        </DialogContent>
      </Dialog>

      {linkClient && (
        <CustomerLinkDialog
          clientId={linkClient.id}
          currentCustomerId={linkClient.customer_id}
          onClose={() => setLinkClient(null)}
          onLinked={load}
        />
      )}
    </div>
  );
}
