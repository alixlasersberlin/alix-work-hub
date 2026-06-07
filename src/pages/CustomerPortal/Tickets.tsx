import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };

export default function CustomerPortalTickets() {
  const ctx = useOutletContext<Ctx>();
  const [own, setOwn] = useState<any[]>([]);
  const [external, setExternal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Support');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from('customer_portal_tickets')
        .select('id, subject, category, status, priority, created_at, closed_at')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false }),
      supabase.from('tickets')
        .select('id, title, status, priority, created_at, device_name, serial_number')
        .order('created_at', { ascending: false }),
    ]);
    setOwn(a.data ?? []);
    setExternal(b.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ctx.customerId]);

  const create = async () => {
    if (!subject.trim()) return toast.error('Bitte Betreff angeben');
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('customer_portal_tickets').insert({
      customer_id: ctx.customerId,
      subject: subject.trim(),
      category,
      status: 'offen',
      priority: 'normal',
      created_by: user?.id ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success('Anfrage erstellt');
    setSubject(''); setBody(''); setCategory('Support');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Neue Anfrage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} className="md:col-span-2" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Wartung">Wartung anfragen</SelectItem>
                <SelectItem value="Rückruf">Rückruf</SelectItem>
                <SelectItem value="Reparatur">Reparatur</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Beschreibung (optional)" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <Button onClick={create} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Anfrage absenden
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meine Anfragen</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (own.length === 0 && external.length === 0) ? (
            <p className="text-center py-6 text-muted-foreground">Keine Anfragen.</p>
          ) : (
            <div className="space-y-2">
              {own.map((t) => (
                <div key={`o-${t.id}`} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <Badge variant={t.status === 'offen' ? 'default' : 'outline'}>{t.status}</Badge>
                </div>
              ))}
              {external.map((t) => (
                <div key={`e-${t.id}`} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.device_name ?? ''} {t.serial_number ? `· ${t.serial_number}` : ''} · {new Date(t.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <Badge variant="outline">{t.status ?? '—'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
