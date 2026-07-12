import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Coverage { role: string; users: number; with_mfa: number; without_mfa: number }
interface Priv { user_id: string; role: string; email: string | null; full_name: string | null }
interface Stale { user_id: string; email: string | null; full_name: string | null; created_at: string; expires_at: string | null; ip_address: string | null }

export default function SecurityMfa() {
  const [cov, setCov] = useState<Coverage[]>([]);
  const [priv, setPriv] = useState<Priv[]>([]);
  const [stale, setStale] = useState<Stale[]>([]);

  useEffect(() => { (async () => {
    const [a, b, c] = await Promise.all([
      (supabase as any).from('security_scan_mfa_coverage').select('*'),
      (supabase as any).from('security_scan_privileged_no_mfa').select('*'),
      (supabase as any).from('security_scan_stale_sessions').select('*').order('created_at'),
    ]);
    setCov((a.data ?? []) as Coverage[]);
    setPriv((b.data ?? []) as Priv[]);
    setStale((c.data ?? []) as Stale[]);
  })(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            MFA-Abdeckung — {priv.length === 0 ? 'alle privilegierten Nutzer geschützt' : `${priv.length} privilegiert ohne MFA`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-left"><tr>
                <th className="p-2">Rolle</th>
                <th className="p-2 text-right">Nutzer</th>
                <th className="p-2 text-right">Mit MFA</th>
                <th className="p-2 text-right">Ohne MFA</th>
                <th className="p-2">Abdeckung</th>
              </tr></thead>
              <tbody>
                {cov.map(r => {
                  const pct = r.users ? Math.round((r.with_mfa / r.users) * 100) : 0;
                  const tone = r.without_mfa === 0
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : pct >= 50
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-red-500/15 text-red-300 border-red-500/40';
                  return (
                    <tr key={r.role} className="border-t">
                      <td className="p-2 font-medium">{r.role}</td>
                      <td className="p-2 text-right tabular-nums">{r.users}</td>
                      <td className="p-2 text-right tabular-nums">{r.with_mfa}</td>
                      <td className="p-2 text-right tabular-nums">{r.without_mfa}</td>
                      <td className="p-2"><Badge variant="outline" className={tone}>{pct}%</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privilegierte Nutzer ohne MFA — {priv.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {priv.length === 0 ? (
            <div className="text-sm text-emerald-400">Alle Nutzer mit erhöhten Rechten (Super Admin, Admin, Finance, Order, QM) haben MFA aktiviert.</div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-[12px]">
                <thead className="bg-muted/40 text-left"><tr>
                  <th className="p-2">Nutzer</th><th className="p-2">E-Mail</th><th className="p-2">Rolle</th>
                </tr></thead>
                <tbody>
                  {priv.map(p => (
                    <tr key={`${p.user_id}-${p.role}`} className="border-t">
                      <td className="p-2">{p.full_name ?? '—'}</td>
                      <td className="p-2 font-mono text-[11px]">{p.email ?? '—'}</td>
                      <td className="p-2"><Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">{p.role}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktive Sessions älter als 30 Tage — {stale.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {stale.length === 0 ? (
            <div className="text-sm text-emerald-400">Keine veralteten Sessions.</div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-[12px]">
                <thead className="bg-muted/40 text-left"><tr>
                  <th className="p-2">Nutzer</th><th className="p-2">Erstellt</th><th className="p-2">Ablauf</th><th className="p-2">IP</th>
                </tr></thead>
                <tbody>
                  {stale.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{s.full_name ?? s.email ?? s.user_id}</td>
                      <td className="p-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString('de-DE')}</td>
                      <td className="p-2 text-muted-foreground">{s.expires_at ? new Date(s.expires_at).toLocaleDateString('de-DE') : '—'}</td>
                      <td className="p-2 font-mono text-[11px]">{s.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
