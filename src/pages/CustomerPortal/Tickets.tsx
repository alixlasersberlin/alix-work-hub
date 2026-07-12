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

type Department = {
  id: string; name: string; color: string; allow_customer_pick_person: boolean;
};

export default function CustomerPortalTickets() {
  const ctx = useOutletContext<Ctx>();
  const [own, setOwn] = useState<any[]>([]);
  const [external, setExternal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Support');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [priority, setPriority] = useState('Normal');
  const [desiredResponse, setDesiredResponse] = useState('');
  const [desiredAppointment, setDesiredAppointment] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const load = async () => {
    setLoading(true);
    const [a, b, d] = await Promise.all([
      supabase.from('customer_portal_tickets')
        .select('id, subject, category, status, priority, created_at, closed_at')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false }),
      supabase.from('tickets')
        .select('id, title, status, priority, created_at, device_name, serial_number, ticket_number')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('ticket_departments')
        .select('id, name, color, allow_customer_pick_person')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    setOwn(a.data ?? []);
    setExternal(b.data ?? []);
    setDepartments((d.data ?? []) as Department[]);
    if (!departmentId && d.data?.length) setDepartmentId((d.data[0] as any).id);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ctx.customerId]);

  const create = async () => {
    if (!subject.trim()) return toast.error('Bitte Betreff angeben');
    if (!departmentId) return toast.error('Bitte Abteilung wählen');
    setSending(true);
    const dept = departments.find(x => x.id === departmentId);

    // Zentral als „echtes" Ticket in public.tickets speichern (via Edge Function mit Service-Role).
    const { data: { user } } = await supabase.auth.getUser();
    const { data: cust } = await supabase.from('customers')
      .select('email, contact_name, company_name, phone')
      .eq('id', ctx.customerId).maybeSingle();

    const { error: fnErr } = await supabase.functions.invoke('public-book-ticket', {
      body: {
        firstName: (cust?.contact_name ?? '').split(' ')[0] || 'Kunde',
        lastName: (cust?.contact_name ?? '').split(' ').slice(1).join(' '),
        email: cust?.email ?? '',
        phone: cust?.phone ?? '',
        company: cust?.company_name ?? '',
        service: category,
        department: dept?.name ?? '',
        message: [
          body,
          desiredResponse ? `\nGewünschte Rückmeldung: ${desiredResponse}` : '',
          desiredAppointment ? `Gewünschter Termin: ${new Date(desiredAppointment).toLocaleString('de-DE')}` : '',
        ].filter(Boolean).join('\n'),
        bookingNumber: null,
      },
    });

    // Zusätzlich Portal-Sicht (customer_portal_tickets) — für Verlauf im Portal
    await supabase.from('customer_portal_tickets').insert({
      customer_id: ctx.customerId,
      subject: subject.trim(),
      category,
      status: 'offen',
      priority: priority.toLowerCase(),
      created_by: user?.id ?? null,
    });

    setSending(false);
    if (fnErr) return toast.error(fnErr.message);
    toast.success('Ticket erstellt — die zuständige Abteilung wurde benachrichtigt.');
    setSubject(''); setBody(''); setDesiredResponse(''); setDesiredAppointment(''); setCategory('Support');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Neues Ticket</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} className="md:col-span-2" />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Niedrig">Niedrig</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Hoch">Hoch</SelectItem>
                <SelectItem value="Kritisch">Kritisch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Abteilung" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded" style={{ background: d.color }} />
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Wartung">Wartung anfragen</SelectItem>
                <SelectItem value="Rückruf">Rückruf</SelectItem>
                <SelectItem value="Reparatur">Reparatur</SelectItem>
                <SelectItem value="Termin">Termin vereinbaren</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Gewünschte Rückmeldung (z. B. Anruf morgens)" value={desiredResponse} onChange={(e) => setDesiredResponse(e.target.value)} />
            <Input type="datetime-local" placeholder="Gewünschter Termin" value={desiredAppointment} onChange={(e) => setDesiredAppointment(e.target.value)} />
          </div>
          <Textarea placeholder="Beschreibung" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          <Button onClick={create} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Ticket absenden
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
                    <p className="font-medium">{t.title ?? t.ticket_number}</p>
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
