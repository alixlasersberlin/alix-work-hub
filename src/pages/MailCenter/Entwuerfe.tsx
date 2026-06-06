import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, Trash2, Edit3 } from 'lucide-react';

export default function MailCenterEntwuerfe() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('mail_messages')
      .select('id,subject,to_email,from_email,body_html,body_text,created_at,customer_id,order_id,template_id')
      .eq('status', 'draft')
      .eq('created_by', user?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Entwurf löschen?')) return;
    const { error } = await supabase.from('mail_messages').delete().eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  const edit = (m: any) => {
    navigate('/mailcenter/schreiben', { state: { draft: m } });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-display font-semibold text-foreground">Entwürfe</h2>
      <Card className="card-glow">
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lade…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 opacity-40 mb-3" />
              <p className="text-sm">Keine Entwürfe vorhanden.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {new Date(r.created_at).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell className="text-xs">{r.to_email}</TableCell>
                    <TableCell className="text-xs">{r.from_email}</TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{r.subject ?? '(leer)'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
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
