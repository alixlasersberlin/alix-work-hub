import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link2, Link2Off, Plus, Search, Sparkles, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type SocialClient = {
  id: string;
  company_name: string;
  contact_person: string | null;
  onboarding_status: string;
};
type SocialAccount = { id: string; platform: string; username: string | null; connected: boolean };

export default function CustomerSocialMediaTab({
  customerId,
  customerName,
  customerEmail,
  customerPhone,
}: {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<SocialClient | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<SocialClient[]>([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from('social_clients')
      .select('id,company_name,contact_person,onboarding_status')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle();
    setClient((c as SocialClient) ?? null);
    if (c) {
      const { data: ac } = await supabase
        .from('social_accounts')
        .select('id,platform,username,connected')
        .eq('client_id', c.id)
        .is('deleted_at', null);
      setAccounts((ac ?? []) as SocialAccount[]);
    } else {
      setAccounts([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!pickerOpen) return;
      const term = q.trim();
      const query = supabase
        .from('social_clients')
        .select('id,company_name,contact_person,onboarding_status')
        .is('deleted_at', null)
        .is('customer_id', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (term.length >= 2) query.ilike('company_name', `%${term}%`);
      const { data } = await query;
      setCandidates((data ?? []) as SocialClient[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, pickerOpen]);

  async function linkExisting(clientId: string) {
    const { error } = await supabase.from('social_clients').update({ customer_id: customerId }).eq('id', clientId);
    if (error) return toast.error(error.message);
    toast.success('Social-Kunde verknüpft');
    setPickerOpen(false); setQ(''); load();
  }

  async function unlink() {
    if (!client) return;
    if (!confirm('Verknüpfung zum Social-Media-Kunden aufheben?')) return;
    const { error } = await supabase.from('social_clients').update({ customer_id: null }).eq('id', client.id);
    if (error) return toast.error(error.message);
    toast.success('Verknüpfung entfernt');
    load();
  }

  async function createFromCustomer() {
    setCreating(true);
    const { data, error } = await supabase
      .from('social_clients')
      .insert({
        customer_id: customerId,
        company_name: customerName,
        contact_person: customerEmail ?? null,
        email: customerEmail,
        phone: customerPhone,
        locations: [],
        corporate_colors: {},
        corporate_fonts: {},
        onboarding_status: 'in_progress',
        onboarding_step: 1,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success('Social-Kunde angelegt');
    if (data?.id) window.location.href = `/social/onboarding?client=${data.id}`;
    else load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Lädt…
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <Sparkles className="h-8 w-8 mx-auto text-primary/70" />
            <div>
              <h3 className="font-semibold">Noch keine Social-Media-Betreuung</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Diesen Kunden mit einem bestehenden Social-Media-Kunden verknüpfen oder neu anlegen.
              </p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />Bestehenden verknüpfen
              </Button>
              <Button onClick={createFromCustomer} disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Social-Kunde anlegen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setQ(''); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Social-Media-Kunde verknüpfen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firmenname suchen…" className="pl-9" />
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-border border border-border rounded-lg">
                {candidates.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">Keine freien Social-Kunden gefunden.</div>
                )}
                {candidates.map((c) => (
                  <button key={c.id} onClick={() => linkExisting(c.id)} className="w-full text-left p-3 hover:bg-muted/60 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.company_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.contact_person ?? '—'}</div>
                    </div>
                    <Badge variant="secondary">{c.onboarding_status}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Verknüpfter Social-Kunde</div>
            <div className="font-semibold text-lg">{client.company_name}</div>
            <div className="text-sm text-muted-foreground">{client.contact_person ?? '—'}</div>
            <Badge className="mt-2" variant={client.onboarding_status === 'completed' ? 'default' : 'secondary'}>
              {client.onboarding_status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/social/plattformen"><ExternalLink className="mr-2 h-4 w-4" />Plattformen</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/social/kalender"><ExternalLink className="mr-2 h-4 w-4" />Kalender</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to={`/social/onboarding?client=${client.id}`}><ExternalLink className="mr-2 h-4 w-4" />Onboarding</Link></Button>
            <Button variant="ghost" size="sm" onClick={unlink}><Link2Off className="mr-2 h-4 w-4" />Trennen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Plattformen ({accounts.length})</h3>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Plattformen konfiguriert.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => (
                <div key={a.id} className="border border-border rounded-lg p-3">
                  <div className="font-medium">{a.platform}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.username ?? 'kein Benutzer'} · {a.connected ? 'verbunden' : 'nicht verbunden'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
