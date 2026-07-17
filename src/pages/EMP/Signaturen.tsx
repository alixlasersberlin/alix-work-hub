import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSignature, ArrowLeft, ScanLine } from 'lucide-react';
import SignaturePad from '@/components/emp/SignaturePad';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type Req = {
  id: string;
  document_id: string;
  status: string;
  created_at: string;
  sig_documents?: { title: string } | null;
  sig_signers?: { id: string; email: string | null; name: string | null; signed_at: string | null }[];
};

export default function EmpSignaturen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'mine' | 'today' | 'all'>('mine');
  const [active, setActive] = useState<Req | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('sig_requests')
      .select('id, document_id, status, created_at, sig_documents(title), sig_signers(id, email, name, signed_at)')
      .in('status', ['versendet', 'geoeffnet', 'teilweise_signiert', 'neu'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      q = q.gte('created_at', today.toISOString());
    }
    const { data, error } = await q;
    if (error) toast.error(error.message);
    let list = (data ?? []) as any as Req[];
    if (filter === 'mine' && user?.email) {
      list = list.filter(r => (r.sig_signers ?? []).some(s => s.email === user.email));
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const submitSignature = async (dataUrl: string) => {
    if (!active) return;
    const mySigner = (active.sig_signers ?? []).find(s => s.email === user?.email && !s.signed_at)
      ?? (active.sig_signers ?? []).find(s => !s.signed_at);
    if (!mySigner) { toast.error('Kein offener Signer gefunden'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('sig-submit', {
        body: {
          request_id: active.id,
          signer_id: mySigner.id,
          signature_data_url: dataUrl,
          geo: await getGeo(),
          source: 'mobile',
        },
      });
      if (error) throw error;
      toast.success('Signatur übertragen');
      setActive(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Fehler beim Übertragen');
    } finally {
      setSaving(false);
    }
  };

  if (active) {
    const primary = (active.sig_signers ?? [])[0];
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <Card>
          <CardHeader><CardTitle className="text-base">{active.sig_documents?.title ?? 'Signatur'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Signer: {primary?.name || primary?.email || '—'}
            </div>
            <div className="border rounded-lg bg-muted/20">
              <SignaturePad onSave={submitSignature} label={saving ? 'Wird übertragen…' : 'Unterschrift bestätigen'} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" /> Signaturen
        </h1>
        <p className="text-xs text-muted-foreground">Offene Signaturaufträge für den Außendienst.</p>
      </div>

      <div className="flex gap-2">
        {(['mine', 'today', 'all'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'mine' ? 'Meine' : f === 'today' ? 'Heute' : 'Alle'}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.info('QR-Scan folgt')}>
          <ScanLine className="w-4 h-4 mr-1" /> QR
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> lädt …
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine offenen Signaturen.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const primary = (r.sig_signers ?? [])[0];
            return (
              <Card key={r.id} className="cursor-pointer active:scale-[.99] transition" onClick={() => setActive(r)}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.sig_documents?.title ?? 'Dokument'}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {primary?.name || primary?.email || '—'} · {new Date(r.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{r.status}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 3000, maximumAge: 60000 }
    );
  });
}
