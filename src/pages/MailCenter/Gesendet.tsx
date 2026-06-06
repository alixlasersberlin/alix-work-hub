import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Send, RefreshCw } from 'lucide-react';

const MAILBOX_LABEL: Record<string, string> = {
  finance: 'Finance', vertrieb: 'Vertrieb', service: 'Service',
  marketing: 'Marketing', personal: 'Persönlich',
};

export default function MailCenterGesendet() {
  const { isAdmin, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [mailbox, setMailbox] = useState('all');
  const [search, setSearch] = useState('');

  const allowedMailboxes = useMemo(() => {
    if (isAdmin || hasRole('Geschäftsführung')) {
      return ['finance', 'vertrieb', 'service', 'marketing', 'personal'];
    }
    const arr: string[] = ['personal'];
    if (hasRole('Finance')) arr.push('finance');
    if (hasRole('Vertrieb') || hasRole('Order')) arr.push('vertrieb');
    if (hasRole('Technik') || hasRole('Kundenservice') || hasRole('Reparaturannahme')) arr.push('service');
    if (hasRole('Marketing')) arr.push('marketing');
    return Array.from(new Set(arr));
  }, [isAdmin, hasRole]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('mail_messages')
      .select('id,subject,from_email,to_email,status,mailbox,sent_at,customers(company_name,contact_name)')
      .eq('direction', 'outbound')
      .neq('status', 'draft')
      .order('sent_at', { ascending: false })
      .limit(300);
    if (mailbox !== 'all') q = q.eq('mailbox', mailbox);
    else q = q.in('mailbox', allowedMailboxes);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [mailbox, allowedMailboxes.join(',')]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${r.subject ?? ''} ${r.to_email ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Gesendet</h2>
          <p className="text-sm text-muted-foreground">Versendete E-Mails aller Postfächer.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
        </Button>
      </div>
      <Card className="card-glow">
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={mailbox} onValueChange={setMailbox}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Postfächer</SelectItem>
                {allowedMailboxes.map(m => <SelectItem key={m} value={m}>{MAILBOX_LABEL[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Suche…" className="max-w-sm" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lade…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Send className="w-10 h-10 opacity-40 mb-3" />
              <p className="text-sm">Keine gesendeten Mails.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Postfach</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{r.from_email}</TableCell>
                    <TableCell className="text-xs">{r.to_email}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate">{r.subject}</TableCell>
                    <TableCell className="text-xs">{r.customers?.company_name ?? r.customers?.contact_name ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline">{MAILBOX_LABEL[r.mailbox] ?? '—'}</Badge></TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
