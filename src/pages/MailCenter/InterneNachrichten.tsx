import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Send, Users } from 'lucide-react';

const DEPARTMENTS = ['finance', 'vertrieb', 'service', 'marketing'];
const DEPT_LABEL: Record<string, string> = {
  finance: 'Finance', vertrieb: 'Vertrieb', service: 'Service', marketing: 'Marketing',
};

export default function MailCenterInternal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [recipientType, setRecipientType] = useState<'user' | 'department'>('user');
  const [recipientUser, setRecipientUser] = useState('');
  const [recipientDept, setRecipientDept] = useState('finance');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('mail_internal_messages')
      .select('*').order('created_at', { ascending: false }).limit(200);
    setMessages(data ?? []);
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('user_profiles')
      .select('id, email, full_name').eq('is_active', true).order('full_name');
    setUsers(data ?? []);
  };

  useEffect(() => { load(); loadUsers(); }, []);

  const send = async () => {
    if (!body.trim()) {
      toast({ title: 'Nachricht fehlt', variant: 'destructive' });
      return;
    }
    setSending(true);
    const payload: any = {
      sender_id: user?.id,
      subject: subject || null,
      body,
    };
    if (recipientType === 'user') payload.recipient_user_id = recipientUser;
    else payload.recipient_department = recipientDept;

    const { data, error } = await supabase.from('mail_internal_messages').insert(payload).select().single();
    setSending(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }

    // create notifications for recipient(s)
    if (recipientType === 'user' && recipientUser) {
      await supabase.from('mail_notifications').insert({
        user_id: recipientUser,
        type: 'internal_message',
        title: 'Neue interne Nachricht',
        body: subject || body.slice(0, 80),
        link: '/mailcenter/intern',
      });
    } else if (recipientType === 'department') {
      const roleMap: Record<string, string[]> = {
        finance: ['Finance'], vertrieb: ['Vertrieb', 'Order'],
        service: ['Technik', 'Kundenservice', 'Reparaturannahme'],
        marketing: ['Marketing'],
      };
      const { data: rows } = await supabase
        .from('user_roles').select('user_id, roles!inner(name)')
        .in('roles.name', roleMap[recipientDept] ?? []);
      const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
      if (userIds.length) {
        await supabase.from('mail_notifications').insert(
          userIds.map(uid => ({
            user_id: uid,
            type: 'internal_message',
            title: `Neue interne Nachricht an ${DEPT_LABEL[recipientDept]}`,
            body: subject || body.slice(0, 80),
            link: '/mailcenter/intern',
          })),
        );
      }
    }

    toast({ title: 'Nachricht gesendet' });
    setSubject(''); setBody(''); setRecipientUser('');
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Interne Nachrichten</h2>
        <p className="text-sm text-muted-foreground">
          In-App Nachrichten an Kollegen oder ganze Abteilungen. Kunden sehen diese nie.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-glow">
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4" /> Neue Nachricht
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant={recipientType === 'user' ? 'default' : 'outline'}
                onClick={() => setRecipientType('user')}>An Benutzer</Button>
              <Button size="sm" variant={recipientType === 'department' ? 'default' : 'outline'}
                onClick={() => setRecipientType('department')}>An Abteilung</Button>
            </div>
            {recipientType === 'user' ? (
              <div>
                <Label>Empfänger</Label>
                <Select value={recipientUser} onValueChange={setRecipientUser}>
                  <SelectTrigger><SelectValue placeholder="Benutzer wählen" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Abteilung</Label>
                <Select value={recipientDept} onValueChange={setRecipientDept}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{DEPT_LABEL[d]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Betreff</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Nachricht</Label>
              <Textarea rows={6} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <Button onClick={send} disabled={sending} className="w-full">
              {sending ? 'Sende…' : 'Senden'}
            </Button>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardContent className="pt-6 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Verlauf
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Lade…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Nachrichten.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {messages.map(m => (
                  <div key={m.id} className="p-3 rounded border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">
                        {m.recipient_department
                          ? <><Users className="w-3 h-3 mr-1 inline" />{DEPT_LABEL[m.recipient_department]}</>
                          : 'Direktnachricht'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString('de-DE')}
                      </span>
                    </div>
                    {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
