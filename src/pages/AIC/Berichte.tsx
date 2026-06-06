import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';

export default function AicBerichte() {
  const qc = useQueryClient();
  const [recipients, setRecipients] = useState('');
  const [kind, setKind] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [sending, setSending] = useState(false);

  const { data: reports } = useQuery({
    queryKey: ['aic', 'reports'],
    queryFn: async () => {
      const { data } = await supabase.from('aic_reports').select('id, kind, title, period_start, period_end, send_status, sent_at, recipients, created_at').order('created_at', { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const send = async () => {
    const rec = recipients.split(/[,;\s]+/).filter((s) => s.includes('@'));
    if (!rec.length) return toast.error('Bitte Empfänger angeben');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('aic-send-report', { body: { kind, recipients: rec, send: true } });
      if (error) throw error;
      toast.success(`Bericht ${data?.status === 'sent' ? 'versendet' : 'erzeugt'}`);
      qc.invalidateQueries({ queryKey: ['aic', 'reports'] });
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Bericht erzeugen & versenden</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Typ</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="block bg-background border border-border rounded px-3 py-2 text-sm">
              <option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option>
            </select>
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-muted-foreground">Empfänger (kommagetrennt)</label>
            <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="gf@alix-lasers.com, controlling@..." />
          </div>
          <Button onClick={send} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Senden
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Versendete Berichte</h2>
        {!reports?.length ? <p className="text-sm text-muted-foreground">Noch keine Berichte.</p> : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="p-3 border border-border rounded flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.period_start} – {r.period_end} · {r.recipients?.join(', ')}</div>
                </div>
                <Badge variant={r.send_status === 'sent' ? 'default' : r.send_status === 'failed' ? 'destructive' : 'outline'}>{r.send_status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
