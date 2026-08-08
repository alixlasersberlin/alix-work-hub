import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ListTodo, Plus, Phone, Mail, Ban, Gavel, RefreshCw, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const fmt = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n ?? 0));

const TYPE_ICON: Record<string, any> = {
  call: Phone, dunning: Mail, return_debit: RefreshCw, block: Ban, legal: Gavel, followup: CalendarClock,
};

const TYPE_LABEL: Record<string, string> = {
  call: 'Anrufen', dunning: 'Mahnung senden', return_debit: 'Rücklastschrift prüfen',
  block: 'Kreditlimit sperren', legal: 'Anwalt informieren', followup: 'Wiedervorlage',
};

export default function FinanceCollectTasks() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('call');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('collect_tasks' as any).select('*').eq('status', 'open').order('priority', { ascending: false }).order('due_date').limit(500);
    if (filter === 'today') q = q.lte('due_date', new Date().toISOString().slice(0, 10));
    const { data, error } = await q;
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const complete = async (id: string) => {
    const { error } = await supabase.from('collect_tasks' as any)
      .update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const postpone = async (id: string, days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    await supabase.from('collect_tasks' as any).update({ due_date: d.toISOString().slice(0, 10) }).eq('id', id);
    load();
  };

  const create = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('collect_tasks' as any)
      .insert({ title: title.trim(), task_type: type, source: 'manual' });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setTitle('');
    load();
  };

  const generate = async () => {
    const { error } = await supabase.functions.invoke('collect-engine', { body: { generate_tasks: true } });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Aufgaben aktualisiert' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aufgaben & Wiedervorlagen"
        subtitle="KI-priorisierte Maßnahmen für heute"
        icon={ListTodo}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/finance/collect">Command Center</Link></Button>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Heute fällig</SelectItem>
                <SelectItem value="all">Alle offenen</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={generate}><RefreshCw className="h-4 w-4 mr-2" />KI-Aufgaben erzeugen</Button>
          </div>
        }
      />

      <DataCard title="Neue Aufgabe">
        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Heute Herrn Müller anrufen" className="h-9 flex-1 min-w-64" />
          <Button size="sm" onClick={create} disabled={!title.trim()}><Plus className="h-4 w-4 mr-2" />Anlegen</Button>
        </div>
      </DataCard>

      <DataCard title={`Offene Aufgaben (${rows.length})`}>
        {loading ? <SkeletonTable /> : rows.length === 0 ? (
          <EmptyState icon={ListTodo} title="Keine offenen Aufgaben" description="Alles erledigt oder KI-Aufgaben noch nicht erzeugt." />
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const Icon = TYPE_ICON[t.task_type] ?? ListTodo;
              const overdue = t.due_date < new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {TYPE_LABEL[t.task_type] ?? t.task_type}
                        {t.customer_name ? ` · ${t.customer_name}` : ''}
                        {Number(t.amount) > 0 ? ` · ${fmt(t.amount)}` : ''}
                        {' · fällig '}{t.due_date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdue && <Badge variant="outline" className="border-red-500/30 bg-red-500/15 text-red-400">überfällig</Badge>}
                    <Badge variant="outline">Prio {t.priority}</Badge>
                    {t.case_id && <Button size="sm" variant="outline" asChild><Link to={`/finance/collect/${t.case_id}`}>Fall</Link></Button>}
                    <Select onValueChange={(v) => postpone(t.id, Number(v))}>
                      <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Verschieben" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Morgen</SelectItem>
                        <SelectItem value="3">3 Tage</SelectItem>
                        <SelectItem value="7">7 Tage</SelectItem>
                        <SelectItem value="30">30 Tage</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => complete(t.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Erledigt</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DataCard>
    </div>
  );
}
