import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Smartphone, RefreshCw, ListChecks, Phone } from 'lucide-react';
import { IphoneConnectDialog } from '@/components/mobile-sync/IphoneConnectDialog';
import { SCOPE_LABELS, SyncScope, previewContacts } from '@/lib/mobile-sync';
import { telHref } from '@/lib/mobil/utils';

export default function MobilKontakte() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<SyncScope>('none');
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: s } = await supabase.from('mobile_sync_settings').select('enabled, scope').eq('user_id', user.id).maybeSingle();
      setScope(((s?.scope as SyncScope) ?? 'none'));
      setEnabled(!!s?.enabled);
      const { data: d } = await supabase.from('mobile_sync_devices').select('last_sync_at').eq('user_id', user.id).eq('status', 'active').order('last_sync_at', { ascending: false }).limit(1);
      setLastSync(d?.[0]?.last_sync_at ?? null);
      if (s?.enabled) {
        const res = await previewContacts();
        setCount(res.count);
        setRows(res.contacts);
      }
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((c) =>
    !q || `${c.company_name ?? ''} ${c.contact_name ?? ''} ${c.phone ?? ''} ${c.email ?? ''} ${c.customer_no ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">Kontakte</h1>

      <Card className="p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'Sync aktiv' : 'Nicht freigegeben'}</Badge>
          <Badge variant="outline">{SCOPE_LABELS[scope]}</Badge>
          <Badge variant="outline">{count.toLocaleString('de-DE')} Kontakte</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Letzte Synchronisierung: {lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'nie'}
        </div>
      </Card>

      <Button className="w-full h-14 text-base" onClick={() => setOpen(true)} disabled={!enabled}>
        <Smartphone className="w-5 h-5 mr-2" /> iPhone verbinden
      </Button>
      <Button variant="outline" className="w-full h-12" onClick={load} disabled={busy}>
        <RefreshCw className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} /> Kontakte synchronisieren
      </Button>

      <div className="pt-2">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><ListChecks className="w-4 h-4" /> Meine freigegebenen Kontakte</div>
        <Input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="h-12" />
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.company_name || c.contact_name || 'Kunde'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[c.contact_name, c.customer_no, c.phone].filter(Boolean).join(' · ')}
              </div>
            </div>
            {c.phone && (
              <Button asChild size="icon" variant="outline"><a href={telHref(c.phone)}><Phone className="w-4 h-4" /></a></Button>
            )}
          </Card>
        ))}
        {enabled && filtered.length === 0 && <div className="text-sm text-muted-foreground">Keine Kontakte gefunden.</div>}
      </div>

      <IphoneConnectDialog open={open} onOpenChange={setOpen} email={profile?.email ?? ''} onCreated={load} />
    </div>
  );
}
