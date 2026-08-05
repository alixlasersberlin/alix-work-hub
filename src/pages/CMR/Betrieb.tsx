import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Link as LinkIcon, Mail, Ban, RotateCcw, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant } from '@/hooks/useCmrTenant';
import CmrReadOnlyBanner from '@/components/cmr/CmrReadOnlyBanner';

type Token = {
  id: string; customer_id: string | null; customer_name: string | null; customer_email: string | null;
  token: string; expires_at: string | null; is_active: boolean;
  last_access_at: string | null; access_count: number; created_at: string;
};

type Run = {
  id: string; job: string; status: string; started_at: string; finished_at: string | null;
  processed: number; skipped: number; failed: number; message: string | null;
};

const JOB_LABEL: Record<string, string> = {
  'cmr-recurring-run': 'Abo-Lauf',
  'cmr-collective-run': 'Sammelabrechnung',
  'cmr-dunning-run': 'Mahnlauf',
  'cmr-bank-automatch': 'Bankabgleich',
};

/**
 * CMR Betrieb: Verwaltung der Kundenportal-Zugänge und Protokoll der automatischen Läufe.
 */
export default function CmrBetrieb() {
  const { tenantId, loading, canWrite } = useCmrTenant();
  const [tab, setTab] = useState<'portale' | 'laeufe'>('portale');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('cmr_portal_tokens' as any).select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('cmr_job_runs' as any).select('*')
        .order('started_at', { ascending: false }).limit(200),
    ]);
    setTokens(((t as any) || []) as Token[]);
    setRuns(((r as any) || []) as Run[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const portalUrl = (t: Token) => `${window.location.origin}/cmr-portal/${t.token}`;

  const copy = async (t: Token) => {
    try { await navigator.clipboard.writeText(portalUrl(t)); toast.success('Link kopiert'); }
    catch { toast.error('Kopieren nicht möglich'); }
  };

  const setActive = async (t: Token, active: boolean) => {
    const { error } = await supabase.from('cmr_portal_tokens' as any)
      .update({ is_active: active }).eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success(active ? 'Zugang wieder aktiv' : 'Zugang widerrufen');
    load();
  };

  const invite = async (t: Token) => {
    setSending(t.id);
    const { data, error } = await supabase.functions.invoke('cmr-portal-invite', {
      body: { tokenId: t.id, portalUrl: portalUrl(t), to: t.customer_email },
    });
    setSending(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Portal-Link per E-Mail versendet');
    load();
  };

  const list = tokens.filter((t) =>
    !q || `${t.customer_name ?? ''} ${t.customer_email ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {!canWrite && <CmrReadOnlyBanner />}
      <PageHeader
        title="CMR Betrieb"
        subtitle="Kundenportal-Zugänge verwalten und automatische Läufe nachvollziehen."
      />

      <div className="flex gap-2">
        {(['portale', 'laeufe'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t === 'portale' ? 'Portal-Zugänge' : 'Laufprotokoll'}
          </Button>
        ))}
      </div>

      {tab === 'portale' && (
        <>
          <Input placeholder="Kunde oder E-Mail suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <Card className="divide-y">
            {list.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <LinkIcon className="w-5 h-5" /> Noch keine Portal-Zugänge vergeben.
              </div>
            )}
            {list.map((t) => (
              <div key={t.id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.customer_name ?? 'Ohne Namen'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.customer_email ?? 'keine E-Mail'} · {t.access_count} Aufruf(e)
                    {t.last_access_at ? ` · zuletzt ${new Date(t.last_access_at).toLocaleString('de-DE')}` : ''}
                    {t.expires_at ? ` · gültig bis ${new Date(t.expires_at).toLocaleDateString('de-DE')}` : ''}
                  </div>
                </div>
                <Badge variant="outline" className={t.is_active ? 'border-emerald-500/40 text-emerald-500' : 'border-red-500/40 text-red-500'}>
                  {t.is_active ? 'aktiv' : 'widerrufen'}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => copy(t)}><LinkIcon className="w-4 h-4" /></Button>
                <Button
                  size="sm" variant="ghost" disabled={!canWrite || !t.is_active || sending === t.id}
                  onClick={() => invite(t)}
                >
                  {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" disabled={!canWrite} onClick={() => setActive(t, !t.is_active)}>
                  {t.is_active ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'laeufe' && (
        <Card className="divide-y">
          {runs.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Activity className="w-5 h-5" /> Noch keine Läufe protokolliert.
            </div>
          )}
          {runs.map((r) => (
            <div key={r.id} className="p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{JOB_LABEL[r.job] ?? r.job}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.started_at).toLocaleString('de-DE')}
                  {r.message ? ` · ${r.message}` : ''}
                </div>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {r.processed} verarbeitet · {r.skipped} übersprungen · {r.failed} Fehler
              </div>
              <Badge
                variant="outline"
                className={r.failed > 0 || r.status !== 'ok'
                  ? 'border-red-500/40 text-red-500'
                  : 'border-emerald-500/40 text-emerald-500'}
              >
                {r.failed > 0 || r.status !== 'ok' ? 'Fehler' : 'ok'}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
