import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldAlert, ShieldOff, Smartphone, Search, RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import ReauthDialog from '@/components/ReauthDialog';
import { useReauthGate } from '@/hooks/useReauthGate';

interface Device {
  id: string;
  user_id: string;
  platform: string | null;
  device_name: string | null;
  os: string | null;
  browser: string | null;
  app_version: string | null;
  ip_hint: string | null;
  approval_status: 'pending' | 'approved' | 'blocked';
  approved_at: string | null;
  blocked_at: string | null;
  block_reason: string | null;
  last_seen_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

/**
 * Admin-Seite zur Verwaltung aller registrierten Push-Geräte / PWA-Installationen.
 * Nur Super Admin & Admin dürfen hier landen (RLS + Route-Guard außerhalb).
 */
export default function GeraeteVerwaltung() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('mobile_push_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); setLoading(false); return; }
    // Nutzerdaten dazu holen
    const ids = Array.from(new Set(((data as Device[]) || []).map(d => d.user_id)));
    let profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: pf } = await (supabase as any)
        .from('user_profiles').select('id,email,full_name').in('id', ids);
      profiles = Object.fromEntries((pf || []).map((p: any) => [p.id, p]));
    }
    setDevices((data as Device[]).map(d => ({
      ...d,
      user_email: profiles[d.user_id]?.email,
      user_name: profiles[d.user_id]?.full_name,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (d: Device, status: 'approved' | 'blocked' | 'pending', reason?: string) => {
    const patch: any = { approval_status: status };
    const { data: { user } } = await supabase.auth.getUser();
    if (status === 'approved') { patch.approved_at = new Date().toISOString(); patch.approved_by = user?.id; patch.blocked_at = null; patch.blocked_by = null; patch.block_reason = null; }
    if (status === 'blocked')  { patch.blocked_at = new Date().toISOString(); patch.blocked_by = user?.id; patch.block_reason = reason || null; }
    if (status === 'pending')  { patch.approved_at = null; patch.approved_by = null; patch.blocked_at = null; patch.blocked_by = null; }
    const { error } = await (supabase as any).from('mobile_push_subscriptions').update(patch).eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Gerät freigegeben' : status === 'blocked' ? 'Gerät gesperrt' : 'Status zurückgesetzt');
    load();
  };

  const filtered = devices.filter(d => {
    if (filter !== 'all' && d.approval_status !== filter) return false;
    if (!q) return true;
    const hay = `${d.user_email || ''} ${d.user_name || ''} ${d.device_name || ''} ${d.os || ''} ${d.browser || ''} ${d.ip_hint || ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const stats = {
    pending: devices.filter(d => d.approval_status === 'pending').length,
    approved: devices.filter(d => d.approval_status === 'approved').length,
    blocked: devices.filter(d => d.approval_status === 'blocked').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Smartphone className="h-6 w-6" /> Gerätefreigabe</h1>
          <p className="text-sm text-muted-foreground">Registrierte PWA-Installationen und Push-Geräte. Zero-Trust: gesperrte Geräte können keine Kalenderdaten mehr empfangen.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Neu laden
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Gesamt"      value={devices.length}     onClick={() => setFilter('all')}      active={filter==='all'} />
        <StatCard label="Ausstehend"  value={stats.pending}      onClick={() => setFilter('pending')}  active={filter==='pending'}  variant="warn" />
        <StatCard label="Freigegeben" value={stats.approved}     onClick={() => setFilter('approved')} active={filter==='approved'} variant="ok" />
        <StatCard label="Gesperrt"    value={stats.blocked}      onClick={() => setFilter('blocked')}  active={filter==='blocked'}  variant="err" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Nutzer, Gerät, OS, Browser, IP …" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map(d => (
          <Card key={d.id} className="p-3 md:p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2">
                  <StatusBadge s={d.approval_status} />
                  <span className="font-semibold text-sm">{d.user_name || d.user_email || d.user_id.slice(0,8)}</span>
                  {d.user_email && d.user_name && <span className="text-xs text-muted-foreground">· {d.user_email}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {d.device_name || d.platform || 'Gerät'} · {d.os || '—'} · {d.browser || '—'}
                  {d.app_version ? ` · v${d.app_version}` : ''}
                  {d.ip_hint ? ` · IP ${d.ip_hint}` : ''}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Registriert {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: de })}
                  {d.last_seen_at ? ` · zuletzt aktiv ${formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: de })}` : ''}
                  {d.block_reason ? ` · Grund: ${d.block_reason}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.approval_status !== 'approved' && (
                  <Button size="sm" onClick={() => setStatus(d, 'approved')}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Freigeben
                  </Button>
                )}
                {d.approval_status !== 'blocked' && (
                  <Button size="sm" variant="destructive" onClick={() => {
                    const reason = prompt('Sperr-Grund (optional):') || undefined;
                    setStatus(d, 'blocked', reason);
                  }}>
                    <ShieldOff className="h-3.5 w-3.5 mr-1" /> Sperren
                  </Button>
                )}
                {d.approval_status !== 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(d, 'pending')}>
                    Zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!loading && !filtered.length && (
          <div className="text-center text-sm text-muted-foreground py-8">Keine Geräte im aktuellen Filter.</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, onClick, active, variant }: { label: string; value: number; onClick: () => void; active: boolean; variant?: 'ok'|'warn'|'err' }) {
  const color = variant === 'ok' ? 'text-emerald-500' : variant === 'warn' ? 'text-amber-500' : variant === 'err' ? 'text-red-500' : '';
  return (
    <button onClick={onClick} className={`text-left rounded-lg border p-3 transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

function StatusBadge({ s }: { s: Device['approval_status'] }) {
  if (s === 'approved') return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Freigegeben</Badge>;
  if (s === 'blocked')  return <Badge className="bg-red-500/15 text-red-500 border-red-500/30"><ShieldOff className="h-3 w-3 mr-1" />Gesperrt</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30"><ShieldAlert className="h-3 w-3 mr-1" />Ausstehend</Badge>;
}
