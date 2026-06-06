import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Row { id: string; to_email: string; subject: string; status: string; error_message: string | null; created_at: string; created_by: string | null; }

export default function Fehlerprotokoll() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('mail_messages')
      .select('id,to_email,subject,status,error_message,created_at,created_by')
      .in('status', ['failed', 'bounced', 'error'])
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /><h2 className="text-xl font-semibold">Fehlerprotokoll</h2></div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Zeitpunkt</th>
                <th className="p-3">Empfänger</th>
                <th className="p-3">Betreff</th>
                <th className="p-3">Bereich</th>
                <th className="p-3">Fehler</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="p-3">{r.to_email}</td>
                  <td className="p-3 max-w-xs truncate">{r.subject}</td>
                  <td className="p-3">E-Mail-Versand</td>
                  <td className="p-3 text-xs text-red-500 max-w-md truncate">{r.error_message || '—'}</td>
                  <td className="p-3"><Badge variant="outline" className="bg-red-500/15 text-red-500">{r.status}</Badge></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine Fehler</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
